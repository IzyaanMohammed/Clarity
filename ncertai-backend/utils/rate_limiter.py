from datetime import date
import os

# In-memory storage for MVP
# Structure:
# {
#   user_id: {
#     "date": "YYYY-MM-DD",
#     "week": "YYYY-WW",
#     "question": 0,
#     "upload": 0,
#     "summary": 0,
#     "test": 0,
#     "tier": "free"
#   }
# }
usage_data = {}

# Tier Limits
LIMITS = {
    "free": {
        "question": 120,
        "upload": 30,
        "summary": 80,
        "test": 30,
        "practice": 120,
    },
    "pro": {
        "question": 999999,
        "upload": 999999,
        "summary": 999999,
        "test": 999999,
        "practice": 999999,
    }
}


def _is_rate_limit_enabled() -> bool:
    # Reliability-first default for local/dev. Set CLARITY_ENFORCE_RATE_LIMITS=1 to enforce.
    return os.getenv("CLARITY_ENFORCE_RATE_LIMITS", "0").strip().lower() in {"1", "true", "yes", "on"}

def get_user_tier(user_id: str) -> str:
    # In a real app, this would check a database
    # For now, we'll check if the user_id contains "PRO" (mocking)
    if user_id.endswith("_PRO"):
        return "pro"
    return usage_data.get(user_id, {}).get("tier", "free")

def check_rate_limit(user_id: str, action: str) -> bool:
    if not _is_rate_limit_enabled():
        return True

    today = str(date.today())
    week_key = f"{date.today().isocalendar().year}-{date.today().isocalendar().week}"
    tier = get_user_tier(user_id)

    if user_id not in usage_data:
        usage_data[user_id] = {
            "date": today,
            "week": week_key,
            "question": 0,
            "upload": 0,
            "summary": 0,
            "test": 0,
            "practice": 0,
            "tier": tier,
        }
        return True

    if usage_data[user_id]["date"] != today:
        usage_data[user_id]["date"] = today
        usage_data[user_id]["question"] = 0
        usage_data[user_id]["upload"] = 0
        usage_data[user_id]["practice"] = 0

    if usage_data[user_id].get("week") != week_key:
        usage_data[user_id]["week"] = week_key
        usage_data[user_id]["summary"] = 0
        usage_data[user_id]["test"] = 0
        
    limit = LIMITS[tier].get(action, 5)
    return usage_data[user_id].get(action, 0) < limit

def increment_usage(user_id: str, action: str):
    if not _is_rate_limit_enabled():
        return

    today = str(date.today())
    week_key = f"{date.today().isocalendar().year}-{date.today().isocalendar().week}"
    tier = get_user_tier(user_id)

    if user_id not in usage_data:
        usage_data[user_id] = {
            "date": today,
            "week": week_key,
            "question": 0,
            "upload": 0,
            "summary": 0,
            "test": 0,
            "practice": 0,
            "tier": tier,
        }

    if usage_data[user_id]["date"] != today:
        usage_data[user_id]["date"] = today
        usage_data[user_id]["question"] = 0
        usage_data[user_id]["upload"] = 0
        usage_data[user_id]["practice"] = 0

    if usage_data[user_id].get("week") != week_key:
        usage_data[user_id]["week"] = week_key
        usage_data[user_id]["summary"] = 0
        usage_data[user_id]["test"] = 0

    usage_data[user_id][action] = usage_data[user_id].get(action, 0) + 1
