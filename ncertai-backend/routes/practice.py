from fastapi import APIRouter, HTTPException, Header
from fastapi.responses import StreamingResponse
from typing import Optional
import re
from pathlib import Path
from models.schemas import (
    PracticeRequest,
    PracticeResponse,
    GradeRequest,
    GradeResponse,
    FlashcardRequest,
    FlashcardResponse,
    FlashcardItem,
    ChapterReadinessResponse,
    ResourceStackResponse,
    StudyNotificationResponse,
    MockScheduleResponse,
)
from services.openrouter import ask_openrouter, ask_openrouter_stream
from services.database import fetch_progress_logs, get_username_by_token
from services.worksheet_discovery import merge_local_and_remote_worksheets
from utils.rate_limiter import check_rate_limit, increment_usage
import logging
import json
from datetime import datetime, date, timedelta

router = APIRouter()
logger = logging.getLogger(__name__)


def _extract_token(authorization: Optional[str]) -> str:
    if not authorization:
        return ""
    parts = authorization.split(" ", 1)
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1].strip()
    return authorization.strip()


def _require_non_empty(text: str, field_name: str):
    if not str(text or "").strip():
        raise HTTPException(status_code=422, detail=f"Please specify mandatory field: {field_name}")


PAST_PAPERS_FILE = Path(__file__).resolve().parent.parent / "data" / "past_papers.json"


def _build_paper_source_link(paper: dict) -> str:
    class_num = str(paper.get("class_num", "")).strip()
    subject = str(paper.get("subject", "")).strip()
    year = str(paper.get("year", "")).strip()
    chapter = str(paper.get("chapter", "")).strip()

    # Prefer official CBSE sample paper portals for common board classes.
    if class_num == "10":
        return "https://cbseacademic.nic.in/SQP_CLASSX_2023-24.html"
    if class_num == "12":
        return "https://cbseacademic.nic.in/SQP_CLASSXII_2023-24.html"

    # Fallback to a focused search query for chapter-specific real paper PDFs.
    query = f"CBSE Class {class_num} {subject} {chapter} {year} question paper pdf"
    return f"https://www.google.com/search?q={query.replace(' ', '+')}"


def _load_past_papers() -> list[dict]:
    if not PAST_PAPERS_FILE.exists():
        return []
    try:
        return json.loads(PAST_PAPERS_FILE.read_text(encoding="utf-8"))
    except Exception:
        return []


def _derive_worksheets_from_papers(
    class_num: str,
    subject: str,
    chapter: str | None = None,
    limit: int = 24,
) -> list[dict]:
    papers = _load_past_papers()
    filtered = [
        p for p in papers
        if str(p.get("class_num", "")) == str(class_num)
        and str(p.get("subject", "")).lower() == subject.lower()
        and (chapter is None or str(p.get("chapter", "")).lower() == chapter.lower())
    ]

    worksheets: list[dict] = []
    for paper in filtered:
        questions = [q for q in paper.get("questions", []) if isinstance(q, str) and q.strip()]
        if not questions:
            continue

        title = f"CBSE {paper.get('year', '')} Worksheet: {paper.get('chapter', 'General')}"
        worksheets.append(
            {
                "id": f"ws_{paper.get('id')}",
                "title": title,
                "class_num": str(paper.get("class_num", class_num)),
                "subject": paper.get("subject", subject),
                "chapter": paper.get("chapter", "General"),
                "question_type": "past-paper",
                "difficulty": paper.get("difficulty", "Medium"),
                "num_questions": min(len(questions), 10),
                "board": paper.get("board", "CBSE"),
                "year": int(paper.get("year", 0) or 0),
                "source_paper_id": paper.get("id"),
                "pdf_url": paper.get("worksheet_pdf_url") or paper.get("pdf_url") or paper.get("source_url"),
                "source_url": paper.get("source_url") or _build_paper_source_link(paper),
                "questions": questions[:10],
            }
        )

    worksheets.sort(key=lambda w: (w.get("year", 0), w.get("chapter", "")), reverse=True)
    return worksheets[: max(1, min(limit, 100))]


def _is_valid_question(text: str) -> bool:
    q = re.sub(r"\s+", " ", text).strip()
    if len(q) < 20:
        return False
    if len(q.split()) < 5:
        return False
    if re.search(r"[\/+\-*=^:]\s*$", q):
        return False
    if q.lower().endswith((" and", " or", " of", " in", " to", " is", " are", " the", " a")):
        return False
    return True


