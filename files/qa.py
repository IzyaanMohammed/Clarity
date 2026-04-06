from fastapi import APIRouter, HTTPException, Header
from models.schemas import QARequest, QAResponse
from services.openrouter import ask_openrouter, detect_task_type
from utils.ncert_context import build_system_prompt
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/ask", response_model=QAResponse)
async def ask_question(request: QARequest):
    try:
        system_prompt = build_system_prompt(
            request.class_num, request.subject, request.chapter
        )

        messages = [{"role": "system", "content": system_prompt}]

        if request.conversation_history:
            messages.extend(request.conversation_history)

        messages.append({"role": "user", "content": request.question})

        # ── Smart routing: pick the right model for the job ───────────────────
        # Detect from marks hint in question OR from keywords
        marks_hint = 0
        q_lower = request.question.lower()
        if "5 mark" in q_lower or "5-mark" in q_lower:
            marks_hint = 5
        elif "3 mark" in q_lower or "3-mark" in q_lower:
            marks_hint = 3
        elif "1 mark" in q_lower or "1-mark" in q_lower:
            marks_hint = 1

        task_type = detect_task_type(request.question, marks_hint)
        logger.info(
            f"Q&A route → task_type={task_type}, subject={request.subject}, "
            f"chapter={request.chapter}, marks_hint={marks_hint}"
        )

        answer = await ask_openrouter(messages, task_type=task_type)
        return QAResponse(answer=answer)

    except Exception as e:
        logger.error(f"Error in ask_question: {str(e)}")
        return QAResponse(
            answer=(
                "💡 NcertAI Teacher: My brain is syncing with the CBSE database. "
                "Please ask again in a moment!"
            )
        )


@router.post("/explain")
async def explain_concept(
    concept: str,
    class_num: str,
    subject: str,
    style: str = "simple",
):
    """Explain a concept — always uses smart model for quality explanations."""
    prompt = (
        f"Explain '{concept}' for Class {class_num} {subject} students "
        f"in {style} language. Use real-life analogies a {class_num}th grader relates to. "
        f"End with: 💡 Exam tip: [one board-relevant tip]"
    )
    messages = [{"role": "user", "content": prompt}]
    answer = await ask_openrouter(messages, task_type="smart")
    return {"explanation": answer}
