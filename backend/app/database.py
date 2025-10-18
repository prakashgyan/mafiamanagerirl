from __future__ import annotations

import os
from collections import defaultdict
from dataclasses import replace
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Protocol, Tuple

from loguru import logger
from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, Enum, ForeignKey
from sqlalchemy.orm import sessionmaker, relationship, Session, joinedload
from sqlalchemy.ext.declarative import declarative_base

from .config import get_settings
from .logging_utils import log_call
from .models import Friend, Game, GameAggregate, GamePhase, GameStatus, Log, Player, User, utc_now

Base = declarative_base()

class UserDb(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password_hash = Column(String)

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
    id = Column(Integer, primary_key=True, index=True)
    host_id = Column(Integer, ForeignKey("users.id"))
    status = Column(Enum(GameStatus), default=GameStatus.PENDING)
    current_phase = Column(Enum(GamePhase), default=GamePhase.DAY)
    current_round = Column(Integer, default=1)
    winning_team = Column(String, nullable=True)
    host = relationship("UserDb")
    players = relationship("PlayerDb", back_populates="game", lazy="joined")
    logs = relationship("LogDb", back_populates="game", lazy="joined")

class PlayerDb(Base):
    __tablename__ = "players"
    id = Column(Integer, primary_key=True, index=True)
    game_id = Column(Integer, ForeignKey("games.id"))
    name = Column(String)
    role = Column(String, nullable=True)
    is_alive = Column(Boolean, default=True)
    avatar = Column(String, nullable=True)
    friend_id = Column(Integer, ForeignKey("friends.id"), nullable=True)
    game = relationship("GameDb", back_populates="players")
    friend = relationship("FriendDb")

class LogDb(Base):
    __tablename__ = "logs"
    id = Column(Integer, primary_key=True, index=True)
    game_id = Column(Integer, ForeignKey("games.id"))
    round = Column(Integer)
    phase = Column(Enum(GamePhase))
    message = Column(String)
    timestamp = Column(DateTime, default=utc_now)
    game = relationship("GameDb", back_populates="logs")


class Datastore(Protocol):
    def get_user_by_username(self, username: str) -> User | None: ...
    def get_user_by_id(self, user_id: int) -> User | None: ...
    def create_user(self, username: str, password_hash: str) -> User: ...
    def list_friends(self, user_id: int) -> List[Friend]: ...
    def create_friend(self, user_id: int, *, name: str, description: str | None, image: str | None) -> Friend: ...
    def delete_friend(self, friend_id: int, user_id: int) -> bool: ...
    def get_friend_for_user(self, friend_id: int, user_id: int) -> Friend | None: ...
    def create_game(
        self,
        host_id: int,
        *,
        status: GameStatus = GameStatus.PENDING,
        current_phase: GamePhase = GamePhase.DAY,
        current_round: int = 1,
        winning_team: str | None = None,
    ) -> Game: ...
    def get_game(self, game_id: int) -> Game | None: ...
    def update_game(self, game_id: int, **changes: Any) -> Game | None: ...
    def update_game_with_log(
        self,
        game_id: int,
        *,
        changes: Dict[str, Any],
        log_round: int,
        log_phase: GamePhase,
        log_message: str,
        timestamp: datetime | None = None,
    ) -> tuple[Game | None, Log | None]: ...
    def list_games(self, host_id: int, status_filter: GameStatus | None = None) -> List[Game]: ...
    def add_player(
        self,
        game_id: int,
        *,
        name: str,
        avatar: str | None,
        friend_id: int | None,
    ) -> Player: ...
    def update_player(self, player_id: int, game_id: int, **changes: Any) -> Player | None: ...
    def get_player(self, game_id: int, player_id: int) -> Player | None: ...
    def list_players(self, game_id: int) -> List[Player]: ...
    def add_log(self, game_id: int, *, round: int, phase: GamePhase, message: str, timestamp: datetime | None = None) -> Log: ...
    def list_logs(self, game_id: int) -> List[Log]: ...
    def get_game_bundle(self, game_id: int) -> GameAggregate | None: ...
    def reset(self) -> None: ...


class PostgresDataStore:
    def __init__(self, session: Session):
        self.session = session
        self._cache_invalidator: Optional[Callable[[int], None]] = None

    def set_cache_invalidator(self, callback: Optional[Callable[[int], None]]) -> None:
        self._cache_invalidator = callback

    def _invalidate_game_cache(self, game_id: int) -> None:
        if self._cache_invalidator is not None:
            try:
                self._cache_invalidator(game_id)
            except Exception as exc:
                logger.exception("Cache invalidation callback failed for game %s: %s", game_id, exc)

    @log_call("datastore.postgres")
    def get_user_by_username(self, username: str) -> User | None:
        user_db = self.session.query(UserDb).filter(UserDb.username == username).first()
        return User.from_orm(user_db) if user_db else None

    @log_call("datastore.postgres")
    def get_user_by_id(self, user_id: int) -> User | None:
        user_db = self.session.query(UserDb).filter(UserDb.id == user_id).first()
        return User.from_orm(user_db) if user_db else None

    @log_call("datastore.postgres")
    def create_user(self, username: str, password_hash: str) -> User:
        user_db = UserDb(username=username, password_hash=password_hash)
        self.session.add(user_db)
        self.session.commit()
        self.session.refresh(user_db)
        return User.from_orm(user_db)

    @log_call("datastore.postgres")
    def list_friends(self, user_id: int) -> List[Friend]:
        friends_db = self.session.query(FriendDb).filter(FriendDb.user_id == user_id).order_by(FriendDb.name).all()
        return [Friend.from_orm(f) for f in friends_db]

    @log_call("datastore.postgres")
    def create_friend(self, user_id: int, *, name: str, description: str | None, image: str | None) -> Friend:
        friend_db = FriendDb(user_id=user_id, name=name, description=description, image=image)
        self.session.add(friend_db)
        self.session.commit()
        self.session.refresh(friend_db)
        return Friend.from_orm(friend_db)

    @log_call("datastore.postgres")
    def delete_friend(self, friend_id: int, user_id: int) -> bool:
        friend_db = self.session.query(FriendDb).filter(FriendDb.id == friend_id, FriendDb.user_id == user_id).first()
        if not friend_db:
            return False
        self.session.delete(friend_db)
        self.session.commit()
        return True

    @log_call("datastore.postgres")
    def get_friend_for_user(self, friend_id: int, user_id: int) -> Friend | None:
        friend_db = self.session.query(FriendDb).filter(FriendDb.id == friend_id, FriendDb.user_id == user_id).first()
        return Friend.from_orm(friend_db) if friend_db else None

    @log_call("datastore.postgres")
    def create_game(
        self,
        host_id: int,
        *,
        status: GameStatus = GameStatus.PENDING,
        current_phase: GamePhase = GamePhase.DAY,
        current_round: int = 1,
        winning_team: str | None = None,
    ) -> Game:
        game_db = GameDb(
            host_id=host_id,
            status=status,
            current_phase=current_phase,
            current_round=current_round,
            winning_team=winning_team,
        )
        self.session.add(game_db)
        self.session.commit()
        self.session.refresh(game_db)
        return Game.from_orm(game_db)

    @log_call("datastore.postgres")
    def get_game(self, game_id: int) -> Game | None:
        game_db = self.session.query(GameDb).filter(GameDb.id == game_id).first()
        return Game.from_orm(game_db) if game_db else None

    @log_call("datastore.postgres")
    def update_game(self, game_id: int, **changes: Any) -> Game | None:
        game_db = self.session.query(GameDb).filter(GameDb.id == game_id).first()
        if not game_db:
            return None
        for key, value in changes.items():
            setattr(game_db, key, value)
        self.session.commit()
        self.session.refresh(game_db)
        self._invalidate_game_cache(game_id)
        return Game.from_orm(game_db)

    @log_call("datastore.postgres")
    def update_game_with_log(
        self,
        game_id: int,
        *,
        changes: Dict[str, Any],
        log_round: int,
        log_phase: GamePhase,
        log_message: str,
        timestamp: datetime | None = None,
    ) -> tuple[Game | None, Log | None]:
        game_db = self.session.query(GameDb).filter(GameDb.id == game_id).first()
        if not game_db:
            return None, None

        for key, value in changes.items():
            setattr(game_db, key, value)

        log_db = LogDb(
            game_id=game_id,
            round=log_round,
            phase=log_phase,
            message=log_message,
            timestamp=timestamp or utc_now(),
        )
        self.session.add(log_db)
        self.session.commit()
        self.session.refresh(game_db)
        self.session.refresh(log_db)

        self._invalidate_game_cache(game_id)
        return Game.from_orm(game_db), Log.from_orm(log_db)

    @log_call("datastore.postgres")
    def list_games(self, host_id: int, status_filter: GameStatus | None = None) -> List[Game]:
        query = self.session.query(GameDb).filter(GameDb.host_id == host_id)
        if status_filter is not None:
            query = query.filter(GameDb.status == status_filter)
        games_db = query.order_by(GameDb.id.desc()).all()
        return [Game.from_orm(g) for g in games_db]

    @log_call("datastore.postgres")
    def add_player(
        self,
        game_id: int,
        *,
        name: str,
        avatar: str | None,
        friend_id: int | None,
    ) -> Player:
        player_db = PlayerDb(
            game_id=game_id,
            name=name,
            avatar=avatar,
            friend_id=friend_id,
        )
        self.session.add(player_db)
        self.session.commit()
        self.session.refresh(player_db)
        self._invalidate_game_cache(game_id)
        return Player.from_orm(player_db)

    @log_call("datastore.postgres")
    def update_player(self, player_id: int, game_id: int, **changes: Any) -> Player | None:
        player_db = self.session.query(PlayerDb).filter(PlayerDb.id == player_id, PlayerDb.game_id == game_id).first()
        if not player_db:
            return None
        for key, value in changes.items():
            setattr(player_db, key, value)
        self.session.commit()
        self.session.refresh(player_db)
        self._invalidate_game_cache(game_id)
        return Player.from_orm(player_db)

    @log_call("datastore.postgres")
    def get_player(self, game_id: int, player_id: int) -> Player | None:
        player_db = self.session.query(PlayerDb).filter(PlayerDb.id == player_id, PlayerDb.game_id == game_id).first()
        return Player.from_orm(player_db) if player_db else None

    @log_call("datastore.postgres")
    def list_players(self, game_id: int) -> List[Player]:
        players_db = self.session.query(PlayerDb).filter(PlayerDb.game_id == game_id).order_by(PlayerDb.id).all()
        return [Player.from_orm(p) for p in players_db]

    @log_call("datastore.postgres")
    def add_log(self, game_id: int, *, round: int, phase: GamePhase, message: str, timestamp: datetime | None = None) -> Log:
        log_db = LogDb(
            game_id=game_id,
            round=round,
            phase=phase,
            message=message,
            timestamp=timestamp or utc_now(),
        )
        self.session.add(log_db)
        self.session.commit()
        self.session.refresh(log_db)
        self._invalidate_game_cache(game_id)
        return Log.from_orm(log_db)

    @log_call("datastore.postgres")
    def list_logs(self, game_id: int) -> List[Log]:
        logs_db = self.session.query(LogDb).filter(LogDb.game_id == game_id).order_by(LogDb.timestamp).all()
        return [Log.from_orm(l) for l in logs_db]

    @log_call("datastore.postgres")
    def get_game_bundle(self, game_id: int) -> GameAggregate | None:
        game_db = self.session.query(GameDb).filter(GameDb.id == game_id).first()
        if not game_db:
            return None
        game = Game.from_orm(game_db)
        players = [Player.from_orm(p) for p in game_db.players]
        logs = [Log.from_orm(l) for l in game_db.logs]
        return GameAggregate(game=game, players=players, logs=logs)

    def reset(self) -> None:
        pass


class InMemoryDataStore:
    def __init__(self) -> None:
        self._cache_invalidator: Optional[Callable[[int], None]] = None
        self.reset()

    @log_call("datastore.memory")
    def reset(self) -> None:
        self._users: Dict[int, User] = {}
        self._usernames: Dict[str, int] = {}
        self._friends: Dict[int, Friend] = {}
        self._games: Dict[int, Game] = {}
        self._players: Dict[int, Player] = {}
        self._logs: Dict[int, Log] = {}
        self._counters: defaultdict[str, int] = defaultdict(int)

    @log_call("datastore.memory")
    def _next_id(self, collection_name: str) -> int:
        self._counters[collection_name] += 1
        return self._counters[collection_name]

    def set_cache_invalidator(self, callback: Optional[Callable[[int], None]]) -> None:
        self._cache_invalidator = callback

    def _invalidate_game_cache(self, game_id: int) -> None:
        if self._cache_invalidator is not None:
            try:
                self._cache_invalidator(game_id)
            except Exception as exc:
                logger.exception("Cache invalidation callback failed for game %s: %s", game_id, exc)

    @log_call("datastore.memory")
    def get_user_by_username(self, username: str) -> User | None:
        user_id = self._usernames.get(username)
        if user_id is None:
            return None
        return self._users.get(user_id)

    @log_call("datastore.memory")
    def get_user_by_id(self, user_id: int) -> User | None:
        return self._users.get(user_id)

    @log_call("datastore.memory")
    def create_user(self, username: str, password_hash: str) -> User:
        if username in self._usernames:
            raise ValueError("Username already exists")
        user_id = self._next_id("users")
        user = User(id=user_id, username=username, password_hash=password_hash)
        self._users[user_id] = user
        self._usernames[username] = user_id
        return user

    @log_call("datastore.memory")
    def list_friends(self, user_id: int) -> List[Friend]:
        friends = [friend for friend in self._friends.values() if friend.user_id == user_id]
        return sorted(friends, key=lambda f: f.name.lower())

    @log_call("datastore.memory")
    def create_friend(self, user_id: int, *, name: str, description: str | None, image: str | None) -> Friend:
        friend_id = self._next_id("friends")
        friend = Friend(id=friend_id, user_id=user_id, name=name, description=description, image=image)
        self._friends[friend_id] = friend
        return friend

    @log_call("datastore.memory")
    def delete_friend(self, friend_id: int, user_id: int) -> bool:
        friend = self._friends.get(friend_id)
        if not friend or friend.user_id != user_id:
            return False
        del self._friends[friend_id]
        return True

    @log_call("datastore.memory")
    def get_friend_for_user(self, friend_id: int, user_id: int) -> Friend | None:
        friend = self._friends.get(friend_id)
        if not friend or friend.user_id != user_id:
            return None
        return friend

    @log_call("datastore.memory")
    def create_game(
        self,
        host_id: int,
        *,
        status: GameStatus = GameStatus.PENDING,
        current_phase: GamePhase = GamePhase.DAY,
        current_round: int = 1,
        winning_team: str | None = None,
    ) -> Game:
        game_id = self._next_id("games")
        game = Game(
            id=game_id,
            host_id=host_id,
            status=status,
            current_phase=current_phase,
            current_round=current_round,
            winning_team=winning_team,
        )
        self._games[game_id] = game
        self._invalidate_game_cache(game_id)
        return game

    @log_call("datastore.memory")
    def get_game(self, game_id: int) -> Game | None:
        return self._games.get(game_id)

    @log_call("datastore.memory")
    def update_game(self, game_id: int, **changes: Any) -> Game | None:
        game = self._games.get(game_id)
        if not game:
            return None

        updated_game = game.model_copy(update=changes)
        self._games[game_id] = updated_game
        self._invalidate_game_cache(game_id)
        return updated_game

    @log_call("datastore.memory")
    def update_game_with_log(
        self,
        game_id: int,
        *,
        changes: Dict[str, Any],
        log_round: int,
        log_phase: GamePhase,
        log_message: str,
        timestamp: datetime | None = None,
    ) -> tuple[Game | None, Log | None]:
        game = self._games.get(game_id)
        if not game:
            return None, None

        updated = game.model_copy(update=changes)
        self._games[game_id] = updated

        log_entry = self.add_log(
            game_id,
            round=log_round,
            phase=log_phase,
            message=log_message,
            timestamp=timestamp,
        )

        self._invalidate_game_cache(game_id)
        return updated, log_entry

    @log_call("datastore.memory")
    def list_games(self, host_id: int, status_filter: GameStatus | None = None) -> List[Game]:
        games = [game for game in self._games.values() if game.host_id == host_id]
        if status_filter is not None:
            games = [game for game in games if game.status == status_filter]
        return sorted(games, key=lambda g: g.id, reverse=True)

    @log_call("datastore.memory")
    def add_player(self, game_id: int, *, name: str, avatar: str | None, friend_id: int | None) -> Player:
        player_id = self._next_id("players")
        player = Player(
            id=player_id,
            game_id=game_id,
            name=name,
            role=None,
            is_alive=True,
            avatar=avatar,
            friend_id=friend_id,
        )
        self._players[player_id] = player
        self._invalidate_game_cache(game_id)
        return player

    @log_call("datastore.memory")
    def update_player(self, player_id: int, game_id: int, **changes: Any) -> Player | None:
        player = self._players.get(player_id)
        if not player or player.game_id != game_id:
            return None

        updated_player = player.model_copy(update=changes)
        self._players[player_id] = updated_player
        self._invalidate_game_cache(game_id)
        return updated_player

    @log_call("datastore.memory")
    def get_player(self, game_id: int, player_id: int) -> Player | None:
        player = self._players.get(player_id)
        if not player or player.game_id != game_id:
            return None
        return player

    @log_call("datastore.memory")
    def list_players(self, game_id: int) -> List[Player]:
        players = [player for player in self._players.values() if player.game_id == game_id]
        return sorted(players, key=lambda p: p.id)

    @log_call("datastore.memory")
    def add_log(self, game_id: int, *, round: int, phase: GamePhase, message: str, timestamp: datetime | None = None) -> Log:
        log_id = self._next_id("logs")
        ts = timestamp or utc_now()
        log = Log(
            id=log_id,
            game_id=game_id,
            round=round,
            phase=phase,
            message=message,
            timestamp=ts,
        )
        self._logs[log_id] = log
        self._invalidate_game_cache(game_id)
        return log

    @log_call("datastore.memory")
    def list_logs(self, game_id: int) -> List[Log]:
        logs = [log for log in self._logs.values() if log.game_id == game_id]
        return sorted(logs, key=lambda l: (l.timestamp, l.id))

    @log_call("datastore.memory")
    def get_game_bundle(self, game_id: int) -> GameAggregate | None:
        game = self._games.get(game_id)
        if not game:
            return None
        players = self.list_players(game_id)
        logs = self.list_logs(game_id)
        return GameAggregate(game=game, players=players, logs=logs)

_engine = None
SessionLocal = None

def init_db():
    global _engine, SessionLocal
    settings = get_settings()
    _engine = create_engine(settings.database_url)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)
    Base.metadata.create_all(bind=_engine)

def get_db():
    if SessionLocal is None:
        raise Exception("Database not initialized. Call init_db() first.")
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

_in_memory_datastore = InMemoryDataStore()

def get_datastore(db: Session = None) -> Datastore:
    settings = get_settings()
    if settings.environment == "test":
        return _in_memory_datastore
    if db:
        return PostgresDataStore(db)
    raise Exception("No database session provided in non-test environment")