def _extract_questions(raw_response: str) -> list[str]:
    parsed = re.split(r'\n?\d+[\.\)]\s+', raw_response)
    questions = [re.sub(r"\s+", " ", q).strip() for q in parsed if q.strip()]

    if not questions:
        questions = [
            re.sub(r"\s+", " ", line).strip()
            for line in raw_response.split('\n')
            if line.strip()
        ]

    return [q for q in questions if _is_valid_question(q)]


def _fallback_questions(request: PracticeRequest, count: int) -> list[str]:
    chapter = request.chapter
    subject = request.subject

    if request.question_type == "1-mark":
        bank = [
            f"Define one core term from '{chapter}' and state its significance in {subject}.",
            f"State one NCERT fact from '{chapter}' that is frequently asked in board exams.",
            f"Write one key difference related to '{chapter}' in a single precise sentence.",
            f"Identify one common mistake students make in '{chapter}' and give the correct statement.",
        ]
    elif request.question_type == "3-mark":
        bank = [
            f"Explain any three important points from '{chapter}' with clear subheadings.",
            f"Differentiate two related concepts from '{chapter}' with at least three valid points.",
            f"Describe a process from '{chapter}' in three logical steps with NCERT terminology.",
            f"Write a 3-mark board-style answer on a key concept from '{chapter}' with one example.",
        ]
    elif request.question_type == "5-mark":
        bank = [
            f"Write a detailed 5-mark answer on a major concept from '{chapter}' with labeled diagram points.",
            f"Explain the full mechanism of an important topic from '{chapter}' with causes and outcomes.",
            f"Answer a 5-mark board question from '{chapter}' using definition, explanation, and application.",
            f"Discuss a high-weightage question from '{chapter}' and include one real-life implication.",
        ]
    elif request.question_type == "mcq":
        bank = [
            f"Which statement best describes a core concept from '{chapter}'? A) ... B) ... C) ... D) ...",
            f"In '{chapter}', which option is correct according to NCERT? A) ... B) ... C) ... D) ...",
            f"Choose the most accurate board-level answer for a '{chapter}' concept: A) ... B) ... C) ... D) ...",
            f"Which option correctly applies the principle from '{chapter}'? A) ... B) ... C) ... D) ...",
        ]
    else:
        bank = [
            f"Write a board-style question from '{chapter}' that tests conceptual understanding in {subject}.",
            f"Frame a competency-based question from '{chapter}' with a short context and clear demand.",
            f"Create a past-paper style question from '{chapter}' with realistic CBSE phrasing.",
            f"Write a HOTS-style question from '{chapter}' that requires reasoning, not memorization.",
        ]

    questions: list[str] = []
    idx = 0
    while len(questions) < count:
        questions.append(bank[idx % len(bank)])
        idx += 1
    return questions[:count]


def _fallback_flashcards(request: FlashcardRequest) -> list[FlashcardItem]:
    chapter = request.chapter
    subject = request.subject
    base = [
        (
            f"Define one core concept from {chapter} in {subject}.",
            "Use exact NCERT wording in 1-2 lines.",
        ),
        (
            f"State one important board point from {chapter}.",
            "Write the point and add one small example.",
        ),
        (
            f"What is one common mistake students make in {chapter}?",
            "Mention the mistake and the correct version.",
        ),
        (
            f"Write one quick revision cue for {chapter}.",
            "Use a short memory hook with a key term.",
        ),
    ]

    cards: list[FlashcardItem] = []
    idx = 0
    while len(cards) < request.count:
        q, a = base[idx % len(base)]
        cards.append(FlashcardItem(question=q, answer=a))
        idx += 1
    return cards[: request.count]


def _fallback_grade_response(request: GradeRequest) -> str:
    awarded = max(1, min(request.marks_available, int(round(request.marks_available * 0.6))))
    return (
        f"MARKS: {awarded}/{request.marks_available}\n"
        "WHAT WAS GOOD: Attempt shows understanding of the chapter basics and relevant terminology.\n"
        "WHAT WAS MISSING: Add clearer stepwise structure, one concrete example, and precise NCERT keywords.\n"
        "MODEL ANSWER: Start with definition, explain key points in order, include one correct example, and end with a concise conclusion."
    )


