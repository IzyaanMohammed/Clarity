from fastapi import APIRouter, HTTPException
import json
import os
from datetime import datetime, date, timedelta
from typing import Optional, List
from pydantic import BaseModel
from services.report_generator import generate_parent_report

router = APIRouter()

PROGRESS_FILE = "progress_data.json"

class LogRequest(BaseModel):
    user_id: str
    action: str
    subject: str
    chapter: str
    score: Optional[int] = None

def get_progress():
    if not os.path.exists(PROGRESS_FILE):
        return []
    try:
        with open(PROGRESS_FILE, "r") as f:
            return json.load(f)
    except:
        return []

def save_progress(data):
    with open(PROGRESS_FILE, "w") as f:
        json.dump(data, f, indent=4)

@router.post("/log")
async def log_progress(request: LogRequest):
    data = get_progress()
    log_entry = {
        "user_id": request.user_id,
        "action": request.action,
        "subject": request.subject,
        "chapter": request.chapter,
        "score": request.score,
        "timestamp": datetime.now().isoformat()
    }
    data.append(log_entry)
    save_progress(data)
    return {"status": "Logged successfully"}

@router.get("/report/{user_id}")
async def get_parent_report(user_id: str):
    report_text = generate_parent_report(user_id)
    return {"report": report_text}

@router.get("/stats/{user_id}")
async def get_stats(user_id: str):
    data = get_progress()
    user_data = [item for item in data if item["user_id"] == user_id]
    
    if not user_data:
        return {
            "total_questions": 0,
            "questions_today": 0,
            "subjects_studied": [],
            "weak_topics": [],
            "streak_days": 1,
            "recent_activity": []
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
            
    return {
        "total_questions": total_questions,
        "questions_today": questions_today,
        "subjects_studied": subjects_studied,
        "weak_topics": weak_topics,
        "streak_days": max(1, streak),
        "recent_activity": user_data[-10:]
    }
