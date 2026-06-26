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

    actions_str = chr(10).join(f'- {item}' for item in corrective_actions)
    date_str = datetime.now().strftime('%Y-%m-%d')
    subjects_str = ', '.join(subjects) if subjects else 'None'
    avg_score_str = avg_score if avg_score else 'No graded attempts yet'
    weak_topics_str = ', '.join(weak_topics) if weak_topics else 'None detected'

    report = (
        f"CLARITY WEEKLY PROGRESS REPORT\n"
        f"Student: {user_id}\n"
        f"Generated on: {date_str}\n"
        f"{parent_creds_block}\n"
        f"OVERVIEW:\n"
        f"- Questions Asked: {total_q}\n"
        f"- Practice Sessions: {total_p}\n"
        f"- Subjects Covered: {subjects_str}\n"
        f"- Average Practice Score: {avg_score_str}\n\n"
        f"MASTERY INSIGHTS:\n"
        f"- Activity is concentrated in {attention_subject}.\n"
        f"- Confidence Meter: {confidence}/100\n"
        f"- Risk Meter: {risk}/100\n"
        f"- Weak Areas: {weak_topics_str}\n\n"
        f"CORRECTIVE ACTIONS:\n"
        f"{actions_str}\n\n"
        f"Thank you for using Clarity for your child's CBSE preparation.\n"
    )
    return report.strip()


def send_parent_report_email(user_id: str, parent_email: str, report_text: str):
    api_key = os.getenv("MAILERSEND_API_KEY")
    from_email = os.getenv("MAILERSEND_FROM_EMAIL", "info@trial-z86org8yvjmpew13.mlsender.net")

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

    try:
        resp = httpx.post(
            "https://api.mailersend.com/v1/email",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json={
                "from": {"email": from_email, "name": "Clarity"},
                "to": [{"email": parent_email}],
                "subject": subject,
                "html": html
            },
            timeout=10.0
        )
        if resp.status_code in (200, 202):
            return {"sent": True, "message": "Email sent successfully via MailerSend."}
        else:
            logger.error(f"MailerSend error: {resp.text}")
            return {"sent": False, "message": "Failed to send email."}
    except Exception as e:
        logger.error(f"Exception sending email: {e}")
        return {"sent": False, "message": "Failed to send email."}


def send_parent_welcome_credentials_email(student_id: str, parent_email: str, parent_password: str):
    api_key = os.getenv("MAILERSEND_API_KEY")
    from_email = os.getenv("MAILERSEND_FROM_EMAIL", "info@trial-z86org8yvjmpew13.mlsender.net")

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

    try:
        resp = httpx.post(
            "https://api.mailersend.com/v1/email",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json={
                "from": {"email": from_email, "name": "Clarity"},
                "to": [{"email": parent_email}],
                "subject": subject,
                "html": html
            },
            timeout=10.0
        )
        if resp.status_code in (200, 202):
            return {"sent": True, "message": "Credentials sent successfully."}
        else:
            logger.error(f"MailerSend error: {resp.text}")
            return {"sent": False, "message": "Failed to send credentials."}
    except Exception as e:
        logger.error(f"Exception sending email: {e}")
        return {"sent": False, "message": "Failed to send credentials."}
