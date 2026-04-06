from typing import Optional
import json

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from services.database import (
    create_session,
    create_user,
    delete_session,
    get_user_snapshot,
    get_study_materials,
    get_user_profile,
    get_username_by_token,
    save_user_snapshot,
    upsert_study_material,
    update_user_profile,
    verify_user,
)

router = APIRouter()


class AuthProfile(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    class_num: int = Field(alias="class")
    subjects: list[str] = []
    school: Optional[str] = None
    learningStyle: Optional[str] = None
    goal: Optional[str] = None
    studyHours: Optional[str] = None
    focusAreas: Optional[str] = None
    examBoard: Optional[str] = None
    preferredLanguage: Optional[str] = None
    preferredPace: Optional[str] = None
    confidenceLevel: Optional[str] = None
    revisionFrequency: Optional[str] = None
    parentEmail: Optional[str] = None


class RegisterRequest(BaseModel):
    profile: AuthProfile
    password: str = Field(min_length=6, max_length=128)


class LoginRequest(BaseModel):
    name: str
    password: str


class StudyMaterialRequest(BaseModel):
    id: str
    type: str
    title: str
    subject: Optional[str] = None
    chapter: Optional[str] = None
    content: Optional[str] = None
    url: Optional[str] = None
    imageDataUrl: Optional[str] = None
    createdAt: int


class SnapshotRequest(BaseModel):
    payload: dict


def _extract_token(authorization: Optional[str]) -> str:
    if not authorization:
        return ""
    parts = authorization.split(" ", 1)
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1].strip()
    return authorization.strip()


def _auth_username(authorization: Optional[str]) -> str:
    token = _extract_token(authorization)
    username = get_username_by_token(token)
    if not username:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return username


@router.post("/register")
async def register(request: RegisterRequest):
    profile_data = request.profile.model_dump(by_alias=False)
    profile_data["class"] = request.profile.class_num
    profile_data["subjects_json"] = json.dumps(request.profile.subjects or [])

    ok = create_user(request.profile.name.strip(), request.password, profile_data)
    if not ok:
        raise HTTPException(status_code=409, detail="User already exists. Please login.")

    token = create_session(request.profile.name.strip())
    return {
        "token": token,
        "user": {
            "name": request.profile.name.strip(),
            "class": request.profile.class_num,
            "subjects": request.profile.subjects,
            "school": request.profile.school,
            "learningStyle": request.profile.learningStyle,
            "goal": request.profile.goal,
            "studyHours": request.profile.studyHours,
            "focusAreas": request.profile.focusAreas,
            "examBoard": request.profile.examBoard,
            "preferredLanguage": request.profile.preferredLanguage,
            "preferredPace": request.profile.preferredPace,
            "confidenceLevel": request.profile.confidenceLevel,
            "revisionFrequency": request.profile.revisionFrequency,
            "parentEmail": request.profile.parentEmail,
        },
    }


@router.post("/login")
async def login(request: LoginRequest):
    username = request.name.strip()
    if not verify_user(username, request.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    row = get_user_profile(username)
    if not row:
        raise HTTPException(status_code=404, detail="User not found")

    subjects = []
    try:
        subjects = json.loads(row.get("subjects_json") or "[]")
    except Exception:
        subjects = []

    token = create_session(username)
    return {
        "token": token,
        "user": {
            "name": username,
            "class": row.get("class_num") or 10,
            "subjects": subjects,
            "school": row.get("school"),
            "learningStyle": row.get("learning_style"),
            "goal": row.get("goal"),
            "studyHours": row.get("study_hours"),
            "focusAreas": row.get("focus_areas"),
            "examBoard": row.get("exam_board"),
            "preferredLanguage": row.get("preferred_language"),
            "preferredPace": row.get("preferred_pace"),
            "confidenceLevel": row.get("confidence_level"),
            "revisionFrequency": row.get("revision_frequency"),
            "parentEmail": row.get("parent_email"),
        },
    }


@router.get("/me")
async def me(authorization: Optional[str] = Header(default=None)):
    username = _auth_username(authorization)
    row = get_user_profile(username)
    if not row:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        subjects = json.loads(row.get("subjects_json") or "[]")
    except Exception:
        subjects = []

    return {
        "name": username,
        "class": row.get("class_num") or 10,
        "subjects": subjects,
        "school": row.get("school"),
        "learningStyle": row.get("learning_style"),
        "goal": row.get("goal"),
        "studyHours": row.get("study_hours"),
        "focusAreas": row.get("focus_areas"),
        "examBoard": row.get("exam_board"),
        "preferredLanguage": row.get("preferred_language"),
        "preferredPace": row.get("preferred_pace"),
        "confidenceLevel": row.get("confidence_level"),
        "revisionFrequency": row.get("revision_frequency"),
        "parentEmail": row.get("parent_email"),
    }


@router.put("/me")
async def update_me(profile: AuthProfile, authorization: Optional[str] = Header(default=None)):
    username = _auth_username(authorization)
    profile_data = profile.model_dump(by_alias=False)
    profile_data["class"] = profile.class_num
    profile_data["subjects_json"] = json.dumps(profile.subjects or [])

    # Keep username immutable in this iteration.
    update_user_profile(username, profile_data)

    return {"status": "ok"}


@router.post("/logout")
async def logout(authorization: Optional[str] = Header(default=None)):
    token = _extract_token(authorization)
    if token:
        delete_session(token)
    return {"status": "ok"}


@router.get("/curriculum")
async def get_curriculum():
    """Return NCERT curriculum catalog by class and subject.
    All users can access this without auth."""
    from constants.ncert import NCERT_CHAPTERS
    return {"catalog": NCERT_CHAPTERS}


@router.post("/materials")
async def save_material(item: StudyMaterialRequest, authorization: Optional[str] = Header(default=None)):
    username = _auth_username(authorization)
    upsert_study_material(username, item.model_dump())
    return {"status": "ok"}


@router.get("/materials")
async def list_materials(authorization: Optional[str] = Header(default=None)):
    username = _auth_username(authorization)
    return {"materials": get_study_materials(username)}


@router.post("/snapshot")
async def sync_snapshot(request: SnapshotRequest, authorization: Optional[str] = Header(default=None)):
    username = _auth_username(authorization)
    payload_json = json.dumps(request.payload)
    save_user_snapshot(username, payload_json)
    return {"status": "ok"}


@router.get("/snapshot")
async def fetch_snapshot(authorization: Optional[str] = Header(default=None)):
    username = _auth_username(authorization)
    snapshot_json = get_user_snapshot(username)
    if not snapshot_json:
        return {"payload": {}}
    try:
        return {"payload": json.loads(snapshot_json)}
    except Exception:
        return {"payload": {}}
