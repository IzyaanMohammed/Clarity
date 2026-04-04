from datetime import date
import os
import json

# In-memory storage for MVP
# Structure: {user_id: {"date": "YYYY-MM-DD", "question": 0, "upload": 0, "tier": "free"}}
usage_data = {}

# Tier Limits
LIMITS = {
    "free": {
        "question": 999999,
        "upload": 999999,
        "practice": 999999
    },
    "pro": {
        "question": 999999,
        "upload": 999999,
        "practice": 999999
    }
}

def get_user_tier(user_id: str) -> str:
    # In a real app, this would check a database
    # For now, we'll check if the user_id contains "PRO" (mocking)
    if user_id.endswith("_PRO"):
        return "pro"
    return usage_data.get(user_id, {}).get("tier", "free")

def check_rate_limit(user_id: str, action: str) -> bool:
    today = str(date.today())
    tier = get_user_tier(user_id)
    
    if user_id not in usage_data or usage_data[user_id]["date"] != today:
        usage_data[user_id] = {"date": today, "question": 0, "upload": 0, "practice": 0, "tier": tier}
        return True
        
    limit = LIMITS[tier].get(action, 5)
    return usage_data[user_id][action] < limit

def increment_usage(user_id: str, action: str):
    today = str(date.today())
    tier = get_user_tier(user_id)
    
    if user_id not in usage_data or usage_data[user_id]["date"] != today:
        usage_data[user_id] = {"date": today, "question": 0, "upload": 0, "practice": 0, "tier": tier}
        
    usage_data[user_id][action] += 1
