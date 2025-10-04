from __future__ import annotations

import os
from collections import defaultdict
from dataclasses import replace
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Protocol, Tuple

from loguru import logger

from google.cloud import firestore
from google.cloud.firestore import Increment
from google.oauth2 import service_account

from .config import get_settings
from .logging_utils import log_call
from .models import Friend, Game, GameAggregate, GamePhase, GameStatus, Log, Player, User, utc_now

COUNTERS_COLLECTION = "counters"
USERS_COLLECTION = "users"
FRIENDS_COLLECTION = "friends"
GAMES_COLLECTION = "games"
PLAYERS_COLLECTION = "players"
LOGS_COLLECTION = "logs"
ID_ALLOCATION_BLOCK_SIZE = 20


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


class FirestoreDataStore:
    def __init__(self, client: firestore.Client) -> None:
        self.client = client
        self._counters = client.collection(COUNTERS_COLLECTION)
        self._id_cache: Dict[str, Tuple[int, int]] = {}
        self._cache_invalidator: Optional[Callable[[int], None]] = None

    @classmethod
    @log_call("firestore")
    def from_settings(cls, settings) -> "FirestoreDataStore":
        credentials_path = Path(settings.firestore_credentials_file)
        if not credentials_path.is_absolute():
            base_dir = Path(__file__).resolve().parents[2]
            credentials_path = (base_dir / credentials_path).resolve()

        credentials = None
        if settings.firestore_emulator_host:
            os.environ.setdefault("FIRESTORE_EMULATOR_HOST", settings.firestore_emulator_host)
            logger.info(
                "Connecting to Firestore emulator at {} for database {}",
                settings.firestore_emulator_host,
                settings.firestore_database,
            )
        else:
            if not credentials_path.exists():
                raise FileNotFoundError(
                    "Firestore credentials file not found at " f"{credentials_path}. Update APP_FIRESTORE_CREDENTIALS_FILE."
                )
            os.environ.setdefault("GOOGLE_APPLICATION_CREDENTIALS", str(credentials_path))
            credentials = service_account.Credentials.from_service_account_file(str(credentials_path))
            logger.info(
                "Connecting to Firestore project {} (database={}) with service account",
                settings.firestore_project_id,
                settings.firestore_database,
            )

        client = firestore.Client(project=settings.firestore_project_id, credentials=credentials, database=settings.firestore_database)
        return cls(client)

    def set_cache_invalidator(self, callback: Optional[Callable[[int], None]]) -> None:
        self._cache_invalidator = callback

    def _invalidate_game_cache(self, game_id: int) -> None:
        if self._cache_invalidator is not None:
            try:
                self._cache_invalidator(game_id)
            except Exception as exc:
                logger.exception("Cache invalidation callback failed for game %s: %s", game_id, exc)

    @log_call("firestore")
    def get_user_by_username(self, username: str) -> User | None:
        query = (
            self.client.collection(USERS_COLLECTION).where(filter=firestore.FieldFilter("username", "==", username)).limit(1).stream()
        )
        for doc in query:
            return self._doc_to_user(doc)
        return None

    @log_call("firestore")
    def get_user_by_id(self, user_id: int) -> User | None:
        doc = self.client.collection(USERS_COLLECTION).document(str(user_id)).get()
        if not doc.exists:
            return None
        return self._doc_to_user(doc)

    @log_call("firestore")
    def create_user(self, username: str, password_hash: str) -> User:
        user_id = self._next_id(USERS_COLLECTION)
        data = {
            "id": user_id,
            "username": username,
            "password_hash": password_hash,
        }
        self.client.collection(USERS_COLLECTION).document(str(user_id)).set(data)
        return User(**data)

    @log_call("firestore")
    def list_friends(self, user_id: int) -> List[Friend]:
        friends_ref = self.client.collection(FRIENDS_COLLECTION)
        docs = friends_ref.where(filter=firestore.FieldFilter("user_id", "==", user_id)).order_by("name").stream()
        return [self._doc_to_friend(doc) for doc in docs]

    @log_call("firestore")
    def create_friend(self, user_id: int, *, name: str, description: str | None, image: str | None) -> Friend:
        friend_id = self._next_id(FRIENDS_COLLECTION)
        data = {
            "id": friend_id,
            "user_id": user_id,
            "name": name,
            "description": description,
            "image": image,
        }
        self.client.collection(FRIENDS_COLLECTION).document(str(friend_id)).set(data)
        return Friend(**data)

    @log_call("firestore")
    def delete_friend(self, friend_id: int, user_id: int) -> bool:
        doc_ref = self.client.collection(FRIENDS_COLLECTION).document(str(friend_id))
        doc = doc_ref.get()
        if not doc.exists:
            return False
        data = doc.to_dict() or {}
        if data.get("user_id") != user_id:
            return False
        doc_ref.delete()
        return True

    @log_call("firestore")
    def get_friend_for_user(self, friend_id: int, user_id: int) -> Friend | None:
        doc = self.client.collection(FRIENDS_COLLECTION).document(str(friend_id)).get()
        if not doc.exists:
            return None
        friend = self._doc_to_friend(doc)
        if friend.user_id != user_id:
            return None
        return friend

    @log_call("firestore")
    def create_game(
        self,
        host_id: int,
        *,
        status: GameStatus = GameStatus.PENDING,
        current_phase: GamePhase = GamePhase.DAY,
        current_round: int = 1,
        winning_team: str | None = None,
    ) -> Game:
        game_id = self._next_id(GAMES_COLLECTION)
        data = {
            "id": game_id,
            "host_id": host_id,
            "status": status.value,
            "current_phase": current_phase.value,
            "current_round": current_round,
            "winning_team": winning_team,
        }
        self.client.collection(GAMES_COLLECTION).document(str(game_id)).set(data)
        return self._doc_to_game_dict(data)

    @log_call("firestore")
    def get_game(self, game_id: int) -> Game | None:
        doc = self.client.collection(GAMES_COLLECTION).document(str(game_id)).get()
        if not doc.exists:
            return None
        return self._doc_to_game(doc)

    @log_call("firestore")
    def update_game(self, game_id: int, **changes: Any) -> Game | None:
        doc_ref = self.client.collection(GAMES_COLLECTION).document(str(game_id))
        snapshot = doc_ref.get()
        if not snapshot.exists:
            return None

        data = snapshot.to_dict() or {}

        update_fields: Dict[str, Any] = {}
        for key, value in changes.items():
            if value is None:
                update_fields[key] = None
            elif isinstance(value, (GameStatus, GamePhase)):
                update_fields[key] = value.value
            else:
                update_fields[key] = value

        if update_fields:
            doc_ref.update(update_fields)
            data.update(update_fields)

        updated_game = self._doc_to_game_dict(data)
        self._invalidate_game_cache(game_id)
        return updated_game

    @log_call("firestore")
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
        transaction = self.client.transaction()

        @firestore.transactional
        def apply(transaction):
            game_ref = self.client.collection(GAMES_COLLECTION).document(str(game_id))
            game_doc = game_ref.get(transaction=transaction)
            if not game_doc.exists:
                return None
            data = game_doc.to_dict()
            data.update(changes)
            transaction.update(game_ref, changes)

            ts = timestamp or utc_now()
            log_id = self._next_id(LOGS_COLLECTION)
            log_data = {
                "id": log_id,
                "game_id": game_id,
                "round": log_round,
                "phase": log_phase.value,
                "message": log_message,
                "timestamp": ts,
            }
            log_ref = self.client.collection(LOGS_COLLECTION).document(str(log_id))
            transaction.set(log_ref, log_data)

            updated_game = self._doc_to_game_dict(data)
            log_entry = self._doc_to_log_dict(log_data)
            return updated_game, log_entry

        result = apply(transaction)
        if result is None:
            return None, None

        updated_game, log_entry = result
        self._invalidate_game_cache(game_id)
        return updated_game, log_entry

    @log_call("firestore")
    def list_games(self, host_id: int, status_filter: GameStatus | None = None) -> List[Game]:
        games_ref = self.client.collection(GAMES_COLLECTION).where(filter=firestore.FieldFilter("host_id", "==", host_id))
        if status_filter is not None:
            games_ref = games_ref.where(filter=firestore.FieldFilter("status", "==", status_filter.value))
        docs = games_ref.order_by("id", direction=firestore.Query.DESCENDING).stream()
        return [self._doc_to_game(doc) for doc in docs]

    @log_call("firestore")
    def add_player(
        self,
        game_id: int,
        *,
        name: str,
        avatar: str | None,
        friend_id: int | None,
    ) -> Player:
        player_id = self._next_id(PLAYERS_COLLECTION)
        data = {
            "id": player_id,
            "game_id": game_id,
            "name": name,
            "role": None,
            "is_alive": True,
            "avatar": avatar,
            "friend_id": friend_id,
        }
        self.client.collection(PLAYERS_COLLECTION).document(str(player_id)).set(data)
        player = self._doc_to_player_dict(data)
        self._invalidate_game_cache(game_id)
        return player

    @log_call("firestore")
    def update_player(self, player_id: int, game_id: int, **changes: Any) -> Player | None:
        doc_ref = self.client.collection(PLAYERS_COLLECTION).document(str(player_id))
        snapshot = doc_ref.get()
        if not snapshot.exists:
            return None
        data = snapshot.to_dict() or {}
        if data.get("game_id") != game_id:
            return None

        update_fields = {k: v for k, v in changes.items()}
        if update_fields:
            doc_ref.update(update_fields)
        updated_player = self._doc_to_player(doc_ref.get())
        self._invalidate_game_cache(game_id)
        return updated_player

    @log_call("firestore")
    def get_player(self, game_id: int, player_id: int) -> Player | None:
        doc = self.client.collection(PLAYERS_COLLECTION).document(str(player_id)).get()
        if not doc.exists:
            return None
        player = self._doc_to_player(doc)
        if player.game_id != game_id:
            return None
        return player

    @log_call("firestore")
    def list_players(self, game_id: int) -> List[Player]:
        docs = (
            self.client.collection(PLAYERS_COLLECTION)
            .where(filter=firestore.FieldFilter("game_id", "==", game_id))
            .order_by("id")
            .stream()
        )
        return [self._doc_to_player(doc) for doc in docs]

    @log_call("firestore")
    def add_log(self, game_id: int, *, round: int, phase: GamePhase, message: str, timestamp: datetime | None = None) -> Log:
        log_id = self._next_id(LOGS_COLLECTION)
        ts = timestamp or utc_now()
        data = {
            "id": log_id,
            "game_id": game_id,
            "round": round,
            "phase": phase.value,
            "message": message,
            "timestamp": ts,
        }
        self.client.collection(LOGS_COLLECTION).document(str(log_id)).set(data)
        log = self._doc_to_log_dict(data)
        self._invalidate_game_cache(game_id)
        return log

    @log_call("firestore")
    def list_logs(self, game_id: int) -> List[Log]:
        docs = (
            self.client.collection(LOGS_COLLECTION)
            .where(filter=firestore.FieldFilter("game_id", "==", game_id))
            .order_by("timestamp")
            .stream()
        )
        return [self._doc_to_log(doc) for doc in docs]

    @log_call("firestore")
    def get_game_bundle(self, game_id: int) -> GameAggregate | None:
        game = self.get_game(game_id)
        if not game:
            return None
        players = self.list_players(game_id)
        logs = self.list_logs(game_id)
        return GameAggregate(game=game, players=players, logs=logs)

    @log_call("firestore")
    def _next_id(self, collection_name: str) -> int:
        next_id, max_id = self._id_cache.get(collection_name, (0, -1))
        if next_id <= max_id:
            self._id_cache[collection_name] = (next_id + 1, max_id)
            return next_id

        start, end = self._allocate_id_block(collection_name)
        self._id_cache[collection_name] = (start + 1, end)
        return start

    def _allocate_id_block(self, collection_name: str) -> Tuple[int, int]:
        block_size = ID_ALLOCATION_BLOCK_SIZE
        counter_ref = self._counters.document(collection_name)
        counter_ref.set({"value": Increment(block_size)}, merge=True)
        snapshot = counter_ref.get()
        value = snapshot.get("value") if snapshot.exists else None
        if value is None:
            counter_ref.set({"value": block_size})
            return (1, block_size)
        end_value = int(value)
        start_value = max(1, end_value - block_size + 1)
        return (start_value, end_value)

    @staticmethod
    def _doc_to_user(doc) -> User:
        data = doc.to_dict() or {}
        return User(
            id=int(data["id"]),
            username=data["username"],
            password_hash=data["password_hash"],
        )

    @staticmethod
    def _doc_to_friend(doc) -> Friend:
        data = doc.to_dict() or {}
        return Friend(
            id=int(data["id"]),
            user_id=int(data["user_id"]),
            name=data["name"],
            description=data.get("description"),
            image=data.get("image"),
        )

    @staticmethod
    def _doc_to_game(doc) -> Game:
        data = doc.to_dict() or {}
        return FirestoreDataStore._doc_to_game_dict(data)

    @staticmethod
    def _doc_to_game_dict(data: Dict[str, Any]) -> Game:
        status = GameStatus(data.get("status", GameStatus.PENDING.value))
        phase = GamePhase(data.get("current_phase", GamePhase.DAY.value))
        return Game(
            id=int(data["id"]),
            host_id=int(data["host_id"]),
            status=status,
            current_phase=phase,
            current_round=int(data.get("current_round", 1)),
            winning_team=data.get("winning_team"),
        )

    @staticmethod
    def _doc_to_player(doc) -> Player:
        data = doc.to_dict() or {}
        return FirestoreDataStore._doc_to_player_dict(data)

    @staticmethod
    def _doc_to_player_dict(data: Dict[str, Any]) -> Player:
        return Player(
            id=int(data["id"]),
            game_id=int(data["game_id"]),
            name=data["name"],
            role=data.get("role"),
            is_alive=bool(data.get("is_alive", True)),
            avatar=data.get("avatar"),
            friend_id=(int(data["friend_id"]) if data.get("friend_id") is not None else None),
        )

    @staticmethod
    def _doc_to_log(doc) -> Log:
        data = doc.to_dict() or {}
        return FirestoreDataStore._doc_to_log_dict(data)

    @staticmethod
    def _doc_to_log_dict(data: Dict[str, Any]) -> Log:
        phase = GamePhase(data.get("phase", GamePhase.DAY.value))
        timestamp = data.get("timestamp")
        if isinstance(timestamp, datetime):
            ts = timestamp
        elif isinstance(timestamp, str):
            ts = datetime.fromisoformat(timestamp)
        else:
            raise ValueError("Invalid log timestamp stored in Firestore")
        return Log(
            id=int(data["id"]),
            game_id=int(data["game_id"]),
            round=int(data.get("round", 1)),
            phase=phase,
            message=data.get("message", ""),
            timestamp=ts,
        )


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
        user_id = self._next_id(USERS_COLLECTION)
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
        friend_id = self._next_id(FRIENDS_COLLECTION)
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
        game_id = self._next_id(GAMES_COLLECTION)
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
        updated = replace(game, **changes)
        self._games[game_id] = updated
        self._invalidate_game_cache(game_id)
        return updated

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

        updated = replace(game, **changes)
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
        player_id = self._next_id(PLAYERS_COLLECTION)
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
        updated = replace(player, **changes)
        self._players[player_id] = updated
        self._invalidate_game_cache(game_id)
        return updated

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
        log_id = self._next_id(LOGS_COLLECTION)
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


def get_datastore() -> FirestoreDataStore:
    global _firestore_datastore
    if _firestore_datastore is None:
        settings = get_settings()
        logger.debug("Initializing Firestore datastore for project={}", settings.firestore_project_id)
        _firestore_datastore = FirestoreDataStore.from_settings(settings)
    assert _firestore_datastore is not None
    return _firestore_datastore


_firestore_datastore: FirestoreDataStore | None = None

