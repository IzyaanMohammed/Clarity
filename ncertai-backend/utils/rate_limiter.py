from datetime import date
import os
from services.database import get_user_profile

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
        "practice": 120,
    },
    "pro_max": {
        "question": 999999,
        "upload": 999999,
        "summary": 999999,
        "practice": 999999,
    },
    "pro": {
        "question": 999999,
        "upload": 999999,
        "summary": 999999,
        "practice": 999999,
    }
}


def _is_rate_limit_enabled() -> bool:
    value = os.getenv("CLARITY_ENFORCE_RATE_LIMITS", "").strip().lower()
    if value in {"1", "true", "yes", "on"}:
        return True
    if value in {"0", "false", "no", "off"}:
        return False
    return os.getenv("CLARITY_ENV", "development").strip().lower() == "production"

def get_user_tier(user_id: str) -> str:
    profile = get_user_profile(user_id) or {}
    tier = str(profile.get("subscription_tier") or "free").strip().lower()
    if tier not in LIMITS:
        return "free"
    return tier

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

    usage_data[user_id][action] = usage_data[user_id].get(action, 0) + 1
