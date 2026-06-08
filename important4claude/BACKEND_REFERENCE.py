"""
Clarity backend condensed reference (standalone handoff).
This is not the full source, but a faithful structural reference of the real system.
"""

from fastapi import FastAPI, APIRouter, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

app = FastAPI(title="Clarity API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------- Schemas --------------------
class VideoRenderPackageRequest(BaseModel):
    class_num: str
    subject: str
    chapter: str
    topic: str
    duration_seconds: int = 90
    style: str = "concept-first"
    broll_mode: str = "balanced"  # minimal | balanced | aggressive
    montage_level: str = "single"  # single | light | dynamic
    min_external_segments: int = 1


class LogRequest(BaseModel):
    action: str
    subject: str
    chapter: str
    score: Optional[int] = None


# -------------------- Auth Helpers --------------------
def _extract_token(authorization: Optional[str]) -> str:
    if not authorization:
        return ""
    parts = authorization.split(" ", 1)
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1].strip()
    return authorization.strip()


def require_auth_username(authorization: Optional[str]) -> str:
    token = _extract_token(authorization)
    # Real system resolves token -> username from SQLite sessions table.
    if not token:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return "resolved_username"


# -------------------- Routers --------------------
auth_router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])
progress_router = APIRouter(prefix="/api/v1/progress", tags=["Progress"])
creative_router = APIRouter(prefix="/api/v1/creative", tags=["Creative"])


@auth_router.get("/curriculum")
async def get_curriculum():
    # Real system returns constants.ncert.NCERT_CHAPTERS
    return {"catalog": {"10": {"Science": ["Life Processes", "Light"]}}}


@progress_router.post("/log")
async def log_progress(request: LogRequest, authorization: Optional[str] = Header(default=None)):
    username = require_auth_username(authorization)
    # Real system inserts into SQLite progress_logs.
    return {"status": "Logged successfully", "username": username}


@creative_router.post("/video-file")
async def video_file(request: VideoRenderPackageRequest, authorization: Optional[str] = Header(default=None)):
    _ = require_auth_username(authorization)
    # Real system pipeline:
    # 1) Build AI slide plan
    # 2) Try external stock clips (Wikimedia/Internet Archive/Pixabay optional)
    # 3) Build montage with ffmpeg
    # 4) Fallback to procedural/slide rendering
    # 5) Write manifest + return telemetry headers
    raise HTTPException(status_code=501, detail="Reference file only. See PROJECT_BRAIN.md and API_CONTRACTS.json")


app.include_router(auth_router)
app.include_router(progress_router)
app.include_router(creative_router)


@app.get("/")
async def root():
    return {"status": "Clarity API live"}


@app.get("/health")
async def health():
    return {"healthy": True}
