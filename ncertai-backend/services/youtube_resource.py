import re
import time
from typing import Any
from urllib.parse import quote_plus

try:
    from pytube import Search as PyTubeSearch
except Exception:  # pragma: no cover - optional dependency
    PyTubeSearch = None

try:
    from youtube_search import YoutubeSearch
except Exception:  # pragma: no cover - optional dependency
    YoutubeSearch = None

try:
    import yt_dlp
except Exception:
    yt_dlp = None


def _normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip()).lower()


def _score_video(title: str, subject: str, grade: str, chapter: str) -> int:
    title_l = _normalize_text(title)
    score = 0

    if f"class {grade}" in title_l or f"{grade}th" in title_l:
        score += 5
    if _normalize_text(subject) in title_l:
        score += 4

    chapter_terms = [t for t in re.findall(r"[a-zA-Z0-9]{3,}", chapter.lower()) if t not in {"chapter", "class", "cbse"}]
    overlap = sum(1 for term in chapter_terms if term in title_l)
    score += overlap * 3

    if "cbse" in title_l:
        score += 3
    if "full chapter" in title_l or "full lesson" in title_l:
        score += 2
    if "official" in title_l:
        score += 2

    return score


def _safe_video_url(video_id: str) -> str:
    clean_id = str(video_id or "").strip()
    if clean_id.startswith("http"):
        return clean_id
    if clean_id.startswith("/watch"):
        return f"https://www.youtube.com{clean_id}"
    if clean_id.startswith("watch"):
        return f"https://www.youtube.com/{clean_id}"
    return f"https://www.youtube.com/watch?v={clean_id}"


def _safe_embed_url(video_id: str) -> str:
    clean_id = str(video_id or "").strip()
    if clean_id.startswith("/watch"):
        match = re.search(r"v=([A-Za-z0-9_-]{6,})", clean_id)
        if match:
            clean_id = match.group(1)
    if "youtube.com/watch" in clean_id:
        match = re.search(r"v=([A-Za-z0-9_-]{6,})", clean_id)
        if match:
            clean_id = match.group(1)
    return f"https://www.youtube.com/embed/{clean_id}"


