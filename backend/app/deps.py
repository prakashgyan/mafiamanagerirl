from __future__ import annotations

from fastapi import Depends, HTTPException, Request, status
from loguru import logger

from .database import get_datastore
from .models import User
from .security import AUTH_COOKIE_NAME, decode_token


def get_current_user(request: Request, datastore = Depends(get_datastore)) -> User:
    token = request.cookies.get(AUTH_COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    payload = decode_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication")

    try:
        user_id = int(payload["sub"])
    except (KeyError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication") from exc

    user = datastore.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    logger.bind(user_id=user_id).debug("Resolved current user")
    return user
