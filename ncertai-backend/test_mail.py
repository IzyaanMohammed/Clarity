import httpx
import sys

api_key = "mlsn.60c3eabba7672f349e45e12f0085775a0d1e1073a5b4043ceccc42d44a1e8588"
from_email = "info@trial-z86org8yvjmpew13.mlsender.net"
to_email = "izyaankaka11@gmail.com"

try:
    resp = httpx.post(
        "https://api.mailersend.com/v1/email",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        },
        json={
            "from": {"email": from_email, "name": "Clarity Testing"},
            "to": [{"email": to_email}],
            "subject": "Clarity API Key Test",
            "html": "<p>If you are reading this, the MailerSend API key is currently working!</p>"
        },
        timeout=10.0
    )
    if resp.status_code in (200, 202):
        print(f"SUCCESS: Email sent to {to_email}. Status code: {resp.status_code}")
    else:
        print(f"FAILED: Status code {resp.status_code}. Response: {resp.text}")
except Exception as e:
    print(f"ERROR: {e}")
