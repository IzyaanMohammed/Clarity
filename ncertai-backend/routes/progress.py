from fastapi import APIRouter, HTTPException, Header
from datetime import datetime, date, timedelta
from typing import Optional, List
import secrets
from pydantic import BaseModel
from services.report_generator import generate_parent_report, send_parent_report_email
from services.database import (
    fetch_progress_logs,
    get_diagnostic_assessment,
    get_user_profile,
    insert_progress_log,
    upsert_parent_account,
)
from utils.auth import require_auth_username, require_parent_context, require_pro_max_username

router = APIRouter()

class LogRequest(BaseModel):
    action: str
    subject: str
    chapter: str
    score: Optional[int] = None


class DailyMissionRequest(BaseModel):
    class_num: str
    subjects: List[str] = []
    available_minutes: int = 60


def _subject_confidence_trend(user_data: list[dict], chosen_subjects: Optional[list[str]] = None) -> list[dict]:
    by_subject: dict[str, list[int]] = {}
    for item in user_data:
        subject = str(item.get("subject") or "").strip()
        score = item.get("score")
        if not subject or not isinstance(score, (int, float)):
            continue
        by_subject.setdefault(subject, []).append(int(score))

    trend: list[dict] = []
    seen_subjects = set()
    for subject, scores in by_subject.items():
        recent = scores[-10:]
        avg_score = int(round(sum(recent) / max(1, len(recent))))
        trend.append({
            "subject": subject,
            "confidence": avg_score,
            "samples": len(recent),
        })
        seen_subjects.add(subject.lower())

    if chosen_subjects:
        for sub in chosen_subjects:
            sub_clean = sub.strip()
            if sub_clean and sub_clean.lower() not in seen_subjects:
                trend.append({
                    "subject": sub_clean,
                    "confidence": 0,
                    "samples": 0,
                })
                seen_subjects.add(sub_clean.lower())

    trend.sort(key=lambda item: item["confidence"])
    return trend


def _overall_readiness(user_data: list[dict]) -> int:
    scored = [int(item.get("score")) for item in user_data if isinstance(item.get("score"), (int, float))]
    if not scored:
        return 35
    last_scores = scored[-20:]
    accuracy = int(round(sum(last_scores) / len(last_scores)))

    # Recency bonus if active in last 3 days.
    latest = None
    for item in user_data:
        timestamp = str(item.get("timestamp") or "").strip()
        if not timestamp:
            continue
        try:
            current = datetime.fromisoformat(timestamp)
        except Exception:
            continue
        if latest is None or current > latest:
            latest = current

    recency = 40
    if latest is not None:
        days = max(0, (datetime.now() - latest).days)
        recency = max(15, 100 - (days * 16))

    readiness = int(round((accuracy * 0.7) + (recency * 0.3)))
    return max(0, min(100, readiness))

def get_progress(username: Optional[str] = None):
    return fetch_progress_logs(username)

def get_augmented_user_data(username: str) -> list[dict]:
    data = get_progress(username)
    user_data = [item for item in data if item.get("user_id") == username]
    
    diag = get_diagnostic_assessment(username)
    if diag:
        try:
            import json
            subject_scores = json.loads(diag.get("subject_scores_json") or "{}")
            created_at = diag.get("created_at") or datetime.utcnow().isoformat()
            for sub, score in subject_scores.items():
                user_data.append({
                    "user_id": username,
                    "action": "practice",
                    "subject": sub,
                    "chapter": "Diagnostic Assessment",
                    "score": score,
                    "timestamp": created_at
                })
        except Exception:
            pass
    return user_data

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


