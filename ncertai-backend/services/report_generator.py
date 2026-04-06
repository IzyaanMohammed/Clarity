import os
from datetime import datetime, timedelta
import logging
import httpx
from services.database import fetch_progress_logs

logger = logging.getLogger(__name__)

def generate_parent_report(user_id: str):
    data = fetch_progress_logs(user_id)
    user_data = [i for i in data if i["user_id"] == user_id]
    if not user_data:
        return "No activity found for this student."
        
    # Filter for last 7 days
    seven_days_ago = (datetime.now() - timedelta(days=7)).isoformat()
    recent_data = [i for i in user_data if i["timestamp"] > seven_days_ago]
    
    total_q = len([i for i in recent_data if i["action"] == "question"])
    total_p = len([i for i in recent_data if i["action"] == "practice"])
    scored = [i for i in recent_data if isinstance(i.get("score"), (int, float))]
    avg_score = round(sum(i["score"] for i in scored) / len(scored), 1) if scored else 0

    subjects = list(dict.fromkeys([i["subject"] for i in recent_data if i.get("subject")]))
    weak_topics = list(dict.fromkeys([i["chapter"] for i in recent_data if isinstance(i.get("score"), (int, float)) and i["score"] < 50 and i.get("chapter")]))
    confidence = min(100, max(35, int(round(avg_score if avg_score else 55))))
    risk = max(0, 100 - confidence)
    corrective_actions = []
    if weak_topics:
        corrective_actions.append(f"Focus on {weak_topics[0]} with one practice set and one recap sheet.")
    if total_p < 2:
        corrective_actions.append("Complete at least one timed practice session this week.")
    if total_q < 5:
        corrective_actions.append("Increase question practice so feedback can become more precise.")
    if not corrective_actions:
        corrective_actions.append("Keep the current routine and add one mixed mock test for retention.")
    
    report = f"""
    NCERTAI WEEKLY PROGRESS REPORT
    Student: {user_id}
    Generated on: {datetime.now().strftime('%Y-%m-%d')}
    
    OVERVIEW:
    - Questions Asked: {total_q}
    - Practice Sessions: {total_p}
    - Subjects Covered: {', '.join(subjects) if subjects else 'None'}
    - Average Practice Score: {avg_score if avg_score else 'No graded attempts yet'}
    
    MASTERY INSIGHTS:
    - The student is showing strong engagement in {subjects[0] if subjects else 'their studies'}.
    - Confidence Meter: {confidence}/100
    - Risk Meter: {risk}/100
    - Weak Areas: {', '.join(weak_topics) if weak_topics else 'None detected'}

    CORRECTIVE ACTIONS:
    - {chr(10).join(f'- {item}' for item in corrective_actions)}
    
    Thank you for choosing NcertAI for your child's CBSE preparation.
    """
    return report.strip()


def send_parent_report_email(user_id: str, parent_email: str, report_text: str):
    resend_api_key = os.getenv("RESEND_API_KEY", "").strip()
    from_email = os.getenv("PARENT_REPORT_FROM_EMAIL", "onboarding@resend.dev").strip()

    if not resend_api_key:
        logger.warning("RESEND_API_KEY not configured; report not sent for user=%s", user_id)
        return {
            "sent": False,
            "message": "Email API key missing. Add RESEND_API_KEY to enable sending.",
        }

    subject = f"Clarity Weekly Progress Report - {user_id}"
    html = (
        "<div style='font-family:Arial,sans-serif;line-height:1.5'>"
        f"<h2>Clarity Weekly Progress Report</h2>"
        f"<p><strong>Student:</strong> {user_id}</p>"
        "<pre style='white-space:pre-wrap;background:#f6f8fa;padding:12px;border-radius:8px;'>"
        f"{report_text}"
        "</pre>"
        "</div>"
    )

    payload = {
        "from": from_email,
        "to": [parent_email],
        "subject": subject,
        "html": html,
    }

    headers = {
        "Authorization": f"Bearer {resend_api_key}",
        "Content-Type": "application/json",
    }

    try:
        response = httpx.post("https://api.resend.com/emails", json=payload, headers=headers, timeout=20.0)
        if response.status_code in (200, 202):
            return {"sent": True, "message": f"Report sent to {parent_email}."}

        logger.error("Resend send failed: status=%s body=%s", response.status_code, response.text)
        return {
            "sent": False,
            "message": f"Resend error {response.status_code}: could not deliver email.",
        }
    except Exception as exc:
        logger.error("Resend send exception: %s", exc)
        return {
            "sent": False,
            "message": "Email service unavailable right now. Please retry.",
        }
