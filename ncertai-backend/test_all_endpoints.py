"""
Clarity API Comprehensive Test Suite
Hits every registered endpoint and reports status.
Run from the ncertai-backend directory with the server running on port 8000.
"""
import asyncio
import httpx
import json
import sys

BASE = "http://127.0.0.1:8000"

# ─── colour helpers ───────────────────────────────────────────────────────────
GREEN = "\033[92m"
RED   = "\033[91m"
YELLOW= "\033[93m"
RESET = "\033[0m"

results = []

async def test(client: httpx.AsyncClient, method: str, path: str, *,
               json_body=None, params=None, label: str = "", expect: int = 200, headers=None):
    url = f"{BASE}{path}"
    label = label or f"{method} {path}"
    try:
        kwargs = {"params": params, "timeout": 20.0}
        if json_body is not None:
            kwargs["json"] = json_body
        if headers:
            kwargs["headers"] = headers
        resp = await getattr(client, method.lower())(url, **kwargs)
        ok = resp.status_code == expect
        colour = GREEN if ok else RED
        status_text = f"[{resp.status_code}]"
        detail = ""
        if not ok:
            try:
                detail = resp.json().get("detail", resp.text[:200])
            except Exception:
                detail = resp.text[:200]
        print(f"  {colour}{'✓' if ok else '✗'}{RESET} {label:<60} {status_text} {detail}")
        results.append((label, ok, resp.status_code, detail))
    except Exception as e:
        print(f"  {RED}✗{RESET} {label:<60} [EXC] {e}")
        results.append((label, False, 0, str(e)))

async def test_stream(client: httpx.AsyncClient, method: str, path: str, *,
                      json_body=None, label: str = ""):
    """Test a streaming endpoint — just checks it opens and sends data."""
    url = f"{BASE}{path}"
    label = label or f"{method} {path}"
    try:
        async with client.stream(method.lower(), url, json=json_body, timeout=20.0) as resp:
            ok = resp.status_code == 200
            chunk = await resp.aread()
            colour = GREEN if ok else RED
            detail = "" if ok else chunk[:200].decode(errors="replace")
            print(f"  {colour}{'✓' if ok else '✗'}{RESET} {label:<60} [{resp.status_code}] {detail}")
            results.append((label, ok, resp.status_code, detail))
    except Exception as e:
        print(f"  {RED}✗{RESET} {label:<60} [EXC] {e}")
        results.append((label, False, 0, str(e)))