def _build_real_recommendations(username: str, user_data: list[dict]) -> list[dict[str, str]]:
    recs: list[dict[str, str]] = []
    diagnostic = get_diagnostic_assessment(username)

    weak_chapters = []
    seen = set()
    for item in user_data:
        chapter = str(item.get("chapter") or "").strip()
        score = item.get("score")
        if chapter and isinstance(score, (int, float)) and int(score) < 50 and chapter.lower() not in seen:
            seen.add(chapter.lower())
            weak_chapters.append(chapter)

    if weak_chapters:
        recs.append({
            "id": f"practice-{weak_chapters[0]}",
            "title": f"Practice {weak_chapters[0]}",
            "reason": "This chapter is below target in your actual practice history.",
            "subject": next((str(i.get("subject") or "").strip() for i in reversed(user_data) if str(i.get("chapter") or "").strip() == weak_chapters[0]), ""),
            "chapter": weak_chapters[0],
            "priority": "high",
            "action": "practice",
        })

    if diagnostic:
        total_score = int(diagnostic.get("total_score") or 0)
        if total_score < 60:
            recs.append({
                "id": "diagnostic-foundation",
                "title": "Start with foundation repair",
                "reason": f"Signup diagnostic is {total_score}%, so the system should begin with core concept repair.",
                "priority": "high",
                "action": "library",
            })
        elif total_score < 80:
            recs.append({
                "id": "diagnostic-practice",
                "title": "Do a short mixed practice set",
                "reason": f"Signup diagnostic is {total_score}%, so a 10-minute mixed drill will calibrate the next mission.",
                "priority": "medium",
                "action": "practice",
            })

    if not recs:
        recs.append({
            "id": "fresh-start",
            "title": "Take the onboarding diagnostic",
            "reason": "No study history exists yet, so the diagnostic is the real starting signal.",
            "priority": "high",
            "action": "practice",
        })

    return recs[:6]


