import os
from datetime import datetime, timedelta
import logging
import httpx
import secrets
from services.database import fetch_progress_logs, get_parent_account_by_student, reset_parent_credentials

logger = logging.getLogger(__name__)


def _public_parent_portal_url() -> str:
    base = os.getenv("CLARITY_APP_BASE_URL", "").strip().rstrip("/")
    if base:
        return f"{base}/parent-portal"
    return "/parent-portal"


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
    subject_counts: dict[str, int] = {}
    for item in recent_data:
        subject = str(item.get("subject") or "").strip()
        if subject:
            subject_counts[subject] = subject_counts.get(subject, 0) + 1
    attention_subject = max(subject_counts, key=subject_counts.get) if subject_counts else (subjects[0] if subjects else "their studies")

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
    
    parent_account = get_parent_account_by_student(user_id)
    parent_creds_block = ""
    if parent_account:
        p_email = parent_account.get("parent_email")
        p_pass = parent_account.get("plain_password")
        if not p_pass or p_pass == "********":
            p_pass = secrets.token_urlsafe(9)
            reset_parent_credentials(user_id, p_pass)
        parent_creds_block = f"\n    PARENT LOGIN CREDENTIALS:\n    - Email: {p_email}\n    - Password: {p_pass}\n"

    report = f"""
    CLARITY WEEKLY PROGRESS REPORT
    Student: {user_id}
    Generated on: {datetime.now().strftime('%Y-%m-%d')}
    {parent_creds_block}
    OVERVIEW:
    - Questions Asked: {total_q}
    - Practice Sessions: {total_p}
    - Subjects Covered: {', '.join(subjects) if subjects else 'None'}
    - Average Practice Score: {avg_score if avg_score else 'No graded attempts yet'}
    
    MASTERY INSIGHTS:
    - Activity is concentrated in {attention_subject}.
    - Confidence Meter: {confidence}/100
    - Risk Meter: {risk}/100
    - Weak Areas: {', '.join(weak_topics) if weak_topics else 'None detected'}

    CORRECTIVE ACTIONS:
    - {chr(10).join(f'- {item}' for item in corrective_actions)}
    
    Thank you for using Clarity for your child's CBSE preparation.
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
    portal_url = _public_parent_portal_url()
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

        logger.warning("Resend send warning: status=%s body=%s", response.status_code, response.text)
        return {
            "sent": False,
            "message": f"Email warning: {response.text}",
        }
    except Exception as exc:
        logger.warning("Resend send exception (handled gracefully): %s", exc)
        return {
            "sent": False,
            "message": f"Email exception: {str(exc)}",
        }


def send_parent_welcome_credentials_email(student_id: str, parent_email: str, parent_password: str):
    resend_api_key = os.getenv("RESEND_API_KEY", "").strip()
    from_email = os.getenv("PARENT_REPORT_FROM_EMAIL", "onboarding@resend.dev").strip()

    if not resend_api_key:
        logger.warning("RESEND_API_KEY not configured; parent credentials email not sent for student=%s", student_id)
        return {
            "sent": False,
            "message": "Parent credentials generated, but email API key is missing. No email sent.",
        }

    subject = f"Clarity Parent Access Credentials - {student_id}"
    portal_url = _public_parent_portal_url()
    html = (
        "<div style='font-family:Arial,sans-serif;line-height:1.5'>"
        "<h2>Welcome to Clarity Parent Portal</h2>"
        f"<p>You are now linked to student: <strong>{student_id}</strong></p>"
        f"<p>Use these credentials to log in at <strong>{portal_url}</strong>:</p>"
        "<ul>"
        f"<li><strong>Email:</strong> {parent_email}</li>"
        f"<li><strong>Password:</strong> {parent_password}</li>"
        "</ul>"
        "<p>Please change/store this password securely after first login.</p>"
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
            return {"sent": True, "message": f"Parent credentials sent to {parent_email}."}
        logger.warning("Resend credentials send warning: status=%s body=%s", response.status_code, response.text)
        return {
            "sent": False,
            "message": f"Credentials generated, but email sending failed: {response.text}",
        }
    except Exception as exc:
        logger.warning("Resend credentials send exception: %s", exc)
        return {
            "sent": False,
            "message": f"Credentials generated, but email sending encountered an error: {str(exc)}",
        }
