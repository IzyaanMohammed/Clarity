"""
One-time migration utility for legacy progress_data.json -> SQLite progress_logs.

Usage:
  d:/Desktop/clarity/.venv/Scripts/python.exe migrate_legacy_progress.py
  d:/Desktop/clarity/.venv/Scripts/python.exe migrate_legacy_progress.py --dry-run
"""

from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path
from typing import Any

from services.database import DB_PATH, init_db

LEGACY_FILE = Path(__file__).resolve().parent / "progress_data.json"


def _load_legacy_rows() -> list[dict[str, Any]]:
    if not LEGACY_FILE.exists():
        return []
    try:
        payload = json.loads(LEGACY_FILE.read_text(encoding="utf-8"))
    except Exception:
        return []
    if not isinstance(payload, list):
        return []
    return [row for row in payload if isinstance(row, dict)]


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _already_exists(conn: sqlite3.Connection, username: str, action: str, subject: str, chapter: str, timestamp: str) -> bool:
    row = conn.execute(
        """
        SELECT id FROM progress_logs
        WHERE username = ? AND action = ? AND subject = ? AND chapter = ? AND timestamp = ?
        LIMIT 1
        """,
        (username, action, subject, chapter, timestamp),
    ).fetchone()
    return row is not None


def migrate(dry_run: bool = False) -> tuple[int, int]:
    init_db()
    rows = _load_legacy_rows()
    inserted = 0
    skipped = 0

    with _connect() as conn:
        for row in rows:
            username = str(row.get("user_id") or "").strip()
            action = str(row.get("action") or "question").strip() or "question"
            subject = str(row.get("subject") or "General").strip() or "General"
            chapter = str(row.get("chapter") or "Core Concepts").strip() or "Core Concepts"
            timestamp = str(row.get("timestamp") or "").strip()
            score_raw = row.get("score")
            score = int(score_raw) if isinstance(score_raw, (int, float)) else None

            if not username or not timestamp:
                skipped += 1
                continue

            if _already_exists(conn, username, action, subject, chapter, timestamp):
                skipped += 1
                continue

            inserted += 1
            if dry_run:
                continue

            conn.execute(
                """
                INSERT INTO progress_logs (username, action, subject, chapter, score, timestamp)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (username, action, subject, chapter, score, timestamp),
            )

        if not dry_run:
            conn.commit()

    return inserted, skipped


def main() -> None:
    parser = argparse.ArgumentParser(description="Migrate legacy progress_data.json entries into SQLite progress_logs")
    parser.add_argument("--dry-run", action="store_true", help="Compute migration result without writing DB rows")
    args = parser.parse_args()

    inserted, skipped = migrate(dry_run=args.dry_run)
    mode = "DRY RUN" if args.dry_run else "MIGRATION"
    print(f"[{mode}] inserted={inserted} skipped={skipped} source='{LEGACY_FILE.name}' db='{DB_PATH.name}'")


if __name__ == "__main__":
    main()