def _progress_analytics_payload(username: str, user_data: list[dict]) -> dict:
    if not user_data:
        return {
            "overall": {
                "average_score": 0,
                "study_streak_days": 0,
                "hours_studied": 0,
                "questions_per_day": 0,
                "accuracy_rate": 0,
                "total_questions": 0,
                "total_practice_attempts": 0,
                "total_flashcard_reviews": 0,
                "total_uploads": 0,
            },
            "weak_topics": [],
            "recommended_topics": [],
            "subject_breakdown": [],
            "insights": [],
            "has_activity": False,
        }

    total_questions = len([i for i in user_data if i.get("action") == "question"])
    total_practice_attempts = len([i for i in user_data if i.get("action") == "practice"])
    total_flashcard_reviews = len([i for i in user_data if i.get("action") == "flashcard"])
    total_uploads = len([i for i in user_data if i.get("action") == "upload"])

    scored = [int(i.get("score")) for i in user_data if isinstance(i.get("score"), (int, float))]
    average_score = int(round(sum(scored) / len(scored))) if scored else 0

    if scored:
        accuracy_rate = average_score
    else:
        accuracy_rate = min(75, 40 + len(user_data) * 2)

    parsed_events: list[tuple[datetime, str]] = []
    for item in user_data:
        try:
            ts = datetime.fromisoformat(str(item.get("timestamp") or ""))
            parsed_events.append((ts, str(item.get("action") or "question")))
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

    unique_dates = sorted(
        {str(i.get("timestamp") or "").split("T")[0] for i in user_data if str(i.get("timestamp") or "")},
        reverse=True,
    )
    streak = 0
    current_check = date.today()
    for d_str in unique_dates:
        try:
            d_obj = datetime.strptime(d_str, "%Y-%m-%d").date()
        except Exception:
            continue
        if d_obj == current_check:
            streak += 1
            current_check -= timedelta(days=1)
        elif d_obj < current_check:
            break

    now = datetime.now()
    seven_days_ago = now - timedelta(days=7)
    recent_questions = 0
    for item in user_data:
        if item.get("action") != "question":
            continue
        try:
            ts = datetime.fromisoformat(str(item.get("timestamp") or ""))
        except Exception:
            continue
        if ts >= seven_days_ago:
            recent_questions += 1
    questions_per_day = round(recent_questions / 7, 1)

    topic_map: dict[str, dict] = {}
    for item in user_data:
        subject = str(item.get("subject") or "").strip() or "General"
        chapter = str(item.get("chapter") or "").strip() or "General"
        key = f"{subject}::{chapter}"
        entry = topic_map.setdefault(
            key,
            {
                "subject": subject,
                "chapter": chapter,
                "total_attempts": 0,
                "scores": [],
                "timestamps": [],
            },
        )
        entry["total_attempts"] += 1
        if isinstance(item.get("score"), (int, float)):
            entry["scores"].append(int(item.get("score")))
        ts_raw = str(item.get("timestamp") or "")
        if ts_raw:
            entry["timestamps"].append(ts_raw)

    weak_topics: list[dict] = []
    subject_rollup: dict[str, dict] = {}
    recommended_topics: list[dict] = []

    for topic in topic_map.values():
        scores = topic["scores"]
        avg_score = int(round(sum(scores) / len(scores))) if scores else 0

        recent_scores: list[int] = []
        previous_scores: list[int] = []
        last_attempt_dt = None
        for ts_raw in topic["timestamps"]:
            try:
                ts = datetime.fromisoformat(ts_raw)
            except Exception:
                continue
            if last_attempt_dt is None or ts > last_attempt_dt:
                last_attempt_dt = ts
            score_at_ts = 0
            # Approximate trend bucket using available average when per-event score absent.
            if avg_score:
                score_at_ts = avg_score
            if ts >= seven_days_ago:
                recent_scores.append(score_at_ts)
            elif ts >= now - timedelta(days=14):
                previous_scores.append(score_at_ts)

        trend = "stable"
        if recent_scores and previous_scores:
            recent_avg = sum(recent_scores) / len(recent_scores)
            previous_avg = sum(previous_scores) / len(previous_scores)
            if recent_avg >= previous_avg + 5:
                trend = "improving"
            elif recent_avg <= previous_avg - 5:
                trend = "declining"

        topic_item = {
            "subject": topic["subject"],
            "chapter": topic["chapter"],
            "average_score": avg_score,
            "total_attempts": topic["total_attempts"],
            "trend": trend,
        }

        if avg_score < 60 or trend == "declining":
            weak_topics.append(topic_item)

        stale = False
        if last_attempt_dt is not None and (now - last_attempt_dt).days >= 14:
            stale = True
        if avg_score <= 75 or stale:
            recommended_topics.append(topic_item)

        subject_entry = subject_rollup.setdefault(
            topic["subject"],
            {"subject": topic["subject"], "topic_count": 0, "score_sum": 0, "attempts": 0},
        )
        subject_entry["topic_count"] += 1
        subject_entry["score_sum"] += avg_score
        subject_entry["attempts"] += topic["total_attempts"]

    weak_topics.sort(key=lambda x: x["average_score"])
    recommended_topics.sort(key=lambda x: (x["average_score"], -x["total_attempts"]))

    subject_breakdown = []
    for item in subject_rollup.values():
        topic_count = max(1, int(item["topic_count"]))
        subject_breakdown.append(
            {
                "subject": item["subject"],
                "average_score": int(round(item["score_sum"] / topic_count)),
                "topic_count": int(item["topic_count"]),
                "attempts": int(item["attempts"]),
            }
        )
    subject_breakdown.sort(key=lambda x: x["average_score"])

    insights: list[str] = []
    if streak >= 3:
        insights.append(f"Study streak is {streak} days. Consistency is improving retention.")
    if weak_topics:
        top_weak = weak_topics[0]
        insights.append(f"{top_weak['chapter']} in {top_weak['subject']} needs immediate focus ({top_weak['average_score']}%).")
    if questions_per_day >= 3:
        insights.append(f"Question practice velocity is {questions_per_day}/day this week.")
    if not insights:
        insights.append("Complete one guided practice session to unlock deeper performance insights.")

    return {
        "overall": {
            "average_score": average_score,
            "study_streak_days": streak,
            "hours_studied": round(estimated_study_minutes / 60, 1),
            "questions_per_day": questions_per_day,
            "accuracy_rate": accuracy_rate,
            "total_questions": total_questions,
            "total_practice_attempts": total_practice_attempts,
            "total_flashcard_reviews": total_flashcard_reviews,
            "total_uploads": total_uploads,
        },
        "weak_topics": weak_topics[:8],
        "recommended_topics": recommended_topics[:10],
        "subject_breakdown": subject_breakdown,
        "insights": insights,
        "has_activity": len(user_data) > 0,
    }

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
async def send_parent_report(authorization: Optional[str] = Header(default=None)):
    username = require_auth_username(authorization)
    profile = get_user_profile(username) or {}
    parent_email = str(profile.get("parent_email") or "").strip().lower()
    if not parent_email:
        raise HTTPException(status_code=422, detail="Parent email is missing in profile")

    report_text = generate_parent_report(username)
    delivery = send_parent_report_email(
        user_id=username,
        parent_email=parent_email,
        report_text=report_text,
    )
    return {
        "status": "sent" if delivery.get("sent") else "queued",
        "message": delivery.get("message", "Report processed."),
        "parent_email": parent_email,
        "report": report_text,
    }

