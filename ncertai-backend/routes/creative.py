from pathlib import Path
import os
import shutil
import subprocess
import tempfile
import json
import base64
import re
import sys

from fastapi import APIRouter, HTTPException, Header
from fastapi.responses import StreamingResponse, FileResponse
from typing import Optional
from PIL import Image, ImageDraw, ImageFont

from models.schemas import VideoStoryboardRequest, MindmapRequest, VideoRenderPackageRequest
from services.openrouter import ask_openrouter_stream, ask_openrouter
from services.video_generator import HighQualityVideoGenerator
from services.database import get_username_by_token

router = APIRouter()


def _ck12_response_headers(source_url: Optional[str]) -> dict[str, str]:
    headers: dict[str, str] = {}
    source = str(source_url or "").strip()
    if not source:
        return headers
    lowered = source.lower()
    if "ck12.org" not in lowered and "flexbooks.ck12.org" not in lowered:
        return headers

    # Option 1 from CK-12 guidance: prevent indexing on pages carrying CK-12 sourced content.
    headers["X-Robots-Tag"] = "noindex"
    # Keep canonical/source discoverable for compliant attribution flows.
    headers["X-Source-Url"] = source
    headers["Link"] = f'<{source}>; rel="canonical"'
    return headers


def _normalize_video_request_topic(request: VideoRenderPackageRequest | VideoStoryboardRequest):
    effective_topic = str((request.topic or request.chapter or request.subject or "Core Concept")).strip()
    if effective_topic:
        return request.model_copy(update={"topic": effective_topic})
    return request


def _extract_token(authorization: Optional[str]) -> str:
    if not authorization:
        return ""
    parts = authorization.split(" ", 1)
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1].strip()
    return authorization.strip()


def _require_request_fields(payload: dict, fields: list[str]):
    missing = [field for field in fields if not str(payload.get(field) or "").strip()]
    if missing:
        missing_text = ", ".join(missing)
        raise HTTPException(status_code=422, detail=f"Please specify mandatory field(s): {missing_text}")


def _load_font(size: int, bold: bool = False):
    candidates = [
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/segoeui.ttf",
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size=size)
            except Exception:
                continue
    return ImageFont.load_default()


def _wrap_text(text: str, max_chars: int = 42):
    words = text.split()
    lines: list[str] = []
    current = []
    for word in words:
        tentative = " ".join(current + [word])
        if len(tentative) > max_chars and current:
            lines.append(" ".join(current))
            current = [word]
        else:
            current.append(word)
    if current:
        lines.append(" ".join(current))
    return lines


def _clean_bullet(text: str, fallback: str, topic: str):
    cleaned = re.sub(r'^[\s\-•\d\.]+', '', str(text or '')).strip()
    lowered = cleaned.lower()
    if not cleaned:
        return fallback
    prompt_like = (
        lowered.startswith('explain ')
        or lowered.startswith('show ')
        or lowered.startswith('add ')
        or lowered.startswith('use ')
        or lowered.startswith('write ')
        or lowered.startswith('create ')
        or lowered.startswith('describe ')
        or lowered.startswith('mention ')
        or lowered.startswith('include ')
        or lowered.startswith('list ')
        or lowered.startswith('make ')
        or 'prompt' in lowered
        or 'visual' in lowered and 'topic' not in lowered
    )
    if prompt_like:
        return fallback
    if len(cleaned) > 92:
        cleaned = cleaned[:89].rstrip() + '...'
    if topic.lower() not in lowered and len(cleaned.split()) <= 3:
        return f'{topic}: {cleaned}'
    return cleaned