def _analyze_mistake(question: str, user_answer: str, response_text: str, marks_available: int) -> dict:
    q = question.lower()
    answer = user_answer.lower()
    feedback = response_text.lower()
    score_hint = 0
    marks_match = re.search(r"MARKS:\s*(\d+)\/(\d+)", response_text, re.I)
    if marks_match:
        try:
            score_hint = int(round((int(marks_match.group(1)) / max(1, int(marks_match.group(2)))) * 100))
        except Exception:
            score_hint = 0

    if score_hint >= 99:
        weak_skill = "mastery-maintenance"
        micro = "Perfect response. Preserve this with one quick spaced recall tomorrow."
        related = f"Solve one similar confidence-check question for: {question[:70].rstrip(' ?.')}."
    elif any(key in q for key in ["define", "what is", "meaning", "state"]):
        weak_skill = "definition precision"
        micro = "Use the exact textbook term first, then add one concise line of meaning."
        related = f"Define {question[:70].rstrip(' ?.') } in one sentence, then add one example."
    elif any(key in q for key in ["why", "how", "explain", "describe"]):
        weak_skill = "concept flow"
        micro = "This needs a stepwise explanation: cause, process, and result."
        related = f"Explain the same concept from '{question[:60]}' in 3 ordered points."
    elif any(key in q for key in ["compare", "difference", "distinguish"]):
        weak_skill = "comparison structure"
        micro = "Use a point-by-point comparison instead of a paragraph."
        related = f"Write two differences between the two ideas used in: {question[:60]}."
    elif any(key in q for key in ["calculate", "find", "numerical", "formula"]):
        weak_skill = "formula application"
        micro = "Check formula choice, substitution, and units in order."
        related = f"Solve a similar numerical from '{question[:60]}' with all units shown."
    else:
        weak_skill = "answer structure"
        micro = "Your answer needs a tighter board-exam structure and one stronger chapter keyword."
        related = f"Rewrite the answer to '{question[:60]}' using 3 exam-ready bullet points."

    due_date = (date.today() + timedelta(days=2)).isoformat()
    flashcard_due = f"Review this as a flashcard on {due_date}: {question[:90]}"
    if score_hint >= 99:
        flashcard_due = f"Mastery check in 3 days: {question[:90]}"
    elif score_hint >= 75:
        flashcard_due = f"Quick flashcard review tomorrow: {question[:90]}"

    if marks_available <= 1:
        related = f"State the exact definition or fact for: {question[:80]}"

    if "missing" in feedback and "keyword" in feedback:
        weak_skill = "keyword recall"

    return {
        "micro_explanation": micro,
        "related_question": related,
        "flashcard_due": flashcard_due,
        "weak_skill": weak_skill,
    }


def _chapter_readiness_metrics(user_data: list[dict], chapter: str) -> dict:
    chapter_rows = [i for i in user_data if str(i.get("chapter") or "").lower() == chapter.lower()]
    if not chapter_rows:
        return {
            "accuracy": 35,
            "recency": 30,
            "speed": 35,
            "confidence": 30,
            "readiness_score": 32,
            "priority": "high",
        }

    scored = [i for i in chapter_rows if isinstance(i.get("score"), (int, float))]
    accuracy = int(round(sum(i["score"] for i in scored) / len(scored))) if scored else 45

    latest = max(datetime.fromisoformat(i["timestamp"]) for i in chapter_rows if i.get("timestamp"))
    days_since = max(0, (datetime.now() - latest).days)
    recency = max(20, 100 - (days_since * 12))

    speed = 70 if len(chapter_rows) >= 4 else 52 if len(chapter_rows) >= 2 else 40
    confidence = 55 if accuracy >= 70 else 42 if accuracy >= 45 else 30
    readiness_score = int(round((accuracy * 0.45) + (recency * 0.2) + (speed * 0.15) + (confidence * 0.2)))
    priority = "high" if readiness_score < 45 else "medium" if readiness_score < 70 else "low"

    return {
        "accuracy": accuracy,
        "recency": recency,
        "speed": speed,
        "confidence": confidence,
        "readiness_score": readiness_score,
        "priority": priority,
    }


def _chapter_resource_stack(chapter: str, subject: str) -> dict:
    return {
        "textbook_section": f"Open the NCERT section for {chapter} in {subject} and read the worked examples first.",
        "explanation": f"One fast explanation: master the core idea of {chapter}, then connect it to one board-style example.",
        "worksheet": {
            "title": f"{chapter} Practice Worksheet",
            "question_type": "past-paper",
            "num_questions": 5,
            "route": "/practice",
            "state": {
                "subject": subject,
                "chapter": chapter,
                "questionType": "past-paper",
                "numQuestions": 5,
            },
        },
        "test": {
            "title": f"{chapter} Quick Test",
            "question_type": "mixed",
            "num_questions": 8,
            "route": "/practice",
            "state": {
                "subject": subject,
                "chapter": chapter,
                "questionType": "mixed",
                "numQuestions": 8,
            },
        },
    }


