from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any, Dict

import bcrypt
from fastapi import Request, Response
from jose import JWTError, jwt

from .config import get_settings

settings = get_settings()
AUTH_COOKIE_NAME = "mafia_session"
BCRYPT_MAX_BYTES = 72


def _ensure_bcrypt_safe(password: str) -> str:
    if len(password.encode("utf-8")) > BCRYPT_MAX_BYTES:
        raise ValueError("Password exceeds bcrypt's 72 byte limit when encoded in UTF-8")
    return password


def hash_password(password: str) -> str:
    safe_password = _ensure_bcrypt_safe(password)
    hashed = bcrypt.hashpw(safe_password.encode("utf-8"), bcrypt.gensalt())
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    safe_password = _ensure_bcrypt_safe(plain_password)
    return bcrypt.checkpw(safe_password.encode("utf-8"), hashed_password.encode("utf-8"))


def create_access_token(data: Dict[str, Any], expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    if "sub" in to_encode:
        to_encode["sub"] = str(to_encode["sub"])
    expire = datetime.now(UTC) + (expires_delta or timedelta(minutes=settings.access_token_expire_minutes))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def decode_token(token: str) -> Dict[str, Any] | None:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError:
        return None
    return payload


def _cookie_settings(request: Request | None = None) -> dict[str, Any]:
    """Resolve cookie configuration based on settings and incoming request."""

    if settings.auth_cookie_samesite is not None:
        samesite = settings.auth_cookie_samesite.lower()
    elif settings.environment in {"production", "staging"}:
        samesite = "none"
    elif request and request.url.scheme == "https":
        samesite = "none"
    else:
        samesite = "lax"

    secure: bool
    if settings.auth_cookie_secure is not None:
        secure = settings.auth_cookie_secure
    elif request:
        secure = request.url.scheme == "https"
    else:
        secure = settings.environment in {"production", "staging"}

    if samesite == "none" and not secure:
        secure = True

    cookie_settings: dict[str, Any] = {
        "httponly": True,
        "samesite": samesite,
        "secure": secure,
        "max_age": settings.access_token_expire_minutes * 60,
        "path": settings.auth_cookie_path or "/",
    }

    if settings.auth_cookie_domain:
        cookie_settings["domain"] = settings.auth_cookie_domain

    return cookie_settings


def set_auth_cookie(response: Response, token: str, request: Request | None = None) -> None:
    cookie_settings = _cookie_settings(request=request)
    response.set_cookie(
        key=AUTH_COOKIE_NAME,
        value=token,
        **cookie_settings,
    )


def clear_auth_cookie(response: Response) -> None:
    cookie_settings = _cookie_settings()
    response.delete_cookie(
        AUTH_COOKIE_NAME,
        path=cookie_settings.get("path", "/"),
        domain=cookie_settings.get("domain"),
    )
