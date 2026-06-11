import hashlib
import json
import os
import secrets
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

import shutil

# Detect Vercel environment
IS_VERCEL = os.getenv("VERCEL") == "1" or "VERCEL" in os.environ

if IS_VERCEL and not os.getenv("CLARITY_DB_PATH"):
    # Use ephemeral writable /tmp directory on Vercel
    BUNDLED_DB = Path(__file__).resolve().parent.parent / "clarity.db"
    DB_PATH = Path("/tmp/clarity.db")
    if BUNDLED_DB.exists() and not DB_PATH.exists():
        try:
            DB_PATH.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(BUNDLED_DB, DB_PATH)
            print(f"Copied bundled SQLite database to {DB_PATH}")
        except Exception as e:
            print(f"Warning: Failed to copy bundled DB to /tmp: {e}")
else:
    env_db_path = os.getenv("CLARITY_DB_PATH")
    BUNDLED_DB = Path(__file__).resolve().parent.parent / "clarity.db"
    if env_db_path:
        DB_PATH = Path(env_db_path)
        # If running on persistent volume and the target db does not exist, copy the bundled db
        if BUNDLED_DB.exists() and not DB_PATH.exists():
            try:
                DB_PATH.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(BUNDLED_DB, DB_PATH)
                print(f"Seeded persistent SQLite database at {DB_PATH} from bundled DB")
            except Exception as e:
                print(f"Warning: Failed to seed persistent DB at {DB_PATH}: {e}")
    else:
        DB_PATH = BUNDLED_DB



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
                subscription_tier TEXT,
                subscription_status TEXT,
                trial_start TEXT,
                trial_end TEXT,
                subscription_end TEXT,
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
                teacher_personality TEXT,
                focus_chapters_json TEXT,
                country TEXT DEFAULT 'India',
                state TEXT DEFAULT 'Delhi',
                city TEXT DEFAULT 'New Delhi',
                points INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        # Lightweight migration for older databases
        user_columns = [row[1] for row in conn.execute("PRAGMA table_info(users)").fetchall()]
        if "subscription_tier" not in user_columns:
            conn.execute("ALTER TABLE users ADD COLUMN subscription_tier TEXT DEFAULT 'free'")
        if "subscription_status" not in user_columns:
            conn.execute("ALTER TABLE users ADD COLUMN subscription_status TEXT DEFAULT 'inactive'")
        if "trial_start" not in user_columns:
            conn.execute("ALTER TABLE users ADD COLUMN trial_start TEXT")
        if "trial_end" not in user_columns:
            conn.execute("ALTER TABLE users ADD COLUMN trial_end TEXT")
        if "subscription_end" not in user_columns:
            conn.execute("ALTER TABLE users ADD COLUMN subscription_end TEXT")
        if "teacher_personality" not in user_columns:
            conn.execute("ALTER TABLE users ADD COLUMN teacher_personality TEXT")
        if "focus_chapters_json" not in user_columns:
            conn.execute("ALTER TABLE users ADD COLUMN focus_chapters_json TEXT")
        if "country" not in user_columns:
            conn.execute("ALTER TABLE users ADD COLUMN country TEXT DEFAULT 'India'")
        if "state" not in user_columns:
            conn.execute("ALTER TABLE users ADD COLUMN state TEXT DEFAULT 'Delhi'")
        if "city" not in user_columns:
            conn.execute("ALTER TABLE users ADD COLUMN city TEXT DEFAULT 'New Delhi'")
        if "points" not in user_columns:
            conn.execute("ALTER TABLE users ADD COLUMN points INTEGER DEFAULT 0")
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
            "CREATE INDEX IF NOT EXISTS idx_progress_logs_username ON progress_logs (username)"
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
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS parent_accounts (
                student_username TEXT PRIMARY KEY,
                parent_email TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                plain_password TEXT,
                encouragement_note TEXT,
                weekly_goals TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY(student_username) REFERENCES users(username)
            )
            """
        )
        # Migration: remove legacy UNIQUE(parent_email) constraint to allow one parent email for multiple students.
        parent_columns = [row[1] for row in conn.execute("PRAGMA table_info(parent_accounts)").fetchall()]
        if parent_columns and "plain_password" not in parent_columns:
            conn.execute("ALTER TABLE parent_accounts ADD COLUMN plain_password TEXT;")
            parent_columns.append("plain_password")
        if parent_columns and "encouragement_note" not in parent_columns:
            conn.execute("ALTER TABLE parent_accounts ADD COLUMN encouragement_note TEXT;")
            parent_columns.append("encouragement_note")
        if parent_columns and "weekly_goals" not in parent_columns:
            conn.execute("ALTER TABLE parent_accounts ADD COLUMN weekly_goals TEXT;")
            parent_columns.append("weekly_goals")
        if parent_columns:
            index_rows = conn.execute("PRAGMA index_list(parent_accounts)").fetchall()
            has_unique_parent_email = False
            for idx in index_rows:
                try:
                    is_unique = int(idx[2]) == 1
                    index_name = str(idx[1])
                except Exception:
                    continue
                if not is_unique:
                    continue
                cols = conn.execute(f"PRAGMA index_info({index_name})").fetchall()
                col_names = [str(c[2]) for c in cols]
                if col_names == ["parent_email"]:
                    has_unique_parent_email = True
                    break

            if has_unique_parent_email:
                conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS parent_accounts_new (
                        student_username TEXT PRIMARY KEY,
                        parent_email TEXT NOT NULL,
                        password_hash TEXT NOT NULL,
                        salt TEXT NOT NULL,
                        plain_password TEXT,
                        encouragement_note TEXT,
                        weekly_goals TEXT,
                        created_at TEXT NOT NULL,
                        updated_at TEXT NOT NULL,
                        FOREIGN KEY(student_username) REFERENCES users(username)
                    )
                    """
                )
                conn.execute(
                    """
                    INSERT OR REPLACE INTO parent_accounts_new (
                        student_username, parent_email, password_hash, salt, plain_password, encouragement_note, weekly_goals, created_at, updated_at
                    )
                    SELECT student_username, parent_email, password_hash, salt, plain_password, encouragement_note, weekly_goals, created_at, updated_at
                    FROM parent_accounts
                    """
                )
                conn.execute("DROP TABLE parent_accounts")
                conn.execute("ALTER TABLE parent_accounts_new RENAME TO parent_accounts")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS parent_sessions (
                token TEXT PRIMARY KEY,
                parent_email TEXT NOT NULL,
                student_username TEXT NOT NULL,
                created_at TEXT NOT NULL,
                last_seen_at TEXT NOT NULL,
                FOREIGN KEY(student_username) REFERENCES users(username)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS diagnostic_assessments (
                username TEXT PRIMARY KEY,
                payload_json TEXT NOT NULL,
                subject_scores_json TEXT NOT NULL,
                total_score INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY(username) REFERENCES users(username)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS custom_textbooks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                class_num INTEGER NOT NULL,
                subject TEXT NOT NULL,
                chapter TEXT NOT NULL,
                filename TEXT NOT NULL,
                filepath TEXT NOT NULL,
                text_content TEXT NOT NULL,
                created_at TEXT NOT NULL,
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
                subscription_tier,
                learning_style, goal, study_hours, focus_areas, exam_board,
                preferred_language, preferred_pace, confidence_level,
                revision_frequency, parent_email, 
                teacher_personality, focus_chapters_json,
                country, state, city, points,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                username,
                password_hash,
                salt,
                profile.get("school"),
                profile.get("class"),
                profile.get("subjects_json"),
                profile.get("subscriptionTier") or "free",
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
                profile.get("teacherPersonality"),
                json.dumps(profile.get("focusChapters") or {}),
                profile.get("country") or "India",
                profile.get("state") or "Delhi",
                profile.get("city") or "New Delhi",
                profile.get("points") or 0,
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
            SET school = ?, class_num = ?, subjects_json = ?, subscription_tier = ?, learning_style = ?, goal = ?,
                study_hours = ?, focus_areas = ?, exam_board = ?, preferred_language = ?,
                preferred_pace = ?, confidence_level = ?, revision_frequency = ?,
                parent_email = ?, teacher_personality = ?, focus_chapters_json = ?, 
                country = ?, state = ?, city = ?, updated_at = ?
            WHERE username = ?
            """,
            (
                profile.get("school"),
                profile.get("class"),
                profile.get("subjects_json"),
                profile.get("subscriptionTier") or "free",
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
                profile.get("teacherPersonality"),
                json.dumps(profile.get("focusChapters") or {}),
                profile.get("country"),
                profile.get("state"),
                profile.get("city"),
                now,
                username,
            ),
        )


def get_user_profile(username: str) -> Optional[dict[str, Any]]:
    with _connect() as conn:
        row = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
        if not row:
            return None
        profile = dict(row)
        
        # Dynamic check for trial expiration
        status = profile.get("subscription_status")
        trial_end = profile.get("trial_end")
        if status == "trialing" and trial_end:
            try:
                from datetime import datetime
                end_dt = datetime.fromisoformat(trial_end.replace("Z", "+00:00"))
                if datetime.utcnow() > end_dt:
                    conn.execute(
                        """
                        UPDATE users
                        SET subscription_tier = 'free', subscription_status = 'expired', updated_at = ?
                        WHERE username = ?
                        """,
                        (_utc_now_iso(), username),
                    )
                    profile["subscription_tier"] = "free"
                    profile["subscription_status"] = "expired"
            except Exception as e:
                print("Error checking trial expiration:", e)
        return profile


def set_user_subscription_tier(username: str, subscription_tier: str) -> None:
    tier = str(subscription_tier or "free").strip().lower()
    if tier not in {"free", "pro", "pro_max"}:
        tier = "free"

    status = "active" if tier in {"pro", "pro_max"} else "inactive"
    with _connect() as conn:
        conn.execute(
            """
            UPDATE users
            SET subscription_tier = ?, subscription_status = ?, updated_at = ?
            WHERE username = ?
            """,
            (tier, status, _utc_now_iso(), username),
        )


def set_user_subscription(
    username: str,
    tier: str,
    status: str,
    trial_start: Optional[str] = None,
    trial_end: Optional[str] = None,
    subscription_end: Optional[str] = None,
) -> None:
    now = _utc_now_iso()
    with _connect() as conn:
        conn.execute(
            """
            UPDATE users
            SET subscription_tier = ?,
                subscription_status = ?,
                trial_start = ?,
                trial_end = ?,
                subscription_end = ?,
                updated_at = ?
            WHERE username = ?
            """,
            (tier, status, trial_start, trial_end, subscription_end, now, username),
        )


def insert_progress_log(username: str, action: str, subject: str, chapter: str, score: Optional[int]) -> None:
    points_to_add = 10
    if action == "recall":
        points_to_add = 30
    elif action in ("practice", "simulator", "exam"):
        points_to_add = 50
    elif action == "ask_ai":
        points_to_add = 10

    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO progress_logs (username, action, subject, chapter, score, timestamp)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (username, action, subject, chapter, score, _utc_now_iso()),
        )
        conn.execute(
            "UPDATE users SET points = points + ? WHERE username = ?",
            (points_to_add, username),
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


def get_parent_account_by_student(student_username: str) -> Optional[dict[str, Any]]:
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM parent_accounts WHERE student_username = ?",
            (student_username,),
        ).fetchone()
    if not row:
        return None
    return dict(row)


def get_parent_account_by_email(parent_email: str) -> Optional[dict[str, Any]]:
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM parent_accounts WHERE parent_email = ?",
            (parent_email,),
        ).fetchone()
    if not row:
        return None
    return dict(row)


def upsert_parent_account(student_username: str, parent_email: str, password: str) -> bool:
    # Check if any other student shares this parent email to reuse the password
    with _connect() as conn:
        existing_shared = conn.execute(
            "SELECT password_hash, salt, plain_password FROM parent_accounts WHERE parent_email = ? LIMIT 1",
            (parent_email,),
        ).fetchone()
        
    if existing_shared:
        password_hash = existing_shared["password_hash"]
        salt = existing_shared["salt"]
        password = existing_shared["plain_password"]
    else:
        salt = secrets.token_hex(16)
        password_hash = _hash_password(password, salt)
        
    now = _utc_now_iso()
    with _connect() as conn:
        existing = conn.execute(
            "SELECT password_hash, salt, created_at FROM parent_accounts WHERE student_username = ?",
            (student_username,),
        ).fetchone()

        if existing:
            conn.execute(
                """
                UPDATE parent_accounts
                SET parent_email = ?, password_hash = ?, salt = ?, plain_password = ?, updated_at = ?
                WHERE student_username = ?
                """,
                (parent_email, password_hash, salt, password, now, student_username),
            )
            return False

        conn.execute(
            """
            INSERT INTO parent_accounts (
                student_username, parent_email, password_hash, salt, plain_password, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (student_username, parent_email, password_hash, salt, password, now, now),
        )
    return True


def reset_parent_credentials(student_username: str, password: str) -> bool:
    salt = secrets.token_hex(16)
    password_hash = _hash_password(password, salt)
    now = _utc_now_iso()
    with _connect() as conn:
        # Find the parent email of the student to reset all shared accounts
        row = conn.execute(
            "SELECT parent_email FROM parent_accounts WHERE student_username = ?",
            (student_username,)
        ).fetchone()
        
        if row:
            parent_email = row["parent_email"]
            result = conn.execute(
                """
                UPDATE parent_accounts
                SET password_hash = ?, salt = ?, plain_password = ?, updated_at = ?
                WHERE parent_email = ?
                """,
                (password_hash, salt, password, now, parent_email),
            )
            return result.rowcount > 0
        else:
            result = conn.execute(
                """
                UPDATE parent_accounts
                SET password_hash = ?, salt = ?, plain_password = ?, updated_at = ?
                WHERE student_username = ?
                """,
                (password_hash, salt, password, now, student_username),
            )
            return result.rowcount > 0


def verify_parent_user(parent_email: str, password: str) -> Optional[str]:
    with _connect() as conn:
        row = conn.execute(
            "SELECT student_username, salt, password_hash FROM parent_accounts WHERE parent_email = ?",
            (parent_email,),
        ).fetchone()
    if not row:
        return None
    expected = row["password_hash"]
    if _hash_password(password, row["salt"]) != expected:
        return None
    return str(row["student_username"])


def create_parent_session(parent_email: str, student_username: str) -> str:
    token = secrets.token_urlsafe(36)
    now = _utc_now_iso()
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO parent_sessions (token, parent_email, student_username, created_at, last_seen_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (token, parent_email, student_username, now, now),
        )
    return token


def get_parent_session(token: str) -> Optional[dict[str, Any]]:
    if not token:
        return None
    with _connect() as conn:
        row = conn.execute(
            "SELECT parent_email, student_username FROM parent_sessions WHERE token = ?",
            (token,),
        ).fetchone()
        if not row:
            return None
        conn.execute(
            "UPDATE parent_sessions SET last_seen_at = ? WHERE token = ?",
            (_utc_now_iso(), token),
        )
    return {
        "parent_email": str(row["parent_email"]),
        "student_username": str(row["student_username"]),
    }


def delete_parent_session(token: str) -> None:
    with _connect() as conn:
        conn.execute("DELETE FROM parent_sessions WHERE token = ?", (token,))


def switch_parent_session_student(token: str, student_username: str) -> None:
    with _connect() as conn:
        conn.execute(
            "UPDATE parent_sessions SET student_username = ?, last_seen_at = ? WHERE token = ?",
            (student_username, _utc_now_iso(), token),
        )


def update_parent_portal_settings(student_username: str, encouragement_note: Optional[str] = None, weekly_goals: Optional[str] = None) -> None:
    with _connect() as conn:
        if encouragement_note is not None and weekly_goals is not None:
            conn.execute(
                "UPDATE parent_accounts SET encouragement_note = ?, weekly_goals = ?, updated_at = ? WHERE student_username = ?",
                (encouragement_note, weekly_goals, _utc_now_iso(), student_username)
            )
        elif encouragement_note is not None:
            conn.execute(
                "UPDATE parent_accounts SET encouragement_note = ?, updated_at = ? WHERE student_username = ?",
                (encouragement_note, _utc_now_iso(), student_username)
            )
        elif weekly_goals is not None:
            conn.execute(
                "UPDATE parent_accounts SET weekly_goals = ?, updated_at = ? WHERE student_username = ?",
                (weekly_goals, _utc_now_iso(), student_username)
            )


def get_parent_portal_settings(student_username: str) -> dict[str, Any]:
    with _connect() as conn:
        row = conn.execute(
            "SELECT encouragement_note, weekly_goals FROM parent_accounts WHERE student_username = ?",
            (student_username,)
        ).fetchone()
    if row:
        return {
            "encouragement_note": row["encouragement_note"] or "",
            "weekly_goals": row["weekly_goals"] or ""
        }
    return {"encouragement_note": "", "weekly_goals": ""}


def save_diagnostic_assessment(username: str, payload_json: str, subject_scores_json: str, total_score: int) -> None:
    now = _utc_now_iso()
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO diagnostic_assessments (username, payload_json, subject_scores_json, total_score, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(username) DO UPDATE SET
                payload_json = excluded.payload_json,
                subject_scores_json = excluded.subject_scores_json,
                total_score = excluded.total_score,
                updated_at = excluded.updated_at
            """,
            (username, payload_json, subject_scores_json, total_score, now, now),
        )


def get_diagnostic_assessment(username: str) -> Optional[dict[str, Any]]:
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM diagnostic_assessments WHERE username = ?",
            (username,),
        ).fetchone()
    if not row:
        return None
    return dict(row)


def save_custom_textbook(username: str, class_num: int, subject: str, chapter: str, filename: str, filepath: str, text_content: str) -> int:
    now = _utc_now_iso()
    with _connect() as conn:
        cursor = conn.execute(
            """
            INSERT INTO custom_textbooks (username, class_num, subject, chapter, filename, filepath, text_content, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (username, class_num, subject, chapter, filename, filepath, text_content, now),
        )
        return cursor.lastrowid


def get_custom_textbooks(username: str, class_num: Optional[int] = None, subject: Optional[str] = None) -> list[dict[str, Any]]:
    query = "SELECT id, username, class_num, subject, chapter, filename, filepath, created_at FROM custom_textbooks WHERE username = ?"
    params = [username]
    if class_num is not None:
        query += " AND class_num = ?"
        params.append(class_num)
    if subject is not None:
        query += " AND subject = ?"
        params.append(subject)
    query += " ORDER BY created_at DESC"
    with _connect() as conn:
        rows = conn.execute(query, params).fetchall()
    return [dict(row) for row in rows]


def get_custom_textbook_content(username: str, class_num: int, subject: str, chapter: str) -> Optional[str]:
    # Try exact match first
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT text_content FROM custom_textbooks
            WHERE username = ? AND class_num = ? AND LOWER(subject) = LOWER(?) AND LOWER(chapter) = LOWER(?)
            """,
            (username, class_num, subject, chapter),
        ).fetchall()
        if rows:
            return "\n\n".join(row["text_content"] for row in rows)
        
        # Partial substring matches for chapter
        rows = conn.execute(
            """
            SELECT chapter, text_content FROM custom_textbooks
            WHERE username = ? AND class_num = ? AND LOWER(subject) = LOWER(?)
            """,
            (username, class_num, subject),
        ).fetchall()
        
        matched = []
        ch_lower = chapter.lower()
        for row in rows:
            row_ch = row["chapter"].lower()
            if row_ch in ch_lower or ch_lower in row_ch:
                matched.append(row["text_content"])
        if matched:
            return "\n\n".join(matched)
    return None


def delete_custom_textbook(username: str, textbook_id: int) -> bool:
    with _connect() as conn:
        cursor = conn.execute(
            "DELETE FROM custom_textbooks WHERE username = ? AND id = ?",
            (username, textbook_id),
        )
        return cursor.rowcount > 0
