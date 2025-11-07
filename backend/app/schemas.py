from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

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
    public_auto_sync_enabled: bool = True

    model_config = {"from_attributes": True}


class UserPreferencesUpdate(BaseModel):
    public_auto_sync_enabled: Optional[bool] = None


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
    public_is_alive: bool = True
    avatar: Optional[str] = None
    friend_id: Optional[int] = None


class PlayerCreate(BaseModel):
    name: str
    avatar: Optional[str] = None
    friend_id: Optional[int] = None


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
    players: List[PlayerCreate] = Field(default_factory=list)

    @model_validator(mode="after")
    def ensure_players_or_names(self) -> "GameCreateRequest":
        if not self.players and not self.player_names:
            raise ValueError("Provide at least one player")
        return self


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


class NightActionsRequest(BaseModel):
    actions: List[GameActionRequest]

    @model_validator(mode="after")
    def validate_actions(self) -> "NightActionsRequest":
        if not self.actions:
            raise ValueError("Provide at least one night action")

        allowed_types = {"kill", "save", "investigate"}
        for action in self.actions:
            if action.action_type not in allowed_types:
                raise ValueError(f"Unsupported night action: {action.action_type}")
            if action.target_player_id is None:
                raise ValueError(f"Night action {action.action_type} requires a target player")
        return self


class GameHistoryEntry(GameRead):
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
