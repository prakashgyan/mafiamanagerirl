from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from loguru import logger
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import schemas
from ..config import get_settings
from ..database import get_datastore, get_db
from ..deps import get_current_user
from ..models import User, utc_now
from ..orm_models import DemoUserStateDb, UserDb
from ..security import create_access_token, hash_password, set_auth_cookie, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])

DEMO_FRIEND_NAME_POOL = [
    "Axiom Vale",
    "Brin Thorne",
    "Cyra Wex",
    "Drex Talon",
    "Elara Quill",
    "Fynn Rook",
    "Galen Prym",
    "Hexa Lune",
    "Iris Vex",
    "Jaxen Null",
    "Kyra Blythe",
    "Luno Shade",
    "Mara Voss",
    "Nero Clast",
    "Oryn Vale",
    "Pyria Sable",
    "Quen Rift",
    "Ryse Calder",
    "Syra Volt",
    "Theron Hale",
]
DEMO_FRIEND_SEED_COUNT = 10


def _pick_demo_friend_names() -> list[str]:
    pool = list(DEMO_FRIEND_NAME_POOL)
    if len(pool) >= DEMO_FRIEND_SEED_COUNT:
        return random.sample(pool, DEMO_FRIEND_SEED_COUNT)

    selections: list[str] = []
    while len(selections) < DEMO_FRIEND_SEED_COUNT:
        random.shuffle(pool)
        for name in pool:
            selections.append(name)
            if len(selections) == DEMO_FRIEND_SEED_COUNT:
                break
        if not pool:
            break
    return selections[:DEMO_FRIEND_SEED_COUNT]


def _reset_demo_account(datastore, user_id: int, password: str) -> None:
    """Reset demo user password, remove all related data, and seed default friends."""
    datastore.update_user(user_id, password_hash=hash_password(password))
    datastore.reset_user_data(user_id)
    for name in _pick_demo_friend_names():
        datastore.create_friend(user_id, name=name, description=None, image=None)


@router.post("/signup", response_model=schemas.UserRead, status_code=status.HTTP_201_CREATED)
def signup(
    payload: schemas.UserCreate,
    response: Response,
    request: Request,
    db: Session = Depends(get_db),
) -> schemas.UserRead:
    datastore = get_datastore(db)
    logger.bind(username=payload.username).debug("Processing signup request")
    existing = datastore.get_user_by_username(payload.username)
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already taken")

    user = datastore.create_user(payload.username, hash_password(payload.password))

    token = create_access_token({"sub": user.id})
    set_auth_cookie(response, token, request=request)

    logger.bind(user_id=user.id).debug("User signed up")

    return schemas.UserRead.model_validate(user)


@router.post("/login", response_model=schemas.UserRead)
def login(
    payload: schemas.LoginRequest,
    response: Response,
    request: Request,
    db: Session = Depends(get_db),
) -> schemas.UserRead:
    datastore = get_datastore(db)
    logger.bind(username=payload.username).debug("Processing login request")
    user = datastore.get_user_by_username(payload.username)
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token({"sub": user.id})
    set_auth_cookie(response, token, request=request)
    logger.bind(user_id=user.id).debug("User logged in")
    return schemas.UserRead.model_validate(user)


@router.post("/demo-login", response_model=schemas.UserRead)
def demo_login(
    response: Response,
    request: Request,
    db: Session = Depends(get_db),
) -> schemas.UserRead:
    settings = get_settings()

    if not settings.demo_user_enabled:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Demo login is not available")

    username = settings.demo_username
    password = settings.demo_password

    if not username or not password:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Demo login is misconfigured")

    now = utc_now()
    now_naive = now.replace(tzinfo=None)
    ttl = timedelta(hours=settings.demo_user_ttl_hours)

    user_db = db.execute(select(UserDb).where(UserDb.username == username)).scalar_one_or_none()
    state = db.execute(select(DemoUserStateDb).where(DemoUserStateDb.username == username)).scalar_one_or_none()

    needs_reset = False

    if user_db is None:
        user_db = UserDb(username=username, password_hash=hash_password(password))
        db.add(user_db)
        db.flush()
        needs_reset = True
        logger.bind(username=username).info("Creating demo user account")

    if state is None:
        state = DemoUserStateDb(username=username, seeded_at=now_naive)
        db.add(state)
        needs_reset = True
    else:
        seeded_at = getattr(state, "seeded_at", None)
        if isinstance(seeded_at, datetime):
            seeded_at_utc = seeded_at.replace(tzinfo=timezone.utc) if seeded_at.tzinfo is None else seeded_at.astimezone(timezone.utc)
            if seeded_at_utc + ttl <= now:
                needs_reset = True

    current_hash = getattr(user_db, "password_hash", "")
    if not isinstance(current_hash, str) or not verify_password(password, current_hash):
        needs_reset = True

    if needs_reset:
        logger.bind(username=username).info("Resetting demo user state")
        datastore = get_datastore(db)
        _reset_demo_account(datastore, user_db.id, password)
        if state is not None:
            setattr(state, "seeded_at", now_naive)

    db.commit()
    db.refresh(user_db)

    token = create_access_token({"sub": user_db.id})
    set_auth_cookie(response, token, request=request)
    logger.bind(user_id=user_db.id).debug("Demo user logged in")
    return schemas.UserRead.model_validate(user_db)


@router.post("/logout")
def logout(response: Response, request: Request) -> Response:
    from ..security import clear_auth_cookie

    clear_auth_cookie(response, request=request)
    response.status_code = status.HTTP_204_NO_CONTENT
    logger.debug("User logged out")
    return response


@router.get("/me", response_model=schemas.UserRead)
def get_me(user: User = Depends(get_current_user)) -> schemas.UserRead:
    return schemas.UserRead.model_validate(user)


@router.patch("/me/preferences", response_model=schemas.UserRead)
def update_preferences(
    payload: schemas.UserPreferencesUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> schemas.UserRead:
    datastore = get_datastore(db)
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        return schemas.UserRead.model_validate(current_user)

    updated = datastore.update_user(current_user.id, **changes)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    return schemas.UserRead.model_validate(updated)
