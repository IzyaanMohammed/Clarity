from fastapi import APIRouter, Header
from fastapi.responses import StreamingResponse
from models.schemas import QARequest, QAResponse
from services.openrouter import ask_openrouter, ask_openrouter_stream, detect_task_type
from utils.ncert_context import build_system_prompt
from services.ncert_retriever import get_ncert_context
import logging
import json

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/ask", response_model=QAResponse)
async def ask_question(request: QARequest, x_user_id: str = Header(None)):
    try:
        board = "CBSE"
        language = "English"
        if request.learner_profile:
            board = request.learner_profile.get("examBoard", "CBSE")
            language = request.learner_profile.get("preferredLanguage", "English")
        system_prompt = build_system_prompt(
            request.class_num, request.subject, request.chapter, board, language
        )
        
        custom_context = None
        if x_user_id:
            from services.database import get_custom_textbook_content
            try:
                custom_context = get_custom_textbook_content(x_user_id, int(request.class_num), request.subject, request.chapter)
            except Exception:
                pass
                
        if custom_context:
            system_prompt += (
                f"\n\nSTUDENT'S UPLOADED TEXTBOOK CONTEXT:\n{custom_context}\n\n"
                "CRITICAL INSTRUCTION: You MUST base your answer strictly and entirely on the text provided above. The format, style, and numerical values of your answers (e.g. balancing equations with whole numbers instead of fractions) must exactly match how they are presented in the textbook."
                "Do NOT use external knowledge. If the answer is not in the text, clearly state that it is not covered in the textbook."
            )
        else:
            ncert_context = get_ncert_context(
                request.class_num, request.subject, request.chapter, request.question
            )
            if ncert_context:
                system_prompt += (
                    f"\n\n{ncert_context}\n\n"
                    "CRITICAL INSTRUCTION: You MUST base your answer strictly and entirely on the NCERT textbook text provided above. The format, style, and numerical values of your answers (e.g. balancing equations with whole numbers instead of fractions) must exactly match how they are presented in the textbook."
                    "Do NOT use external knowledge to add facts not present in the text. "
                    "If the answer is not in the text, clearly state that it is not covered in the NCERT chapter."
                )

        if request.learner_profile:
            profile_bits = [
                f"{k}: {v}"
                for k, v in request.learner_profile.items()
                if isinstance(v, str) and v.strip()
            ]
            if profile_bits:
                system_prompt = (
                    f"{system_prompt}\n\n"
                    "Learner personalization profile (adapt tone, examples, pace, and response format):\n"
                    + "\n".join(f"- {bit}" for bit in profile_bits)
                )

        if request.teacher_personality:
            system_prompt = (
                f"{system_prompt}\n\n"
                f"Your teaching personality is: {request.teacher_personality}. "
                f"Always respond with a tone and style that matches a {request.teacher_personality} teacher."
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
                "💡 Clarity Teacher: My brain is syncing with the CBSE database. "
                "Please ask again in a moment!"
            )
        )


