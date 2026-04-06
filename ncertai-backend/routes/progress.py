from fastapi import APIRouter, HTTPException, Header
from datetime import datetime, date, timedelta
from typing import Optional, List
from pydantic import BaseModel
from services.report_generator import generate_parent_report, send_parent_report_email
from services.database import fetch_progress_logs, insert_progress_log
from utils.auth import require_auth_username

router = APIRouter()

class LogRequest(BaseModel):
    action: str
    subject: str
    chapter: str
    score: Optional[int] = None


class ParentReportEmailRequest(BaseModel):
    parent_email: str


class DailyMissionRequest(BaseModel):
    class_num: str
    subjects: List[str] = []
    available_minutes: int = 60

def get_progress():
    return fetch_progress_logs()

def save_progress(data):
    # Progress is now database-backed; this function remains for compatibility.
    return None


def _build_chapter_subject_map(user_data: list[dict]) -> dict[str, str]:
    chapter_subject: dict[str, str] = {}
    for item in user_data:
        chapter = str(item.get("chapter") or "").strip()
        subject = str(item.get("subject") or "").strip()
        if chapter and subject:
            chapter_subject[chapter] = subject
    return chapter_subject


def _pick_focus_chapters(user_data: list[dict], weak_topics: list[str]) -> list[str]:
    focus: list[str] = []
    for topic in weak_topics:
        if topic and topic not in focus:
            focus.append(topic)

    recent = sorted(user_data, key=lambda x: x.get("timestamp", ""), reverse=True)
    for item in recent:
        chapter = str(item.get("chapter") or "").strip()
        if chapter and chapter not in focus:
            focus.append(chapter)
        if len(focus) >= 3:
            break

    if not focus:
        focus = ["Core Concepts"]
    return focus[:3]


def _chapter_readiness_metrics(user_data: list[dict], chapter: str) -> dict[str, int | str]:
    chapter_rows = [item for item in user_data if str(item.get("chapter") or "").strip().lower() == chapter.lower()]
    if not chapter_rows:
        return {
            "accuracy": 35,
            "recency": 30,
            "speed": 35,
            "confidence": 30,
            "readiness_score": 32,
            "priority": "high",
        }

    scored_rows = [item for item in chapter_rows if isinstance(item.get("score"), (int, float))]
    accuracy = int(round(sum(item["score"] for item in scored_rows) / len(scored_rows))) if scored_rows else 45

    latest_timestamp = None
    for item in chapter_rows:
        timestamp = str(item.get("timestamp") or "").strip()
        if not timestamp:
            continue
        try:
            current_ts = datetime.fromisoformat(timestamp)
        except Exception:
            continue
        if latest_timestamp is None or current_ts > latest_timestamp:
            latest_timestamp = current_ts

    if latest_timestamp is None:
        recency = 40
    else:
        days_since = max(0, (datetime.now() - latest_timestamp).days)
        recency = max(20, 100 - (days_since * 12))

    activity_count = len(chapter_rows)
    speed = min(100, 35 + (activity_count * 8))
    confidence = 55 if accuracy >= 70 else 42 if accuracy >= 45 else 30
    readiness_score = int(round((accuracy * 0.45) + (recency * 0.2) + (speed * 0.15) + (confidence * 0.2)))
    priority = "high" if readiness_score < 45 else "medium" if readiness_score < 70 else "low"

    return {
        "accuracy": accuracy,
        "recency": recency,
        "speed": speed,
        "confidence": confidence,
        "readiness_score": readiness_score,
        "priority": priority,
    }


def _rank_chapters_by_readiness(user_data: list[dict], candidate_chapters: list[str]) -> list[dict[str, int | str]]:
    ranked: list[dict[str, int | str]] = []
    seen: set[str] = set()
    for chapter in candidate_chapters:
        chapter_name = str(chapter or "").strip()
        if not chapter_name or chapter_name.lower() in seen:
            continue
        seen.add(chapter_name.lower())
        metrics = _chapter_readiness_metrics(user_data, chapter_name)
        ranked.append({
            "chapter": chapter_name,
            **metrics,
        })

    ranked.sort(key=lambda item: (int(item["readiness_score"]), int(item["accuracy"]), int(item["recency"])))
    return ranked

@router.post("/log")
async def log_progress(request: LogRequest, authorization: Optional[str] = Header(default=None)):
    username = require_auth_username(authorization)
    insert_progress_log(
        username=username,
        action=request.action,
        subject=request.subject,
        chapter=request.chapter,
        score=request.score,
    )
    return {"status": "Logged successfully"}

@router.get("/report/{user_id}")
async def get_parent_report(user_id: str, authorization: Optional[str] = Header(default=None)):
    username = require_auth_username(authorization)
    if user_id != username:
        raise HTTPException(status_code=403, detail="Forbidden")
    report_text = generate_parent_report(username)
    return {"report": report_text}


