import re

with open('services/database.py', 'r') as f:
    db_content = f.read()
# we already did the db methods in database.py

with open('routes/progress.py', 'r') as f:
    content = f.read()

# Replace get_daily_mission entirely
new_func = '''@router.post("/daily-mission")
async def get_daily_mission(request: DailyMissionRequest, authorization: Optional[str] = Header(default=None)):
    username = require_auth_username(authorization)
    from services.database import fetch_daily_missions, upsert_daily_mission, get_user_profile, update_streak
    from datetime import date
    mission_date = date.today().isoformat()
    
    # Update streak whenever they fetch daily mission (simplest way to track activity)
    update_streak(username)
    
    existing_missions = fetch_daily_missions(username, mission_date)
    
    if existing_missions:
        tasks = []
        for em in existing_missions:
            tasks.append({
                "id": str(em["id"]),
                "kind": "practice",
                "title": em["task_description"],
                "reason": "Daily practice for retention",
                "subject": em["subject"],
                "chapter": em["chapter"],
                "completed": bool(em["completed"]),
                "destination": "practice",
                "route": "/practice",
                "route_state": {
                    "subject": em["subject"],
                    "chapter": em["chapter"],
                },
            })
        profile = get_user_profile(username)
        return {
            "date": mission_date,
            "tasks": tasks,
            "streak": profile.get("streak_count", 0) if profile else 0,
            "total_minutes_assigned": len(tasks) * 15,
            "theme": "Consistent Practice"
        }

    user_data = get_augmented_user_data(username)
    chapter_subject_map = _build_chapter_subject_map(user_data)
    
    tasks = []
    subjects = request.subjects if request.subjects else ["Physics", "Chemistry", "Math"]
    for idx, subj in enumerate(subjects):
        # find a chapter for this subject
        chaps = [k for k, v in chapter_subject_map.items() if v == subj]
        chap = chaps[0] if chaps else "Core Concepts"
        desc = f"Solve 3 {chap} problems"
        
        upsert_daily_mission(username, subj, mission_date, chap, desc)
    
    existing_missions = fetch_daily_missions(username, mission_date)
    for em in existing_missions:
        tasks.append({
            "id": str(em["id"]),
            "kind": "practice",
            "title": em["task_description"],
            "reason": "Daily practice for retention",
            "subject": em["subject"],
            "chapter": em["chapter"],
            "completed": bool(em["completed"]),
            "destination": "practice",
            "route": "/practice",
            "route_state": {
                "subject": em["subject"],
                "chapter": em["chapter"],
            },
        })

    profile = get_user_profile(username)
    streak = profile.get("streak_count", 0) if profile else 0

    return {
        "date": mission_date,
        "tasks": tasks,
        "streak": streak,
        "total_minutes_assigned": len(tasks) * 15,
        "theme": "Consistent Practice"
    }
'''

content = re.sub(r'@router\.post\("/daily-mission"\).*?async def get_daily_mission.*?return \{.*?\}', new_func, content, flags=re.DOTALL)

with open('routes/progress.py', 'w') as f:
    f.write(content)
