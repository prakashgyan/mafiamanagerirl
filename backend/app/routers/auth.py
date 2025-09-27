from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from .. import schemas
from ..database import get_db
from ..deps import get_current_user
from ..models import User
from ..security import create_access_token, hash_password, set_auth_cookie, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=schemas.UserRead, status_code=status.HTTP_201_CREATED)
def signup(payload: schemas.UserCreate, response: Response, db: Session = Depends(get_db)) -> schemas.UserRead:
    existing = db.query(User).filter(User.username == payload.username).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already taken")

    user = User(username=payload.username, password_hash=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": user.id})
    set_auth_cookie(response, token)

    return schemas.UserRead.model_validate(user)


@router.post("/login", response_model=schemas.UserRead)
def login(payload: schemas.LoginRequest, response: Response, db: Session = Depends(get_db)) -> schemas.UserRead:
    user = db.query(User).filter(User.username == payload.username).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token({"sub": user.id}, expires_delta=timedelta(minutes=60 * 24))
    set_auth_cookie(response, token)
    return schemas.UserRead.model_validate(user)


@router.post("/logout")
def logout(response: Response) -> Response:
    from ..security import clear_auth_cookie

    clear_auth_cookie(response)

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me", response_model=schemas.UserRead)
def get_me(user: User = Depends(get_current_user)) -> schemas.UserRead:
    return schemas.UserRead.model_validate(user)