@router.post("/report/send")
async def send_parent_report(request: ParentReportEmailRequest, authorization: Optional[str] = Header(default=None)):
    username = require_auth_username(authorization)
    report_text = generate_parent_report(username)
    delivery = send_parent_report_email(
        user_id=username,
        parent_email=request.parent_email,
        report_text=report_text,
    )
    return {
        "status": "sent" if delivery.get("sent") else "queued",
        "message": delivery.get("message", "Report processed."),
        "report": report_text,
    }

@router.get("/stats/{user_id}")
async def get_stats(user_id: str, authorization: Optional[str] = Header(default=None)):
    username = require_auth_username(authorization)
    if user_id != username:
        raise HTTPException(status_code=403, detail="Forbidden")
    data = get_progress()
    user_data = [item for item in data if item["user_id"] == username]
    
    if not user_data:
        return {
            "total_questions": 0,
            "questions_today": 0,
            "subjects_studied": [],
            "weak_topics": [],
            "streak_days": 1,
            "recent_activity": [],
            "total_practice_attempts": 0,
            "avg_practice_score": 0,
            "accuracy_rate": 0,
            "estimated_study_minutes": 0,
        }
    
    total_questions = len([i for i in user_data if i["action"] == "question"])
    today = str(date.today())
    questions_today = len([i for i in user_data if i["action"] == "question" and i["timestamp"].startswith(today)])
    
    subjects_studied = list(set([i["subject"] for i in user_data]))
    weak_topics = list(set([i["chapter"] for i in user_data if i.get("score") is not None and i["score"] < 50]))
    
    # IMPROVED STREAK LOGIC
    dates = sorted(list(set([i["timestamp"].split("T")[0] for i in user_data])), reverse=True)
    streak = 0
    current_check = date.today()
    
    for d_str in dates:
        d_obj = datetime.strptime(d_str, '%Y-%m-%d').date()
        if d_obj == current_check:
            streak += 1
            current_check -= timedelta(days=1)
        elif d_obj < current_check:
            break # streak broken

    practice_attempts = [i for i in user_data if i.get("action") == "practice"]
    scored_attempts = [i for i in practice_attempts if isinstance(i.get("score"), (int, float))]
    avg_practice_score = round(
        sum(i["score"] for i in scored_attempts) / len(scored_attempts), 1
    ) if scored_attempts else 0

    # Accuracy blends practice score and question volume quality signal.
    if scored_attempts:
        accuracy_rate = int(round(avg_practice_score))
    else:
        # If no graded attempts yet, infer a gentle baseline from activity volume.
        accuracy_rate = min(75, 40 + len(user_data) * 2)

    # Real event-based time estimate using event spacing (capped) + per-action baseline.
    parsed_events = []
    for item in user_data:
        try:
            ts = datetime.fromisoformat(item["timestamp"])
            parsed_events.append((ts, item.get("action", "question")))
        except Exception:
            continue

    parsed_events.sort(key=lambda x: x[0])
    estimated_study_minutes = 0
    for idx in range(len(parsed_events)):
        _, action = parsed_events[idx]
        baseline = 3 if action == "question" else 8 if action == "practice" else 5
        estimated_study_minutes += baseline
        if idx > 0:
            delta = parsed_events[idx][0] - parsed_events[idx - 1][0]
            gap_minutes = int(delta.total_seconds() // 60)
            if 1 <= gap_minutes <= 45:
                estimated_study_minutes += min(10, gap_minutes // 4)

    recent_activity = sorted(
        user_data,
        key=lambda x: x.get("timestamp", ""),
        reverse=True,
    )[:10]
            
    return {
        "total_questions": total_questions,
        "questions_today": questions_today,
        "subjects_studied": subjects_studied,
        "weak_topics": weak_topics,
        "streak_days": max(1, streak),
        "recent_activity": recent_activity,
        "total_practice_attempts": len(practice_attempts),
        "avg_practice_score": avg_practice_score,
        "accuracy_rate": accuracy_rate,
        "estimated_study_minutes": estimated_study_minutes,
    }


@router.post("/daily-mission")
async def get_daily_mission(request: DailyMissionRequest, authorization: Optional[str] = Header(default=None)):
    username = require_auth_username(authorization)
    data = get_progress()
    user_data = [item for item in data if item.get("user_id") == username]

    chapter_subject_map = _build_chapter_subject_map(user_data)
    weak_topics: list[str] = []
    all_chapters: list[str] = []
    for item in user_data:
        score = item.get("score")
        chapter = str(item.get("chapter") or "").strip()
        if chapter and chapter not in all_chapters:
            all_chapters.append(chapter)
        if isinstance(score, (int, float)) and score < 50 and chapter:
            weak_topics.append(chapter)

    # Preserve order while deduping
    seen = set()
    dedup_weak = []
    for topic in weak_topics:
        if topic not in seen:
            seen.add(topic)
            dedup_weak.append(topic)

    focus_pool = dedup_weak if dedup_weak else all_chapters
    if not focus_pool:
        focus_pool = ["Core Concepts"]

    ranked_focus = _rank_chapters_by_readiness(user_data, focus_pool)
    focus_chapters = [item["chapter"] for item in ranked_focus] or _pick_focus_chapters(user_data, dedup_weak)
    default_subject = request.subjects[0] if request.subjects else "Science"

    if focus_chapters:
        learn_chapter = focus_chapters[0]
        practice_chapter = focus_chapters[0]
        review_chapter = focus_chapters[1] if len(focus_chapters) > 1 else focus_chapters[0]
    else:
        learn_chapter = "Core Concepts"
        practice_chapter = "Core Concepts"
        review_chapter = "Core Concepts"

    learn_subject = chapter_subject_map.get(learn_chapter, default_subject)
    practice_subject = chapter_subject_map.get(practice_chapter, learn_subject)
    review_subject = chapter_subject_map.get(review_chapter, learn_subject)

    learn_readiness = _chapter_readiness_metrics(user_data, learn_chapter)
    practice_readiness = _chapter_readiness_metrics(user_data, practice_chapter)
    review_readiness = _chapter_readiness_metrics(user_data, review_chapter)

    total_minutes = max(30, min(int(request.available_minutes or 60), 180))
    weak_focus_multiplier = 1.15 if int(learn_readiness["readiness_score"]) < 45 else 1.0
    learn_minutes = max(12, int(total_minutes * 0.35 * weak_focus_multiplier))
    practice_minutes = max(12, int(total_minutes * 0.4 * weak_focus_multiplier))
    review_minutes = max(8, total_minutes - learn_minutes - practice_minutes)
    if review_minutes < 8:
        review_minutes = 8

    mission_date = date.today().isoformat()
    mission_id = f"mission_{username}_{mission_date}"

    tasks = [
        {
            "id": f"{mission_id}_learn",
            "kind": "learn",
            "title": f"Learn new chapter: {learn_chapter}",
            "reason": "Start with concept clarity before attempting graded work.",
            "subject": learn_subject,
            "chapter": learn_chapter,
            "readiness_score": int(learn_readiness["readiness_score"]),
            "priority": str(learn_readiness["priority"]),
            "duration_minutes": learn_minutes,
            "destination": "library",
            "route": "/library",
            "route_state": {
                "subject": learn_subject,
                "chapter": learn_chapter,
                "readiness_score": int(learn_readiness["readiness_score"]),
                "priority": str(learn_readiness["priority"]),
            },
        },
        {
            "id": f"{mission_id}_practice",
            "kind": "practice",
            "title": f"Practice Q&A drill: {practice_chapter}",
            "reason": "Convert understanding into marks with timed board-style questions.",
            "subject": practice_subject,
            "chapter": practice_chapter,
            "readiness_score": int(practice_readiness["readiness_score"]),
            "priority": str(practice_readiness["priority"]),
            "duration_minutes": practice_minutes,
            "destination": "practice",
            "route": "/practice",
            "route_state": {
                "subject": practice_subject,
                "chapter": practice_chapter,
                "questionType": "past-paper",
                "numQuestions": 5,
                "readiness_score": int(practice_readiness["readiness_score"]),
                "priority": str(practice_readiness["priority"]),
            },
        },
        {
            "id": f"{mission_id}_review",
            "kind": "review",
            "title": f"Learn this question with AI: {review_chapter}",
            "reason": "Use AI explain mode to close conceptual gaps from weak/questioned areas.",
            "subject": review_subject,
            "chapter": review_chapter,
            "readiness_score": int(review_readiness["readiness_score"]),
            "priority": str(review_readiness["priority"]),
            "duration_minutes": review_minutes,
            "destination": "ask",
            "route": "/ask",
            "route_state": {
                "subject": review_subject,
                "chapter": review_chapter,
                "readiness_score": int(review_readiness["readiness_score"]),
                "priority": str(review_readiness["priority"]),
            },
        },
    ]

    weak_count = len(dedup_weak)
    confidence = "high" if weak_count == 0 else "medium" if weak_count <= 2 else "focused"

    return {
        "mission_id": mission_id,
        "date": mission_date,
        "headline": "Daily Auto Mission",
        "summary": f"3-step autonomous flow: Learn -> Practice -> Review. Top priority: {learn_chapter}.",
        "confidence": confidence,
        "estimated_total_minutes": total_minutes,
        "chapter_ranking": ranked_focus,
        "tasks": tasks,
    }