def _study_notifications(user_data: list[dict]) -> list[dict]:
    notifications: list[dict] = []
    if not user_data:
        return notifications

    last_activity = max(datetime.fromisoformat(i["timestamp"]) for i in user_data if i.get("timestamp"))
    if (datetime.now() - last_activity).days >= 2:
        notifications.append({
            "title": "Revision overdue",
            "message": "You have not studied in the last 48 hours. A short practice run will protect your streak.",
            "severity": "medium",
            "action": "Start a 10-minute recovery practice",
        })

    weak_topics = [i for i in user_data if isinstance(i.get("score"), (int, float)) and i.get("score", 100) < 50]
    if weak_topics:
        topic = str(weak_topics[0].get("chapter") or "a weak chapter")
        notifications.append({
            "title": "Weak chapter detected",
            "message": f"{topic} is below target. Move it to today's top priority.",
            "severity": "high",
            "action": f"Open resources for {topic}",
        })

    if len({i.get("chapter") for i in user_data if i.get("chapter")}) >= 3:
        notifications.append({
            "title": "Mock test due",
            "message": "You have enough activity to benefit from a weekly mock test today.",
            "severity": "medium",
            "action": "Launch a mixed mock test",
        })

    return notifications[:3]


@router.post("/flashcards", response_model=FlashcardResponse)
async def generate_flashcards(request: FlashcardRequest, x_user_id: str = Header(None)):
    _require_non_empty(request.class_num, "class_num")
    _require_non_empty(request.subject, "subject")
    _require_non_empty(request.chapter, "chapter")
    if x_user_id and not check_rate_limit(x_user_id, "question"):
        raise HTTPException(
            status_code=429,
            detail="Daily flashcard limit reached. Upgrade to Pro for unlimited revision packs!",
        )

    prompt = (
        f"Create exactly {request.count} CBSE revision flashcards for Class {request.class_num} "
        f"{request.subject}, Chapter: {request.chapter}.\n\n"
        "Output format rules:\n"
        "- One flashcard per line\n"
        "- Use this exact format: Q: <question> | A: <answer>\n"
        "- Keep answer concise and exam-ready\n"
        "- Use NCERT terms"
    )

    messages = [
        {
            "role": "system",
            "content": (
                f"You are Clarity, a CBSE tutor for Class {request.class_num} {request.subject}. "
                "Create high-quality board revision flashcards."
            ),
        },
        {"role": "user", "content": prompt},
    ]

    response = await ask_openrouter(messages, task_type="fast")

    flashcards = []
    for raw in response.splitlines():
        line = raw.strip()
        if not line or "Q:" not in line or "| A:" not in line:
            continue
        q_part, a_part = line.split("| A:", 1)
        question = q_part.replace("Q:", "", 1).strip(" -\t")
        answer = a_part.strip()
        if question and answer:
            flashcards.append(FlashcardItem(question=question, answer=answer))

    if not flashcards:
        fallback_lines = [l.strip("- ") for l in response.splitlines() if l.strip()]
        for line in fallback_lines[: request.count]:
            flashcards.append(
                FlashcardItem(
                    question=line[:120],
                    answer="Review this concept from the chapter and write a 1-mark response.",
                )
            )

    if x_user_id:
        increment_usage(x_user_id, "question")

    return FlashcardResponse(flashcards=flashcards[: request.count])


@router.post("/flashcards-stream")
async def generate_flashcards_stream(request: FlashcardRequest, x_user_id: str = Header(None)):
    _require_non_empty(request.class_num, "class_num")
    _require_non_empty(request.subject, "subject")
    _require_non_empty(request.chapter, "chapter")
    if x_user_id and not check_rate_limit(x_user_id, "question"):
        raise HTTPException(
            status_code=429,
            detail="Daily flashcard limit reached. Upgrade to Pro for unlimited revision packs!",
        )

    prompt = (
        f"Create exactly {request.count} CBSE revision flashcards for Class {request.class_num} "
        f"{request.subject}, Chapter: {request.chapter}.\n\n"
        "Output format rules:\n"
        "- One flashcard per line\n"
        "- Use this exact format: Q: <question> | A: <answer>\n"
        "- Keep answer concise and exam-ready\n"
        "- Use NCERT terms"
    )

    messages = [
        {
            "role": "system",
            "content": (
                f"You are Clarity, a CBSE tutor for Class {request.class_num} {request.subject}. "
                "Create high-quality board revision flashcards."
            ),
        },
        {"role": "user", "content": prompt},
    ]

    async def event_generator():
        try:
            async for token in ask_openrouter_stream(messages, task_type="fast"):
                yield f"data: {json.dumps({'token': token, 'done': False})}\n\n"
        except Exception as exc:
            logger.error("Flashcards stream failed, emitting fallback: %s", str(exc))
            fallback_cards = _fallback_flashcards(request)
            fallback_text = "\n".join([f"Q: {c.question} | A: {c.answer}" for c in fallback_cards])
            yield f"data: {json.dumps({'token': fallback_text, 'done': False})}\n\n"
        if x_user_id:
            increment_usage(x_user_id, "question")
        yield f"data: {json.dumps({'token': '', 'done': True})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/generate", response_model=PracticeResponse)
