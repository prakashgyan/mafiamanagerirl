from __future__ import annotations

import random
from typing import Callable, Optional

from anyio import from_thread
from fastapi import HTTPException, status
from loguru import logger

from .. import schemas
from ..database import Datastore
from ..game_logic import determine_winner, resolve_vote_elimination
from ..models import Game, GameAggregate, GamePhase, GameStatus, Log, Player, User
from ..socket_manager import manager

ANIMAL_AVATARS = [
    "🦊", "🐻", "🐼", "🦁", "🐯", "🐮", "🐸", "🐵", "🐶", "🐱",
    "🦄", "🦉", "🦜", "🦇", "🐢", "🐙", "🐳", "🐬", "🦕", "🦓",
]


def random_animal_avatar() -> str:
    return random.choice(ANIMAL_AVATARS)


def _serialize_player(player: Player, *, use_public_visibility: bool) -> dict:
    visible_is_alive = player.public_is_alive if use_public_visibility else player.is_alive
    return {
        "id": player.id,
        "name": player.name,
        "role": player.role,
        "is_alive": visible_is_alive,
        "public_is_alive": player.public_is_alive,
        "actual_is_alive": player.is_alive,
        "avatar": player.avatar,
        "friend_id": player.friend_id,
    }


def _serialize_log(log: Log) -> dict:
    return {
        "id": log.id,
        "round": log.round,
        "phase": log.phase.value,
        "message": log.message,
        "timestamp": log.timestamp.isoformat(),
    }


