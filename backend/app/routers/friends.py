from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from .. import schemas
from ..database import get_db
from ..deps import get_current_user
from ..models import Friend, User

router = APIRouter(prefix="/friends", tags=["friends"])


@router.get("/", response_model=list[schemas.FriendRead])
def list_friends(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[schemas.FriendRead]:
    friends = db.query(Friend).filter(Friend.user_id == current_user.id).order_by(Friend.name).all()
    return [schemas.FriendRead.model_validate(friend) for friend in friends]


@router.post("/", response_model=schemas.FriendRead, status_code=status.HTTP_201_CREATED)
def create_friend(
    payload: schemas.FriendCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> schemas.FriendRead:
    friend = Friend(user_id=current_user.id, **payload.model_dump())
    db.add(friend)
    db.commit()
    db.refresh(friend)
    return schemas.FriendRead.model_validate(friend)


@router.delete("/{friend_id}")
def delete_friend(
    friend_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    friend = db.query(Friend).filter(Friend.user_id == current_user.id, Friend.id == friend_id).first()
    if not friend:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Friend not found")
    db.delete(friend)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
