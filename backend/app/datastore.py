from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional, Protocol

from loguru import logger
from sqlalchemy import delete, select
from sqlalchemy.orm import Session, joinedload

from .logging_utils import log_call
from .models import Friend, Game, GameAggregate, GamePhase, GameStatus, Log, Player, User, utc_now
from .orm_models import (
    FriendDb,
    GameDb,
    LogDb,
    PlayerDb,
    UserDb,
    generate_game_code,
)


class Datastore(Protocol):
    def get_user_by_username(self, username: str) -> User | None: ...
    def get_user_by_id(self, user_id: int) -> User | None: ...
    def create_user(self, username: str, password_hash: str) -> User: ...
    def update_user(self, user_id: int, **changes: Any) -> User | None: ...
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
    def get_game(self, game_id: str) -> Game | None: ...
    def update_game(self, game_id: str, **changes: Any) -> Game | None: ...
    def update_game_with_log(
        self,
        game_id: str,
        *,
        changes: Dict[str, Any],
        log_round: int,
        log_phase: GamePhase,
        log_message: str,
        timestamp: datetime | None = None,
    ) -> tuple[Game | None, Log | None]: ...
    def list_games(self, host_id: int, status_filter: GameStatus | None = None) -> List[Game]: ...
    def delete_game(self, game_id: str, host_id: int) -> bool: ...
    def add_player(
        self,
        game_id: str,
        *,
        name: str,
        avatar: str | None,
        friend_id: int | None,
    ) -> Player: ...
    def update_player(self, player_id: int, game_id: str, **changes: Any) -> Player | None: ...
    def get_player(self, game_id: str, player_id: int) -> Player | None: ...
    def list_players(self, game_id: str) -> List[Player]: ...
    def add_log(self, game_id: str, *, round: int, phase: GamePhase, message: str, timestamp: datetime | None = None) -> Log: ...
    def list_logs(self, game_id: str) -> List[Log]: ...
    def get_game_bundle(self, game_id: str) -> GameAggregate | None: ...
    def reset_user_data(self, user_id: int) -> None: ...
    def reset(self) -> None: ...


