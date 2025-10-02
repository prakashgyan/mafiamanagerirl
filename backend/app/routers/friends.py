from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status

from .. import schemas
from ..database import get_datastore
from ..deps import get_current_user
from ..models import Friend, User

router = APIRouter(prefix="/friends", tags=["friends"])


@router.get("/", response_model=list[schemas.FriendRead])
def list_friends(current_user: User = Depends(get_current_user), datastore = Depends(get_datastore)) -> list[schemas.FriendRead]:
    friends = datastore.list_friends(current_user.id)
    return [schemas.FriendRead.model_validate(friend) for friend in friends]


@router.post("/", response_model=schemas.FriendRead, status_code=status.HTTP_201_CREATED)
def create_friend(
    payload: schemas.FriendCreate,
    current_user: User = Depends(get_current_user),
    datastore = Depends(get_datastore),
) -> schemas.FriendRead:
    friend = datastore.create_friend(
        current_user.id,
        name=payload.name,
        description=payload.description,
        image=payload.image,
    )
    return schemas.FriendRead.model_validate(friend)


@router.delete("/{friend_id}")
def delete_friend(
    friend_id: int,
    current_user: User = Depends(get_current_user),
    datastore = Depends(get_datastore),
) -> Response:
    deleted = datastore.delete_friend(friend_id, current_user.id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Friend not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
