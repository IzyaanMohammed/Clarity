from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Header
from models.schemas import UploadResponse
from services.openrouter import ask_openrouter
from services.file_processor import process_file_for_ai
from utils.rate_limiter import check_rate_limit, increment_usage
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

SUPPORTED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".webp"}
MAX_FILE_SIZE_MB = 10


@router.post("/analyze", response_model=UploadResponse)
async def analyze_file(
    file: UploadFile = File(...),
    question: str = Form(default="Summarize this study material and explain key concepts."),
    x_user_id: str = Header(None),
):
    # Rate limit check
    if x_user_id and not check_rate_limit(x_user_id, "upload"):
        raise HTTPException(
            status_code=429,
            detail="Daily upload limit reached. Upgrade to Pro for unlimited uploads! 📚",
        )

    # File size check
    file_bytes = await file.read()
    size_mb = len(file_bytes) / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({size_mb:.1f}MB). Maximum allowed is {MAX_FILE_SIZE_MB}MB.",
        )

    logger.info(f"Upload: {file.filename} ({size_mb:.2f}MB) from user={x_user_id}")

    content_data = process_file_for_ai(file_bytes, file.filename)

    if content_data["type"] == "pdf":
        if not content_data.get("content"):
            raise HTTPException(
                status_code=422,
                detail="Could not extract text from this PDF. Try uploading an image of the page instead.",
            )

        messages = [
            {
                "role": "system",
                "content": (
                    "You are NcertAI analyzing a student's uploaded study material. "
                    "If it's an NCERT textbook page, identify the chapter and class. "
                    "Give a structured, exam-focused response with key points, definitions, "
                    "and a 💡 Exam tip at the end."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Here is the content extracted from the uploaded PDF:\n\n"
                    f"{content_data['content'][:8000]}\n\n"  # cap at 8k chars to avoid token overflow
                    f"Student's question: {question}"
                ),
            },
        ]
        # PDF text analysis → smart model for better comprehension
        task_type = "smart"
        extracted_text = content_data["content"]

    elif content_data["type"] == "image":
        messages = [
            {
                "role": "system",
                "content": (
                    "You are NcertAI analyzing a student's uploaded image — this could be "
                    "a textbook page, handwritten notes, or a diagram. "
                    "Identify what chapter/concept it's from, explain key points, "
                    "and end with a 💡 Exam tip."
                ),
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{content_data['base64']}"
                        },
                    },
                    {"type": "text", "text": question},
                ],
            },
        ]
        # Images MUST use vision model
        task_type = "vision"
        extracted_text = "[Image uploaded — visual content analyzed by AI]"

    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Please upload a PDF, JPG, or PNG. Got: {file.filename}",
        )

    logger.info(f"Upload analysis → task_type={task_type}")
    analysis = await ask_openrouter(messages, task_type=task_type)

    if x_user_id:
        increment_usage(x_user_id, "upload")

    return UploadResponse(analysis=analysis, extracted_text=extracted_text)