@router.post("/ask-stream")
async def ask_question_stream(request: QARequest, x_user_id: str = Header(None)):
    async def event_generator():
        try:
            board = "CBSE"
            language = "English"
            if request.learner_profile:
                board = request.learner_profile.get("examBoard", "CBSE")
                language = request.learner_profile.get("preferredLanguage", "English")
            system_prompt = build_system_prompt(
                request.class_num, request.subject, request.chapter, board, language
            )
            
            custom_context = None
            if x_user_id:
                from services.database import get_custom_textbook_content
                try:
                    custom_context = get_custom_textbook_content(x_user_id, int(request.class_num), request.subject, request.chapter)
                except Exception:
                    pass
            
            if custom_context:
                system_prompt += (
                    f"\n\nSTUDENT'S UPLOADED TEXTBOOK CONTEXT:\n{custom_context}\n\n"
                    "CRITICAL INSTRUCTION: You MUST base your answer strictly and entirely on the text provided above. The format, style, and numerical values of your answers (e.g. balancing equations with whole numbers instead of fractions) must exactly match how they are presented in the textbook."
                    "Do NOT use external knowledge. If the answer is not in the text, clearly state that it is not covered in the textbook."
                )
            else:
                ncert_context = get_ncert_context(
                    request.class_num, request.subject, request.chapter, request.question
                )
                if ncert_context:
                    system_prompt += (
                        f"\n\n{ncert_context}\n\n"
                        "CRITICAL INSTRUCTION: You MUST base your answer strictly and entirely on the NCERT textbook text provided above. The format, style, and numerical values of your answers (e.g. balancing equations with whole numbers instead of fractions) must exactly match how they are presented in the textbook."
                        "Do NOT use external knowledge to add facts not present in the text. "
                        "If the answer is not in the text, clearly state that it is not covered in the NCERT chapter."
                    )

            if request.learner_profile:
                profile_bits = [
                    f"{k}: {v}"
                    for k, v in request.learner_profile.items()
                    if isinstance(v, str) and v.strip()
                ]
                if profile_bits:
                    system_prompt = (
                        f"{system_prompt}\n\n"
                        "Learner personalization profile (adapt tone, examples, pace, and response format):\n"
                        + "\n".join(f"- {bit}" for bit in profile_bits)
                    )

            if request.teacher_personality:
                system_prompt = (
                    f"{system_prompt}\n\n"
                    f"Your teaching personality is: {request.teacher_personality}. "
                    f"Always respond with a tone and style that matches a {request.teacher_personality} teacher."
                )
            messages = [{"role": "system", "content": system_prompt}]

            if request.conversation_history:
                messages.extend(request.conversation_history)

            messages.append({"role": "user", "content": request.question})

            marks_hint = 0
            q_lower = request.question.lower()
            if "5 mark" in q_lower or "5-mark" in q_lower:
                marks_hint = 5
            elif "3 mark" in q_lower or "3-mark" in q_lower:
                marks_hint = 3
            elif "1 mark" in q_lower or "1-mark" in q_lower:
                marks_hint = 1

            task_type = detect_task_type(request.question, marks_hint)
            async for token in ask_openrouter_stream(messages, task_type=task_type):
                data = json.dumps({"token": token, "done": False})
                yield f"data: {data}\n\n"

            yield f"data: {json.dumps({'token': '', 'done': True})}\n\n"
        except Exception as e:
            logger.error(f"Error in ask_question_stream: {str(e)}")
            yield f"data: {json.dumps({'token': 'Streaming failed. Please retry.', 'done': True})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


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


from pydantic import BaseModel
from typing import List, Optional

class TutorChatRequest(BaseModel):
    question: str
    conversation_history: Optional[List[dict]] = None


