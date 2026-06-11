import os
from dotenv import load_dotenv

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
logging.basicConfig(level=os.getenv("CLARITY_LOG_LEVEL", "INFO"))
logger = logging.getLogger(__name__)

app = FastAPI(title="NcertAI API", version="1.0.0")
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
init_db()

IS_PRODUCTION = os.getenv("CLARITY_ENV", "development").strip().lower() == "production"


def _parse_cors_origins() -> list[str]:
    raw = os.getenv("CLARITY_CORS_ORIGINS", "")
    origins_list = []
    if raw.strip():
        origins_list = [origin.strip() for origin in raw.split(",") if origin.strip()]
    else:
        origins_list = [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "https://claritystudy.vercel.app",
        ]
    
    app_base = os.getenv("CLARITY_APP_BASE_URL", "").strip()
    if app_base and app_base not in origins_list:
        origins_list.append(app_base)
    return origins_list

# CORS setup
origins = _parse_cors_origins()

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if response.headers.get("X-Frame-Options") == "":
        if "X-Frame-Options" in response.headers:
            del response.headers["X-Frame-Options"]
    elif "pdf" in request.url.path or "proxy" in request.url.path:
        if "X-Frame-Options" in response.headers:
            del response.headers["X-Frame-Options"]
    else:
        response.headers["X-Frame-Options"] = "DENY"
    if IS_PRODUCTION:
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
    return response

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
async def khan_adapter(class_num: str = "9", subject: str = "Mathematics", limit: int = 8):
    mock_enabled = os.getenv("CLARITY_ENABLE_KHAN_ADAPTER_MOCK", "0").strip().lower() in {"1", "true", "yes", "on"}
    if not mock_enabled:
        return {
            "worksheets": [],
            "source": "disabled",
            "message": "Khan adapter is disabled. Configure a production worksheet provider or enable CLARITY_ENABLE_KHAN_ADAPTER_MOCK explicitly.",
        }

    # Development fallback adapter for local testing only.
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
    status_code = 500
    detail = "Internal server error"
    if not IS_PRODUCTION:
        detail = f"Internal server error: {str(exc)}"

    response = JSONResponse(
        status_code=status_code,
        content={
            "detail": detail,
        }
    )
    origin = request.headers.get("origin", "")
    if origin and origin in origins:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Vary"] = "Origin"
        response.headers["Access-Control-Allow-Credentials"] = "true"
    return response

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
