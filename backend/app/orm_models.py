from __future__ import annotations

import secrets
import string

from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import declarative_base, relationship

from .models import GamePhase, GameStatus, utc_now

Base = declarative_base()

_GAME_CODE_ALPHABET = string.ascii_uppercase + string.digits


def generate_game_code() -> str:
    """Generate a random 6-character alphanumeric game code (e.g. A3BX7K)."""
    return "".join(secrets.choice(_GAME_CODE_ALPHABET) for _ in range(6))


class UserDb(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password_hash = Column(String)
    public_auto_sync_enabled = Column(Boolean, default=True, nullable=False)


class FriendDb(Base):
    __tablename__ = "friends"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String)
    description = Column(String, nullable=True)
    image = Column(String, nullable=True)
    user = relationship("UserDb")


class GameDb(Base):
    __tablename__ = "games"
    id = Column(String(6), primary_key=True, index=True)
    host_id = Column(Integer, ForeignKey("users.id"))
    status = Column(Enum(GameStatus), default=GameStatus.PENDING)
    current_phase = Column(Enum(GamePhase), default=GamePhase.DAY)
    current_round = Column(Integer, default=1)
    winning_team = Column(String, nullable=True)
    host = relationship("UserDb")
    players = relationship("PlayerDb", back_populates="game")
    logs = relationship("LogDb", back_populates="game")


class PlayerDb(Base):
    __tablename__ = "players"
    id = Column(Integer, primary_key=True, index=True)
    game_id = Column(String(6), ForeignKey("games.id"))
    name = Column(String)
    role = Column(String, nullable=True)
    is_alive = Column(Boolean, default=True)
    public_is_alive = Column(Boolean, default=True, nullable=False)
    avatar = Column(String, nullable=True)
    friend_id = Column(Integer, ForeignKey("friends.id"), nullable=True)
    game = relationship("GameDb", back_populates="players")
    friend = relationship("FriendDb")


class LogDb(Base):
    __tablename__ = "logs"
    id = Column(Integer, primary_key=True, index=True)
    game_id = Column(String(6), ForeignKey("games.id"))
    round = Column(Integer)
    phase = Column(Enum(GamePhase))
    message = Column(String)
    timestamp = Column(DateTime(timezone=True), default=utc_now)
    game = relationship("GameDb", back_populates="logs")


class DemoUserStateDb(Base):
    __tablename__ = "demo_user_state"
    username = Column(String, primary_key=True)
    seeded_at = Column(DateTime, nullable=False)
