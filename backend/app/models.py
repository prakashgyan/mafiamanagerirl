from __future__ import annotations

import enum
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import List


def utc_now() -> datetime:
    return datetime.now(UTC)


def create_game_log(game_id: int, round: int, phase: GamePhase, message: str) -> tuple[int, GamePhase, str]:
    """Helper to create consistent log entries with automatic timestamp handling.
    
    Returns tuple of (round, phase, message) for use with datastore.add_log()
    """
    return round, phase, message


class GameStatus(str, enum.Enum):
    PENDING = "pending"
    ACTIVE = "active"
    FINISHED = "finished"


class GamePhase(str, enum.Enum):
    DAY = "day"
    NIGHT = "night"


@dataclass(slots=True)
class User:
    id: int
    username: str
    password_hash: str


@dataclass(slots=True)
class Friend:
    id: int
    user_id: int
    name: str
    description: str | None = None
    image: str | None = None


@dataclass(slots=True)
class Game:
    id: int
    host_id: int
    status: GameStatus = GameStatus.PENDING
    current_phase: GamePhase = GamePhase.DAY
    current_round: int = 1
    winning_team: str | None = None


@dataclass(slots=True)
class Player:
    id: int
    game_id: int
    name: str
    role: str | None = None
    is_alive: bool = True
    avatar: str | None = None
    friend_id: int | None = None


@dataclass(slots=True)
class Log:
    id: int
    game_id: int
    round: int
    phase: GamePhase
    message: str
    timestamp: datetime


@dataclass(slots=True)
class GameAggregate:
    game: Game
    players: List[Player] = field(default_factory=list)
    logs: List[Log] = field(default_factory=list)

    @property
    def id(self) -> int:
        return self.game.id

    @property
    def status(self) -> GameStatus:
        return self.game.status

    @property
    def current_phase(self) -> GamePhase:
        return self.game.current_phase

    @property
    def current_round(self) -> int:
        return self.game.current_round

    @property
    def winning_team(self) -> str | None:
        return self.game.winning_team

    @property
    def host_id(self) -> int:
        return self.game.host_id
