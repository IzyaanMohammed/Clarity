import json
import logging
import os
import re
from pathlib import Path
from typing import Any
from urllib.parse import urljoin

import httpx

logger = logging.getLogger(__name__)

CACHE_FILE = Path(__file__).resolve().parent.parent / "data" / "remote_worksheets_cache.json"
DEFAULT_TTL_SECONDS = 900
DEFAULT_BASE_URL = os.getenv("CLARITY_BACKEND_BASE_URL", "http://127.0.0.1:8000").strip() or "http://127.0.0.1:8000"
DEFAULT_LOCAL_JSON_FILE = Path(__file__).resolve().parent.parent / "data" / "cbse-grade9-worksheets.json"


def _resolve_source_url(url: str) -> str:
    if not url:
        return ""
    if url.startswith("http://") or url.startswith("https://"):
        return url
    if url.startswith("/"):
        return urljoin(DEFAULT_BASE_URL, url)
    return url


def _load_cache() -> dict[str, Any]:
    if not CACHE_FILE.exists():
        return {"updated_at": 0, "worksheets": []}
    try:
        return json.loads(CACHE_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {"updated_at": 0, "worksheets": []}


def _save_cache(data: dict[str, Any]) -> None:
    CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
    CACHE_FILE.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def _load_local_fallback_worksheets() -> list[dict[str, Any]]:
    configured = os.getenv("CLARITY_WORKSHEET_LOCAL_JSON", "").strip()
    candidates = []

    if configured:
        configured_path = Path(configured)
        if not configured_path.is_absolute():
            configured_path = (Path(__file__).resolve().parent.parent / configured_path).resolve()
        candidates.append(configured_path)

    candidates.append(DEFAULT_LOCAL_JSON_FILE)

    for file_path in candidates:
        if not file_path.exists():
            continue
        try:
            payload = json.loads(file_path.read_text(encoding="utf-8"))
            return _parse_feed_payload(payload)
        except Exception as exc:
            logger.warning("Failed reading local worksheet fallback %s: %s", file_path, exc)

    return []


def _normalize_worksheet(item: dict[str, Any]) -> dict[str, Any] | None:
    title = str(item.get("title") or "").strip()
    chapter = str(item.get("chapter") or "General").strip()
    subject = str(item.get("subject") or "").strip()
    class_num = str(item.get("class_num") or "").strip()
    questions = item.get("questions") if isinstance(item.get("questions"), list) else []
    questions = [str(q).strip() for q in questions if str(q).strip()]

    if not title or not subject or not class_num:
        return None

    year = item.get("year")
    try:
        year = int(year) if year is not None else 0
    except Exception:
        year = 0

    difficulty = str(item.get("difficulty") or "Medium").strip().title()
    question_type = str(item.get("question_type") or "past-paper").strip().lower()
    if question_type not in {"past-paper", "mixed", "variety", "1-mark", "3-mark", "5-mark"}:
        question_type = "past-paper"

    ws_id = str(item.get("id") or f"ws_remote_{class_num}_{subject}_{chapter}_{year}_{abs(hash(title)) % 999999}")

    return {
        "id": ws_id,
        "title": title,
        "class_num": class_num,
        "subject": subject,
        "chapter": chapter,
        "question_type": question_type,
        "difficulty": difficulty,
        "num_questions": max(1, min(int(item.get("num_questions") or len(questions) or 5), 20)),
        "board": str(item.get("board") or "CBSE"),
        "year": year,
        "source_paper_id": item.get("source_paper_id"),
        "pdf_url": item.get("pdf_url") or item.get("source_url"),
        "source_url": item.get("source_url") or item.get("pdf_url"),
        "questions": questions[:20],
    }


def _parse_feed_payload(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, dict):
        raw_items = payload.get("worksheets") or payload.get("items") or payload.get("data") or []
    elif isinstance(payload, list):
        raw_items = payload
    else:
        raw_items = []

    normalized: list[dict[str, Any]] = []
    for raw in raw_items:
        if not isinstance(raw, dict):
            continue
        item = _normalize_worksheet(raw)
        if item:
            normalized.append(item)
    return normalized


def _infer_subject_and_chapter(title: str) -> tuple[str, str]:
    lowered = title.lower()
    subject = "Science"
    chapter = "General"

    if any(k in lowered for k in ["math", "mathematics", "algebra", "geometry", "number system"]):
        subject = "Mathematics"
    elif any(k in lowered for k in ["science", "physics", "chemistry", "biology"]):
        subject = "Science"
    elif "english" in lowered:
        subject = "English"
    elif "social" in lowered or "history" in lowered or "geography" in lowered:
        subject = "Social Science"

    chapter_match = re.search(r"class\s*ix\s*[-: ]\s*([^|]+)", title, flags=re.IGNORECASE)
    if chapter_match:
        chapter = chapter_match.group(1).strip()
    elif " - " in title:
        chapter = title.split(" - ", 1)[1].strip() or chapter

    return subject, chapter


def _extract_html_links(base_url: str, html: str) -> list[dict[str, Any]]:
    links: list[dict[str, Any]] = []
    for match in re.finditer(r'<a[^>]+href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', html, flags=re.IGNORECASE | re.DOTALL):
        href = match.group(1).strip()
        label_html = match.group(2)
        label = re.sub(r"<[^>]+>", " ", label_html)
        label = re.sub(r"\s+", " ", label).strip()
        if not href or not label:
            continue

        full_url = urljoin(base_url, href)
        lowered = f"{label} {href}".lower()
        if not any(k in lowered for k in ["sample", "sample question", "question paper", "questionbank", "question bank", "sqp", "worksheet", "class ix", "class 9"]):
            continue

        subject, chapter = _infer_subject_and_chapter(label)
        links.append(
            {
                "id": f"ws_html_{abs(hash(full_url + label)) % 999999}",
                "title": f"CBSE Worksheet: {label[:90]}",
                "class_num": "9",
                "subject": subject,
                "chapter": chapter,
                "question_type": "past-paper",
                "difficulty": "Medium",
                "num_questions": 8,
                "board": "CBSE",
                "year": 2024,
                "pdf_url": full_url if full_url.lower().endswith(".pdf") else None,
                "source_url": full_url,
                "questions": [],
            }
        )

    return links


def _discover_remote_worksheets() -> list[dict[str, Any]]:
    feeds = [u.strip() for u in os.getenv("CLARITY_WORKSHEET_FEEDS", "").split(",") if u.strip()]
    khan_api_url = os.getenv("CLARITY_KHAN_WORKSHEET_API", "").strip()
    if not feeds:
        feeds = []

    discovered: list[dict[str, Any]] = []
    with httpx.Client(timeout=15.0) as client:
        for feed_url in feeds:
            try:
                resolved_feed_url = _resolve_source_url(feed_url)
                response = client.get(resolved_feed_url)
                response.raise_for_status()
                content_type = str(response.headers.get("content-type", "")).lower()
                if "json" in content_type:
                    payload = response.json()
                    discovered.extend(_parse_feed_payload(payload))
                else:
                    discovered.extend(_extract_html_links(str(response.url), response.text))
            except Exception as exc:
                logger.warning("Worksheet feed failed for %s: %s", feed_url, exc)

        # Optional provider hook for Khan-style worksheet sources served by your own adapter endpoint.
        # This avoids hard-coding undocumented third-party APIs and keeps integration policy-safe.
        if khan_api_url:
            try:
                resolved_khan_url = _resolve_source_url(khan_api_url)
                response = client.get(resolved_khan_url)
                response.raise_for_status()
                content_type = str(response.headers.get("content-type", "")).lower()
                if "json" in content_type:
                    payload = response.json()
                    discovered.extend(_parse_feed_payload(payload))
            except Exception as exc:
                logger.warning("Khan worksheet provider failed for %s: %s", khan_api_url, exc)

    discovered.extend(_load_local_fallback_worksheets())

    # de-dupe by content signature
    dedup: dict[str, dict[str, Any]] = {}
    for item in discovered:
        key = "|".join([
            item.get("class_num", ""),
            item.get("subject", "").lower(),
            item.get("chapter", "").lower(),
            item.get("title", "").lower(),
            str(item.get("year", 0)),
        ])
        dedup[key] = item
    return list(dedup.values())


def get_remote_worksheets_cached(force_refresh: bool = False, ttl_seconds: int = DEFAULT_TTL_SECONDS) -> list[dict[str, Any]]:
    env_ttl = os.getenv("CLARITY_WORKSHEET_CACHE_TTL_SECONDS", "").strip()
    if env_ttl:
        try:
            ttl_seconds = int(env_ttl)
        except ValueError:
            ttl_seconds = DEFAULT_TTL_SECONDS

    cache = _load_cache()
    now_ts = int(__import__("time").time())
    last_updated = int(cache.get("updated_at", 0) or 0)
    cached_items = cache.get("worksheets", []) if isinstance(cache.get("worksheets"), list) else []

    is_stale = (now_ts - last_updated) > max(60, ttl_seconds)
    if not force_refresh and not is_stale:
        return cached_items

    discovered = _discover_remote_worksheets()
    if discovered:
        _save_cache({"updated_at": now_ts, "worksheets": discovered})
        return discovered

    # keep last known cache if discovery fails
    return cached_items


def merge_local_and_remote_worksheets(
    local_items: list[dict[str, Any]],
    class_num: str,
    subject: str,
    chapter: str | None = None,
    limit: int = 24,
    force_refresh: bool = False,
) -> list[dict[str, Any]]:
    remote_items = get_remote_worksheets_cached(force_refresh=force_refresh)

    class_num_str = str(class_num)
    chapter_l = chapter.lower() if chapter else None
    preferred_board = os.getenv("CLARITY_WORKSHEET_BOARD", "CBSE").strip().upper() or "CBSE"
    allow_all_boards = os.getenv("CLARITY_ALLOW_ALL_BOARDS", "0").strip().lower() in {"1", "true", "yes"}

    filtered_remote = [
        r for r in remote_items
        if str(r.get("class_num", "")) == class_num_str
        and str(r.get("subject", "")).lower() == subject.lower()
        and (chapter_l is None or str(r.get("chapter", "")).lower() == chapter_l)
        and (
            allow_all_boards
            or str(r.get("board", "CBSE")).strip().upper() == preferred_board
        )
    ]

    combined = local_items + filtered_remote

    dedup: dict[str, dict[str, Any]] = {}
    for item in combined:
        key = "|".join([
            str(item.get("class_num", "")),
            str(item.get("subject", "")).lower(),
            str(item.get("chapter", "")).lower(),
            str(item.get("title", "")).lower(),
            str(item.get("year", 0)),
        ])
        dedup[key] = item

    result = list(dedup.values())
    result.sort(key=lambda w: (int(w.get("year", 0) or 0), str(w.get("title", ""))), reverse=True)
    return result[: max(1, min(limit, 100))]