def _render_slide(path: Path, title: str, subtitle: str, bullets: list[str], accent: tuple[int, int, int], footer: str, hero: bool = False):
    width, height = 1280, 720
    image = Image.new("RGB", (width, height), (248, 250, 252))
    draw = ImageDraw.Draw(image)

    draw.rectangle([0, 0, width, 132 if hero else 120], fill=accent)
    draw.rectangle([0, 120, width, height], fill=(248, 250, 252))
    draw.rounded_rectangle([64, 160, 1216, 648], radius=36, fill=(255, 255, 255), outline=(229, 231, 235), width=3)

    title_font = _load_font(58 if hero else 44, bold=True)
    subtitle_font = _load_font(28 if hero else 26)
    bullet_font = _load_font(28)
    footer_font = _load_font(20)

    title_lines = _wrap_text(title[:72], 22 if hero else 44)
    title_y = 28 if hero else 36
    for line_index, line in enumerate(title_lines[:2]):
        draw.text((64, title_y + line_index * (42 if hero else 34)), line, fill=(255, 255, 255), font=title_font)
    draw.text((72, 186), subtitle[:120], fill=(31, 41, 55), font=subtitle_font)

    y = 252 if hero else 250
    for bullet in bullets[:5]:
        wrapped = _wrap_text(bullet, 52)
        draw.rounded_rectangle([78, y, 1186, y + 72 + 24 * (len(wrapped) - 1)], radius=18, fill=(244, 250, 248), outline=(203, 213, 225), width=2)
        draw.text((102, y + 18), "•", fill=accent, font=bullet_font)
        text_y = y + 12
        for idx, line in enumerate(wrapped):
            draw.text((140, text_y + idx * 26), line, fill=(51, 65, 85), font=bullet_font)
        y += 92 + 24 * (len(wrapped) - 1)

    draw.text((72, 656), footer, fill=(100, 116, 139), font=footer_font)
    image.save(path)


def _parse_json_block(raw: str) -> dict:
    text = (raw or '').strip()
    if text.startswith('```'):
        parts = text.split('```')
        for part in parts:
            candidate = part.strip()
            if not candidate:
                continue
            if candidate.startswith('json'):
                candidate = candidate[4:].strip()
            try:
                return json.loads(candidate)
            except Exception:
                continue
    return json.loads(text)


def _extract_code_block(markdown: str, language: str = "python") -> str:
    text = markdown or ""
    pattern = rf"```{language}\s*([\s\S]*?)```"
    match = re.search(pattern, text, flags=re.IGNORECASE)
    if match:
        return match.group(1).strip()
    # Fallback: if the whole response appears to be code-like.
    if "class " in text and "Scene" in text:
        return text.strip()
    return ""


def _extract_scene_name(script: str) -> str:
    match = re.search(r"class\s+([A-Za-z_][A-Za-z0-9_]*)\s*\((?:Scene|ThreeDScene|MovingCameraScene)\)", script)
    if match:
        return match.group(1)
    return "MainScene"


def _is_safe_manim_script(script: str) -> bool:
    lowered = script.lower()
    blocked_tokens = [
        "import os",
        "import subprocess",
        "import socket",
        "import requests",
        "from os",
        "from subprocess",
        "eval(",
        "exec(",
        "open(",
        "__import__",
    ]
    return not any(token in lowered for token in blocked_tokens)