async def generate_questions(request: PracticeRequest, x_user_id: str = Header(None)):
    _require_non_empty(request.class_num, "class_num")
    _require_non_empty(request.subject, "subject")
    _require_non_empty(request.chapter, "chapter")
    if x_user_id and not check_rate_limit(x_user_id, "question"):
        raise HTTPException(status_code=429, detail="Daily limit reached. Upgrade to Pro for unlimited practice! 🚀")

    # Determine mark type for better prompting
    mark_instructions = {
        "1-mark": "very short, single-sentence answer questions (definitions, fill-in-the-blank style)",
        "3-mark": "short answer questions requiring 3 distinct points",
        "5-mark": "long answer questions requiring detailed explanations with diagrams described",
        "mixed":  "a mix of 1-mark, 3-mark and 5-mark questions — label each with [1 Mark], [3 Marks], [5 Marks]",
        "mcq":    "MCQ questions with 4 options (A-D) — mark the correct answer at the end as: Answer: X",
        "variety": "a varied set including assertion-reason, case-based, competency-based, HOTS, and previous-year style questions",
        "past-paper": "past-paper style board questions with realistic CBSE phrasing and mark tags",
    }
    style = mark_instructions.get(request.question_type, mark_instructions["mixed"])

    prompt = (
        f"Generate exactly {request.num_questions} CBSE board-style {style} "
        f"for Class {request.class_num} {request.subject}, Chapter: {request.chapter}.\n\n"
        f"Rules:\n"
        f"- Number each question: 1. 2. 3. ...\n"
        f"- Questions must match past CBSE board paper patterns\n"
        f"- Do NOT include answers (except for MCQs)\n"
        f"- Use exact NCERT terminology\n"
        f"- Return ONLY the numbered questions, no preamble"
    )

    messages = [
        {
            "role": "system",
            "content": (
                f"You are an experienced CBSE exam paper setter for Class {request.class_num} "
                f"{request.subject}. Generate questions that have actually appeared in boards."
            ),
        },
        {"role": "user", "content": prompt},
    ]

    # Variety/long-form generation benefits from stronger reasoning.
    task_type = "smart" if request.question_type in ("5-mark", "mixed", "variety", "past-paper") else "fast"
    logger.info(f"Practice generate → task_type={task_type}, type={request.question_type}")

    response = await ask_openrouter(messages, task_type=task_type)

    questions = _extract_questions(response)

    if len(questions) < request.num_questions:
        # One repair pass: ask the model to rewrite malformed output into clean, complete questions.
        repair_prompt = (
            f"The following generated question set is malformed. Rewrite it into exactly {request.num_questions} "
            f"complete CBSE board-style questions for Class {request.class_num} {request.subject}, Chapter: {request.chapter}.\n\n"
            "Rules:\n"
            "- Keep each question complete and grammatically correct\n"
            "- Do NOT include answers\n"
            "- Number as 1. 2. 3. ...\n"
            "- Return ONLY the final numbered list\n\n"
            f"Malformed content:\n{response}"
        )
        repaired = await ask_openrouter(
            [
                {
                    "role": "system",
                    "content": "You clean and normalize CBSE exam question lists.",
                },
                {"role": "user", "content": repair_prompt},
            ],
            task_type="smart",
        )
        repaired_questions = _extract_questions(repaired)
        if repaired_questions:
            questions = repaired_questions

    if len(questions) < request.num_questions:
        missing = request.num_questions - len(questions)
        questions.extend(_fallback_questions(request, missing))

    if x_user_id:
        increment_usage(x_user_id, "question")

    return PracticeResponse(questions=questions[:request.num_questions])


