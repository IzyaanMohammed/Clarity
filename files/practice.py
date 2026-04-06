from fastapi import APIRouter, HTTPException, Header
import re
from models.schemas import PracticeRequest, PracticeResponse, GradeRequest, GradeResponse
from services.openrouter import ask_openrouter
from utils.rate_limiter import check_rate_limit, increment_usage
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/generate", response_model=PracticeResponse)
async def generate_questions(request: PracticeRequest, x_user_id: str = Header(None)):
    if x_user_id and not check_rate_limit(x_user_id, "question"):
        raise HTTPException(status_code=429, detail="Daily limit reached. Upgrade to Pro for unlimited practice! 🚀")

    # Determine mark type for better prompting
    mark_instructions = {
        "1-mark": "very short, single-sentence answer questions (definitions, fill-in-the-blank style)",
        "3-mark": "short answer questions requiring 3 distinct points",
        "5-mark": "long answer questions requiring detailed explanations with diagrams described",
        "mixed":  "a mix of 1-mark, 3-mark and 5-mark questions — label each with [1 Mark], [3 Marks], [5 Marks]",
        "mcq":    "MCQ questions with 4 options (A-D) — mark the correct answer at the end as: Answer: X",
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

    # MCQs and 1-mark → fast model; 5-mark/mixed → need more intelligence
    task_type = "smart" if request.question_type in ("5-mark", "mixed") else "fast"
    logger.info(f"Practice generate → task_type={task_type}, type={request.question_type}")

    response = await ask_openrouter(messages, task_type=task_type)

    # Parse numbered list
    questions = re.split(r'\n?\d+[\.\)]\s+', response)
    questions = [q.strip() for q in questions if q.strip() and len(q.strip()) > 10]

    if not questions:
        # Fallback: split by newline if the parser failed
        questions = [line.strip() for line in response.split('\n') if line.strip() and len(line.strip()) > 10]

    if x_user_id:
        increment_usage(x_user_id, "question")

    return PracticeResponse(questions=questions[:request.num_questions])


@router.post("/grade", response_model=GradeResponse)
async def grade_answer(request: GradeRequest, x_user_id: str = Header(None)):
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

    return GradeResponse(
        marks_awarded=marks_awarded,
        total_marks=total_marks,
        feedback=feedback,
        model_answer=model_answer,
    )
