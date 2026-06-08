"""Quick smoke test for major API endpoints.

Run:
    d:/Desktop/clarity/.venv/Scripts/python.exe smoke_endpoints.py

This script uses deterministic mocks for external AI/network/video dependencies
so endpoint contracts can be tested reliably in local development.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from main import app  # noqa: E402
import routes.qa as qa  # noqa: E402
import routes.practice as practice  # noqa: E402
import routes.summary as summary  # noqa: E402
import routes.upload as upload  # noqa: E402
import routes.creative as creative  # noqa: E402
import routes.progress as progress  # noqa: E402
from services.database import set_user_subscription_tier, upsert_parent_account  # noqa: E402


async def mock_ask_openrouter(messages, task_type="smart"):
    joined = "\n".join(str(m.get("content", "")) for m in messages if isinstance(m, dict))
    if "MARKS:" in joined:
        return (
            "MARKS: 4/5\n"
            "WHAT WAS GOOD: Correct concept and structure.\n"
            "WHAT WAS MISSING: One key point and a labeled diagram.\n"
            "MODEL ANSWER: A complete board-style answer with all required points."
        )
    if "flashcards" in joined.lower():
        return "Q: Define velocity. | A: Speed with direction.\nQ: State Ohm's law. | A: V=IR at constant temperature."
    if "strict JSON" in joined and "branches" in joined:
        return '{"branches": ["Definition", "Mechanism", "Examples", "Diagram", "Mistakes", "Exam Tip"]}'
    if "chapter summary" in joined.lower() or "## Core Ideas" in joined:
        return (
            "## Core Ideas\n| Idea | Why It Matters | Memory Hook |\n|---|---|---|\n"
            "| Nutrition | Energy source | Food to fuel |\n| Photosynthesis | Food synthesis | Sun + leaf |\n"
            "| Digestion | Breakdown | Small molecules |\n| Absorption | Transport | Into blood |\n\n"
            "## Key Terms\n| Term | Meaning | Where Used |\n|---|---|---|\n| Chlorophyll | Green pigment | Leaves |\n\n"
            "## Board Focus\n| Likely Question Type | What Examiner Expects | Answer Starter |\n|---|---|---|\n"
            "| 3-mark difference | 3 clear points | Autotrophic nutrition is... |\n\n"
            "## Quick Recall\n- [ ] Define nutrition\n- [ ] Autotrophic mode\n- [ ] Heterotrophic mode\n- [ ] Photosynthesis equation\n- [ ] One exam difference\n\n"
            "## Exam Tip\nAlways write process steps in sequence."
        )
    if "formula and definition reference sheet" in joined.lower():
        return (
            "## Formulas\n| Formula | Meaning | Unit | Typical Question Use |\n|---|---|---|---|\n| V=IR | Ohm's law | V | circuit numericals |\n\n"
            "## Definitions\n| Term | Definition | Chapter Context |\n|---|---|---|\n| Resistance | Opposition to current | Electricity |\n\n"
            "## Units\n| Quantity | SI Unit | Conversion Note |\n|---|---|---|\n| Current | Ampere | 1 A = 1 C/s |\n\n"
            "## Common Mistakes\n| Mistake | Why It Happens | Fix |\n|---|---|---|\n| Unit mismatch | Rushing | Write SI units first |\n\n"
            "## Exam Tip\nShow unit at each step."
        )
    if "one-day CBSE study plan" in joined:
        return (
            "## Morning Sprint\n| Task | Duration (min) | Outcome | Action |\n|---|---|---|---|\n| Revise notes | 40 | Recall terms | [ ] Revise notes |\n\n"
            "## Afternoon Deep Work\n| Task | Duration (min) | Outcome | Action |\n|---|---|---|---|\n| Solve board questions | 60 | Application | [ ] Solve test set |\n\n"
            "## Evening Review\n| Task | Duration (min) | Outcome | Action |\n|---|---|---|---|\n| Error log review | 30 | Fix mistakes | [ ] Update error log |\n\n"
            "## Priority Fixes\n| Topic | Fix Action | Deadline |\n|---|---|---|\n| Numericals | 10 mixed questions | Tonight |\n\n"
            "## Exam Tip\nDo timed revision blocks."
        )
    if "Manim Script" in joined:
        return "## Manim Script\n```python\nfrom manim import *\n```\n## Voiceover Script\n...\n## Subtitle SRT\n...\n## Render Commands\nmanim -pql scene.py Scene"
    return "1. Define the term with an NCERT example.\n2. Explain with one diagram-based point."


async def mock_ask_openrouter_stream(messages, task_type="smart"):
    for token in ["High", " quality", " streamed", " output"]:
        yield token


class _FakeResp:
    def __init__(self, text: str):
        self.status_code = 200
        self.text = text


class _FakeClient:
    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def get(self, url):
        if "r.jina.ai" in url:
            return _FakeResp(
                "Chapter 1 Nutrition in Plants and Animals. "
                "This chapter explains autotrophic and heterotrophic modes, photosynthesis steps, "
                "digestion stages, and board-level definitions with clear NCERT terminology."
            )
        return _FakeResp(
            "<html><body><h1>Chapter 1 Nutrition</h1>"
            "<p>Detailed chapter content covering definitions, process flow, examples, and revision points "
            "for class-level board preparation.</p></body></html>"
        )


def patch_dependencies() -> None:
    qa.ask_openrouter = mock_ask_openrouter
    qa.ask_openrouter_stream = mock_ask_openrouter_stream
    practice.ask_openrouter = mock_ask_openrouter
    practice.ask_openrouter_stream = mock_ask_openrouter_stream
    summary.ask_openrouter = mock_ask_openrouter
    summary.ask_openrouter_stream = mock_ask_openrouter_stream
    upload.ask_openrouter = mock_ask_openrouter
    upload.httpx.AsyncClient = _FakeClient
    creative.ask_openrouter = mock_ask_openrouter
    creative.ask_openrouter_stream = mock_ask_openrouter_stream

    import services.paypal as paypal
    async def mock_get_paypal_access_token():
        return "mock_paypal_token"
    async def mock_create_paypal_subscription(username, plan, success_url, cancel_url):
        return {
            "subscription_id": "I-MOCKSUBSCRIPTIONID",
            "approve_url": "https://www.sandbox.paypal.com/checkoutnow?token=mock_token",
            "status": "APPROVAL_PENDING"
        }
    paypal.get_paypal_access_token = mock_get_paypal_access_token
    paypal.create_paypal_subscription = mock_create_paypal_subscription

    practice.get_best_cbse_videos = lambda subject, grade, chapter, limit=5: {
        "query": f"class {grade} {subject} {chapter} ncert explanation",
        "query_url": "https://www.youtube.com/results?search_query=class+10+science+nutrition",
        "videos": [
            {
                "title": "NCERT Nutrition in Plants and Animals",
                "channel": "Clarity Demo",
                "duration": "12:34",
                "views": "100000",
                "published": "1 year ago",
                "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                "embed_url": "https://www.youtube.com/embed/dQw4w9WgXcQ",
                "embed_code": "<iframe src='https://www.youtube.com/embed/dQw4w9WgXcQ' loading='lazy' allowfullscreen></iframe>",
                "search_source": "smoke_mock",
            }
        ],
    }
    practice._fetch_video_transcript_entries = lambda _video_id: [
        {"start": 8.0, "duration": 4.0, "text": "Nutrition is the process of obtaining food."},
        {"start": 28.0, "duration": 5.0, "text": "Autotrophic nutrition uses sunlight and chlorophyll."},
        {"start": 48.0, "duration": 6.0, "text": "Photosynthesis converts carbon dioxide and water into glucose and oxygen."},
        {"start": 73.0, "duration": 6.0, "text": "Heterotrophic nutrition includes holozoic, saprophytic, and parasitic modes."},
        {"start": 101.0, "duration": 5.0, "text": "Exam answers should include NCERT keywords and one clear example."},
    ]

    progress.generate_parent_report = lambda user_id: f"Report for {user_id}: steady progress."
    progress.send_parent_report_email = lambda user_id, parent_email, report_text: {
        "sent": True,
        "message": "Email sent",
    }

    tmp_video = BACKEND_DIR / "_smoke_video.mp4"
    tmp_video.write_bytes(b"\x00\x00\x00\x18ftypmp42")

    async def _mock_slide_video(req):
        return tmp_video

    async def _mock_manim_video(req):
        raise RuntimeError("manim unavailable in smoke")

    creative._make_video_from_topic = _mock_slide_video
    creative._make_video_with_manim = _mock_manim_video


def check(client: TestClient, name: str, method: str, path: str, expected_statuses=(200,), **kwargs):
    resp = getattr(client, method)(path, **kwargs)
    ok = resp.status_code in expected_statuses
    print(("OK" if ok else "FAIL"), name, resp.status_code)
    return ok


def main() -> int:
    patch_dependencies()
    client = TestClient(app)

    auth_profile = {
        "name": "smoke_user",
        "class": 10,
        "subjects": ["Science"],
        "school": "Smoke School",
        "parentEmail": "smokeparent@example.com",
    }
    register_resp = client.post(
        "/api/v1/auth/register",
        json={"profile": auth_profile, "password": "smoke123"},
    )
    if register_resp.status_code == 409:
        login_resp = client.post(
            "/api/v1/auth/login",
            json={"name": auth_profile["name"], "password": "smoke123"},
        )
        if login_resp.status_code != 200:
            print("FAIL auth.login", login_resp.status_code)
            return 1
        token = login_resp.json().get("token", "")
    elif register_resp.status_code == 200:
        token = register_resp.json().get("token", "")
    else:
        print("FAIL auth.register", register_resp.status_code)
        return 1

    auth_headers = {"Authorization": f"Bearer {token}"}

    # Parent portal auth flow with deterministic credentials for smoke checks.
    parent_password = "parentSmoke123!"
    upsert_parent_account(auth_profile["name"], auth_profile["parentEmail"], parent_password)
    parent_login_resp = client.post(
        "/api/v1/auth/parent/login",
        json={"email": auth_profile["parentEmail"], "password": parent_password},
    )
    if parent_login_resp.status_code != 200:
        print("FAIL auth.parent.login", parent_login_resp.status_code)
        return 1
    parent_token = parent_login_resp.json().get("token", "")
    parent_headers = {"Authorization": f"Bearer {parent_token}"}

    qa_payload = {
        "class_num": "10",
        "subject": "Science",
        "chapter": "Life Processes",
        "question": "What is nutrition?",
        "conversation_history": [],
    }
    practice_payload = {
        "class_num": "10",
        "subject": "Science",
        "chapter": "Life Processes",
        "question_type": "mixed",
        "num_questions": 3,
    }
    creative_payload = {
        "class_num": "10",
        "subject": "Science",
        "chapter": "Life Processes",
        "topic": "Nutrition",
    }

    png_bytes = (
        b"\x89PNG\r\n\x1a\n"
        b"\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
        b"\x00\x00\x00\x0cIDATx\x9cc``\xf8\xcf\xc0\x00\x00\x03\x01\x01\x00\xc9\xfe\x92\xef"
        b"\x00\x00\x00\x00IEND\xaeB`\x82"
    )

    checks = [
        check(client, "root", "get", "/"),
        check(client, "health", "get", "/health"),
        check(client, "auth.me.unauthorized", "get", "/api/v1/auth/me", expected_statuses=(401,)),
        check(client, "progress.log.unauthorized", "post", "/api/v1/progress/log", json={
            "action": "question", "subject": "Science", "chapter": "Life Processes", "score": 80
        }, expected_statuses=(401,)),
        check(client, "progress.analytics.unauthorized", "get", "/api/v1/progress/analytics", expected_statuses=(401,)),
        check(client, "creative.video.unauthorized", "post", "/api/v1/creative/video-file", json=creative_payload, expected_statuses=(401,)),
        check(client, "qa.ask", "post", "/api/v1/chat/ask", json=qa_payload),
        check(client, "qa.ask-stream", "post", "/api/v1/chat/ask-stream", json=qa_payload),
        check(client, "auth.me", "get", "/api/v1/auth/me", headers=auth_headers),
        check(client, "auth.billing-config", "get", "/api/v1/auth/billing/config"),
        check(client, "auth.billing.checkout", "post", "/api/v1/auth/billing/checkout", headers=auth_headers, json={"plan": "pro"}, expected_statuses=(200, 503)),
        check(client, "auth.parent.portal-summary", "get", "/api/v1/progress/parent-portal/summary", headers=parent_headers),
        check(client, "auth.parent.logout", "post", "/api/v1/auth/parent/logout", headers=parent_headers),
        check(client, "practice.generate", "post", "/api/v1/practice/generate", json=practice_payload),
        check(client, "practice.generate-stream", "post", "/api/v1/practice/generate-stream", json=practice_payload),
        check(client, "practice.video-resource-stack.unauthorized", "get", "/api/v1/practice/video-resource-stack", params={
            "class_num": "10", "subject": "Science", "chapter": "Life Processes"
        }, expected_statuses=(401,)),
        check(client, "practice.video-resource-stack", "get", "/api/v1/practice/video-resource-stack", params={
            "class_num": "10", "subject": "Science", "chapter": "Life Processes"
        }, headers=auth_headers),
        check(client, "practice.video-learning-assist.unauthorized", "get", "/api/v1/practice/video-learning-assist", params={
            "class_num": "10", "subject": "Science", "chapter": "Life Processes", "video_id": "dQw4w9WgXcQ"
        }, expected_statuses=(401,)),
        check(client, "practice.grade", "post", "/api/v1/practice/grade", json={
            "question": "Define nutrition.",
            "user_answer": "Nutrition is obtaining food.",
            "class_num": "10",
            "subject": "Science",
            "marks_available": 5,
        }),
        check(client, "practice.grade-stream", "post", "/api/v1/practice/grade-stream", json={
            "question": "Define nutrition.",
            "user_answer": "Nutrition is obtaining food.",
            "class_num": "10",
            "subject": "Science",
            "marks_available": 5,
        }),
        check(client, "practice.explain-question", "get", "/api/v1/practice/explain-question", params={
            "subject": "Science",
            "chapter": "Life Processes",
            "question": "What is nutrition?",
        }),
        check(client, "auth.diagnostic.questions", "get", "/api/v1/auth/diagnostic/questions", params={
            "class_num": "10",
            "subject": "mixed",
        }),
        check(client, "summary.chapter", "post", "/api/v1/summary/chapter-summary", json={
            "class_num": "10", "subject": "Science", "chapter": "Life Processes"
        }),
        check(client, "summary.plan", "post", "/api/v1/summary/daily-plan", json={
            "class_num": "10", "subjects": ["Science", "Math"], "weak_topics": ["Numericals"]
        }),
        check(client, "upload.ocr", "post", "/api/v1/upload/ocr", files={"file": ("note.png", png_bytes, "image/png")}),
        check(client, "upload.textbook", "get", "/api/v1/upload/textbook-content", params={
            "url": "https://ncert.nic.in/textbook.php?jesc1=0-16", "chapter_index": 1
        }),
        check(client, "progress.log", "post", "/api/v1/progress/log", json={
            "action": "question", "subject": "Science", "chapter": "Life Processes", "score": 80
        }, headers=auth_headers),
        check(client, "progress.analytics", "get", "/api/v1/progress/analytics", headers=auth_headers),
        check(client, "progress.recommendations", "get", "/api/v1/progress/recommendations", headers=auth_headers),
        check(client, "creative.video", "post", "/api/v1/creative/video-file", json=creative_payload, headers=auth_headers),
        check(client, "creative.video-manim", "post", "/api/v1/creative/video-file-manim", json=creative_payload, headers=auth_headers),
        check(client, "creative.mindmap", "post", "/api/v1/creative/mindmap-image", json=creative_payload, headers=auth_headers),
    ]

    # Contract check for embed-first frontend behavior.
    video_stack_resp = client.get(
        "/api/v1/practice/video-resource-stack",
        params={"class_num": "10", "subject": "Science", "chapter": "Life Processes"},
        headers=auth_headers,
    )
    video_stack_ok = False
    if video_stack_resp.status_code == 200:
        payload = video_stack_resp.json()
        videos = payload.get("videos", [])
        first = videos[0] if videos else {}
        video_stack_ok = bool(videos) and bool(first.get("embed_url") or first.get("embed_code"))
    print(("OK" if video_stack_ok else "FAIL"), "practice.video-resource-stack.embed-contract", video_stack_resp.status_code)
    checks.append(video_stack_ok)

    # Diagnostic submit with live question ids/options from contract endpoint.
    diagnostic_questions = client.get(
        "/api/v1/auth/diagnostic/questions",
        params={"class_num": "10", "subject": "mixed"},
    )
    diag_submit_ok = False
    if diagnostic_questions.status_code == 200:
        payload = diagnostic_questions.json()
        answers = []
        for item in payload.get("questions", []):
            options = item.get("options", [])
            selected = options[0].get("key") if options else "A"
            answers.append({"question_id": item.get("id"), "selected_option": selected})
        diag_resp = client.post(
            "/api/v1/auth/diagnostic",
            json={"class_num": "10", "subject": "mixed", "answers": answers},
            headers=auth_headers,
        )
        diag_submit_ok = diag_resp.status_code == 200
        print(("OK" if diag_submit_ok else "FAIL"), "auth.diagnostic.submit", diag_resp.status_code)
    else:
        print("FAIL", "auth.diagnostic.questions.prep", diagnostic_questions.status_code)
    checks.append(diag_submit_ok)

    # Video learning assist is gated to paid tiers (pro/pro_max).
    set_user_subscription_tier(auth_profile["name"], "free")
    video_assist_free_resp = client.get(
        "/api/v1/practice/video-learning-assist",
        params={
            "class_num": "10",
            "subject": "Science",
            "chapter": "Life Processes",
            "video_id": "dQw4w9WgXcQ",
        },
        headers=auth_headers,
    )
    video_assist_free_ok = video_assist_free_resp.status_code == 403
    print(("OK" if video_assist_free_ok else "FAIL"), "practice.video-learning-assist.free-tier", video_assist_free_resp.status_code)
    checks.append(video_assist_free_ok)

    set_user_subscription_tier(auth_profile["name"], "pro")
    video_assist_pro_resp = client.get(
        "/api/v1/practice/video-learning-assist",
        params={
            "class_num": "10",
            "subject": "Science",
            "chapter": "Life Processes",
            "video_id": "dQw4w9WgXcQ",
        },
        headers=auth_headers,
    )
    video_assist_pro_ok = False
    if video_assist_pro_resp.status_code == 200:
        payload = video_assist_pro_resp.json()
        video_assist_pro_ok = bool(payload.get("key_moments")) and len(payload.get("quiz", [])) == 3
    print(("OK" if video_assist_pro_ok else "FAIL"), "practice.video-learning-assist.pro-tier", video_assist_pro_resp.status_code)
    checks.append(video_assist_pro_ok)

    # Tier-gated checks: deny on free, allow on pro_max.
    set_user_subscription_tier(auth_profile["name"], "free")
    free_tier_resp = client.post(
        "/api/v1/practice/exam-simulation/start",
        json={
            "class_num": "10",
            "subject": "Science",
            "chapter": "Life Processes",
            "mode": "section-drill",
            "duration_minutes": 30,
            "question_count": 3,
        },
        headers=auth_headers,
    )
    free_tier_ok = free_tier_resp.status_code == 403
    print(("OK" if free_tier_ok else "FAIL"), "practice.exam-simulation.start.free-tier", free_tier_resp.status_code)
    checks.append(free_tier_ok)

    set_user_subscription_tier(auth_profile["name"], "pro_max")
    pro_start_resp = client.post(
        "/api/v1/practice/exam-simulation/start",
        json={
            "class_num": "10",
            "subject": "Science",
            "chapter": "Life Processes",
            "mode": "section-drill",
            "duration_minutes": 30,
            "question_count": 3,
        },
        headers=auth_headers,
    )
    pro_start_ok = pro_start_resp.status_code == 200
    print(("OK" if pro_start_ok else "FAIL"), "practice.exam-simulation.start.pro-max", pro_start_resp.status_code)
    checks.append(pro_start_ok)

    pro_submit_ok = False
    if pro_start_ok:
        payload = pro_start_resp.json()
        questions = payload.get("questions", [])
        answers = [
            {
                "question_id": q.get("question_id", ""),
                "question": q.get("question", ""),
                "marks_available": int(q.get("marks", 5) or 5),
                "answer_text": "Board-style answer with key points and one example.",
            }
            for q in questions
        ]
        pro_submit_resp = client.post(
            "/api/v1/practice/exam-simulation/submit",
            json={
                "session_id": payload.get("session_id"),
                "class_num": "10",
                "subject": "Science",
                "scope": payload.get("scope", "single-chapter"),
                "chapter": "Life Processes",
                "chapters": payload.get("chapters", ["Life Processes"]),
                "mode": "section-drill",
                "answers": answers,
            },
            headers=auth_headers,
        )
        pro_submit_ok = pro_submit_resp.status_code == 200
        print(("OK" if pro_submit_ok else "FAIL"), "practice.exam-simulation.submit.pro-max", pro_submit_resp.status_code)
    checks.append(pro_submit_ok)

    total = len(checks)
    failed = total - sum(1 for ok in checks if ok)
    print(f"TOTAL {total}")
    print(f"FAILED {failed}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