class PostgresDataStore:
    def __init__(self, session: Session):
        self.session = session
        self._cache_invalidator: Optional[Callable[[str], None]] = None

    def set_cache_invalidator(self, callback: Optional[Callable[[str], None]]) -> None:
        self._cache_invalidator = callback

    def _invalidate_game_cache(self, game_id: str) -> None:
        if self._cache_invalidator is not None:
            try:
                self._cache_invalidator(game_id)
            except Exception as exc:
                logger.exception("Cache invalidation callback failed for game %s: %s", game_id, exc)

    @log_call("datastore.postgres")
    def get_user_by_username(self, username: str) -> User | None:
        user_db = self.session.execute(select(UserDb).where(UserDb.username == username)).scalar_one_or_none()
        return User.model_validate(user_db) if user_db else None

    @log_call("datastore.postgres")
    def get_user_by_id(self, user_id: int) -> User | None:
        user_db = self.session.execute(select(UserDb).where(UserDb.id == user_id)).scalar_one_or_none()
        return User.model_validate(user_db) if user_db else None

    @log_call("datastore.postgres")
    def create_user(self, username: str, password_hash: str) -> User:
        user_db = UserDb(username=username, password_hash=password_hash)
        self.session.add(user_db)
        self.session.commit()
        self.session.refresh(user_db)
        return User.model_validate(user_db)

    @log_call("datastore.postgres")
    def update_user(self, user_id: int, **changes: Any) -> User | None:
        user_db = self.session.execute(select(UserDb).where(UserDb.id == user_id)).scalar_one_or_none()
        if not user_db:
            return None
        for key, value in changes.items():
            setattr(user_db, key, value)
        self.session.commit()
        self.session.refresh(user_db)
        return User.model_validate(user_db)

    @log_call("datastore.postgres")
    def list_friends(self, user_id: int) -> List[Friend]:
        friends_db = self.session.execute(
            select(FriendDb).where(FriendDb.user_id == user_id).order_by(FriendDb.name)
        ).scalars().all()
        return [Friend.model_validate(f) for f in friends_db]

    @log_call("datastore.postgres")
    def create_friend(self, user_id: int, *, name: str, description: str | None, image: str | None) -> Friend:
        friend_db = FriendDb(user_id=user_id, name=name, description=description, image=image)
        self.session.add(friend_db)
        self.session.commit()
        self.session.refresh(friend_db)
        return Friend.model_validate(friend_db)

    @log_call("datastore.postgres")
    def delete_friend(self, friend_id: int, user_id: int) -> bool:
        friend_db = self.session.execute(
            select(FriendDb).where(FriendDb.id == friend_id, FriendDb.user_id == user_id)
        ).scalar_one_or_none()
        if not friend_db:
            return False
        self.session.delete(friend_db)
        self.session.commit()
        return True

    @log_call("datastore.postgres")
    def get_friend_for_user(self, friend_id: int, user_id: int) -> Friend | None:
        friend_db = self.session.execute(
            select(FriendDb).where(FriendDb.id == friend_id, FriendDb.user_id == user_id)
        ).scalar_one_or_none()
        return Friend.model_validate(friend_db) if friend_db else None

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
            id=generate_game_code(),
            host_id=host_id,
            status=status,
            current_phase=current_phase,
            current_round=current_round,
            winning_team=winning_team,
        )
        self.session.add(game_db)
        self.session.commit()
        self.session.refresh(game_db)
        return Game.model_validate(game_db)

    @log_call("datastore.postgres")
    def get_game(self, game_id: str) -> Game | None:
        game_db = self.session.execute(select(GameDb).where(GameDb.id == game_id)).scalar_one_or_none()
        return Game.model_validate(game_db) if game_db else None

    @log_call("datastore.postgres")
    def update_game(self, game_id: str, **changes: Any) -> Game | None:
        game_db = self.session.execute(select(GameDb).where(GameDb.id == game_id)).scalar_one_or_none()
        if not game_db:
            return None
        for key, value in changes.items():
            setattr(game_db, key, value)
        self.session.commit()
        self.session.refresh(game_db)
        self._invalidate_game_cache(game_id)
        return Game.model_validate(game_db)

    @log_call("datastore.postgres")
    def update_game_with_log(
        self,
        game_id: str,
        *,
        changes: Dict[str, Any],
        log_round: int,
        log_phase: GamePhase,
        log_message: str,
        timestamp: datetime | None = None,
    ) -> tuple[Game | None, Log | None]:
        game_db = self.session.execute(select(GameDb).where(GameDb.id == game_id)).scalar_one_or_none()
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
        return Game.model_validate(game_db), Log.model_validate(log_db)

    @log_call("datastore.postgres")
    def list_games(self, host_id: int, status_filter: GameStatus | None = None) -> List[Game]:
        stmt = select(GameDb).where(GameDb.host_id == host_id).order_by(GameDb.id.desc())
        if status_filter is not None:
            stmt = stmt.where(GameDb.status == status_filter)
        games_db = self.session.execute(stmt).scalars().all()
        return [Game.model_validate(g) for g in games_db]

    @log_call("datastore.postgres")
    def delete_game(self, game_id: str, host_id: int) -> bool:
        game_db = self.session.execute(
            select(GameDb).where(GameDb.id == game_id, GameDb.host_id == host_id)
        ).scalar_one_or_none()
        if not game_db:
            return False
        self.session.execute(delete(PlayerDb).where(PlayerDb.game_id == game_id))
        self.session.execute(delete(LogDb).where(LogDb.game_id == game_id))
        self.session.delete(game_db)
        self.session.commit()
        self._invalidate_game_cache(game_id)
        return True

    @log_call("datastore.postgres")
    def add_player(
        self,
        game_id: str,
        *,
        name: str,
        avatar: str | None,
        friend_id: int | None,
    ) -> Player:
        player_db = PlayerDb(
            game_id=game_id,
            name=name,
            is_alive=True,
            public_is_alive=True,
            avatar=avatar,
            friend_id=friend_id,
        )
        self.session.add(player_db)
        self.session.commit()
        self.session.refresh(player_db)
        self._invalidate_game_cache(game_id)
        return Player.model_validate(player_db)

    @log_call("datastore.postgres")
    def update_player(self, player_id: int, game_id: str, **changes: Any) -> Player | None:
        player_db = self.session.execute(
            select(PlayerDb).where(PlayerDb.id == player_id, PlayerDb.game_id == game_id)
        ).scalar_one_or_none()
        if not player_db:
            return None
        for key, value in changes.items():
            setattr(player_db, key, value)
        self.session.commit()
        self.session.refresh(player_db)
        self._invalidate_game_cache(game_id)
        return Player.model_validate(player_db)

    @log_call("datastore.postgres")
    def get_player(self, game_id: str, player_id: int) -> Player | None:
        player_db = self.session.execute(
            select(PlayerDb).where(PlayerDb.id == player_id, PlayerDb.game_id == game_id)
        ).scalar_one_or_none()
        return Player.model_validate(player_db) if player_db else None

    @log_call("datastore.postgres")
    def list_players(self, game_id: str) -> List[Player]:
        players_db = self.session.execute(
            select(PlayerDb).where(PlayerDb.game_id == game_id).order_by(PlayerDb.id)
        ).scalars().all()
        return [Player.model_validate(p) for p in players_db]

    @log_call("datastore.postgres")
    def add_log(self, game_id: str, *, round: int, phase: GamePhase, message: str, timestamp: datetime | None = None) -> Log:
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
        return Log.model_validate(log_db)

    @log_call("datastore.postgres")
    def list_logs(self, game_id: str) -> List[Log]:
        logs_db = self.session.execute(
            select(LogDb).where(LogDb.game_id == game_id).order_by(LogDb.timestamp)
        ).scalars().all()
        return [Log.model_validate(l) for l in logs_db]

    @log_call("datastore.postgres")
    def get_game_bundle(self, game_id: str) -> GameAggregate | None:
        game_db = self.session.execute(
            select(GameDb)
            .options(joinedload(GameDb.players), joinedload(GameDb.logs))
            .where(GameDb.id == game_id)
        ).unique().scalar_one_or_none()
        if not game_db:
            return None
        game = Game.model_validate(game_db)
        players = [Player.model_validate(p) for p in game_db.players]
        logs = [Log.model_validate(l) for l in game_db.logs]
        return GameAggregate(game=game, players=players, logs=logs)

    @log_call("datastore.postgres")
    def reset_user_data(self, user_id: int) -> None:
        game_ids = self.session.execute(
            select(GameDb.id).where(GameDb.host_id == user_id)
        ).scalars().all()
        if game_ids:
            self.session.execute(delete(PlayerDb).where(PlayerDb.game_id.in_(game_ids)))
            self.session.execute(delete(LogDb).where(LogDb.game_id.in_(game_ids)))
            self.session.execute(delete(GameDb).where(GameDb.id.in_(game_ids)))
        self.session.execute(delete(FriendDb).where(FriendDb.user_id == user_id))
        self.session.commit()

    def reset(self) -> None:
        pass


