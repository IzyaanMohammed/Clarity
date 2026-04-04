from fastapi import APIRouter, HTTPException, Header
from models.schemas import QARequest, QAResponse
from services.openrouter import ask_openrouter
from utils.ncert_context import build_system_prompt
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/ask", response_model=QAResponse)
async def ask_question(request: QARequest):
    try:
        # Build system context
        system_prompt = build_system_prompt(request.class_num, request.subject, request.chapter)
        
        messages = [{"role": "system", "content": system_prompt}]
        if request.conversation_history:
            messages.extend(request.conversation_history)
        
        messages.append({"role": "user", "content": request.question})
        
        # Call OpenRouter service directly
        answer = await ask_openrouter(messages)
            
        return QAResponse(answer=answer)
    except Exception as e:
        logger.error(f"Error in ask_question: {str(e)}")
        return QAResponse(answer="💡 NcertAI Teacher: My brain is syncing with the CBSE database. Please ask again in a moment!")

@router.post("/explain")
async def explain_concept(concept: str, class_num: str, subject: str, style: str = "simple"):
    prompt = f"Explain {concept} for Class {class_num} in {style} style."
    messages = [{"role": "user", "content": prompt}]
    answer = await ask_openrouter(messages)
    return {"explanation": answer}