@router.get("/stats/{user_id}")
async def get_stats(user_id: str, authorization: Optional[str] = Header(default=None)):
    username = require_auth_username(authorization)
    if user_id != username:
        raise HTTPException(status_code=403, detail="Forbidden")
    user_data = get_augmented_user_data(username)
    
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

    from services.database import get_parent_portal_settings
    parent_note = ""
    try:
        settings = get_parent_portal_settings(username)
        parent_note = settings.get("encouragement_note") or ""
    except Exception:
        pass
            
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
        "parent_note": parent_note,
    }


@router.post("/daily-mission")
async def get_daily_mission(request: DailyMissionRequest, authorization: Optional[str] = Header(default=None)):
    username = require_auth_username(authorization)
    user_data = get_augmented_user_data(username)

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


def _compile_parent_summary(username: str, parent_email: Optional[str], user_data: list[dict], chosen_subjects: list[str]) -> dict:
    trend = _subject_confidence_trend(user_data, chosen_subjects)
    readiness_score = _overall_readiness(user_data)

    weak_chapters = [
        str(item.get("chapter") or "").strip()
        for item in user_data
        if isinstance(item.get("score"), (int, float)) and int(item.get("score", 100)) < 50
    ]
    weak_unique: list[str] = []
    seen: set[str] = set()
    for chapter in weak_chapters:
        if chapter and chapter.lower() not in seen:
            seen.add(chapter.lower())
            weak_unique.append(chapter)

    risk_level = "low"
    if readiness_score < 45:
        risk_level = "high"
    elif readiness_score < 70:
        risk_level = "medium"

    recommendations = [
        "Run 3 focused practice sessions this week on weakest chapters.",
        "Schedule one timed mock test before the weekend.",
        "Use Daily Mission every day for consistent revision.",
    ]

    if risk_level == "high":
        recommendations.insert(0, "Consider extra tutor support in the two weakest subjects.")

    # Calculate extra stats
    total_questions = len([i for i in user_data if i["action"] == "question"])
    practice_attempts = [i for i in user_data if i.get("action") == "practice"]
    
    # streak
    dates = sorted(list(set([i["timestamp"].split("T")[0] for i in user_data])), reverse=True)
    streak = 0
    current_check = date.today()
    for d_str in dates:
        try:
            d_obj = datetime.strptime(d_str, '%Y-%m-%d').date()
        except Exception:
            continue
        if d_obj == current_check:
            streak += 1
            current_check -= timedelta(days=1)
        elif d_obj < current_check:
            break
            
    # study minutes
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

    students_list = [username]
    if parent_email:
        from services.database import _connect
        try:
            with _connect() as conn:
                rows = conn.execute(
                    "SELECT student_username FROM parent_accounts WHERE parent_email = ?",
                    (parent_email,)
                ).fetchall()
                students_list = [str(r["student_username"]) for r in rows]
        except Exception:
            pass

    return {
        "student": username,
        "parent_email": parent_email,
        "students": students_list,
        "readiness_score": readiness_score,
        "risk_level": risk_level,
        "subject_confidence": trend,
        "weak_chapters": weak_unique[:8],
        "recommendations": recommendations,
        "total_questions": total_questions,
        "practice_attempts_count": len(practice_attempts),
        "streak_days": max(1, streak),
        "estimated_study_minutes": estimated_study_minutes,
        "recent_activity": recent_activity,
        "updated_at": datetime.now().isoformat(),
    }


@router.get("/parent-portal-summary")
async def parent_portal_summary(authorization: Optional[str] = Header(default=None)):
    username = require_pro_max_username(authorization)
    user_data = get_augmented_user_data(username)

    profile = get_user_profile(username)
    chosen_subjects = []
    if profile and profile.get("subjects_json"):
        try:
            import json
            chosen_subjects = json.loads(profile["subjects_json"])
        except Exception:
            pass

    return _compile_parent_summary(username, None, user_data, chosen_subjects)


@router.get("/parent-portal/summary")
async def parent_portal_summary_for_parent(authorization: Optional[str] = Header(default=None)):
    context = require_parent_context(authorization)
    username = context["student_username"]
    user_data = get_augmented_user_data(username)

    profile = get_user_profile(username)
    chosen_subjects = []
    if profile and profile.get("subjects_json"):
        try:
            import json
            chosen_subjects = json.loads(profile["subjects_json"])
        except Exception:
            pass

    return _compile_parent_summary(username, context["parent_email"], user_data, chosen_subjects)