class GameManager:
    """Manages the state of a single game instance."""

    def __init__(self, bundle: GameAggregate, datastore: Datastore):
        self.bundle = bundle
        self.datastore = datastore
        self.player_map = {p.id: p for p in bundle.players}
        self.action_handlers: dict[str, Callable[[schemas.GameActionRequest], str]] = {
            "vote": self._handle_vote_action,
            "kill": self._handle_kill_action,
            "save": self._handle_save_action,
            "investigate": self._handle_investigate_action,
        }
        host = self.datastore.get_user_by_id(self.bundle.host_id)
        self.public_auto_sync_enabled = getattr(host, "public_auto_sync_enabled", True)

    @classmethod
    def load(cls, game_id: int, datastore: Datastore, user: Optional[User] = None) -> "GameManager":
        bundle = datastore.get_game_bundle(game_id)
        if not bundle:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found")
        game_manager = cls(bundle, datastore)
        if user:
            game_manager.ensure_owner(user)
        return game_manager

    @property
    def id(self) -> int:
        return self.bundle.id

    def ensure_owner(self, user: User) -> None:
        if self.bundle.host_id != user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not permitted for this game")

    def require_target(self, action: schemas.GameActionRequest) -> Player:
        if action.target_player_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{action.action_type} requires a target",
            )
        player = self.player_map.get(action.target_player_id)
        if not player:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Player not found")
        return player

    def append_log(self, log_entry: Log) -> None:
        self.bundle.logs.append(log_entry)
        self.bundle.logs.sort(key=lambda entry: (entry.timestamp, entry.id))

    def sync_game_state(self, updated_game: Game) -> None:
        self.bundle.game.status = updated_game.status
        self.bundle.game.current_phase = updated_game.current_phase
        self.bundle.game.current_round = updated_game.current_round
        self.bundle.game.winning_team = updated_game.winning_team

    def serialize_for_api(self) -> schemas.GameDetail:
        return schemas.GameDetail(
            id=self.bundle.id,
            status=self.bundle.status,
            current_phase=self.bundle.current_phase,
            current_round=self.bundle.current_round,
            winning_team=self.bundle.winning_team,
            players=[schemas.PlayerRead.model_validate(p) for p in self.bundle.players],
            logs=[schemas.LogRead.model_validate(log) for log in self.bundle.logs],
        )

    def serialize_for_broadcast(self, event: str, payload: Optional[dict] = None) -> dict:
        message = {
            "event": event,
            "game_id": self.bundle.id,
            "status": self.bundle.status.value,
            "phase": self.bundle.current_phase.value,
            "round": self.bundle.current_round,
            "winning_team": self.bundle.winning_team,
            "public_auto_sync_enabled": self.public_auto_sync_enabled,
            "players": [
                _serialize_player(p, use_public_visibility=not self.public_auto_sync_enabled)
                for p in self.bundle.players
            ],
            "logs": [_serialize_log(log) for log in self.bundle.logs],
        }
        if payload:
            message.update(payload)
        return message

    def broadcast(self, event: str, payload: Optional[dict] = None) -> None:
        message = self.serialize_for_broadcast(event, payload)
        logger.bind(game_id=self.id, event=event).debug("Broadcasting game state update")
        from_thread.run(manager.broadcast, self.id, message)

    def assign_roles(self, payload: schemas.AssignRolesRequest) -> None:
        for assignment in payload.assignments:
            player = self.player_map.get(assignment.player_id)
            if not player:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid player {assignment.player_id}")
            self.datastore.update_player(player.id, self.id, role=assignment.role)
            player.role = assignment.role
        self.broadcast("roles_assigned")

    def start(self) -> None:
        if self.bundle.status != GameStatus.PENDING:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Game already started")

        updated_game, new_log = self.datastore.update_game_with_log(
            self.id,
            changes={"status": GameStatus.ACTIVE, "current_phase": GamePhase.DAY, "current_round": 1},
            log_round=1,
            log_phase=GamePhase.DAY,
            log_message="Game started",
        )
        if not updated_game or not new_log:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update game state")

        self.sync_game_state(updated_game)
        self.append_log(new_log)
        self.broadcast("game_started")

    def _replace_player(self, player: Player) -> None:
        self.player_map[player.id] = player
        for index, existing in enumerate(self.bundle.players):
            if existing.id == player.id:
                self.bundle.players[index] = player
                break

    def _update_player_alive(self, player: Player, alive: bool, *, force_public_sync: bool = False) -> Player:
        updates: dict[str, object] = {"is_alive": alive}
        if self.public_auto_sync_enabled or force_public_sync:
            updates["public_is_alive"] = alive
        updated_player = self.datastore.update_player(player.id, self.id, **updates)
        if not updated_player:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Player not found")
        self._replace_player(updated_player)
        return updated_player

    def _handle_vote_action(self, action: schemas.GameActionRequest) -> str:
        target_player = self.require_target(action)
        updated_player = self._update_player_alive(target_player, False, force_public_sync=True)
        message = action.note or f"{updated_player.name} was voted out."
        jester_win = resolve_vote_elimination(updated_player)
        if jester_win:
            updated_game = self.datastore.update_game(
                self.id, status=GameStatus.FINISHED, winning_team=jester_win
            )
            if updated_game:
                self.sync_game_state(updated_game)
        return message

    def _handle_kill_action(self, action: schemas.GameActionRequest) -> str:
        target_player = self.require_target(action)
        updated_player = self._update_player_alive(target_player, False)
        return action.note or f"{updated_player.name} was killed during the night."

    def _handle_save_action(self, action: schemas.GameActionRequest) -> str:
        target_player = self.require_target(action)
        updated_player = self._update_player_alive(target_player, True)
        return action.note or f"{updated_player.name} was saved by the doctor."

    def _handle_investigate_action(self, action: schemas.GameActionRequest) -> str:
        target_player = self.require_target(action)
        role_info = target_player.role or "Unknown"
        return action.note or f"Detective investigated {target_player.name}: {role_info}."

    def process_action(self, action: schemas.GameActionRequest) -> bool:
        if self.bundle.status != GameStatus.ACTIVE:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Game not active")

        handler = self.action_handlers.get(action.action_type.lower())
        if not handler:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported action type")

        message = handler(action)

        log_entry = self.datastore.add_log(
            self.id,
            round=self.bundle.current_round,
            phase=self.bundle.current_phase,
            message=message,
        )
        self.append_log(log_entry)

        if self.bundle.status == GameStatus.FINISHED:
            return True

        winner = determine_winner(self.bundle)
        if winner:
            updated_game, final_log = self.datastore.update_game_with_log(
                self.id,
                changes={"status": GameStatus.FINISHED, "winning_team": winner},
                log_round=self.bundle.current_round,
                log_phase=self.bundle.current_phase,
                log_message=f"Game ended. {winner} win!",
            )
            if updated_game and final_log:
                self.sync_game_state(updated_game)
                self.append_log(final_log)
            return True

        return self.bundle.status == GameStatus.FINISHED

    def apply_night_actions(self, payload: schemas.NightActionsRequest) -> None:
        if self.bundle.status != GameStatus.ACTIVE:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Game not active")
        if self.bundle.current_phase != GamePhase.NIGHT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Night actions only allowed during night phase",
            )

        for action in payload.actions:
            finished = self.process_action(action)
            if finished:
                break
        self.broadcast(
            "night_actions_resolved",
            {"actions": [action.model_dump() for action in payload.actions]},
        )

    def change_phase(self, payload: schemas.PhaseChangeRequest) -> None:
        if self.bundle.status != GameStatus.ACTIVE:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Game is not active")

        previous_phase = self.bundle.current_phase
        new_round = self.bundle.current_round
        if previous_phase == GamePhase.NIGHT and payload.phase == GamePhase.DAY:
            new_round += 1

        updated_game, log_entry = self.datastore.update_game_with_log(
            self.id,
            changes={"current_phase": payload.phase, "current_round": new_round},
            log_round=new_round,
            log_phase=payload.phase,
            log_message=f"Phase switched to {payload.phase.value.capitalize()} {new_round}",
        )
        if not updated_game or not log_entry:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to change phase")

        self.sync_game_state(updated_game)
        self.append_log(log_entry)
        self.broadcast("phase_changed")

    def finish(self, payload: schemas.FinishGameRequest) -> None:
        updated_game, log_entry = self.datastore.update_game_with_log(
            self.id,
            changes={"status": GameStatus.FINISHED, "winning_team": payload.winning_team},
            log_round=self.bundle.current_round,
            log_phase=self.bundle.current_phase,
            log_message=f"Game finished manually. Winner: {payload.winning_team}",
        )
        if not updated_game or not log_entry:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to finish game")

        self.sync_game_state(updated_game)
        self.append_log(log_entry)
        self.broadcast("game_finished")

    def sync_night_events(self) -> None:
        if self.bundle.status != GameStatus.ACTIVE:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Game is not active")

        revealed_players: list[int] = []
        for player in list(self.bundle.players):
            public_state = getattr(player, "public_is_alive", player.is_alive)
            if public_state != player.is_alive:
                updated_player = self.datastore.update_player(
                    player.id,
                    self.id,
                    public_is_alive=player.is_alive,
                )
                if updated_player:
                    self._replace_player(updated_player)
                    revealed_players.append(player.id)

        log_entry = self.datastore.add_log(
            self.id,
            round=self.bundle.current_round,
            phase=self.bundle.current_phase,
            message="Night events synced to public view.",
        )
        self.append_log(log_entry)
        self.broadcast("night_synced", {"revealed_player_ids": revealed_players})


