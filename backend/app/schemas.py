from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator

from .models import GamePhase, GameStatus


class UserBase(BaseModel):
    username: str


class UserCreate(UserBase):
    password: str = Field(min_length=6, max_length=72)

    @field_validator("password")
    @classmethod
    def password_within_bcrypt_limit(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Password must be at most 72 bytes when UTF-8 encoded")
        return value


class UserRead(UserBase):
    id: int

    model_config = {"from_attributes": True}


class LoginRequest(BaseModel):
    username: str
    password: str = Field(max_length=72)

    @field_validator("password")
    @classmethod
    def login_password_within_bcrypt_limit(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Password must be at most 72 bytes when UTF-8 encoded")
        return value


class FriendBase(BaseModel):
    name: str
    description: Optional[str] = None
    image: Optional[str] = None


class FriendCreate(FriendBase):
    pass


class FriendRead(FriendBase):
    id: int

    model_config = {"from_attributes": True}


class PlayerBase(BaseModel):
    name: str
    role: Optional[str] = None
    is_alive: bool = True


class PlayerCreate(BaseModel):
    name: str


class PlayerUpdateRole(BaseModel):
    player_id: int
    role: str


class PlayerRead(PlayerBase):
    id: int

    model_config = {"from_attributes": True}


class LogRead(BaseModel):
    id: int
    round: int
    phase: GamePhase
    message: str
    timestamp: datetime

    model_config = {"from_attributes": True}


class GameBase(BaseModel):
    status: GameStatus
    current_phase: GamePhase
    current_round: int
    winning_team: Optional[str] = None


class GameCreateRequest(BaseModel):
    player_names: List[str] = Field(default_factory=list)


class GameRead(GameBase):
    id: int

    model_config = {"from_attributes": True}


class GameDetail(GameRead):
    players: List[PlayerRead]
    logs: List[LogRead]


class AssignRolesRequest(BaseModel):
    assignments: List[PlayerUpdateRole]


class GameActionRequest(BaseModel):
    action_type: str
    target_player_id: Optional[int] = None
    actor_role: Optional[str] = None
    note: Optional[str] = None


class PhaseChangeRequest(BaseModel):
    phase: GamePhase


class FinishGameRequest(BaseModel):
    winning_team: str


class GameHistoryEntry(GameRead):
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
