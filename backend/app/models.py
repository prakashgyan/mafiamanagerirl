from __future__ import annotations

import enum
from datetime import UTC, datetime

from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utc_now() -> datetime:
    return datetime.now(UTC)


class GameStatus(str, enum.Enum):
    PENDING = "pending"
    ACTIVE = "active"
    FINISHED = "finished"


class GamePhase(str, enum.Enum):
    DAY = "day"
    NIGHT = "night"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)

    friends: Mapped[list["Friend"]] = relationship(back_populates="owner", cascade="all, delete-orphan")
    games: Mapped[list["Game"]] = relationship(back_populates="host")


class Friend(Base):
    __tablename__ = "friends"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    image: Mapped[str | None] = mapped_column(String(255), nullable=True)

    owner: Mapped[User] = relationship(back_populates="friends")


class Game(Base):
    __tablename__ = "games"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    host_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[GameStatus] = mapped_column(Enum(GameStatus), default=GameStatus.PENDING, nullable=False)
    current_phase: Mapped[GamePhase] = mapped_column(Enum(GamePhase), default=GamePhase.DAY, nullable=False)
    current_round: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    winning_team: Mapped[str | None] = mapped_column(String(50), nullable=True)

    host: Mapped[User] = relationship(back_populates="games")
    players: Mapped[list["Player"]] = relationship(back_populates="game", cascade="all, delete-orphan")
    logs: Mapped[list["Log"]] = relationship(back_populates="game", cascade="all, delete-orphan", order_by="Log.timestamp")


class Player(Base):
    __tablename__ = "players"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    game_id: Mapped[int] = mapped_column(ForeignKey("games.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_alive: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    game: Mapped[Game] = relationship(back_populates="players")


class Log(Base):
    __tablename__ = "logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    game_id: Mapped[int] = mapped_column(ForeignKey("games.id", ondelete="CASCADE"), nullable=False)
    round: Mapped[int] = mapped_column(Integer, nullable=False)
    phase: Mapped[GamePhase] = mapped_column(Enum(GamePhase), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)

    game: Mapped[Game] = relationship(back_populates="logs")
