from fastapi import APIRouter, HTTPException, Header
import re
from models.schemas import PracticeRequest, PracticeResponse, GradeRequest, GradeResponse
from services.openrouter import ask_openrouter
from utils.rate_limiter import check_rate_limit, increment_usage

router = APIRouter()

@router.post("/generate", response_model=PracticeResponse)
async def generate_questions(request: PracticeRequest, x_user_id: str = Header(None)):
    if x_user_id and not check_rate_limit(x_user_id, "question"):
        raise HTTPException(status_code=429, detail="Daily limit reached.")

    prompt = f"Generate {request.num_questions} {request.question_type} questions for CBSE Class {request.class_num} {request.subject}, Chapter: {request.chapter}. Number them 1, 2, 3... Return ONLY the questions, no answers. Make them exam-style questions that have appeared in CBSE board papers."
    
    messages = [
        {"role": "system", "content": "You are a CBSE exam paper setter."},
        {"role": "user", "content": prompt}
    ]
    
    response = await ask_openrouter(messages)
    
    # Simple parser for numbered list
    questions = re.split(r'\d+\.\s+', response)
    questions = [q.strip() for q in questions if q.strip()]
    
    if x_user_id:
        increment_usage(x_user_id, "question")
        
    return PracticeResponse(questions=questions)

@router.post("/grade", response_model=GradeResponse)
async def grade_answer(request: GradeRequest, x_user_id: str = Header(None)):
    prompt = f"""You are a CBSE examiner grading a student answer. 
Question: {request.question}
Student's answer: {request.user_answer}
Total marks: {request.marks_available}

Grade this strictly as a CBSE examiner would. Return in this EXACT format:
MARKS: X/Y
WHAT WAS GOOD: [specific points that were correct]
WHAT WAS MISSING: [specific points that were missing or wrong]
MODEL ANSWER: [the ideal answer a student should write]"""

    messages = [
        {"role": "system", "content": "You are a strict but fair CBSE examiner."},
        {"role": "user", "content": prompt}
    ]
    
    response = await ask_openrouter(messages)
    
    # Parse the response
    marks_match = re.search(r'MARKS:\s*(\d+)/(\d+)', response)
    good_match = re.search(r'WHAT WAS GOOD:\s*(.*?)(?=WHAT WAS MISSING:|$)', response, re.DOTALL)
    missing_match = re.search(r'WHAT WAS MISSING:\s*(.*?)(?=MODEL ANSWER:|$)', response, re.DOTALL)
    model_match = re.search(r'MODEL ANSWER:\s*(.*)', response, re.DOTALL)
    
    marks_awarded = int(marks_match.group(1)) if marks_match else 0
    total_marks = int(marks_match.group(2)) if marks_match else request.marks_available
    feedback = f"Good: {good_match.group(1).strip() if good_match else 'None'}\nMissing: {missing_match.group(1).strip() if missing_match else 'None'}"
    model_answer = model_match.group(1).strip() if model_match else "N/A"
    
    return GradeResponse(
        marks_awarded=marks_awarded,
        total_marks=total_marks,
        feedback=feedback,
        model_answer=model_answer
    )
