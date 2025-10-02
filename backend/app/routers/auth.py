from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from .. import schemas
from ..database import get_datastore
from ..deps import get_current_user
from ..models import User
from ..security import create_access_token, hash_password, set_auth_cookie, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=schemas.UserRead, status_code=status.HTTP_201_CREATED)
def signup(
    payload: schemas.UserCreate,
    response: Response,
    request: Request,
    datastore = Depends(get_datastore),
) -> schemas.UserRead:
    existing = datastore.get_user_by_username(payload.username)
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already taken")

    user = datastore.create_user(payload.username, hash_password(payload.password))

    token = create_access_token({"sub": user.id})
    set_auth_cookie(response, token, request=request)

    return schemas.UserRead.model_validate(user)


@router.post("/login", response_model=schemas.UserRead)
def login(
    payload: schemas.LoginRequest,
    response: Response,
    request: Request,
    datastore = Depends(get_datastore),
) -> schemas.UserRead:
    user = datastore.get_user_by_username(payload.username)
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token({"sub": user.id}, expires_delta=timedelta(minutes=60 * 24))
    set_auth_cookie(response, token, request=request)
    return schemas.UserRead.model_validate(user)


@router.post("/logout")
def logout(response: Response, request: Request) -> Response:
    from ..security import clear_auth_cookie

    clear_auth_cookie(response, request=request)
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.get("/me", response_model=schemas.UserRead)
def get_me(user: User = Depends(get_current_user)) -> schemas.UserRead:
    return schemas.UserRead.model_validate(user)