@router.post("/generate-stream")
async def generate_questions_stream(request: PracticeRequest, x_user_id: str = Header(None)):
    _require_non_empty(request.class_num, "class_num")
    _require_non_empty(request.subject, "subject")
    _require_non_empty(request.chapter, "chapter")
    if x_user_id and not check_rate_limit(x_user_id, "question"):
        raise HTTPException(status_code=429, detail="Daily limit reached. Upgrade to Pro for unlimited practice! 🚀")

    mark_instructions = {
        "1-mark": "very short, single-sentence answer questions (definitions, fill-in-the-blank style)",
        "3-mark": "short answer questions requiring 3 distinct points",
        "5-mark": "long answer questions requiring detailed explanations with diagrams described",
        "mixed": "a mix of 1-mark, 3-mark and 5-mark questions — label each with [1 Mark], [3 Marks], [5 Marks]",
        "mcq": "MCQ questions with 4 options (A-D) — mark the correct answer at the end as: Answer: X",
        "variety": "a varied set including assertion-reason, case-based, competency-based, HOTS, and previous-year style questions",
        "past-paper": "past-paper style board questions with realistic CBSE phrasing and mark tags",
    }
    style = mark_instructions.get(request.question_type, mark_instructions["mixed"])

    prompt = (
        f"Generate exactly {request.num_questions} CBSE board-style {style} "
        f"for Class {request.class_num} {request.subject}, Chapter: {request.chapter}.\n\n"
        "Rules:\n"
        "- Number each question: 1. 2. 3. ...\n"
        "- Questions must match past CBSE board paper patterns\n"
        "- Do NOT include answers (except for MCQs)\n"
        "- Use exact NCERT terminology\n"
        "- Return ONLY the numbered questions, no preamble"
    )

    messages = [
        {
            "role": "system",
            "content": (
                f"You are an experienced CBSE exam paper setter for Class {request.class_num} "
                f"{request.subject}. Generate questions that have actually appeared in boards."
            ),
        },
        {"role": "user", "content": prompt},
    ]
    task_type = "smart" if request.question_type in ("5-mark", "mixed", "variety", "past-paper") else "fast"

    async def event_generator():
        try:
            async for token in ask_openrouter_stream(messages, task_type=task_type):
                yield f"data: {json.dumps({'token': token, 'done': False})}\n\n"
        except Exception as exc:
            logger.error("Practice generate stream failed, emitting fallback: %s", str(exc))
            fallback_questions = _fallback_questions(request, request.num_questions)
            fallback_text = "\n".join([f"{idx + 1}. {q}" for idx, q in enumerate(fallback_questions)])
            yield f"data: {json.dumps({'token': fallback_text, 'done': False})}\n\n"
        if x_user_id:
            increment_usage(x_user_id, "question")
        yield f"data: {json.dumps({'token': '', 'done': True})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/grade", response_model=GradeResponse)
async def grade_answer(request: GradeRequest, x_user_id: str = Header(None)):
    _require_non_empty(request.class_num, "class_num")
    _require_non_empty(request.subject, "subject")
    _require_non_empty(request.question, "question")
    _require_non_empty(request.user_answer, "user_answer")
    prompt = f"""You are a strict but fair CBSE examiner grading a student's answer.

QUESTION: {request.question}
STUDENT'S ANSWER: {request.user_answer}
TOTAL MARKS AVAILABLE: {request.marks_available}
CLASS: {request.class_num} | SUBJECT: {request.subject}

Grade this answer exactly as CBSE board examiners do. Be precise.

Return your response in this EXACT format (no extra text):
MARKS: X/{request.marks_available}
WHAT WAS GOOD: [specific points the student got right]
WHAT WAS MISSING: [specific points that were missing or incorrect]
MODEL ANSWER: [the ideal CBSE answer a student should write to get full marks]"""

    messages = [
        {
            "role": "system",
            "content": (
                "You are a CBSE board examiner with 20 years of experience. "
                "Grade answers fairly but strictly according to NCERT content. "
                "Always return in the exact format requested."
            ),
        },
        {"role": "user", "content": prompt},
    ]

    # Grading needs intelligence — always use smart model
    logger.info(f"Practice grade → task_type=smart, marks={request.marks_available}")
    response = await ask_openrouter(messages, task_type="smart")

    # Parse the structured response
    marks_match = re.search(r'MARKS:\s*(\d+)/(\d+)', response)
    good_match = re.search(r'WHAT WAS GOOD:\s*(.*?)(?=WHAT WAS MISSING:|$)', response, re.DOTALL)
    missing_match = re.search(r'WHAT WAS MISSING:\s*(.*?)(?=MODEL ANSWER:|$)', response, re.DOTALL)
    model_match = re.search(r'MODEL ANSWER:\s*(.*)', response, re.DOTALL)

    marks_awarded = int(marks_match.group(1)) if marks_match else 0
    total_marks = int(marks_match.group(2)) if marks_match else request.marks_available
    good_text = good_match.group(1).strip() if good_match else "Attempted the question."
    missing_text = missing_match.group(1).strip() if missing_match else "Review the chapter concepts."
    model_answer = model_match.group(1).strip() if model_match else "Refer to your NCERT textbook."

    feedback = f"Good: {good_text}\nMissing: {missing_text}"
    revision = _analyze_mistake(request.question, request.user_answer, response, request.marks_available)

    return GradeResponse(
        marks_awarded=marks_awarded,
        total_marks=total_marks,
        feedback=feedback,
        model_answer=model_answer,
        micro_explanation=revision["micro_explanation"],
        related_question=revision["related_question"],
        flashcard_due=revision["flashcard_due"],
        weak_skill=revision["weak_skill"],
    )


