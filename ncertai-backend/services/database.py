import hashlib
import os
import secrets
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

DB_PATH = Path(os.getenv("CLARITY_DB_PATH", Path(__file__).resolve().parent.parent / "clarity.db"))


def _utc_now_iso() -> str:
    return datetime.utcnow().isoformat()


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with _connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY,
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                school TEXT,
                class_num INTEGER,
                subjects_json TEXT,
                learning_style TEXT,
                goal TEXT,
                study_hours TEXT,
                focus_areas TEXT,
                exam_board TEXT,
                preferred_language TEXT,
                preferred_pace TEXT,
                confidence_level TEXT,
                revision_frequency TEXT,
                parent_email TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                created_at TEXT NOT NULL,
                last_seen_at TEXT NOT NULL,
                FOREIGN KEY(username) REFERENCES users(username)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS progress_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                action TEXT NOT NULL,
                subject TEXT NOT NULL,
                chapter TEXT NOT NULL,
                score INTEGER,
                timestamp TEXT NOT NULL,
                FOREIGN KEY(username) REFERENCES users(username)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS study_materials (
                id TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                type TEXT NOT NULL,
                title TEXT NOT NULL,
                subject TEXT,
                chapter TEXT,
                content TEXT,
                url TEXT,
                image_data_url TEXT,
                created_at INTEGER NOT NULL,
                FOREIGN KEY(username) REFERENCES users(username)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS user_snapshots (
                username TEXT PRIMARY KEY,
                payload_json TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY(username) REFERENCES users(username)
            )
            """
        )


def _hash_password(password: str, salt: str) -> str:
    hashed = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 120000)
    return hashed.hex()


def create_user(username: str, password: str, profile: dict[str, Any]) -> bool:
    salt = secrets.token_hex(16)
    password_hash = _hash_password(password, salt)
    now = _utc_now_iso()

    with _connect() as conn:
        existing = conn.execute("SELECT username FROM users WHERE username = ?", (username,)).fetchone()
        if existing:
            return False
        conn.execute(
            """
            INSERT INTO users (
                username, password_hash, salt, school, class_num, subjects_json,
                learning_style, goal, study_hours, focus_areas, exam_board,
                preferred_language, preferred_pace, confidence_level,
                revision_frequency, parent_email, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                username,
                password_hash,
                salt,
                profile.get("school"),
                profile.get("class"),
                profile.get("subjects_json"),
                profile.get("learningStyle"),
                profile.get("goal"),
                profile.get("studyHours"),
                profile.get("focusAreas"),
                profile.get("examBoard"),
                profile.get("preferredLanguage"),
                profile.get("preferredPace"),
                profile.get("confidenceLevel"),
                profile.get("revisionFrequency"),
                profile.get("parentEmail"),
                now,
                now,
            ),
        )
    return True


def verify_user(username: str, password: str) -> bool:
    with _connect() as conn:
        row = conn.execute("SELECT salt, password_hash FROM users WHERE username = ?", (username,)).fetchone()
        if not row:
            return False
        expected = row["password_hash"]
        return _hash_password(password, row["salt"]) == expected


def create_session(username: str) -> str:
    token = secrets.token_urlsafe(36)
    now = _utc_now_iso()
    with _connect() as conn:
        conn.execute(
            "INSERT INTO sessions (token, username, created_at, last_seen_at) VALUES (?, ?, ?, ?)",
            (token, username, now, now),
        )
    return token


def get_username_by_token(token: str) -> Optional[str]:
    if not token:
        return None
    with _connect() as conn:
        row = conn.execute("SELECT username FROM sessions WHERE token = ?", (token,)).fetchone()
        if not row:
            return None
        conn.execute("UPDATE sessions SET last_seen_at = ? WHERE token = ?", (_utc_now_iso(), token))
        return str(row["username"])


def delete_session(token: str) -> None:
    with _connect() as conn:
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))


def update_user_profile(username: str, profile: dict[str, Any]) -> None:
    now = _utc_now_iso()
    with _connect() as conn:
        conn.execute(
            """
            UPDATE users
            SET school = ?, class_num = ?, subjects_json = ?, learning_style = ?, goal = ?,
                study_hours = ?, focus_areas = ?, exam_board = ?, preferred_language = ?,
                preferred_pace = ?, confidence_level = ?, revision_frequency = ?,
                parent_email = ?, updated_at = ?
            WHERE username = ?
            """,
            (
                profile.get("school"),
                profile.get("class"),
                profile.get("subjects_json"),
                profile.get("learningStyle"),
                profile.get("goal"),
                profile.get("studyHours"),
                profile.get("focusAreas"),
                profile.get("examBoard"),
                profile.get("preferredLanguage"),
                profile.get("preferredPace"),
                profile.get("confidenceLevel"),
                profile.get("revisionFrequency"),
                profile.get("parentEmail"),
                now,
                username,
            ),
        )


def get_user_profile(username: str) -> Optional[dict[str, Any]]:
    with _connect() as conn:
        row = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
        if not row:
            return None
        return dict(row)


def insert_progress_log(username: str, action: str, subject: str, chapter: str, score: Optional[int]) -> None:
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO progress_logs (username, action, subject, chapter, score, timestamp)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (username, action, subject, chapter, score, _utc_now_iso()),
        )


def fetch_progress_logs(username: Optional[str] = None) -> list[dict[str, Any]]:
    with _connect() as conn:
        if username:
            rows = conn.execute(
                "SELECT username as user_id, action, subject, chapter, score, timestamp FROM progress_logs WHERE username = ? ORDER BY timestamp ASC",
                (username,),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT username as user_id, action, subject, chapter, score, timestamp FROM progress_logs ORDER BY timestamp ASC"
            ).fetchall()
        return [dict(row) for row in rows]


def upsert_study_material(username: str, material: dict[str, Any]) -> None:
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO study_materials (id, username, type, title, subject, chapter, content, url, image_data_url, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                type = excluded.type,
                title = excluded.title,
                subject = excluded.subject,
                chapter = excluded.chapter,
                content = excluded.content,
                url = excluded.url,
                image_data_url = excluded.image_data_url,
                created_at = excluded.created_at
            """,
            (
                material.get("id"),
                username,
                material.get("type"),
                material.get("title"),
                material.get("subject"),
                material.get("chapter"),
                material.get("content"),
                material.get("url"),
                material.get("imageDataUrl"),
                material.get("createdAt") or 0,
            ),
        )


def get_study_materials(username: str) -> list[dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT id, type, title, subject, chapter, content, url, image_data_url as imageDataUrl, created_at as createdAt FROM study_materials WHERE username = ? ORDER BY created_at DESC",
            (username,),
        ).fetchall()
    return [dict(row) for row in rows]


def save_user_snapshot(username: str, payload_json: str) -> None:
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO user_snapshots (username, payload_json, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(username) DO UPDATE SET
                payload_json = excluded.payload_json,
                updated_at = excluded.updated_at
            """,
            (username, payload_json, _utc_now_iso()),
        )


def get_user_snapshot(username: str) -> Optional[str]:
    with _connect() as conn:
        row = conn.execute("SELECT payload_json FROM user_snapshots WHERE username = ?", (username,)).fetchone()
    if not row:
        return None
    return str(row["payload_json"])
