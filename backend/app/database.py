from __future__ import annotations

import os
from collections import defaultdict
from dataclasses import replace
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

from google.cloud import firestore
from google.cloud.firestore import Increment
from google.oauth2 import service_account

from .config import get_settings
from .models import Friend, Game, GameAggregate, GamePhase, GameStatus, Log, Player, User

COUNTERS_COLLECTION = "counters"
USERS_COLLECTION = "users"
FRIENDS_COLLECTION = "friends"
GAMES_COLLECTION = "games"
PLAYERS_COLLECTION = "players"
LOGS_COLLECTION = "logs"


class FirestoreDataStore:
    def __init__(self, client: firestore.Client) -> None:
        self.client = client
        self._counters = client.collection(COUNTERS_COLLECTION)

    @classmethod
    def from_settings(cls, settings) -> "FirestoreDataStore":
        credentials_path = Path(settings.firestore_credentials_file)
        if not credentials_path.is_absolute():
            base_dir = Path(__file__).resolve().parents[2]
            credentials_path = (base_dir / credentials_path).resolve()

        credentials = None
        if settings.firestore_emulator_host:
            os.environ.setdefault("FIRESTORE_EMULATOR_HOST", settings.firestore_emulator_host)
        else:
            if not credentials_path.exists():
                raise FileNotFoundError(
                    "Firestore credentials file not found at " f"{credentials_path}. Update APP_FIRESTORE_CREDENTIALS_FILE."
                )
            os.environ.setdefault("GOOGLE_APPLICATION_CREDENTIALS", str(credentials_path))
            credentials = service_account.Credentials.from_service_account_file(str(credentials_path))

        client = firestore.Client(project=settings.firestore_project_id, credentials=credentials,database=settings.firestore_database)
        return cls(client)

    def get_user_by_username(self, username: str) -> User | None:
        query = (
            self.client.collection(USERS_COLLECTION).where("username", "==", username).limit(1).stream()
        )
        for doc in query:
            return self._doc_to_user(doc)
        return None

    def get_user_by_id(self, user_id: int) -> User | None:
        doc = self.client.collection(USERS_COLLECTION).document(str(user_id)).get()
        if not doc.exists:
            return None
        return self._doc_to_user(doc)

    def create_user(self, username: str, password_hash: str) -> User:
        user_id = self._next_id(USERS_COLLECTION)
        data = {
            "id": user_id,
            "username": username,
            "password_hash": password_hash,
        }
        self.client.collection(USERS_COLLECTION).document(str(user_id)).set(data)
        return User(**data)

    def list_friends(self, user_id: int) -> List[Friend]:
        friends_ref = self.client.collection(FRIENDS_COLLECTION)
        docs = friends_ref.where("user_id", "==", user_id).stream()
        friends = [self._doc_to_friend(doc) for doc in docs]
        friends.sort(key=lambda friend: friend.name.lower())
        return friends

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

    def get_friend_for_user(self, friend_id: int, user_id: int) -> Friend | None:
        doc = self.client.collection(FRIENDS_COLLECTION).document(str(friend_id)).get()
        if not doc.exists:
            return None
        friend = self._doc_to_friend(doc)
        if friend.user_id != user_id:
            return None
        return friend

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

    def get_game(self, game_id: int) -> Game | None:
        doc = self.client.collection(GAMES_COLLECTION).document(str(game_id)).get()
        if not doc.exists:
            return None
        return self._doc_to_game(doc)

    def update_game(self, game_id: int, **changes: Any) -> Game | None:
        doc_ref = self.client.collection(GAMES_COLLECTION).document(str(game_id))
        snapshot = doc_ref.get()
        if not snapshot.exists:
            return None

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

        return self._doc_to_game(doc_ref.get())

    def list_games(self, host_id: int, status_filter: GameStatus | None = None) -> List[Game]:
        games_ref = self.client.collection(GAMES_COLLECTION).where("host_id", "==", host_id)
        if status_filter is not None:
            games_ref = games_ref.where("status", "==", status_filter.value)
        docs = games_ref.stream()
        games = [self._doc_to_game(doc) for doc in docs]
        games.sort(key=lambda g: g.id, reverse=True)
        return games

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
        return self._doc_to_player_dict(data)

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
        return self._doc_to_player(doc_ref.get())

    def get_player(self, game_id: int, player_id: int) -> Player | None:
        doc = self.client.collection(PLAYERS_COLLECTION).document(str(player_id)).get()
        if not doc.exists:
            return None
        player = self._doc_to_player(doc)
        if player.game_id != game_id:
            return None
        return player

    def list_players(self, game_id: int) -> List[Player]:
        docs = (
            self.client.collection(PLAYERS_COLLECTION)
            .where("game_id", "==", game_id)
            .stream()
        )
        players = [self._doc_to_player(doc) for doc in docs]
        players.sort(key=lambda player: player.id)
        return players

    def add_log(self, game_id: int, *, round: int, phase: GamePhase, message: str, timestamp: datetime) -> Log:
        log_id = self._next_id(LOGS_COLLECTION)
        data = {
            "id": log_id,
            "game_id": game_id,
            "round": round,
            "phase": phase.value,
            "message": message,
            "timestamp": timestamp,
        }
        self.client.collection(LOGS_COLLECTION).document(str(log_id)).set(data)
        return self._doc_to_log_dict(data)

    def list_logs(self, game_id: int) -> List[Log]:
        docs = (
            self.client.collection(LOGS_COLLECTION)
            .where("game_id", "==", game_id)
            .stream()
        )
        logs = [self._doc_to_log(doc) for doc in docs]
        logs.sort(key=lambda log: log.timestamp)
        return logs

    def get_game_bundle(self, game_id: int) -> GameAggregate | None:
        game = self.get_game(game_id)
        if not game:
            return None
        players = self.list_players(game_id)
        logs = self.list_logs(game_id)
        return GameAggregate(game=game, players=players, logs=logs)

    def _next_id(self, collection_name: str) -> int:
        counter_ref = self._counters.document(collection_name)
        counter_ref.set({"value": Increment(1)}, merge=True)
        snapshot = counter_ref.get()
        value = snapshot.get("value") if snapshot.exists else None
        if value is None:
            counter_ref.set({"value": 1})
            return 1
        return int(value)

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
        else:
            ts = datetime.fromisoformat(timestamp)
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
        self.reset()

    def reset(self) -> None:
        self._users: Dict[int, User] = {}
        self._usernames: Dict[str, int] = {}
        self._friends: Dict[int, Friend] = {}
        self._games: Dict[int, Game] = {}
        self._players: Dict[int, Player] = {}
        self._logs: Dict[int, Log] = {}
        self._counters: defaultdict[str, int] = defaultdict(int)

    def _next_id(self, collection_name: str) -> int:
        self._counters[collection_name] += 1
        return self._counters[collection_name]

    def get_user_by_username(self, username: str) -> User | None:
        user_id = self._usernames.get(username)
        if user_id is None:
            return None
        return self._users.get(user_id)

    def get_user_by_id(self, user_id: int) -> User | None:
        return self._users.get(user_id)

    def create_user(self, username: str, password_hash: str) -> User:
        if username in self._usernames:
            raise ValueError("Username already exists")
        user_id = self._next_id(USERS_COLLECTION)
        user = User(id=user_id, username=username, password_hash=password_hash)
        self._users[user_id] = user
        self._usernames[username] = user_id
        return user

    def list_friends(self, user_id: int) -> List[Friend]:
        friends = [friend for friend in self._friends.values() if friend.user_id == user_id]
        return sorted(friends, key=lambda f: f.name.lower())

    def create_friend(self, user_id: int, *, name: str, description: str | None, image: str | None) -> Friend:
        friend_id = self._next_id(FRIENDS_COLLECTION)
        friend = Friend(id=friend_id, user_id=user_id, name=name, description=description, image=image)
        self._friends[friend_id] = friend
        return friend

    def delete_friend(self, friend_id: int, user_id: int) -> bool:
        friend = self._friends.get(friend_id)
        if not friend or friend.user_id != user_id:
            return False
        del self._friends[friend_id]
        return True

    def get_friend_for_user(self, friend_id: int, user_id: int) -> Friend | None:
        friend = self._friends.get(friend_id)
        if not friend or friend.user_id != user_id:
            return None
        return friend

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
        return game

    def get_game(self, game_id: int) -> Game | None:
        return self._games.get(game_id)

    def update_game(self, game_id: int, **changes: Any) -> Game | None:
        game = self._games.get(game_id)
        if not game:
            return None
        updated = replace(game, **changes)
        self._games[game_id] = updated
        return updated

    def list_games(self, host_id: int, status_filter: GameStatus | None = None) -> List[Game]:
        games = [game for game in self._games.values() if game.host_id == host_id]
        if status_filter is not None:
            games = [game for game in games if game.status == status_filter]
        return sorted(games, key=lambda g: g.id, reverse=True)

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
        return player

    def update_player(self, player_id: int, game_id: int, **changes: Any) -> Player | None:
        player = self._players.get(player_id)
        if not player or player.game_id != game_id:
            return None
        updated = replace(player, **changes)
        self._players[player_id] = updated
        return updated

    def get_player(self, game_id: int, player_id: int) -> Player | None:
        player = self._players.get(player_id)
        if not player or player.game_id != game_id:
            return None
        return player

    def list_players(self, game_id: int) -> List[Player]:
        players = [player for player in self._players.values() if player.game_id == game_id]
        return sorted(players, key=lambda p: p.id)

    def add_log(self, game_id: int, *, round: int, phase: GamePhase, message: str, timestamp: datetime) -> Log:
        log_id = self._next_id(LOGS_COLLECTION)
        log = Log(
            id=log_id,
            game_id=game_id,
            round=round,
            phase=phase,
            message=message,
            timestamp=timestamp,
        )
        self._logs[log_id] = log
        return log

    def list_logs(self, game_id: int) -> List[Log]:
        logs = [log for log in self._logs.values() if log.game_id == game_id]
        return sorted(logs, key=lambda l: (l.timestamp, l.id))

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
        _firestore_datastore = FirestoreDataStore.from_settings(settings)
    return _firestore_datastore


_firestore_datastore: FirestoreDataStore | None = None