@router.post("/grade-stream")
async def grade_answer_stream(request: GradeRequest, x_user_id: str = Header(None)):
    _require_non_empty(request.class_num, "class_num")
    _require_non_empty(request.subject, "subject")
    _require_non_empty(request.question, "question")
    _require_non_empty(request.user_answer, "user_answer")
    prompt = f"""You are a strict but fair CBSE examiner grading a student's answer.

QUESTION: {request.question}
STUDENT'S ANSWER: {request.user_answer}
TOTAL MARKS AVAILABLE: {request.marks_available}
CLASS: {request.class_num} | SUBJECT: {request.subject}

Grade this answer exactly as CBSE board examiners do. Be precise.

Return your response in this EXACT format (no extra text):
MARKS: X/{request.marks_available}
WHAT WAS GOOD: [specific points the student got right]
WHAT WAS MISSING: [specific points that were missing or incorrect]
MODEL ANSWER: [the ideal CBSE answer a student should write to get full marks]"""

    messages = [
        {
            "role": "system",
            "content": (
                "You are a CBSE board examiner with 20 years of experience. "
                "Grade answers fairly but strictly according to NCERT content. "
                "Always return in the exact format requested."
            ),
        },
        {"role": "user", "content": prompt},
    ]

    async def event_generator():
        response_text = ""
        try:
            async for token in ask_openrouter_stream(messages, task_type="smart"):
                response_text += token
                yield f"data: {json.dumps({'token': token, 'done': False})}\n\n"
        except Exception as exc:
            logger.error("Practice grade stream failed, emitting fallback: %s", str(exc))
            response_text = _fallback_grade_response(request)
            yield f"data: {json.dumps({'token': response_text, 'done': False})}\n\n"

        revision = _analyze_mistake(request.question, request.user_answer, response_text, request.marks_available)
        revision_lines = [
            f"MICRO EXPLANATION: {revision['micro_explanation']}",
            f"RELATED QUESTION: {revision['related_question']}",
            f"FLASHCARD DUE: {revision['flashcard_due']}",
            f"WEAK SKILL: {revision['weak_skill']}",
        ]
        for line in revision_lines:
            payload = {"token": "\n" + line, "done": False}
            yield f"data: {json.dumps(payload)}\n\n"
        yield f"data: {json.dumps({'token': '', 'done': True})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/past-papers")
async def list_past_papers(class_num: str, subject: str, chapter: str | None = None, limit: int = 50):
    papers = _load_past_papers()
    filtered = [
        p for p in papers
        if str(p.get("class_num", "")) == str(class_num)
        and str(p.get("subject", "")).lower() == subject.lower()
        and (chapter is None or str(p.get("chapter", "")).lower() == chapter.lower())
    ]

    normalized = []
    for p in filtered[: max(1, min(limit, 200))]:
        item = dict(p)
        item["pdf_url"] = item.get("pdf_url")
        item["source_url"] = item.get("source_url") or _build_paper_source_link(item)
        normalized.append(item)

    return {"papers": normalized}


@router.get("/past-paper-questions")
async def get_past_paper_questions(paper_id: str):
    papers = _load_past_papers()
    for paper in papers:
        if str(paper.get("id")) == str(paper_id):
            return {
                "paper": {
                    "id": paper.get("id"),
                    "year": paper.get("year"),
                    "board": paper.get("board"),
                    "subject": paper.get("subject"),
                    "chapter": paper.get("chapter"),
                    "difficulty": paper.get("difficulty"),
                    "pdf_url": paper.get("pdf_url"),
                    "source_url": paper.get("source_url") or _build_paper_source_link(paper),
                },
                "questions": paper.get("questions", []),
            }
    raise HTTPException(status_code=404, detail="Past paper not found")