async def _make_video_with_manim(request: VideoRenderPackageRequest) -> tuple[Path, str]:
    temp_dir = Path(tempfile.mkdtemp(prefix="clarity_manim_"))
    script_path = temp_dir / "scene.py"

    prompt = (
        f"Create a render-ready Manim package for a Class {request.class_num} {request.subject} lesson. "
        f"Chapter: {request.chapter}. Topic: {request.topic}. Duration: {request.duration_seconds}s. "
        f"Style: {request.style}.\n\n"
        "Return markdown with exact sections:\n"
        "## Manim Script\n"
        "```python\n# full runnable manim file\n```\n"
        "## Voiceover Script\n"
        "## Subtitle SRT\n"
        "## Render Commands\n"
        "Keep visuals educational, factual, and board-exam aligned."
    )

    content = await ask_openrouter(
        [
            {
                "role": "system",
                "content": (
                    "You are an educational video engineer. Produce accurate, runnable Manim scripts. "
                    "Use only standard Manim and avoid external libraries."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        task_type="smart",
    )

    script = _extract_code_block(content, "python")
    if not script:
        raise HTTPException(status_code=500, detail="Manim script extraction failed.")
    if not _is_safe_manim_script(script):
        raise HTTPException(status_code=500, detail="Generated Manim script failed safety checks.")

    scene_name = _extract_scene_name(script)
    script_path.write_text(script, encoding="utf-8")

    manim_bin = shutil.which("manim")
    commands = []
    if manim_bin:
        commands.append([manim_bin, "-qm", str(script_path), scene_name])
    commands.append([sys.executable, "-m", "manim", "-qm", str(script_path), scene_name])

    last_error = ""
    for cmd in commands:
        result = subprocess.run(cmd, cwd=str(temp_dir), capture_output=True, text=True)
        if result.returncode == 0:
            videos = sorted(temp_dir.rglob("*.mp4"), key=lambda p: p.stat().st_mtime, reverse=True)
            if videos:
                return videos[0], "manim"
        last_error = (result.stderr or "")[-700:]

    raise HTTPException(status_code=500, detail=f"Manim render failed: {last_error}")


async def _build_topic_slides(request: VideoRenderPackageRequest):
    prompt = (
        f"Create topic-accurate educational slide content for Class {request.class_num} {request.subject}. "
        f"Chapter: {request.chapter}. Topic: {request.topic}.\n"
        "Return only valid JSON (no markdown) with this exact shape:\n"
        "{\n"
        '  "video_title": "string",\n'
        '  "scene_subtitle": "string",\n'
        '  "slides": [\n'
        "    {\n"
        '      "title": "string",\n'
        '      "subtitle": "string",\n'
        '      "bullets": ["string", "string", "string"],\n'
        '      "footer": "string"\n'
        "    }\n"
        "  ]\n"
        "}\n"
        "Rules: exactly 4 slides; bullets must be concrete teaching points (not instructions); "
        "avoid generic phrases like 'explain concept' or 'add example'; keep each bullet <= 14 words."
    )

    messages = [
        {
            "role": "system",
            "content": (
                "You are an accurate CBSE content designer. "
                "Provide concise, factual and exam-relevant teaching points."
            ),
        },
        {"role": "user", "content": prompt},
    ]

    try:
        raw = await ask_openrouter(messages, task_type="smart")
        parsed = _parse_json_block(raw)
        video_title = str(parsed.get("video_title", f"{request.subject}: {request.topic}"))[:72] if isinstance(parsed, dict) else f"{request.subject}: {request.topic}"
        scene_subtitle = str(parsed.get("scene_subtitle", f"Class {request.class_num} • {request.chapter}"))[:120] if isinstance(parsed, dict) else f"Class {request.class_num} • {request.chapter}"
        slides = parsed.get("slides", []) if isinstance(parsed, dict) else []
        if not isinstance(slides, list) or len(slides) < 4:
            raise ValueError("Incomplete slides")

        accent_palette = [
            (29, 158, 117),
            (14, 116, 144),
            (217, 119, 6),
            (37, 99, 235),
        ]
        result = []
        hero_bullets = [
            f"Topic focus: {request.topic}.",
            f"Chapter context: {request.chapter}.",
            "Start with the core definition and one board-style takeaway.",
        ]
        result.append((video_title, scene_subtitle, hero_bullets, accent_palette[0], "Lesson overview"))

        for idx, slide in enumerate(slides[:3], start=1):
            title = str(slide.get("title", f"Scene {idx + 1}"))[:46]
            subtitle = str(slide.get("subtitle", f"{request.subject} • {request.topic}"))[:120]
            bullets_raw = slide.get("bullets", [])
            fallback_bullets = [
                f"{request.topic}: key definition and scope.",
                "One exam-oriented example with direct application.",
                "Common mistake and how to avoid it.",
            ]
            bullets = [
                _clean_bullet(item, fallback_bullets[min(i, len(fallback_bullets) - 1)], request.topic)
                for i, item in enumerate(bullets_raw[:5])
                if str(item).strip()
            ]
            if not bullets:
                bullets = fallback_bullets
            footer = str(slide.get("footer", "CBSE revision focus"))[:80]
            result.append((title, subtitle, bullets, accent_palette[idx % len(accent_palette)], footer))

        if len(result) == 4:
            return result
    except Exception:
        pass

    return [
        (
            f"{request.subject}: {request.topic}",
            f"Class {request.class_num} • {request.chapter}",
            [
                f"Topic focus: {request.topic}.",
                f"Chapter context: {request.chapter}.",
                "Start with the core definition and one board-style takeaway.",
            ],
            (29, 158, 117),
            "Foundation first",
        ),
        (
            "How It Works",
            f"Mechanism behind {request.topic}",
            [
                "Stepwise process in concise sequence.",
                "Cause and effect in exam language.",
                "Where this appears in solved questions.",
            ],
            (14, 116, 144),
            "Understand the logic",
        ),
        (
            "Example and Application",
            "Board-style usage",
            [
                "One textbook example with key values/terms.",
                "How to structure a 3 or 5-mark answer.",
                "Common student error and correction.",
            ],
            (217, 119, 6),
            "Answer with structure",
        ),
        (
            "Rapid Revision",
            "Before-test checklist",
            [
                "Definition recall in one sentence.",
                "Process/formula recap from memory.",
                "Final exam tip for accuracy and speed.",
            ],
            (37, 99, 235),
            "Revise smarter",
        ),
    ]


async def _make_video_from_topic(request: VideoRenderPackageRequest) -> Path:
    temp_dir = Path(tempfile.mkdtemp(prefix="clarity_video_"))
    strict_long_form = str(request.style or "").strip().lower() == "topic-full-video"

    slides = await _build_topic_slides(request)

    generator = HighQualityVideoGenerator(temp_dir=temp_dir)

    # If user asks for long-form (5-6 min), prefer a single full stock clip rather than repeated scene loops.
    if int(request.duration_seconds or 0) >= 300:
        long_file = temp_dir / f"clarity_{request.class_num}_{request.subject}_{request.chapter[:18].replace(' ', '_')}_fullstock.mp4"
        full_topic = f"{request.subject} {request.chapter} {request.topic}".strip()
        full_result = generator.generate_full_topic_video(
            output_path=long_file,
            topic_query=full_topic,
            target_seconds=int(request.duration_seconds),
            min_external_segments=int(request.min_external_segments or 0),
        )
        if full_result and full_result.exists() and full_result.stat().st_size > 0:
            return Path(full_result)
        if strict_long_form:
            raise HTTPException(status_code=503, detail="Unable to assemble a long-form external video for this topic yet.")

    def _read_manifest_count(video_path: Path) -> int:
        manifest_path = video_path.with_suffix(".manifest.json")
        if not manifest_path.exists():
            return 0
        try:
            payload = json.loads(manifest_path.read_text(encoding="utf-8"))
            return int(payload.get("external_video_count", 0))
        except Exception:
            return 0

    def _write_fallback_manifest(video_path: Path) -> None:
        manifest_path = video_path.with_suffix(".manifest.json")
        payload = {
            "slides_count": len(slides or []),
            "motion_template": "fallback-zoompan",
            "subtitles_enabled": False,
            "narration_enabled": False,
            "external_video_count": 0,
            "procedural_broll_count": max(1, len(slides or [])),
            "broll_mode": request.broll_mode,
            "montage_level": request.montage_level,
            "montage_segments_total": 0,
            "features_enabled": [
                "fallback_zoompan_render",
                "telemetry_manifest_written",
            ],
            "output_file": str(video_path),
        }
        manifest_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    async def _render_once(render_request: VideoRenderPackageRequest) -> Path:
        attempt_generator = HighQualityVideoGenerator(temp_dir=temp_dir)
        title = slides[0][0] if slides else f"{render_request.subject}: {render_request.topic}"
        subtitle = f"Class {render_request.class_num} • {render_request.subject} • {render_request.chapter}"
        attempt_generator.render_title_slide(title=title, subtitle=subtitle, accent_color=(29, 158, 117))

        for slide in slides[1:] if len(slides) > 1 else slides:
            slide_title, _slide_subtitle, bullets, accent, footer = slide
            attempt_generator.render_content_slide_with_image(
                title=slide_title,
                bullets=bullets,
                topic=f"{render_request.subject} {render_request.topic}",
                accent_color=accent,
                footer=footer,
            )

        out_path = temp_dir / f"clarity_{render_request.class_num}_{render_request.subject}_{render_request.chapter[:18].replace(' ', '_')}_hq.mp4"
        return attempt_generator.generate_video(
            output_path=out_path,
            fps=24,
            duration_per_frame=4.0,
            motion_template="mixed",
            slides=slides,
            subject=render_request.subject,
            chapter=render_request.chapter,
            topic=render_request.topic,
            include_subtitles=True,
            include_narration_track=True,
            broll_mode=render_request.broll_mode,
            montage_level=render_request.montage_level,
            min_external_segments=render_request.min_external_segments,
        )

    try:
        out_file = await _render_once(request)
        if out_file.exists() and out_file.stat().st_size > 0:
            required_external_count = max(0, int(request.min_external_segments or 0))
            external_count = _read_manifest_count(out_file)
            if external_count < required_external_count:
                retry_request = request.model_copy(update={
                    "broll_mode": "aggressive",
                    "montage_level": "dynamic",
                })
                retry_file = await _render_once(retry_request)
                if retry_file.exists() and retry_file.stat().st_size > 0:
                    retry_count = _read_manifest_count(retry_file)
                    if retry_count >= required_external_count:
                        return Path(retry_file)
                raise RuntimeError(
                    f"Video quality threshold not met: external segments {retry_count}/{required_external_count}."
                )
            return Path(out_file)

        raise HTTPException(status_code=500, detail="Video generation produced no output file")

    except Exception as exc:
        if "Video quality threshold not met" in str(exc):
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        if strict_long_form:
            raise
        # Fallback to basic rendering if high-quality generation fails
        frames_dir = temp_dir / "frames"
        frames_dir.mkdir(parents=True, exist_ok=True)

        for idx, slide in enumerate(slides, start=1):
            _render_slide(frames_dir / f"frame_{idx:02d}.png", *slide)

        out_file = temp_dir / f"clarity_{request.class_num}_{request.subject}_{request.chapter[:18].replace(' ', '_')}.mp4"
        ffmpeg = shutil.which("ffmpeg")
        if not ffmpeg:
            raise HTTPException(status_code=500, detail="ffmpeg is not available on this system.")

        command = [
            ffmpeg,
            "-y",
            "-framerate", "1",
            "-i", str(frames_dir / "frame_%02d.png"),
            "-vf", "zoompan=z='min(zoom+0.0008,1.08)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=96:s=1280x720:fps=24,format=yuv420p",
            "-c:v", "libx264",
            "-preset", "medium",
            "-crf", "23",
            "-pix_fmt", "yuv420p",
            str(out_file),
        ]

        result = subprocess.run(command, capture_output=True, text=True)
        if result.returncode == 0 and out_file.exists() and out_file.stat().st_size > 0:
            _write_fallback_manifest(out_file)
            return out_file

        raise HTTPException(status_code=500, detail=f"Video render failed (fallback): {result.stderr[-300:]}")


def _video_manifest_headers(video_path: Path) -> dict[str, str]:
    """Expose render diagnostics as headers so the client can show quality telemetry."""
    headers: dict[str, str] = {}
    try:
        manifest_path = video_path.with_suffix(".manifest.json")
        if not manifest_path.exists():
            return headers
        payload = json.loads(manifest_path.read_text(encoding="utf-8"))
        headers["X-External-Video-Count"] = str(int(payload.get("external_video_count", 0)))
        headers["X-Procedural-Broll-Count"] = str(int(payload.get("procedural_broll_count", 0)))
        headers["X-Montage-Segments"] = str(int(payload.get("montage_segments_total", 0)))
        headers["X-Broll-Mode"] = str(payload.get("broll_mode", "balanced"))
        headers["X-Montage-Level"] = str(payload.get("montage_level", "single"))
    except Exception:
        return headers
    return headers


@router.post("/video-script-stream")
async def video_script_stream(request: VideoStoryboardRequest, authorization: Optional[str] = Header(default=None)):
    username = get_username_by_token(_extract_token(authorization)) if authorization else None
    if not username:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    request = _normalize_video_request_topic(request)
    prompt = (
        f"Create a {request.duration_seconds}-second educational micro-video storyboard for "
        f"Class {request.class_num} {request.subject}. Chapter: {request.chapter}. Topic: {request.topic}. "
        f"Style: {request.style}.\n\n"
        "Output as markdown with these exact sections:\n"
        "## Hook (0-8s)\n"
        "## Scene Plan\n"
        "- [time range] Visual\n"
        "- [time range] Narration\n"
        "- [time range] On-screen text\n"
        "## Accuracy Checkpoints\n"
        "## Revision Quiz (3 quick questions)\n"
        "Keep it scientifically accurate and board-exam aligned."
    )

    messages = [
        {
            "role": "system",
            "content": (
                "You are a CBSE instructional designer creating short, highly accurate lesson videos. "
                "Do not invent wrong facts. Keep visuals easy to animate."
            ),
        },
        {"role": "user", "content": prompt},
    ]

    async def event_generator():
        async for token in ask_openrouter_stream(messages, task_type="smart"):
            yield f"data: {json.dumps({'token': token, 'done': False})}\n\n"
        yield f"data: {json.dumps({'token': '', 'done': True})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/mindmap-stream")
async def mindmap_stream(request: MindmapRequest, authorization: Optional[str] = Header(default=None)):
    username = get_username_by_token(_extract_token(authorization)) if authorization else None
    if not username:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    prompt = (
        f"Generate a structured mindmap for Class {request.class_num} {request.subject}. "
        f"Chapter: {request.chapter}. Topic: {request.topic}. Depth: {request.depth}.\n\n"
        "Output format (strict):\n"
        "## Mindmap\n"
        "```mermaid\n"
        "mindmap\n"
        "  root((Topic))\n"
        "    Branch\n"
        "      Subpoint\n"
        "```\n"
        "## Visual Prompt\n"
        "One sentence image prompt for a clean educational diagram.\n"
        "## Key Insights\n"
        "- bullet\n"
        "- bullet\n"
        "- bullet"
    )

    messages = [
        {
            "role": "system",
            "content": (
                "You are an expert teacher that converts textbook content into accurate mindmaps. "
                "Prefer short labels, hierarchy clarity, and board exam relevance."
            ),
        },
        {"role": "user", "content": prompt},
    ]

    async def event_generator():
        async for token in ask_openrouter_stream(messages, task_type="smart"):
            yield f"data: {json.dumps({'token': token, 'done': False})}\n\n"
        yield f"data: {json.dumps({'token': '', 'done': True})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


def _svg_escape(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def _build_mindmap_svg(topic: str, branches: list[str]) -> str:
    width, height = 1200, 900
    cx, cy = 600, 450
    palette = ["#1D9E75", "#0E7490", "#D97706", "#2563EB", "#7C3AED", "#BE185D"]
    safe_topic = _svg_escape(topic[:56])
    nodes = branches[:6]
    if len(nodes) < 6:
        nodes.extend(["Key Idea"] * (6 - len(nodes)))

    positions = [
        (280, 190),
        (920, 190),
        (220, 450),
        (980, 450),
        (280, 710),
        (920, 710),
    ]

    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
        '<rect width="100%" height="100%" fill="#F8FAFC"/>',
        '<rect x="36" y="36" width="1128" height="828" rx="34" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="3"/>',
        f'<text x="72" y="96" font-size="42" font-family="Segoe UI, Arial" font-weight="800" fill="#0F172A">{safe_topic}</text>',
        '<text x="72" y="132" font-size="21" font-family="Segoe UI, Arial" font-weight="600" fill="#64748B">Mindmap overview</text>',
        f'<circle cx="{cx}" cy="{cy}" r="116" fill="#1D9E75"/>',
        f'<text x="{cx}" y="{cy - 8}" text-anchor="middle" font-size="28" font-family="Segoe UI, Arial" font-weight="700" fill="#FFFFFF">Core Idea</text>',
        f'<text x="{cx}" y="{cy + 26}" text-anchor="middle" font-size="22" font-family="Segoe UI, Arial" font-weight="600" fill="#ECFDF5">{safe_topic}</text>',
    ]

    for i, (x, y) in enumerate(positions):
        color = palette[i % len(palette)]
        label = _svg_escape(nodes[i][:36])
        parts.append(f'<line x1="{cx}" y1="{cy}" x2="{x}" y2="{y}" stroke="{color}" stroke-width="5" stroke-linecap="round"/>')
        parts.append(f'<circle cx="{x}" cy="{y}" r="70" fill="{color}" opacity="0.12"/>')
        parts.append(f'<circle cx="{x}" cy="{y}" r="58" fill="#FFFFFF" stroke="{color}" stroke-width="4"/>')
        parts.append(f'<text x="{x}" y="{y + 8}" text-anchor="middle" font-size="20" font-family="Segoe UI, Arial" font-weight="700" fill="#0F172A">{label}</text>')

    parts.append('</svg>')
    return ''.join(parts)


@router.post("/mindmap-image")
async def mindmap_image(request: MindmapRequest, authorization: Optional[str] = Header(default=None)):
    username = get_username_by_token(_extract_token(authorization)) if authorization else None
    if not username:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    _require_request_fields(
        request.model_dump(),
        ["class_num", "subject", "chapter", "topic"],
    )
    prompt = (
        f"Generate notebook-style concept cards for Class {request.class_num} {request.subject}. "
        f"Chapter: {request.chapter}. Topic: {request.topic}. "
        "Return strict JSON with this exact shape:\n"
        "{\n"
        '  "branches": ["string"],\n'
        '  "notebook_blocks": [\n'
        "    {\n"
        '      "title": "string",\n'
        '      "summary": "string",\n'
        '      "details": ["string", "string", "string"],\n'
        '      "exam_link": "string"\n'
        "    }\n"
        "  ]\n"
        "}\n"
        "Rules: exactly 6 branches, exactly 6 notebook_blocks, title <= 4 words, summary <= 18 words, each detail <= 14 words."
    )

    branches = []
    notebook_blocks = []
    try:
        raw = await ask_openrouter(
            [
                {
                    "role": "system",
                    "content": (
                        "You create concise, accurate educational mindmap and notebook cards. "
                        "Return strict JSON only."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            task_type="smart",
        )
        parsed = _parse_json_block(raw)
        maybe = parsed.get("branches", []) if isinstance(parsed, dict) else []
        branches = [str(item).strip() for item in maybe if str(item).strip()][:6]

        maybe_blocks = parsed.get("notebook_blocks", []) if isinstance(parsed, dict) else []
        if isinstance(maybe_blocks, list):
            for item in maybe_blocks[:6]:
                if not isinstance(item, dict):
                    continue
                title = str(item.get("title", "Concept")).strip()[:40]
                summary = str(item.get("summary", "Quick chapter understanding")).strip()[:140]
                raw_details = item.get("details", [])
                details = [str(d).strip()[:120] for d in raw_details if str(d).strip()][:4]
                if not details:
                    details = [
                        "Core definition in one sentence.",
                        "How this appears in board questions.",
                        "One common error to avoid.",
                    ]
                exam_link = str(item.get("exam_link", "Useful for 3 and 5-mark answers.")).strip()[:140]
                notebook_blocks.append(
                    {
                        "title": title or "Concept",
                        "summary": summary or "Quick chapter understanding",
                        "details": details,
                        "exam_link": exam_link or "Useful for board answers.",
                    }
                )
    except Exception:
        branches = []
        notebook_blocks = []

    if not branches:
        branches = [
            "Definition",
            "Core Principle",
            "Process",
            "Example",
            "Common Mistake",
            "Exam Tip",
        ]

    if not notebook_blocks:
        notebook_blocks = [
            {
                "title": "Definition",
                "summary": f"Understand what {request.topic} means in NCERT language.",
                "details": [
                    "Write one crisp textbook definition.",
                    "Identify the key term in the chapter.",
                    "Use one short example for memory.",
                ],
                "exam_link": "Strong base for 1-mark and short-answer questions.",
            },
            {
                "title": "Core Principle",
                "summary": "Focus on the central rule or mechanism.",
                "details": [
                    "Note the cause-and-effect chain.",
                    "Connect concept to previous chapter basics.",
                    "Remember where diagrams are used.",
                ],
                "exam_link": "Used in explanation-heavy 3-mark questions.",
            },
            {
                "title": "Process",
                "summary": "Break the process into ordered steps.",
                "details": [
                    "List steps in sequence.",
                    "Underline key terms in each step.",
                    "Track input and output clearly.",
                ],
                "exam_link": "Essential for process-based board answers.",
            },
            {
                "title": "Example",
                "summary": "Anchor the concept with one textbook-style case.",
                "details": [
                    "Use class-level familiar context.",
                    "State why the example fits.",
                    "Mention one variation question.",
                ],
                "exam_link": "Improves scoring in application questions.",
            },
            {
                "title": "Common Mistake",
                "summary": "Avoid frequent student confusion points.",
                "details": [
                    "Spot the most mixed-up terms.",
                    "Write the corrected statement.",
                    "Keep a quick error checklist.",
                ],
                "exam_link": "Prevents mark loss in structured answers.",
            },
            {
                "title": "Exam Tip",
                "summary": "Use a practical strategy in timed exams.",
                "details": [
                    "Start with definition, then logic.",
                    "Use short labeled points.",
                    "Close with one direct conclusion.",
                ],
                "exam_link": "Boosts clarity for 5-mark responses.",
            },
        ]

    svg = _build_mindmap_svg(request.topic, branches)
    encoded_svg = base64.b64encode(svg.encode("utf-8")).decode("utf-8")
    image_url = f"data:image/svg+xml;base64,{encoded_svg}"

    return {
        "image_url": image_url,
        "prompt": f"local-svg-mindmap:{request.topic}",
        "notebook_blocks": notebook_blocks,
    }


@router.post("/video-render-package")
async def video_render_package(request: VideoRenderPackageRequest, authorization: Optional[str] = Header(default=None)):
    username = get_username_by_token(_extract_token(authorization)) if authorization else None
    if not username:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    _require_request_fields(
        request.model_dump(),
        ["class_num", "subject", "chapter"],
    )
    request = _normalize_video_request_topic(request)
    prompt = (
        f"Create a render-ready Manim package for a Class {request.class_num} {request.subject} lesson. "
        f"Chapter: {request.chapter}. Topic: {request.topic}. Duration: {request.duration_seconds}s. "
        f"Style: {request.style}. B-roll mode: {request.broll_mode}. Montage: {request.montage_level}.\n\n"
        "Return markdown with exact sections:\n"
        "## Manim Script\n"
        "```python\n# full runnable manim file\n```\n"
        "## Voiceover Script\n"
        "## Subtitle SRT\n"
        "## Render Commands\n"
        "Include command lines for manim and ffmpeg that generate an MP4."
    )

    messages = [
        {
            "role": "system",
            "content": (
                "You are an educational video engineer. Produce accurate, runnable Manim scripts. "
                "Keep visuals simple and scientifically correct."
            ),
        },
        {"role": "user", "content": prompt},
    ]

    content = await ask_openrouter(messages, task_type="smart")
    return {"package": content}


@router.post("/video-file")
async def video_file(request: VideoRenderPackageRequest, authorization: Optional[str] = Header(default=None)):
    username = get_username_by_token(_extract_token(authorization)) if authorization else None
    if not username:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    _require_request_fields(
        request.model_dump(),
        ["class_num", "subject", "chapter"],
    )
    request = _normalize_video_request_topic(request)
    video_path = await _make_video_from_topic(request)
    filename = video_path.name
    headers = _video_manifest_headers(video_path)
    headers.update(_ck12_response_headers(request.source_url))
    return FileResponse(
        path=str(video_path),
        media_type="video/mp4",
        filename=filename,
        headers=headers,
    )


@router.post("/video-file-manim")
async def video_file_manim(request: VideoRenderPackageRequest, authorization: Optional[str] = Header(default=None)):
    username = get_username_by_token(_extract_token(authorization)) if authorization else None
    if not username:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    _require_request_fields(
        request.model_dump(),
        ["class_num", "subject", "chapter"],
    )
    request = _normalize_video_request_topic(request)
    try:
        video_path, engine = await _make_video_with_manim(request)
    except Exception:
        if str(request.style or "").strip().lower() == "topic-full-video":
            raise HTTPException(status_code=503, detail="Unable to render the requested long-form video right now.")
        # Reliable fallback so students still get a finished video.
        video_path = await _make_video_from_topic(request)
        engine = "fallback-slides"

    filename = video_path.name if video_path.suffix.lower() == ".mp4" else f"clarity_{request.topic or request.chapter}.mp4"
    headers = {"X-Video-Engine": engine}
    headers.update(_ck12_response_headers(request.source_url))
    return FileResponse(
        path=str(video_path),
        media_type="video/mp4",
        filename=filename,
        headers=headers,
    )
