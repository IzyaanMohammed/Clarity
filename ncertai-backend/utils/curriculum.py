from __future__ import annotations

import json
import re
from pathlib import Path


_CACHE: dict[str, object] = {"mtime": None, "data": {}}


def _frontend_curriculum_path() -> Path:
    # backend/utils -> backend -> repo root -> project/src/constants/ncert.ts
    return Path(__file__).resolve().parents[2] / "project" / "src" / "constants" / "ncert.ts"


def _extract_object_literal(source: str) -> str:
    marker = "NCERT_CHAPTERS"
    marker_index = source.find(marker)
    if marker_index < 0:
        return "{}"

    brace_start = source.find("{", marker_index)
    if brace_start < 0:
        return "{}"

    depth = 0
    for idx in range(brace_start, len(source)):
        char = source[idx]
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return source[brace_start: idx + 1]
    return "{}"


def _to_json_text(js_object_literal: str) -> str:
    # The TS object is already JSON-like (quoted keys/strings), only trailing commas break json.loads.
    return re.sub(r",\s*([}\]])", r"\1", js_object_literal)


def load_curriculum_catalog() -> dict[str, dict[str, list[str]]]:
    source_path = _frontend_curriculum_path()
    if not source_path.exists():
        cached = _CACHE.get("data")
        return cached if isinstance(cached, dict) else {}

    mtime = source_path.stat().st_mtime
    if _CACHE.get("mtime") == mtime and isinstance(_CACHE.get("data"), dict):
        return _CACHE["data"]  # type: ignore[return-value]

    raw = source_path.read_text(encoding="utf-8")
    literal = _extract_object_literal(raw)
    json_text = _to_json_text(literal)
    parsed = json.loads(json_text)
    if not isinstance(parsed, dict):
        parsed = {}

    normalized: dict[str, dict[str, list[str]]] = {}
    for class_num, subject_map in parsed.items():
        if not isinstance(class_num, str) or not isinstance(subject_map, dict):
            continue
        normalized_subjects: dict[str, list[str]] = {}
        for subject, chapters in subject_map.items():
            if not isinstance(subject, str) or not isinstance(chapters, list):
                continue
            normalized_subjects[subject] = [str(ch).strip() for ch in chapters if str(ch).strip()]
        normalized[class_num] = normalized_subjects

    _CACHE["mtime"] = mtime
    _CACHE["data"] = normalized
    return normalized
