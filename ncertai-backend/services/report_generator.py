import json
import os
from datetime import datetime, timedelta

PROGRESS_FILE = "progress_data.json"

def generate_parent_report(user_id: str):
    if not os.path.exists(PROGRESS_FILE):
        return "No data available yet."
        
    try:
        with open(PROGRESS_FILE, "r") as f:
            data = json.load(f)
    except:
        return "Error reading progress data."
        
    user_data = [i for i in data if i["user_id"] == user_id]
    if not user_data:
        return "No activity found for this student."
        
    # Filter for last 7 days
    seven_days_ago = (datetime.now() - timedelta(days=7)).isoformat()
    recent_data = [i for i in user_data if i["timestamp"] > seven_days_ago]
    
    total_q = len([i for i in recent_data if i["action"] == "question"])
    total_p = len([i for i in recent_data if i["action"] == "practice"])
    
    subjects = list(set([i["subject"] for i in recent_data]))
    
    report = f"""
    NCERTAI WEEKLY PROGRESS REPORT
    Student: {user_id}
    Generated on: {datetime.now().strftime('%Y-%m-%d')}
    
    OVERVIEW:
    - Questions Asked: {total_q}
    - Practice Sessions: {total_p}
    - Subjects Covered: {', '.join(subjects) if subjects else 'None'}
    
    MASTERY INSIGHTS:
    - The student is showing strong engagement in {subjects[0] if subjects else 'their studies'}.
    - AI Recommendation: Focus on mock tests for the coming week to build exam stamina.
    
    Thank you for choosing NcertAI for your child's CBSE preparation.
    """
    return report.strip()