def build_tutor_system_prompt(username: str) -> str:
    from services.database import get_user_profile, get_diagnostic_assessment, fetch_progress_logs
    from routes.progress import _progress_analytics_payload
    import json
    from datetime import datetime
    
    profile = get_user_profile(username) or {}
    logs = fetch_progress_logs(username)
    
    diag = get_diagnostic_assessment(username)
    if diag:
        try:
            subject_scores = json.loads(diag.get("subject_scores_json") or "{}")
            created_at = diag.get("created_at") or datetime.utcnow().isoformat()
            for sub, score in subject_scores.items():
                logs.append({
                    "user_id": username,
                    "action": "practice",
                    "subject": sub,
                    "chapter": "Diagnostic Assessment",
                    "score": score,
                    "timestamp": created_at
                })
        except Exception:
            pass
            
    analytics = _progress_analytics_payload(username, logs)
    
    school = profile.get("school") or "Unknown"
    class_num = profile.get("class_num") or "10"
    learning_style = profile.get("learning_style") or "visual"
    goal = profile.get("goal") or "scoring 95%+ in CBSE board exams"
    study_hours = profile.get("study_hours") or "2-3 hours daily"
    focus_areas = profile.get("focus_areas") or "All core chapters"
    exam_board = profile.get("exam_board") or "CBSE"
    confidence_level = profile.get("confidence_level") or "moderate"
    revision_frequency = profile.get("revision_frequency") or "weekly"
    teacher_personality = profile.get("teacher_personality") or "Kind and encouraging"
    
    overall_avg = analytics.get("overall", {}).get("average_score", 65)
    streak = analytics.get("overall", {}).get("study_streak_days", 0)
    weak_topics = [
        x.get("chapter") or x.get("title") or str(x) if isinstance(x, dict) else str(x)
        for x in analytics.get("weak_topics", [])
    ]
    rec_topics = [
        x.get("chapter") or x.get("title") or str(x) if isinstance(x, dict) else str(x)
        for x in analytics.get("recommended_topics", [])
    ]
    
    system_prompt = (
        "You are Clarity's dedicated AI Study Coach and Exam Planner.\n"
        "Your role is to act as an encouraging, board-exam expert study coach for CBSE school students. "
        "Help them optimize their study plan, manage exam stress, review weak areas, and suggest daily practice plans.\n\n"
        f"STUDENT PROFILE:\n"
        f"- Name: {username}\n"
        f"- Class: CBSE Grade {class_num}\n"
        f"- School: {school}\n"
        f"- Goal: {goal}\n"
        f"- Study Hours: {study_hours}\n"
        f"- Focus Areas: {focus_areas}\n"
        f"- Exam Board: {exam_board}\n"
        f"- Learning Style: {learning_style}\n"
        f"- Confidence Level: {confidence_level}\n"
        f"- Revision Frequency: {revision_frequency}\n"
        f"- Coach Personality: {teacher_personality}\n\n"
        f"STUDENT STUDY PROGRESS & METRICS:\n"
        f"- Current Study Streak: {streak} days\n"
        f"- Average Practice Score: {overall_avg}/100\n"
        f"- Weak Chapters/Topics: {', '.join(weak_topics) if weak_topics else 'None identified yet'}\n"
        f"- Recommended Chapters to Study: {', '.join(rec_topics) if rec_topics else 'All core chapters'}\n\n"
        "INSTRUCTIONS:\n"
        "1. Personalize all responses to the student's learning style, goal, and study metrics.\n"
        "2. If they have weak chapters, gently remind them and suggest concrete ways to improve (e.g. asking specifically about those concepts, doing practice worksheets).\n"
        "3. Provide actionable CBSE Board Grade-specific advice. Use formatting (bullet points, bold text) to keep your advice clean, premium, and easy to read.\n"
        "4. Adopt the teacher personality defined in the profile.\n"
        "5. CONVERSATIONAL EFFICIENCY FOR GREETINGS: If the student says a greeting (like 'hello', 'hi', 'hey', 'good morning'), or casual chit-chat, reply with a simple, friendly 2-4 line response. Do NOT output lists, study plans, tables, or massive responses for casual greetings.\n"
        "6. Reserve detailed plans, checklists, tables, and structured breakdowns strictly for academic questions, study goals, planning questions, or subject topic discussions.\n"
    )
    return system_prompt


@router.post("/tutor")
async def chat_tutor(request: TutorChatRequest, authorization: Optional[str] = Header(default=None)):
    from utils.auth import require_auth_username
    username = require_auth_username(authorization)
    system_prompt = build_tutor_system_prompt(username)
    messages = [{"role": "system", "content": system_prompt}]
    if request.conversation_history:
        messages.extend(request.conversation_history)
    messages.append({"role": "user", "content": request.question})
    
    answer = await ask_openrouter(messages, task_type="smart")
    return {"answer": answer}


@router.post("/tutor-stream")
async def chat_tutor_stream(request: TutorChatRequest, authorization: Optional[str] = Header(default=None)):
    from utils.auth import require_auth_username
    username = require_auth_username(authorization)
    async def event_generator():
        try:
            system_prompt = build_tutor_system_prompt(username)
            messages = [{"role": "system", "content": system_prompt}]
            if request.conversation_history:
                messages.extend(request.conversation_history)
            messages.append({"role": "user", "content": request.question})
            
            async for token in ask_openrouter_stream(messages, task_type="smart"):
                yield f"data: {json.dumps({'token': token, 'done': False})}\n\n"
            yield f"data: {json.dumps({'token': '', 'done': True})}\n\n"
        except Exception as e:
            logger.error(f"Error in chat_tutor_stream: {str(e)}")
            yield f"data: {json.dumps({'token': 'Streaming failed. Please retry.', 'done': True})}\n\n"
            
    return StreamingResponse(event_generator(), media_type="text/event-stream")