@router.get("/recommendations")
async def get_recommendations(authorization: Optional[str] = Header(default=None)):
    username = require_auth_username(authorization)
    user_data = get_augmented_user_data(username)
    return {"recommendations": _build_real_recommendations(username, user_data)}


@router.get("/analytics")
async def get_progress_analytics(authorization: Optional[str] = Header(default=None)):
    username = require_auth_username(authorization)
    user_data = get_augmented_user_data(username)
    return _progress_analytics_payload(username, user_data)


class ParentPortalSettingsUpdateRequest(BaseModel):
    encouragement_note: Optional[str] = None
    weekly_goals: Optional[str] = None


class ParentAdvisorChatRequest(BaseModel):
    message: str
    history: Optional[List[dict]] = None


@router.get("/parent-portal/settings")
async def get_parent_settings_endpoint(authorization: Optional[str] = Header(default=None)):
    context = require_parent_context(authorization)
    student_username = context["student_username"]
    from services.database import get_parent_portal_settings
    return get_parent_portal_settings(student_username)


@router.post("/parent-portal/settings")
async def update_parent_settings_endpoint(
    request: ParentPortalSettingsUpdateRequest,
    authorization: Optional[str] = Header(default=None)
):
    context = require_parent_context(authorization)
    student_username = context["student_username"]
    from services.database import update_parent_portal_settings
    update_parent_portal_settings(
        student_username,
        encouragement_note=request.encouragement_note,
        weekly_goals=request.weekly_goals
    )
    return {"status": "success", "message": "Parent settings updated."}


@router.post("/parent-portal/advisor/chat")
async def parent_portal_advisor_chat(
    request: ParentAdvisorChatRequest,
    authorization: Optional[str] = Header(default=None)
):
    context = require_parent_context(authorization)
    student_username = context["student_username"]
    user_data = get_augmented_user_data(student_username)
    
    readiness_score = _overall_readiness(user_data)
    
    profile = get_user_profile(student_username)
    chosen_subjects = []
    if profile and profile.get("subjects_json"):
        try:
            import json
            chosen_subjects = json.loads(profile["subjects_json"])
        except Exception:
            pass
            
    trend = _subject_confidence_trend(user_data, chosen_subjects)
    
    weak_chapters = [
        str(item.get("chapter") or "").strip()
        for item in user_data
        if isinstance(item.get("score"), (int, float)) and int(item.get("score", 100)) < 50
    ]
    weak_unique = []
    seen = set()
    for chapter in weak_chapters:
        if chapter and chapter.lower() not in seen:
            seen.add(chapter.lower())
            weak_unique.append(chapter)
            
    risk_level = "low"
    if readiness_score < 45:
        risk_level = "high"
    elif readiness_score < 70:
        risk_level = "medium"
        
    subject_conf_str = ", ".join([f"{item['subject']}: {item['confidence']}%" for item in trend])
    weak_chap_str = ", ".join(weak_unique[:5]) or "None detected"
    
    system_prompt = (
        "You are Clarity's AI Parent Advisor. Your role is to help parents support their child's "
        "academic journey (CBSE board preparation). Be encouraging, highly informative, practical, "
        "and empathetic. Use clear bullet points and simple terms.\n\n"
        f"Child's Profile ({student_username}):\n"
        f"- Overall Syllabus Readiness Score: {readiness_score}%\n"
        f"- Academic Risk Alert Level: {risk_level.upper()}\n"
        f"- Weak Areas/Gaps: {weak_chap_str}\n"
        f"- Subject Confidence Levels: {subject_conf_str}\n\n"
        "Provide professional tutoring-grade feedback. Do not repeat this data verbatim unless relevant, "
        "but use it to ground your recommendations. Advise the parent on how they can help in daily study habits, "
        "using Clarity's active recall/tutor features, and keeping the child motivated."
    )
    
    messages = [{"role": "system", "content": system_prompt}]
    if request.history:
        for msg in request.history:
            messages.append({
                "role": "user" if msg.get("sender") == "parent" else "assistant",
                "content": msg.get("text", "")
            })
    messages.append({"role": "user", "content": request.message})
    
    from services.openrouter import ask_openrouter
    response_text = await ask_openrouter(messages, task_type="fast")
    return {"response": response_text}
