"""
High-quality educational video generator with image integration, GIFs, and professional layouts.
Produces MP4 files suitable for lesson delivery with rich visual and textual content.
"""

import io
import json
import os
import re
import subprocess
import tempfile
import textwrap
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Optional

from PIL import Image, ImageDraw, ImageFont, ImageFilter


class HighQualityVideoGenerator:
    """
    Generates professional educational videos with embedded images, diagrams, and animations.
    Supports multiple slide layouts and effects.
    """

    def __init__(self, temp_dir: Optional[Path] = None):
        self.temp_dir = temp_dir or Path(tempfile.mkdtemp(prefix="clarity_hq_video_"))
        self.frames_dir = self.temp_dir / "frames"
        self.images_dir = self.temp_dir / "images"
        self.videos_dir = self.temp_dir / "videos"
        self.frames_dir.mkdir(parents=True, exist_ok=True)
        self.images_dir.mkdir(parents=True, exist_ok=True)
        self.videos_dir.mkdir(parents=True, exist_ok=True)
        self._video_cache: dict[str, Optional[Path]] = {}
        self.frame_count = 0

    def _load_font(self, size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
        """Load system font with fallback."""
        candidates = [
            "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
            "C:/Windows/Fonts/segoeui.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        ]
        for path in candidates:
            if os.path.exists(path):
                try:
                    return ImageFont.truetype(path, size=size)
                except Exception:
                    continue
        return ImageFont.load_default()

    def _wrap_text(self, text: str, max_chars: int = 42) -> list[str]:
        """Wrap text to multiple lines."""
        words = text.split()
        lines = []
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

    def _fetch_image_for_topic(self, topic: str, fallback_color: tuple[int, int, int]) -> Optional[Image.Image]:
        """
        Attempt to fetch a relevant image from free external sources with no API keys.
        Returns PIL Image or None if fetch fails (graceful fallback to colored background).
        """
        search_query = re.sub(r'[^\w\s]', '', topic).strip()[:80]
        if not search_query:
            return None

        source_urls: list[str] = []

        # 1) Wikimedia Commons (free + no key).
        commons_url = self._get_wikimedia_image_url(search_query)
        if commons_url:
            source_urls.append(commons_url)

        encoded = urllib.parse.quote_plus(search_query)

        # 2) LoremFlickr (public random photo endpoint).
        source_urls.append(f"https://loremflickr.com/1280/720/{encoded}")

        # 3) Unsplash Source fallback.
        source_urls.append(f"https://source.unsplash.com/1280x720/?{search_query.replace(' ', ',')}")

        for source_url in source_urls:
            try:
                req = urllib.request.Request(source_url, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req, timeout=12) as response:
                    content = response.read()

                img = Image.open(io.BytesIO(content)).convert("RGB")
                img.thumbnail((1280, 720), Image.Resampling.LANCZOS)

                background = Image.new("RGB", (1280, 720), fallback_color)
                offset_x = (1280 - img.width) // 2
                offset_y = (720 - img.height) // 2
                background.paste(img, (offset_x, offset_y))
                return background
            except Exception:
                continue

        return None

    def _get_wikimedia_image_url(self, query: str) -> Optional[str]:
        """Find a relevant image URL from Wikimedia Commons using public API."""
        try:
            api_url = (
                "https://commons.wikimedia.org/w/api.php?"
                f"action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrsearch={urllib.parse.quote_plus(query)}"
                "&gsrlimit=5&prop=imageinfo&iiprop=url"
            )
            req = urllib.request.Request(api_url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=12) as response:
                payload = json.loads(response.read().decode("utf-8", errors="ignore"))

            pages = payload.get("query", {}).get("pages", {})
            for page in pages.values():
                imageinfo = page.get("imageinfo") or []
                if not imageinfo:
                    continue
                candidate = str(imageinfo[0].get("url", ""))
                if candidate.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
                    return candidate
        except Exception:
            return None

        return None

    def _get_wikimedia_video_url(self, query: str) -> Optional[str]:
        """Find a relevant short video URL from Wikimedia Commons using public API."""
        try:
            api_url = (
                "https://commons.wikimedia.org/w/api.php?"
                f"action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrsearch={urllib.parse.quote_plus(query)}"
                "&gsrlimit=10&prop=imageinfo&iiprop=url|mime"
            )
            req = urllib.request.Request(api_url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=12) as response:
                payload = json.loads(response.read().decode("utf-8", errors="ignore"))

            pages = payload.get("query", {}).get("pages", {})
            for page in pages.values():
                imageinfo = page.get("imageinfo") or []
                if not imageinfo:
                    continue
                info = imageinfo[0]
                candidate = str(info.get("url", ""))
                mime = str(info.get("mime", ""))
                if mime.startswith("video/") and candidate.lower().endswith((".webm", ".ogv", ".mp4")):
                    return candidate
        except Exception:
            return None

        return None

    def _get_pixabay_video_url(self, query: str) -> Optional[str]:
        """Optional Pixabay videos API (requires PIXABAY_API_KEY)."""
        api_key = os.getenv("PIXABAY_API_KEY", "").strip()
        if not api_key:
            return None
        try:
            api_url = (
                "https://pixabay.com/api/videos/?"
                f"key={urllib.parse.quote_plus(api_key)}&q={urllib.parse.quote_plus(query)}"
                "&safesearch=true&per_page=5"
            )
            req = urllib.request.Request(api_url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=12) as response:
                payload = json.loads(response.read().decode("utf-8", errors="ignore"))

            hits = payload.get("hits", []) if isinstance(payload, dict) else []
            for hit in hits:
                videos = hit.get("videos") or {}
                medium = videos.get("medium") or videos.get("small") or videos.get("tiny")
                if isinstance(medium, dict):
                    url = str(medium.get("url", "")).strip()
                    if url.lower().endswith((".mp4", ".webm")):
                        return url
        except Exception:
            return None

        return None

    def _get_internet_archive_video_url(self, query: str) -> Optional[str]:
        """Find a public-domain or freely accessible video from Internet Archive."""
        normalized_query = re.sub(r"\s+", " ", query or "").strip()
        if not normalized_query:
            return None
        try:
            search_url = (
                "https://archive.org/advancedsearch.php?"
                f"q={urllib.parse.quote_plus(f'({normalized_query}) AND mediatype:movies')}"
                "&fl[]=identifier&fl[]=title&rows=5&page=1&output=json"
            )
            req = urllib.request.Request(search_url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=12) as response:
                payload = json.loads(response.read().decode("utf-8", errors="ignore"))

            docs = payload.get("response", {}).get("docs", []) if isinstance(payload, dict) else []
            for doc in docs:
                identifier = str(doc.get("identifier", "")).strip()
                if not identifier:
                    continue
                metadata_url = f"https://archive.org/metadata/{urllib.parse.quote_plus(identifier)}"
                metadata_req = urllib.request.Request(metadata_url, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(metadata_req, timeout=12) as metadata_response:
                    metadata = json.loads(metadata_response.read().decode("utf-8", errors="ignore"))

                files = metadata.get("files", []) if isinstance(metadata, dict) else []
                for item in files:
                    name = str(item.get("name", "")).strip()
                    format_name = str(item.get("format", "")).lower()
                    if not name:
                        continue
                    if not any(name.lower().endswith(ext) for ext in (".mp4", ".webm", ".ogv")):
                        continue
                    if any(marker in format_name for marker in ("mpeg4", "h.264", "h264", "mpeg2", "video")):
                        return f"https://archive.org/download/{identifier}/{urllib.parse.quote(name)}"
                for item in files:
                    name = str(item.get("name", "")).strip()
                    if name.lower().endswith((".mp4", ".webm", ".ogv")):
                        return f"https://archive.org/download/{identifier}/{urllib.parse.quote(name)}"
        except Exception:
            return None

        return None

    def _download_external_video(self, source_url: str, topic: str) -> Optional[Path]:
        """Download a remote stock video to temp storage."""
        if not source_url:
            return None
        ext = ".mp4" if ".mp4" in source_url.lower() else ".webm" if ".webm" in source_url.lower() else ".ogv"
        safe_topic = re.sub(r"[^a-z0-9]+", "_", topic.lower()).strip("_")[:36] or "topic"
        target = self.videos_dir / f"bg_{safe_topic}_{abs(hash(source_url)) % 99999}{ext}"
        if target.exists() and target.stat().st_size > 0:
            return target
        try:
            req = urllib.request.Request(source_url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=20) as response:
                data = response.read()
            if not data:
                return None
            target.write_bytes(data)
            if target.stat().st_size < 50_000:
                return None
            return target
        except Exception:
            return None

    def _fetch_video_for_topic(self, topic: str) -> Optional[Path]:
        """Fetch a relevant external video clip and cache result by topic key."""
        normalized = re.sub(r"\s+", " ", topic).strip().lower()
        if not normalized:
            return None
        if normalized in self._video_cache:
            return self._video_cache[normalized]

        # Prefer no-key sources first.
        candidate_urls: list[str] = []
        wiki_url = self._get_wikimedia_video_url(normalized)
        if wiki_url:
            candidate_urls.append(wiki_url)

        archive_url = self._get_internet_archive_video_url(normalized)
        if archive_url:
            candidate_urls.append(archive_url)

        # Optional API-backed provider.
        pixabay_url = self._get_pixabay_video_url(normalized)
        if pixabay_url:
            candidate_urls.append(pixabay_url)

        for url in candidate_urls:
            path = self._download_external_video(url, normalized)
            if path and path.exists():
                self._video_cache[normalized] = path
                return path

        self._video_cache[normalized] = None
        return None

    def _video_query_variants(self, query: str, broll_mode: str) -> list[str]:
        """Build fallback-friendly query variants to improve external clip hit rate."""
        mode = (broll_mode or "balanced").strip().lower()
        base = re.sub(r"\s+", " ", query or "").strip()
        if not base:
            return []

        variants: list[str] = [base]
        words = base.split()
        if len(words) > 4:
            variants.append(" ".join(words[:4]))
        if len(words) > 2:
            variants.append(" ".join(words[:2]))

        # Broader classroom-safe fallback tags for generic stock footage providers.
        variants.extend([
            f"{base} education",
            f"{base} science",
            f"{base} learning",
            f"{base} concept",
            f"{base} classroom",
            "classroom lesson",
            "students learning",
            "education science",
            "classroom concept",
        ])

        if mode == "minimal":
            variants = variants[:2]
        elif mode == "aggressive":
            variants.extend([
                "school board teaching",
                "study notes concept",
                "science documentary",
                "explainer animation",
            ])
        else:
            variants = variants[:5]

        deduped: list[str] = []
        seen: set[str] = set()
        for item in variants:
            normalized = item.strip().lower()
            if normalized and normalized not in seen:
                deduped.append(item.strip())
                seen.add(normalized)
        return deduped

    def _montage_segment_target(self, montage_level: str) -> int:
        level = (montage_level or "single").strip().lower()
        if level == "dynamic":
            return 3
        if level == "light":
            return 2
        return 1

    def render_title_slide(self, title: str, subtitle: str, accent_color: tuple[int, int, int]) -> Path:
        """
        Create an attractive title slide with large text and gradient background.
        """
        self.frame_count += 1
        width, height = 1280, 720
        image = Image.new("RGB", (width, height), accent_color)
        draw = ImageDraw.Draw(image)

        # Add gradient overlay (darker at edges)
        gradient = Image.new("RGB", (width, height), accent_color)
        for y in range(height):
            factor = 1 - (abs(y - height / 2) / (height / 2)) * 0.3
            overlay = Image.new("RGB", (width, 1), tuple(int(c * factor) for c in accent_color))
            gradient.paste(overlay, (0, y))

        image.paste(gradient, (0, 0))
        draw = ImageDraw.Draw(image)

        # Add semi-transparent overlay for text readability
        overlay_img = Image.new("RGBA", (width, height), (0, 0, 0, 120))
        image = Image.alpha_composite(image.convert("RGBA"), overlay_img).convert("RGB")
        draw = ImageDraw.Draw(image)

        # Title
        title_font = self._load_font(72, bold=True)
        subtitle_font = self._load_font(36)

        title_lines = self._wrap_text(title, 20)
        y = 200
        for line in title_lines[:2]:
            bbox = draw.textbbox((0, 0), line, font=title_font)
            line_width = bbox[2] - bbox[0]
            x = (width - line_width) // 2
            draw.text((x, y), line, fill=(255, 255, 255), font=title_font)
            y += 90

        # Subtitle
        subtitle_lines = self._wrap_text(subtitle, 35)
        y = 520
        for line in subtitle_lines[:2]:
            bbox = draw.textbbox((0, 0), line, font=subtitle_font)
            line_width = bbox[2] - bbox[0]
            x = (width - line_width) // 2
            draw.text((x, y), line, fill=(229, 231, 235), font=subtitle_font)
            y += 50

        path = self.frames_dir / f"frame_{self.frame_count:03d}.png"
        image.save(path, quality=95)
        return path

    def render_content_slide_with_image(
        self,
        title: str,
        bullets: list[str],
        topic: str,
        accent_color: tuple[int, int, int],
        footer: str = ""
    ) -> Path:
        """
        Create a content slide with integrated image/diagram.
        """
        self.frame_count += 1
        width, height = 1280, 720
        image = Image.new("RGB", (width, height), (248, 250, 252))
        draw = ImageDraw.Draw(image)

        # Try to fetch and embed an image
        bg_image = self._fetch_image_for_topic(topic, accent_color)
        if bg_image:
            # Use image as background with overlay for text readability
            image.paste(bg_image, (0, 0))
            overlay = Image.new("RGBA", (width, height), (*accent_color, 140))
            image = Image.alpha_composite(image.convert("RGBA"), overlay).convert("RGB")
            draw = ImageDraw.Draw(image)
        else:
            # Colored background
            draw.rectangle([0, 0, width, 140], fill=accent_color)

        # Title bar
        title_font = self._load_font(52, bold=True)
        title_color = (255, 255, 255)
        title_lines = self._wrap_text(title, 32)
        title_y = 28
        for line in title_lines[:2]:
            draw.text((64, title_y), line, fill=title_color, font=title_font)
            title_y += 50

        # Content box with semi-transparent background
        if bg_image:
            # Light background for readability
            content_bg = Image.new("RGBA", (width - 128, 520), (255, 255, 255, 230))
            composed = image.convert("RGBA")
            composed.paste(content_bg, (64, 180), content_bg)
            image = composed.convert("RGB")
            draw = ImageDraw.Draw(image)

        # Bullets
        bullet_font = self._load_font(24)
        y = 200
        for bullet_idx, bullet in enumerate(bullets[:5]):
            if y + 90 > height - 60:
                break
            bullet_text = f"• {bullet[:80]}"
            draw.text((100, y), bullet_text, fill=(31, 41, 55), font=bullet_font)
            y += 92

        # Footer
        if footer:
            footer_font = self._load_font(16)
            draw.text((64, height - 36), footer, fill=(107, 114, 128), font=footer_font)

        path = self.frames_dir / f"frame_{self.frame_count:03d}.png"
        image.save(path, quality=95)
        return path

    def render_diagram_slide(self, title: str, conceptual_text: str, accent_color: tuple[int, int, int]) -> Path:
        """
        Create a slide with large conceptual diagrams/text.
        """
        self.frame_count += 1
        width, height = 1280, 720
        image = Image.new("RGB", (width, height), (248, 250, 252))
        draw = ImageDraw.Draw(image)

        # Header
        draw.rectangle([0, 0, width, 100], fill=accent_color)
        title_font = self._load_font(48, bold=True)
        draw.text((64, 20), title, fill=(255, 255, 255), font=title_font)

        # Large conceptual box
        box_font = self._load_font(32)
        draw.rounded_rectangle([80, 150, 1200, 650], radius=20, fill=(255, 255, 255), outline=accent_color, width=4)

        # Center text in box
        concept_lines = self._wrap_text(conceptual_text, 48)
        start_y = 250
        for line in concept_lines[:4]:
            bbox = draw.textbbox((0, 0), line, font=box_font)
            line_width = bbox[2] - bbox[0]
            x = (width - line_width) // 2
            draw.text((x, start_y), line, fill=(31, 41, 55), font=box_font)
            start_y += 80

        path = self.frames_dir / f"frame_{self.frame_count:03d}.png"
        image.save(path, quality=95)
        return path

    def render_comparison_slide(
        self,
        title: str,
        left_label: str,
        left_items: list[str],
        right_label: str,
        right_items: list[str],
        accent_color: tuple[int, int, int]
    ) -> Path:
        """
        Create a comparison slide with two columns.
        """
        self.frame_count += 1
        width, height = 1280, 720
        image = Image.new("RGB", (width, height), (248, 250, 252))
        draw = ImageDraw.Draw(image)

        # Header
        draw.rectangle([0, 0, width, 100], fill=accent_color)
        title_font = self._load_font(48, bold=True)
        draw.text((64, 20), title, fill=(255, 255, 255), font=title_font)

        # Left column
        draw.rectangle([40, 140, 620, 680], fill=(225, 245, 254), outline=(59, 130, 246), width=3)
        draw.text((60, 160), left_label, fill=(30, 58, 138), font=self._load_font(28, bold=True))
        y = 220
        for item in left_items[:4]:
            draw.text((80, y), f"→ {item[:35]}", fill=(31, 41, 55), font=self._load_font(20))
            y += 100

        # Right column
        draw.rectangle([660, 140, 1240, 680], fill=(240, 253, 244), outline=(34, 197, 94), width=3)
        draw.text((680, 160), right_label, fill=(20, 83, 45), font=self._load_font(28, bold=True))
        y = 220
        for item in right_items[:4]:
            draw.text((700, y), f"→ {item[:35]}", fill=(31, 41, 55), font=self._load_font(20))
            y += 100

        path = self.frames_dir / f"frame_{self.frame_count:03d}.png"
        image.save(path, quality=95)
        return path

    def _slide_duration(self, bullets: list[str], default: float) -> float:
        """Compute a readable duration based on content length."""
        words = sum(len(str(item).split()) for item in bullets[:5])
        adaptive = 3.5 + (words / 18.0)
        return max(3.5, min(7.0, max(default, adaptive)))

    def _motion_name(self, index: int, motion_template: str) -> str:
        modes = ["zoom_in", "pan_left", "pan_right", "drift_up", "zoom_out"]
        if motion_template == "mixed":
            return modes[index % len(modes)]
        if motion_template in modes:
            return motion_template
        return "zoom_in"

    def _motion_filter(self, motion_name: str, fps: int, duration: float) -> str:
        out_start = max(duration - 0.45, 0.2)
        motion_filters = {
            "zoom_in": "zoompan=z='min(zoom+0.0010,1.12)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1280x720:fps={fps}",
            "zoom_out": "zoompan=z='if(lte(on,1),1.12,max(zoom-0.0010,1.00))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1280x720:fps={fps}",
            "pan_left": "zoompan=z='1.07':x='max((iw-iw/zoom)-on*1.5,0)':y='ih/2-(ih/zoom/2)':d=1:s=1280x720:fps={fps}",
            "pan_right": "zoompan=z='1.07':x='min(on*1.5,(iw-iw/zoom))':y='ih/2-(ih/zoom/2)':d=1:s=1280x720:fps={fps}",
            "drift_up": "zoompan=z='1.06':x='iw/2-(iw/zoom/2)':y='max((ih-ih/zoom)-on*1.3,0)':d=1:s=1280x720:fps={fps}",
        }
        base = motion_filters.get(motion_name, motion_filters["zoom_in"]).format(fps=fps)
        return f"{base},fade=t=in:st=0:d=0.35,fade=t=out:st={out_start:.2f}:d=0.45,format=yuv420p"

    def _escape_ffmpeg_path(self, path: str) -> str:
        """Escape file paths for ffmpeg filter arguments (not shell escaping)."""
        return str(path or "").replace("\\", "/").replace(":", "\\:")

    def _subtitle_drawtext_filter(self, title: str, bullets: list[str], fontfile: str) -> str:
        """Create a burned-in caption strip for a slide clip."""
        safe_font = self._escape_ffmpeg_path(fontfile)
        caption_lines = [title.strip()]
        for bullet in bullets[:2]:
            clean = str(bullet).strip()
            if clean:
                caption_lines.append(clean)
        caption_text = "\\n".join(caption_lines[:3]).replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'")
        return (
            f"drawtext=fontfile='{safe_font}':text='{caption_text}':"
            "fontcolor=white:fontsize=28:box=1:boxcolor=0x00000088:boxborderw=18:"
            "x=(w-text_w)/2:y=h-140"
        )

    def _cinematic_video_filter(self, duration: float, title: str, bullets: list[str], fontfile: str) -> str:
        """Video clip filter chain: crop/grade + cinematic bars + lesson text overlay."""
        safe_font = self._escape_ffmpeg_path(fontfile)
        top_text = str(title or "").strip().replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'")
        hook = str((bullets[0] if bullets else "")).strip()
        hook_text = hook.replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'")
        out_start = max(duration - 0.45, 0.2)
        return (
            "scale=1280:720:force_original_aspect_ratio=increase,"
            "crop=1280:720,"
            "eq=saturation=1.18:contrast=1.08:brightness=-0.02,"
            "drawbox=x=0:y=0:w=iw:h=84:color=black@0.42:t=fill,"
            "drawbox=x=0:y=ih-170:w=iw:h=170:color=black@0.46:t=fill,"
            f"drawtext=fontfile='{safe_font}':text='{top_text}':fontcolor=white:fontsize=44:x=56:y=22,"
            f"drawtext=fontfile='{safe_font}':text='{hook_text}':fontcolor=white:fontsize=30:x=56:y=h-126,"
            f"fade=t=in:st=0:d=0.35,fade=t=out:st={out_start:.2f}:d=0.45,format=yuv420p"
        )

    def _format_srt_ts(self, seconds: float) -> str:
        ms_total = int(max(seconds, 0) * 1000)
        hours = ms_total // 3600000
        ms_total %= 3600000
        minutes = ms_total // 60000
        ms_total %= 60000
        secs = ms_total // 1000
        millis = ms_total % 1000
        return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

    def create_subtitle_track(
        self,
        slides: list[tuple[str, str, list[str], tuple[int, int, int], str]],
        durations: list[float],
        output_path: Optional[Path] = None,
    ) -> Path:
        """Create an SRT subtitle track from slide titles and key bullets."""
        subtitle_path = output_path or (self.temp_dir / "captions.srt")
        lines: list[str] = []
        now = 0.0
        for idx, slide in enumerate(slides, start=1):
            title, _subtitle, bullets, _accent, _footer = slide
            dur = durations[idx - 1] if idx - 1 < len(durations) else 4.5
            text_parts = [title.strip()]
            for bullet in bullets[:2]:
                text_parts.append(str(bullet).strip())
            text = "\\n".join([part for part in text_parts if part])
            lines.append(str(idx))
            lines.append(f"{self._format_srt_ts(now)} --> {self._format_srt_ts(now + dur)}")
            lines.append(textwrap.shorten(text, width=220, placeholder="..."))
            lines.append("")
            now += dur
        subtitle_path.write_text("\n".join(lines), encoding="utf-8")
        return subtitle_path

    def create_narration_script(
        self,
        slides: list[tuple[str, str, list[str], tuple[int, int, int], str]],
        subject: str,
        chapter: str,
        topic: str,
        output_path: Optional[Path] = None,
    ) -> Path:
        """Create a narration script aligned with the generated slide deck."""
        narration_path = output_path or (self.temp_dir / "narration.txt")
        lines = [
            f"Welcome to {subject}.",
            f"Chapter: {chapter}.",
            f"Topic: {topic}.",
            "",
        ]
        for idx, slide in enumerate(slides, start=1):
            title, _subtitle, bullets, _accent, _footer = slide
            lines.append(f"Slide {idx}: {title}.")
            for bullet in bullets[:3]:
                lines.append(str(bullet).rstrip(".") + ".")
            lines.append("")
        narration_path.write_text("\n".join(lines), encoding="utf-8")
        return narration_path

    def _attach_subtitle_track(self, ffmpeg: str, input_video: Path, subtitle_srt: Path, output_video: Path) -> bool:
        """Mux SRT as a soft subtitle track inside MP4 (mov_text)."""
        command = [
            ffmpeg,
            "-y",
            "-i", str(input_video),
            "-i", str(subtitle_srt),
            "-c:v", "copy",
            "-c:a", "copy",
            "-c:s", "mov_text",
            "-metadata:s:s:0", "language=eng",
            str(output_video),
        ]
        result = subprocess.run(command, capture_output=True, text=True)
        return result.returncode == 0 and output_video.exists() and output_video.stat().st_size > 0

    def _try_generate_tts_wav_windows(self, narration_script_path: Path) -> Optional[Path]:
        """Generate simple narration WAV using native Windows SAPI when available."""
        if os.name != "nt" or not narration_script_path.exists():
            return None
        output_wav = self.temp_dir / "narration.wav"
        script_path_ps = str(narration_script_path).replace("'", "''")
        output_wav_ps = str(output_wav).replace("'", "''")
        ps_script = (
            "Add-Type -AssemblyName System.Speech; "
            "$speak = New-Object System.Speech.Synthesis.SpeechSynthesizer; "
            "$speak.Rate = 0; "
            f"$text = Get-Content -Raw '{script_path_ps}'; "
            f"$speak.SetOutputToWaveFile('{output_wav_ps}'); "
            "$speak.Speak($text); "
            "$speak.Dispose();"
        )
        result = subprocess.run(
            ["powershell", "-NoProfile", "-Command", ps_script],
            capture_output=True,
            text=True,
        )
        if result.returncode == 0 and output_wav.exists() and output_wav.stat().st_size > 0:
            return output_wav
        return None

    def _voice_style_settings(self, voice_style: str) -> tuple[int, Optional[str]]:
        """Map voice style to speech rate and optional preferred voice name."""
        style = (voice_style or "warm").strip().lower()
        if style == "calm":
            return (-1, None)
        if style == "energetic":
            return (1, None)
        if style == "teacher":
            return (0, None)
        return (0, None)

    def _attach_audio_track(self, ffmpeg: str, input_video: Path, audio_wav: Path, output_video: Path) -> bool:
        """Mux narration audio into the MP4."""
        command = [
            ffmpeg,
            "-y",
            "-i", str(input_video),
            "-i", str(audio_wav),
            "-c:v", "copy",
            "-c:a", "aac",
            "-b:a", "160k",
            "-shortest",
            str(output_video),
        ]
        result = subprocess.run(command, capture_output=True, text=True)
        return result.returncode == 0 and output_video.exists() and output_video.stat().st_size > 0

    def _write_render_manifest(
        self,
        output_path: Path,
        slides_count: int,
        motion_template: str,
        subtitles_enabled: bool,
        narration_enabled: bool,
        external_video_count: int,
        procedural_broll_count: int,
        broll_mode: str,
        montage_level: str,
        montage_segments_total: int,
    ) -> None:
        """Write a debug manifest with active rendering features."""
        manifest_path = output_path.with_suffix(".manifest.json")
        features_enabled = [
            "multi_source_images",
            "wikimedia_commons_lookup",
            "loremflickr_fallback",
            "unsplash_source_fallback",
            "per_slide_motion_templates",
            "adaptive_slide_duration",
            "fade_transitions",
            "srt_subtitle_generation",
            "subtitle_track_muxing",
            "optional_tts_narration_audio",
            "external_stock_video_broll",
            "wikimedia_video_search",
            "pixabay_video_api_optional",
        ]
        if montage_segments_total > max(slides_count, 1):
            features_enabled.append("multi_clip_montage")
        if procedural_broll_count > 0:
            features_enabled.append("procedural_cinematic_fallback")
        payload = {
            "slides_count": slides_count,
            "motion_template": motion_template,
            "subtitles_enabled": subtitles_enabled,
            "narration_enabled": narration_enabled,
            "external_video_count": external_video_count,
            "procedural_broll_count": procedural_broll_count,
            "broll_mode": broll_mode,
            "montage_level": montage_level,
            "montage_segments_total": montage_segments_total,
            "features_enabled": features_enabled,
            "output_file": str(output_path),
        }
        manifest_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    def generate_video(
        self,
        output_path: Path,
        fps: int = 24,
        duration_per_frame: float = 4.0,
        motion_template: str = "mixed",
        slides: Optional[list[tuple[str, str, list[str], tuple[int, int, int], str]]] = None,
        subject: str = "",
        chapter: str = "",
        topic: str = "",
        include_subtitles: bool = True,
        include_narration_track: bool = True,
        voice_style: str = "warm",
        broll_mode: str = "balanced",
        montage_level: str = "single",
        min_external_segments: int = 1,
    ) -> Path:
        """
        Combine rendered frames into an MP4 with per-slide motion,
        optional subtitle track, and optional narration audio.
        """
        ffmpeg = self._find_ffmpeg()
        if not ffmpeg:
            raise RuntimeError("ffmpeg is not available. Install it to generate videos.")

        frame_files = sorted(self.frames_dir.glob("frame_*.png"))
        if not frame_files:
            raise RuntimeError("No frames were rendered before generate_video call.")

        clips_dir = self.temp_dir / "clips"
        clips_dir.mkdir(parents=True, exist_ok=True)
        fontfile = "C:/Windows/Fonts/arial.ttf" if os.path.exists("C:/Windows/Fonts/arial.ttf") else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
        min_external_segments = max(0, int(min_external_segments))

        durations: list[float] = []
        clip_paths: list[Path] = []
        external_video_count = 0
        procedural_broll_count = 0
        montage_segments_total = 0
        for index, frame_path in enumerate(frame_files):
            clip_path = clips_dir / f"clip_{index + 1:03d}.mp4"
            bullets = []
            slide_title = ""
            slide_query = topic
            duration = self._slide_duration([], duration_per_frame)
            if slides and index < len(slides):
                bullets = slides[index][2]
                slide_title = slides[index][0]
                slide_query = f"{subject} {chapter} {slide_title}".strip()
                duration = self._slide_duration(bullets, duration_per_frame)
            durations.append(duration)
            segment_target = max(self._montage_segment_target(montage_level), min_external_segments or 0)
            candidate_paths: list[Path] = []
            for query in self._video_query_variants(slide_query, broll_mode):
                candidate = self._fetch_video_for_topic(query)
                if not candidate or not candidate.exists():
                    continue
                if candidate in candidate_paths:
                    continue
                candidate_paths.append(candidate)
                if len(candidate_paths) >= segment_target:
                    break

            if candidate_paths:
                slide_bullets = bullets if bullets else ["Key concept", "Exam-focused explanation"]
                segment_duration = max(duration / len(candidate_paths), 1.6)
                segment_paths: list[Path] = []
                for seg_index, source_path in enumerate(candidate_paths):
                    segment_path = clips_dir / f"clip_{index + 1:03d}_seg_{seg_index + 1:02d}.mp4"
                    vf = self._cinematic_video_filter(segment_duration, slide_title or "Concept Focus", slide_bullets, fontfile)
                    segment_command = [
                        ffmpeg,
                        "-y",
                        "-stream_loop", "-1",
                        "-t", f"{segment_duration:.2f}",
                        "-i", str(source_path),
                        "-vf", vf,
                        "-r", str(fps),
                        "-c:v", "libx264",
                        "-preset", "medium",
                        "-crf", "20",
                        "-b:v", "5200k",
                        "-pix_fmt", "yuv420p",
                        str(segment_path),
                    ]
                    segment_result = subprocess.run(segment_command, capture_output=True, text=True)
                    if segment_result.returncode == 0 and segment_path.exists() and segment_path.stat().st_size > 0:
                        segment_paths.append(segment_path)

                if segment_paths:
                    concat_segment_file = clips_dir / f"clip_{index + 1:03d}_segments.txt"
                    concat_segment_lines: list[str] = []
                    for seg_path in segment_paths:
                        safe_seg_path = str(seg_path).replace("\\", "/")
                        concat_segment_lines.append(f"file '{safe_seg_path}'")
                    concat_segment_file.write_text(
                        "\n".join(concat_segment_lines),
                        encoding="utf-8",
                    )
                    concat_command = [
                        ffmpeg,
                        "-y",
                        "-f", "concat",
                        "-safe", "0",
                        "-i", str(concat_segment_file),
                        "-c", "copy",
                        str(clip_path),
                    ]
                    concat_result = subprocess.run(concat_command, capture_output=True, text=True)
                    if concat_result.returncode != 0 or not clip_path.exists() or clip_path.stat().st_size == 0:
                        fallback_command = [
                            ffmpeg,
                            "-y",
                            "-i", str(segment_paths[0]),
                            "-c:v", "libx264",
                            "-preset", "medium",
                            "-crf", "20",
                            "-b:v", "5200k",
                            "-pix_fmt", "yuv420p",
                            str(clip_path),
                        ]
                        fallback_result = subprocess.run(fallback_command, capture_output=True, text=True)
                        if fallback_result.returncode != 0:
                            raise RuntimeError(f"Failed to render montage clip {index + 1}: {fallback_result.stderr[-500:]}")

                    external_video_count += len(segment_paths)
                    montage_segments_total += len(segment_paths)
                    clip_paths.append(clip_path)
                    continue

            motion_name = self._motion_name(index, motion_template)
            top_text = (slide_title or "Concept Focus").replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'")
            hook_text = (str((bullets[0] if bullets else "Core concept explanation")).strip()).replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'")
            motion_vf = self._motion_filter(motion_name, fps=fps, duration=duration)
            complex_filter = (
                f"[1:v]{motion_vf}[bg];"
                "[0:v]scale=1080:608,format=rgba,colorchannelmixer=aa=0.85[card];"
                "[bg][card]overlay=(W-w)/2:(H-h)/2,"
                "drawbox=x=0:y=0:w=iw:h=88:color=black@0.34:t=fill,"
                "drawbox=x=0:y=ih-152:w=iw:h=152:color=black@0.40:t=fill,"
                f"drawtext=fontfile='{fontfile}':text='{top_text}':fontcolor=white:fontsize=40:x=52:y=20,"
                f"drawtext=fontfile='{fontfile}':text='{hook_text}':fontcolor=white:fontsize=28:x=52:y=h-116,"
                "format=yuv420p[v]"
            )
            command = [
                ffmpeg,
                "-y",
                "-loop", "1",
                "-t", f"{duration:.2f}",
                "-i", str(frame_path),
                "-f", "lavfi",
                "-t", f"{duration:.2f}",
                "-i", f"testsrc2=size=1280x720:rate={fps}",
                "-filter_complex", complex_filter,
                "-map", "[v]",
                "-r", str(fps),
                "-c:v", "libx264",
                "-preset", "medium",
                "-crf", "20",
                "-b:v", "5200k",
                "-pix_fmt", "yuv420p",
                str(clip_path),
            ]

            result = subprocess.run(command, capture_output=True, text=True)
            if result.returncode != 0:
                raise RuntimeError(f"Failed to render motion clip {index + 1}: {result.stderr[-500:]}")
            procedural_broll_count += 1
            clip_paths.append(clip_path)

        concat_file = self.temp_dir / "concat_list.txt"
        concat_lines: list[str] = []
        for path in clip_paths:
            safe_path = str(path).replace("\\", "/")
            concat_lines.append(f"file '{safe_path}'")
        concat_file.write_text("\n".join(concat_lines), encoding="utf-8")

        stitched_video = self.temp_dir / "stitched_video.mp4"
        concat_command = [
            ffmpeg,
            "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", str(concat_file),
            "-c", "copy",
            str(stitched_video),
        ]
        concat_result = subprocess.run(concat_command, capture_output=True, text=True)
        if concat_result.returncode != 0 or not stitched_video.exists():
            raise RuntimeError(f"Failed to stitch motion clips: {concat_result.stderr[-500:]}")

        current_video = stitched_video
        subtitles_enabled = False
        narration_enabled = False

        if include_subtitles and slides:
            subtitle_srt = self.create_subtitle_track(slides=slides, durations=durations)
            subtitled_video = self.temp_dir / "with_subtitles.mp4"
            if self._attach_subtitle_track(ffmpeg, current_video, subtitle_srt, subtitled_video):
                current_video = subtitled_video
                subtitles_enabled = True

        if include_narration_track and slides:
            narration_script = self.create_narration_script(
                slides=slides,
                subject=subject,
                chapter=chapter,
                topic=topic,
            )
            narration_wav = self._try_generate_tts_wav_windows(narration_script)
            if narration_wav:
                narrated_video = self.temp_dir / "with_narration.mp4"
                if self._attach_audio_track(ffmpeg, current_video, narration_wav, narrated_video):
                    current_video = narrated_video
                    narration_enabled = True
            else:
                rate, preferred_voice = self._voice_style_settings(voice_style)
                voice_script = self.temp_dir / "narration_voice.ps1"
                voice_wav = self.temp_dir / "narration_voice.wav"
                ps_lines = [
                    "Add-Type -AssemblyName System.Speech;",
                    "$speak = New-Object System.Speech.Synthesis.SpeechSynthesizer;",
                    f"$speak.Rate = {rate};",
                ]
                if preferred_voice:
                    safe_voice = preferred_voice.replace("'", "''")
                    ps_lines.append(f"$speak.SelectVoice('{safe_voice}');")
                narration_text = narration_script.read_text(encoding="utf-8").replace("`", "``")
                safe_voice_path = str(voice_wav).replace("\\", "/")
                ps_lines.extend([
                    f"$speak.SetOutputToWaveFile('{safe_voice_path}');",
                    f"$speak.Speak(@'\n{narration_text}\n'@);",
                    "$speak.Dispose();",
                ])
                voice_script.write_text("\n".join(ps_lines), encoding="utf-8")
                result = subprocess.run(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(voice_script)], capture_output=True, text=True)
                if result.returncode == 0 and voice_wav.exists() and voice_wav.stat().st_size > 0:
                    narrated_video = self.temp_dir / "with_voice_narration.mp4"
                    if self._attach_audio_track(ffmpeg, current_video, voice_wav, narrated_video):
                        current_video = narrated_video
                        narration_enabled = True

        final_command = [
            ffmpeg,
            "-y",
            "-i", str(current_video),
            "-c:v", "libx264",
            "-preset", "medium",
            "-crf", "20",
            "-b:v", "5200k",
            "-pix_fmt", "yuv420p",
            str(output_path),
        ]
        final_result = subprocess.run(final_command, capture_output=True, text=True)
        if final_result.returncode != 0:
            raise RuntimeError(f"ffmpeg final encode failed: {final_result.stderr[-500:]}")

        if not output_path.exists() or output_path.stat().st_size == 0:
            raise RuntimeError("Video file was not created or is empty.")

        self._write_render_manifest(
            output_path=output_path,
            slides_count=len(slides or []),
            motion_template=motion_template,
            subtitles_enabled=subtitles_enabled,
            narration_enabled=narration_enabled,
            external_video_count=external_video_count,
            procedural_broll_count=procedural_broll_count,
            broll_mode=broll_mode,
            montage_level=montage_level,
            montage_segments_total=montage_segments_total,
        )

        return output_path

    def _find_ffmpeg(self) -> Optional[str]:
        """Find ffmpeg executable in system PATH."""
        import shutil
        return shutil.which("ffmpeg")

    def cleanup(self):
        """Remove temporary files."""
        import shutil
        if self.temp_dir.exists():
            shutil.rmtree(self.temp_dir)
