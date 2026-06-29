import asyncio
from services.report_generator import send_parent_report_email, send_parent_welcome_credentials_email
from dotenv import load_dotenv

load_dotenv()

def test_email():
    res = send_parent_welcome_credentials_email("test_student", "izyaan.mohammed@example.com", "mypassword")
    print(res)

if __name__ == "__main__":
    test_email()