class InMemoryDataStore:
    def __init__(self) -> None:
        self._cache_invalidator: Optional[Callable[[str], None]] = None
        self.reset()

    @log_call("datastore.memory")
    def reset(self) -> None:
        self._users: Dict[int, User] = {}
        self._usernames: Dict[str, int] = {}
        self._friends: Dict[int, Friend] = {}
        self._games: Dict[str, Game] = {}
        self._players: Dict[int, Player] = {}
        self._logs: Dict[int, Log] = {}
        self._counters: defaultdict[str, int] = defaultdict(int)

    @log_call("datastore.memory")
    def _next_id(self, collection_name: str) -> int:
        self._counters[collection_name] += 1
        return self._counters[collection_name]

    def set_cache_invalidator(self, callback: Optional[Callable[[str], None]]) -> None:
        self._cache_invalidator = callback

    def _invalidate_game_cache(self, game_id: str) -> None:
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
    def update_user(self, user_id: int, **changes: Any) -> User | None:
        user = self._users.get(user_id)
        if not user:
            return None
        updated_user = user.model_copy(update=changes)
        self._users[user_id] = updated_user
        return updated_user

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
        game_id = generate_game_code()
        game = Game(
            id=game_id,
            host_id=host_id,
            status=status,
            current_phase=current_phase,
            current_round=current_round,
            winning_team=winning_team,
            created_at=utc_now(),
        )
        self._games[game_id] = game
        self._invalidate_game_cache(game_id)
        return game

    @log_call("datastore.memory")
    def get_game(self, game_id: str) -> Game | None:
        return self._games.get(game_id)

    @log_call("datastore.memory")
    def update_game(self, game_id: str, **changes: Any) -> Game | None:
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
        game_id: str,
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
    def delete_game(self, game_id: str, host_id: int) -> bool:
        game = self._games.get(game_id)
        if not game or game.host_id != host_id:
            return False
        self._players = {pid: p for pid, p in self._players.items() if p.game_id != game_id}
        self._logs = {lid: l for lid, l in self._logs.items() if l.game_id != game_id}
        del self._games[game_id]
        self._invalidate_game_cache(game_id)
        return True

    @log_call("datastore.memory")
    def add_player(self, game_id: str, *, name: str, avatar: str | None, friend_id: int | None) -> Player:
        player_id = self._next_id("players")
        player = Player(
            id=player_id,
            game_id=game_id,
            name=name,
            role=None,
            is_alive=True,
            public_is_alive=True,
            avatar=avatar,
            friend_id=friend_id,
        )
        self._players[player_id] = player
        self._invalidate_game_cache(game_id)
        return player

    @log_call("datastore.memory")
    def update_player(self, player_id: int, game_id: str, **changes: Any) -> Player | None:
        player = self._players.get(player_id)
        if not player or player.game_id != game_id:
            return None
        updated_player = player.model_copy(update=changes)
        self._players[player_id] = updated_player
        self._invalidate_game_cache(game_id)
        return updated_player

    @log_call("datastore.memory")
    def get_player(self, game_id: str, player_id: int) -> Player | None:
        player = self._players.get(player_id)
        if not player or player.game_id != game_id:
            return None
        return player

    @log_call("datastore.memory")
    def list_players(self, game_id: str) -> List[Player]:
        players = [player for player in self._players.values() if player.game_id == game_id]
        return sorted(players, key=lambda p: p.id)

    @log_call("datastore.memory")
    def add_log(self, game_id: str, *, round: int, phase: GamePhase, message: str, timestamp: datetime | None = None) -> Log:
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
    def list_logs(self, game_id: str) -> List[Log]:
        logs = [log for log in self._logs.values() if log.game_id == game_id]
        return sorted(logs, key=lambda l: (l.timestamp, l.id))

    @log_call("datastore.memory")
    def get_game_bundle(self, game_id: str) -> GameAggregate | None:
        game = self._games.get(game_id)
        if not game:
            return None
        players = self.list_players(game_id)
        logs = self.list_logs(game_id)
        return GameAggregate(game=game, players=players, logs=logs)

    @log_call("datastore.memory")
    def reset_user_data(self, user_id: int) -> None:
        game_ids = {g.id for g in self._games.values() if g.host_id == user_id}
        self._players = {pid: p for pid, p in self._players.items() if p.game_id not in game_ids}
        self._logs = {lid: l for lid, l in self._logs.items() if l.game_id not in game_ids}
        self._games = {gid: g for gid, g in self._games.items() if gid not in game_ids}
        self._friends = {fid: f for fid, f in self._friends.items() if f.user_id != user_id}
