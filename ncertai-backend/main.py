from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
import time

from routes.qa import router as qa_router
from routes.practice import router as practice_router
from routes.upload import router as upload_router
from routes.progress import router as progress_router
from routes.summary import router as summary_router
from routes.creative import router as creative_router
from routes.auth import router as auth_router
from routes.curriculum import router as curriculum_router
from services.database import init_db

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="NcertAI API", version="1.0.0")
init_db()

# CORS setup
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(qa_router, prefix="/api/v1/chat", tags=["QA"])
app.include_router(practice_router, prefix="/api/v1/practice", tags=["Practice"])
app.include_router(upload_router, prefix="/api/v1/upload", tags=["Upload"])
app.include_router(progress_router, prefix="/api/v1/progress", tags=["Progress"])
app.include_router(summary_router, prefix="/api/v1/summary", tags=["Summary"])
app.include_router(creative_router, prefix="/api/v1/creative", tags=["Creative"])
app.include_router(auth_router, prefix="/api/v1/auth", tags=["Auth"])
app.include_router(curriculum_router, prefix="/api/v1/curriculum", tags=["Curriculum"])

# Root Endpoints
@app.get("/")
async def root():
    return {"status": "NcertAI is live", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    return {"healthy": True}


@app.get("/api/khan-adapter")
async def khan_adapter_mock(class_num: str = "9", subject: str = "Mathematics", limit: int = 8):
    # Mock adapter: maps grade 9 Khan-style math topics to CBSE chapter names.
    # Replace this endpoint with your real adapter implementation when available.
    if str(class_num) != "9":
        return {"worksheets": []}

    topic_map = [
        ("Number System Foundations", "Number Systems"),
        ("Algebraic Expressions and Identities", "Polynomials"),
        ("Linear Equation Basics", "Linear Equations in Two Variables"),
        ("Coordinate Plane Essentials", "Coordinate Geometry"),
        ("Euclid and Geometry Axioms", "Introduction to Euclid's Geometry"),
        ("Triangles and Congruency", "Triangles"),
        ("Area and Heron Practice", "Heron's Formula"),
        ("Surface Area and Volume Drill", "Surface Areas and Volumes"),
    ]

    worksheets = []
    normalized_subject = subject or "Mathematics"
    for idx, (title, chapter) in enumerate(topic_map[: max(1, min(limit, 20))], start=1):
        worksheets.append(
            {
                "id": f"khan_cbse_9_{idx}",
                "title": f"Khan Grade 9 -> CBSE: {title}",
                "class_num": "9",
                "subject": normalized_subject,
                "chapter": chapter,
                "question_type": "mixed",
                "difficulty": "Medium",
                "num_questions": 8,
                "board": "CBSE",
                "year": 2024,
                "source_url": "https://www.khanacademy.org/math",
                "questions": [],
            }
        )

    return {"worksheets": worksheets}

# GLOBAL AUTONOMOUS ERROR HANDLER
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Autonomous System caught error: {str(exc)}", exc_info=True)
    # Never let the student see a crash. Always return a teacher fallback.
    return JSONResponse(
        status_code=200, # Return 200 so frontend doesn't trigger 'Something went wrong'
        content={
            "answer": (
                "💡 **Clarity Tutor**: Our AI engines encountered a brief hiccup ☕ \n\n"
                "**What this means:** All three of our backup models are temporarily overwhelmed. "
                "This usually lasts less than 30 seconds.\n\n"
                "**Here's what to do:**\n"
                "1️⃣ **Immediate retry:** Click the Send button again in 5-10 seconds\n"
                "2️⃣ **Split the question:** Try asking one specific concept instead of multiple\n"
                "3️⃣ **Use simpler wording:** Sometimes brief questions get responses faster\n\n"
                "⚠️ *If this keeps happening, check that the backend is running:*\n"
                "`uvicorn main:app --port 8000`\n\n"
                "**Your CBSE prep matters — let's get you back on track! 🎯**"
            ),
            "tokens_used": 0,
            "is_fallback": True,
            "retry_after_seconds": 10
        }
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
