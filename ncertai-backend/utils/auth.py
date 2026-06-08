from typing import Optional

from fastapi import HTTPException

from services.database import get_parent_session, get_username_by_token, get_user_profile


def extract_bearer_token(authorization: Optional[str]) -> str:
    if not authorization:
        return ""
    parts = authorization.split(" ", 1)
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1].strip()
    return authorization.strip()


def require_auth_username(authorization: Optional[str]) -> str:
    token = extract_bearer_token(authorization)
    username = get_username_by_token(token)
    if not username:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return username


def require_pro_max_username(authorization: Optional[str]) -> str:
    username = require_auth_username(authorization)
    # Bypass subscription tier gating for launch promotion (everything is free)
    return username


def require_parent_context(authorization: Optional[str]) -> dict[str, str]:
    token = extract_bearer_token(authorization)
    session = get_parent_session(token)
    if not session:
        raise HTTPException(status_code=401, detail="Unauthorized parent session")
    return session