async def main():
    # ── Get a real auth token first ──────────────────────────────────────────
    print(f"\n{YELLOW}=== Clarity API Endpoint Test ==={RESET}")
    print(f"Target: {BASE}\n")

    token = None
    username = None
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            r = await client.post(f"{BASE}/api/v1/auth/login",
                                  json={"username": "Izyaan", "password": "test"})
            if r.status_code == 200:
                token = r.json().get("access_token")
                username = "Izyaan"
                print(f"{GREEN}✓ Auth token obtained for user: {username}{RESET}\n")
            else:
                print(f"{YELLOW}⚠ Could not get token ({r.status_code}). Testing as anonymous.{RESET}\n")
        except Exception as e:
            print(f"{YELLOW}⚠ Auth error: {e}. Testing as anonymous.{RESET}\n")

    auth_headers = {"Authorization": f"Bearer {token}"} if token else {}
    user_headers = {**auth_headers, "X-User-Id": username} if username else {}

    # Common payloads
    CHAPTER_PAYLOAD = {"class_num": "10", "subject": "Science", "chapter": "Chemical Reactions and Equations"}
    PLAN_PAYLOAD    = {"class_num": "10", "subjects": ["Science", "Maths"], "weak_topics": ["Acids, Bases and Salts"], "task_count": 6, "plan_depth": "balanced"}
    QA_PAYLOAD      = {**CHAPTER_PAYLOAD, "question": "What is a chemical equation?"}
    GRADE_PAYLOAD   = {"question": "Define photosynthesis", "user_answer": "Plants make food using sunlight", "class_num": "10", "subject": "Science", "marks_available": 2}
    SUMMARY_PAYLOAD = {**CHAPTER_PAYLOAD, "detail_level": "standard"}
    FORMULA_PAYLOAD = {"class_num": "10", "subject": "Maths", "chapter": "Triangles", "formula_count": 5}
    FLASHCARD_PAYLOAD = {**CHAPTER_PAYLOAD, "count": 4}
    AR_PAYLOAD      = {**CHAPTER_PAYLOAD, "recall_text": "Chemical reactions involve breaking and forming bonds."}

    async with httpx.AsyncClient(timeout=30.0, headers=auth_headers) as client:

        # ── AUTH ─────────────────────────────────────────────────────────────
        print(f"{YELLOW}── AUTH ──────────────────────────────────────────{RESET}")
        await test(client, "GET",  "/api/v1/auth/me",       label="GET /auth/me",       expect=200 if token else 401)
        await test(client, "POST", "/api/v1/auth/login",    label="POST /auth/login (bad creds)", json_body={"username":"x","password":"x"}, expect=401)
        await test(client, "GET",  "/api/v1/auth/curriculum", label="GET /auth/curriculum")
        await test(client, "GET",  "/api/v1/auth/snapshot",  label="GET /auth/snapshot")
        await test(client, "GET",  "/api/v1/auth/materials", label="GET /auth/materials")

        # ── CURRICULUM ───────────────────────────────────────────────────────
        print(f"\n{YELLOW}── CURRICULUM ───────────────────────────────────{RESET}")
        await test(client, "GET", "/api/v1/curriculum/catalog",   label="GET /curriculum/catalog")
        await test(client, "GET", "/api/v1/curriculum/subjects",  label="GET /curriculum/subjects", params={"class_num":"10"})
        await test(client, "GET", "/api/v1/curriculum/chapters",  label="GET /curriculum/chapters", params={"class_num":"10","subject":"Science"})
        await test(client, "GET", "/api/v1/curriculum/chapter-text", label="GET /curriculum/chapter-text", params={"class_num":"10","subject":"Science","chapter":"Chemical Reactions and Equations"})
        await test(client, "POST", "/api/v1/curriculum/active-recall/evaluate", label="POST /curriculum/active-recall/evaluate", json_body=AR_PAYLOAD)

        # ── SUMMARY ──────────────────────────────────────────────────────────
        print(f"\n{YELLOW}── SUMMARY ──────────────────────────────────────{RESET}")
        await test(client, "POST", "/api/v1/summary/chapter-summary",     label="POST /summary/chapter-summary",     json_body=SUMMARY_PAYLOAD)
        await test(client, "POST", "/api/v1/summary/formula-sheet",       label="POST /summary/formula-sheet",       json_body=FORMULA_PAYLOAD)
        await test(client, "POST", "/api/v1/summary/daily-plan",          label="POST /summary/daily-plan",          json_body=PLAN_PAYLOAD)
        await test_stream(client, "POST", "/api/v1/summary/chapter-summary-stream", label="POST /summary/chapter-summary-stream", json_body=SUMMARY_PAYLOAD)
        await test_stream(client, "POST", "/api/v1/summary/daily-plan-stream",      label="POST /summary/daily-plan-stream",      json_body=PLAN_PAYLOAD)
        await test_stream(client, "POST", "/api/v1/summary/formula-sheet-stream",   label="POST /summary/formula-sheet-stream",   json_body=FORMULA_PAYLOAD)

        # ── QA ───────────────────────────────────────────────────────────────
        print(f"\n{YELLOW}── QA ───────────────────────────────────────────{RESET}")
        await test(client, "POST", "/api/v1/qa/ask",         label="POST /qa/ask",         json_body=QA_PAYLOAD)
        await test(client, "POST", "/api/v1/qa/grade",       label="POST /qa/grade",       json_body=GRADE_PAYLOAD)
        await test(client, "POST", "/api/v1/qa/flashcards",  label="POST /qa/flashcards",  json_body=FLASHCARD_PAYLOAD)
        await test_stream(client, "POST", "/api/v1/chat/tutor-stream", label="POST /chat/tutor-stream", json_body={"class_num":"10","subject":"Science","chapter":"Chemical Reactions","message":"What are reactants?","conversation_history":[]})
        await test(client, "POST", "/api/v1/qa/recommended-topics", label="POST /qa/recommended-topics", json_body={"class_num":"10","subject":"Science"})

        # ── PRACTICE ─────────────────────────────────────────────────────────
        print(f"\n{YELLOW}── PRACTICE ─────────────────────────────────────{RESET}")
        await test(client, "GET",  "/api/v1/practice/notifications",    label="GET /practice/notifications",    params={"class_num":"10","subject":"Science"})
        await test(client, "GET",  "/api/v1/practice/mock-schedule",    label="GET /practice/mock-schedule",    params={"class_num":"10","subject":"Science"})
        await test(client, "GET",  "/api/v1/practice/chapter-readiness",label="GET /practice/chapter-readiness",params={"chapter":"Chemical Reactions and Equations"})
        await test(client, "GET",  "/api/v1/practice/resource-stack",   label="GET /practice/resource-stack",   params={"subject":"Science","chapter":"Chemical Reactions and Equations"})
        await test(client, "GET",  "/api/v1/practice/past-papers",      label="GET /practice/past-papers",      params={"class_num":"10","subject":"Science"})
        await test(client, "GET",  "/api/v1/practice/worksheets",       label="GET /practice/worksheets",       params={"class_num":"10","subject":"Science"})

        # ── PROGRESS ─────────────────────────────────────────────────────────
        print(f"\n{YELLOW}── PROGRESS ─────────────────────────────────────{RESET}")
        await test(client, "GET",  "/api/v1/progress/stats/Izyaan",      label="GET /progress/stats")
        await test(client, "GET",  "/api/v1/progress/recommendations",   label="GET /progress/recommendations")
        await test(client, "POST", "/api/v1/progress/daily-mission",     label="POST /progress/daily-mission", json_body={})

        # ── UPLOAD ───────────────────────────────────────────────────────────
        print(f"\n{YELLOW}── UPLOAD ───────────────────────────────────────{RESET}")
        await test(client, "GET",  "/api/v1/upload/custom-textbooks",        label="GET /upload/custom-textbooks",       params={"class_num":10,"subject":"Maths"})
        await test(client, "GET",  "/api/v1/upload/custom-textbook/4/pdf",   label="GET /upload/custom-textbook/4/pdf",  expect=200)
        await test(client, "GET",  "/api/v1/upload/custom-textbook/4/content",label="GET /upload/custom-textbook/4/content")
        await test(client, "GET",  "/api/v1/upload/ncert-pdf-proxy",         label="GET /upload/ncert-pdf-proxy",        params={"book_code":"jesc1","chapter_num":1})
        await test(client, "GET",  "/api/v1/upload/textbook-content",        label="GET /upload/textbook-content",       params={"url":"https://ncert.nic.in/textbook.php?jesc1=1-13","chapter_index":1})

    # ── Summary ───────────────────────────────────────────────────────────────
    total   = len(results)
    passed  = sum(1 for _, ok, _, _ in results if ok)
    failed  = total - passed
    print(f"\n{YELLOW}═══ Results: {GREEN}{passed} passed{RESET}{YELLOW}, {RED}{failed} failed{RESET}{YELLOW} / {total} total ═══{RESET}")
    if failed:
        print(f"\n{RED}Failed endpoints:{RESET}")
        for label, ok, status, detail in results:
            if not ok:
                print(f"  ✗ {label}  [{status}]  {detail[:120]}")
    return failed

if __name__ == "__main__":
    failed = asyncio.run(main())
    sys.exit(1 if failed else 0)