class GameService:
    def __init__(self, datastore: Datastore):
        self.datastore = datastore

    def get_game_manager(self, game_id: int, current_user: Optional[User] = None) -> GameManager:
        return GameManager.load(game_id, self.datastore, current_user)

    def create_game(self, payload: schemas.GameCreateRequest, current_user: User) -> GameManager:
        logger.bind(user_id=current_user.id).debug("Creating new game")
        game = self.datastore.create_game(current_user.id)
        bundle = GameAggregate(game=game, players=[], logs=[])
        game_manager = GameManager(bundle, self.datastore)

        players_payload = payload.players or [schemas.PlayerCreate(name=name) for name in payload.player_names]

        for player_payload in players_payload:
            raw_name = player_payload.name.strip()
            if not raw_name:
                continue

            friend = None
            if player_payload.friend_id is not None:
                friend = self.datastore.get_friend_for_user(player_payload.friend_id, current_user.id)
                if not friend:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid friend selection")

            name = friend.name.strip() if friend else raw_name
            avatar = (player_payload.avatar or "").strip() or (friend.image or "" if friend else "")
            avatar = avatar or random_animal_avatar()

            player = self.datastore.add_player(
                game.id,
                name=name,
                avatar=avatar,
                friend_id=friend.id if friend else None,
            )
            bundle.players.append(player)

        bundle.players.sort(key=lambda p: p.id)
        game_manager.player_map = {p.id: p for p in bundle.players}
        game_manager.broadcast("game_created")
        return game_manager

    def list_games(self, user: User, status_filter: Optional[GameStatus]) -> list[schemas.GameRead]:
        games = self.datastore.list_games(user.id, status_filter)
        return [schemas.GameRead.model_validate(game) for game in games]