@router.get("/chapter-readiness", response_model=ChapterReadinessResponse)
async def chapter_readiness(chapter: str, authorization: Optional[str] = Header(default=None)):
    username = get_username_by_token(_extract_token(authorization)) if authorization else None
    if not username:
        raise HTTPException(status_code=401, detail="Unauthorized")
    user_data = fetch_progress_logs(username)
    metrics = _chapter_readiness_metrics(user_data, chapter)
    return ChapterReadinessResponse(chapter=chapter, **metrics)


@router.get("/resource-stack", response_model=ResourceStackResponse)
async def resource_stack(subject: str, chapter: str, authorization: Optional[str] = Header(default=None)):
    username = get_username_by_token(_extract_token(authorization)) if authorization else None
    if not username:
        raise HTTPException(status_code=401, detail="Unauthorized")
    stack = _chapter_resource_stack(chapter, subject)
    return ResourceStackResponse(
        chapter=chapter,
        subject=subject,
        textbook_section=stack["textbook_section"],
        explanation=stack["explanation"],
        worksheet=stack["worksheet"],
        test=stack["test"],
    )


@router.get("/mock-schedule", response_model=MockScheduleResponse)
async def mock_schedule(authorization: Optional[str] = Header(default=None)):
    username = get_username_by_token(_extract_token(authorization)) if authorization else None
    if not username:
        raise HTTPException(status_code=401, detail="Unauthorized")
    user_data = fetch_progress_logs(username)
    weak_topics = [str(i.get("chapter") or "").strip() for i in user_data if isinstance(i.get("score"), (int, float)) and i.get("score", 100) < 50]
    last_mock = None
    for item in reversed(user_data):
        if item.get("action") == "practice":
            last_mock = item.get("timestamp")
            break
    last_mock_date = datetime.fromisoformat(last_mock) if last_mock else datetime.now() - timedelta(days=7)
    next_mock_date = (last_mock_date + timedelta(days=7)).date().isoformat()
    readiness = _chapter_readiness_metrics(user_data, weak_topics[0] if weak_topics else (user_data[-1].get("chapter") if user_data else "Core Concepts"))
    difficulty = "easy" if readiness["readiness_score"] < 45 else "medium" if readiness["readiness_score"] < 70 else "hard"
    recovery_plan = [
        "Review one weak chapter for 20 minutes",
        "Solve 5 board-style questions under time",
        "Revise mistakes as flashcards for tomorrow",
    ]
    return MockScheduleResponse(
        next_mock_date=next_mock_date,
        difficulty=difficulty,
        readiness_score=readiness["readiness_score"],
        weak_skills=weak_topics[:5],
        recovery_plan=recovery_plan,
    )


@router.get("/notifications")
async def proactive_notifications(authorization: Optional[str] = Header(default=None)):
    username = get_username_by_token(_extract_token(authorization)) if authorization else None
    if not username:
        raise HTTPException(status_code=401, detail="Unauthorized")
    user_data = fetch_progress_logs(username)
    return {"notifications": _study_notifications(user_data)}


@router.get("/explain-question")
async def explain_question(question: str, chapter: str, subject: str):
    _require_non_empty(subject, "subject")
    _require_non_empty(chapter, "chapter")
    _require_non_empty(question, "question")
    prompt = (
        f"Explain this question for Class {subject} students from chapter '{chapter}'.\n"
        f"Question: {question}\n\n"
        "Return exactly these sections:\n"
        "## Concept Behind It\n"
        "## Why Each Option/Part Is Right or Wrong\n"
        "## Similar Pattern Question\n"
        "Keep it concise, exam-aligned, and board-friendly."
    )
    messages = [
        {"role": "system", "content": "You are an NCERT tutor who explains questions deeply but briefly."},
        {"role": "user", "content": prompt},
    ]
    answer = await ask_openrouter(messages, task_type="smart")
    return {"explanation": answer}


@router.get("/worksheets")
async def list_worksheets(
    class_num: str,
    subject: str,
    chapter: str | None = None,
    limit: int = 24,
    refresh: bool = False,
):
    local_worksheets = _derive_worksheets_from_papers(class_num, subject, chapter, limit)
    merged = merge_local_and_remote_worksheets(
        local_items=local_worksheets,
        class_num=class_num,
        subject=subject,
        chapter=chapter,
        limit=limit,
        force_refresh=refresh,
    )
    return {"worksheets": merged}