def get_best_cbse_videos(subject: str, grade: str, chapter: str, limit: int = 5) -> dict[str, Any]:
    query = f"CBSE Class {grade} {subject} Chapter {chapter} official lesson full chapter"
    limit = max(1, min(int(limit or 5), 8))
    candidates: list[dict[str, Any]] = []

    if yt_dlp is not None:
        ydl_opts = {
            'quiet': True,
            'extract_flat': 'in_playlist',
            'skip_download': True,
            'no_warnings': True,
        }
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(f"ytsearch{limit}:{query}", download=False)
                if info and 'entries' in info:
                    for entry in info['entries']:
                        video_id = entry.get('id')
                        title = entry.get('title')
                        if video_id and title:
                            candidates.append({
                                "video_id": video_id,
                                "title": title,
                                "url": _safe_video_url(video_id),
                                "embed_url": _safe_embed_url(video_id),
                                "embed_code": f"<iframe width='560' height='315' src='{_safe_embed_url(video_id)}' frameborder='0' allowfullscreen></iframe>",
                                "duration": str(entry.get('duration_string') or entry.get('duration') or ""),
                                "channel": str(entry.get('uploader') or entry.get('channel') or ""),
                                "search_source": "yt_dlp",
                                "match_score": _score_video(title, subject, grade, chapter),
                            })
        except Exception:
            pass

    if not candidates and PyTubeSearch is not None:
        for attempt in range(1, 12):
            try:
                search = PyTubeSearch(query)
                results = list(search.results or [])
                for result in results[:10]:
                    video_id = str(getattr(result, "video_id", "") or "").strip()
                    title = str(getattr(result, "title", "") or "").strip()
                    if not video_id or not title:
                        continue
                    candidates.append(
                        {
                            "video_id": video_id,
                            "title": title,
                            "url": _safe_video_url(video_id),
                            "embed_url": _safe_embed_url(video_id),
                            "embed_code": f"<iframe width='560' height='315' src='{_safe_embed_url(video_id)}' frameborder='0' allowfullscreen></iframe>",
                            "duration": str(getattr(result, "length", "") or ""),
                            "channel": str(getattr(result, "author", "") or ""),
                            "search_source": "pytube",
                            "match_score": _score_video(title, subject, grade, chapter),
                        }
                    )
                if candidates:
                    break
            except Exception:
                time.sleep(1)
                if attempt == 11:
                    break

    if not candidates and YoutubeSearch is not None:
        try:
            fallback = YoutubeSearch(query, max_results=10).to_dict() or []
            for item in fallback:
                video_id = str(item.get("id") or item.get("url_suffix") or "").strip()
                title = str(item.get("title") or "").strip()
                if not video_id or not title:
                    continue
                candidates.append(
                    {
                        "video_id": video_id,
                        "title": title,
                        "url": _safe_video_url(video_id),
                        "embed_url": _safe_embed_url(video_id),
                        "embed_code": f"<iframe width='560' height='315' src='{_safe_embed_url(video_id)}' frameborder='0' allowfullscreen></iframe>",
                        "duration": str(item.get("duration") or ""),
                        "channel": str(item.get("channel") or ""),
                        "search_source": "youtube_search",
                        "match_score": _score_video(title, subject, grade, chapter),
                    }
                )
        except Exception:
            pass

    dedup: dict[str, dict[str, Any]] = {}
    for row in candidates:
        key = str(row.get("url") or "").strip()
        if not key:
            continue
        existing = dedup.get(key)
        if not existing or int(row.get("match_score", 0)) > int(existing.get("match_score", 0)):
            dedup[key] = row

    ranked = sorted(dedup.values(), key=lambda r: int(r.get("match_score", 0)), reverse=True)
    if ranked:
        ranked[0]["most_relevant"] = True
        
    if not ranked:
        # Fallback map for common chapters to avoid serving Life Processes for everything
        chapter_l = _normalize_text(chapter)
        fallback_video_id = "OlrKfytI4i4" # Default: Life Processes
        if "acid" in chapter_l or "base" in chapter_l or "salt" in chapter_l:
            fallback_video_id = "xZ1IeZ1Q_3c" # Acids, Bases and Salts
        elif "chemical reaction" in chapter_l:
            fallback_video_id = "xXh2R6G_73Y" # Chemical Reactions
        elif "metal" in chapter_l and "non" in chapter_l:
            fallback_video_id = "1nC_rC7OQks" # Metals and Non-metals
        elif "carbon" in chapter_l:
            fallback_video_id = "4SXYP_t-3iQ" # Carbon and its Compounds
        elif "life process" in chapter_l:
            fallback_video_id = "OlrKfytI4i4" # Life Processes
        elif "control" in chapter_l and "coordination" in chapter_l:
            fallback_video_id = "zP9j6x0w008" # Control and Coordination
        elif "reproduc" in chapter_l:
            fallback_video_id = "4YyV3T6P4wQ" # How do Organisms Reproduce
        elif "heredity" in chapter_l or "evolution" in chapter_l:
            fallback_video_id = "TzZ2R_Jm2eE" # Heredity and Evolution
        elif "light" in chapter_l or "reflection" in chapter_l:
            fallback_video_id = "uU1p-Y1Fpxw" # Light
        elif "human eye" in chapter_l or "colourful" in chapter_l:
            fallback_video_id = "eF_oB-R8sI8" # Human Eye
        elif "electricity" in chapter_l:
            fallback_video_id = "wK_fFm-p7zI" # Electricity
        elif "magnetic" in chapter_l:
            fallback_video_id = "gJv3B0M_3cI" # Magnetic Effects
        elif "environment" in chapter_l:
            fallback_video_id = "K6y9v5aLq9s" # Our Environment
        elif "math" in _normalize_text(subject):
            fallback_video_id = "2d7Q-3R7b_M" # Generic Math

        fallback_embed = _safe_embed_url(fallback_video_id)
        fallback_url = _safe_video_url(fallback_video_id)
        ranked = [
            {
                "video_id": fallback_video_id,
                "title": f"CBSE Class {grade} {subject} chapter lesson (Clarity fallback)",
                "url": fallback_url,
                "embed_url": fallback_embed,
                "embed_code": f"<iframe width='560' height='315' src='{fallback_embed}' frameborder='0' allowfullscreen></iframe>",
                "duration": "",
                "channel": "Clarity Curated",
                "search_source": "embed_fallback",
                "match_score": 1,
            }
        ]

    return {
        "query": query,
        "query_url": f"https://www.youtube.com/results?search_query={quote_plus(query)}",
        "videos": ranked[:limit],
    }
