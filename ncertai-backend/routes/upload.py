from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Header
from models.schemas import UploadResponse
from services.openrouter import ask_openrouter
from services.file_processor import process_file_for_ai
from utils.rate_limiter import check_rate_limit, increment_usage

router = APIRouter()

@router.post("/analyze", response_model=UploadResponse)
async def analyze_file(
    file: UploadFile = File(...),
    question: str = Form(...),
    x_user_id: str = Header(None)
):
    if x_user_id and not check_rate_limit(x_user_id, "upload"):
        raise HTTPException(status_code=429, detail="Daily upload limit reached.")
        
    file_bytes = await file.read()
    content_data = process_file_for_ai(file_bytes, file.filename)
    
    if content_data["type"] == "pdf":
        messages = [
            {"role": "system", "content": "You are NcertAI analyzing a student's uploaded study material. Analyze the content and answer the student's question. If it's a textbook page, identify the NCERT chapter if possible. Give a structured, helpful response."},
            {"role": "user", "content": f"Here is the content of a PDF: {content_data['content']}\n\nStudent's question: {question}"}
        ]
        extracted_text = content_data['content']
    elif content_data["type"] == "image":
        messages = [
            {"role": "system", "content": "You are NcertAI analyzing a student's uploaded study material. Analyze the content and answer the student's question. If it's a textbook page, identify the NCERT chapter if possible. Give a structured, helpful response."},
            {"role": "user", "content": [
                {"type": "text", "text": question},
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{content_data['base64']}"}}
            ]}
        ]
        extracted_text = "[Image Content]"
    else:
        raise HTTPException(status_code=400, detail="Unsupported file type.")
        
    analysis = await ask_openrouter(messages, task_type="vision")
    
    if x_user_id:
        increment_usage(x_user_id, "upload")
        
    return UploadResponse(analysis=analysis, extracted_text=extracted_text)
