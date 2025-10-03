from __future__ import annotations

from datetime import UTC, datetime
from typing import Optional

import random

from fastapi import APIRouter, Depends, HTTPException, status
from loguru import logger
from anyio import from_thread

from .. import schemas
from ..database import get_datastore
from ..deps import get_current_user
from ..game_logic import determine_winner, resolve_vote_elimination
from ..models import Game, GameAggregate, GamePhase, GameStatus, Log, Player, User
from ..socket_manager import manager

router = APIRouter(prefix="/games", tags=["games"])

ANIMAL_AVATARS = [
    "🦊",
    "🐻",
    "🐼",
    "🦁",
    "🐯",
    "🐮",
    "🐸",
    "🐵",
    "🐶",
    "🐱",
    "🦄",
    "🦉",
    "🦜",
    "🦇",
    "🐢",
    "🐙",
    "🐳",
    "🐬",
    "🦕",
    "🦓",
]


def random_animal_avatar() -> str:
    return random.choice(ANIMAL_AVATARS)


def ensure_game_owner(game: GameAggregate, user: User) -> None:
    if game.host_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not permitted for this game")


def serialize_game(game: GameAggregate) -> schemas.GameDetail:
    return schemas.GameDetail(
        id=game.id,
        status=game.status,
        current_phase=game.current_phase,
        current_round=game.current_round,
        winning_team=game.winning_team,
        players=[schemas.PlayerRead.model_validate(player) for player in game.players],
        logs=[schemas.LogRead.model_validate(log) for log in game.logs],
    )


def broadcast_state(game: GameAggregate, event: str, payload: dict | None = None) -> None:
    message = {
        "event": event,
        "game_id": game.id,
        "status": game.status.value,
        "phase": game.current_phase.value,
        "round": game.current_round,
        "winning_team": game.winning_team,
        "players": [
            {
                "id": player.id,
                "name": player.name,
                "role": player.role,
                "is_alive": player.is_alive,
                "avatar": player.avatar,
                "friend_id": player.friend_id,
            }
            for player in game.players
        ],
        "logs": [
            {
                "id": log.id,
                "round": log.round,
                "phase": log.phase.value,
                "message": log.message,
                "timestamp": log.timestamp.isoformat(),
            }
            for log in game.logs
        ],
    }
    if payload:
        message.update(payload)

    logger.bind(game_id=game.id, event=event).debug("Broadcasting game state update")
    from_thread.run(manager.broadcast, game.id, message)


def append_log(bundle: GameAggregate, log_entry: Log) -> None:
    bundle.logs.append(log_entry)
    bundle.logs.sort(key=lambda entry: (entry.timestamp, entry.id))


def sync_game_state(bundle: GameAggregate, updated_game: Game) -> None:
    bundle.game.status = updated_game.status
    bundle.game.current_phase = updated_game.current_phase
    bundle.game.current_round = updated_game.current_round
    bundle.game.winning_team = updated_game.winning_team


def process_game_action(bundle: GameAggregate, datastore, action: schemas.GameActionRequest) -> bool:
    if bundle.game.status != GameStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Game not active")

    player_map = {player.id: player for player in bundle.players}
    action_type = action.action_type.lower()
    message = (action.note or "").strip()
    target_player: Player | None = None

    def require_target() -> Player:
        if action.target_player_id is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{action.action_type} requires a target")
        player = player_map.get(action.target_player_id)
        if not player:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Player not found")
        return player

    if action_type == "vote":
        target_player = require_target()
        datastore.update_player(target_player.id, bundle.id, is_alive=False)
        target_player.is_alive = False
        message = message or f"{target_player.name} was voted out."
        jester_win = resolve_vote_elimination(target_player)
        if jester_win:
            updated_game = datastore.update_game(bundle.id, status=GameStatus.FINISHED, winning_team=jester_win)
            if updated_game:
                sync_game_state(bundle, updated_game)
    elif action_type == "kill":
        target_player = require_target()
        datastore.update_player(target_player.id, bundle.id, is_alive=False)
        target_player.is_alive = False
        message = message or f"{target_player.name} was killed during the night."
    elif action_type == "save":
        target_player = require_target()
        datastore.update_player(target_player.id, bundle.id, is_alive=True)
        target_player.is_alive = True
        message = message or f"{target_player.name} was saved by the doctor."
    elif action_type == "investigate":
        target_player = require_target()
        role_info = target_player.role or "Unknown"
        message = message or f"Detective investigated {target_player.name}: {role_info}."
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported action type")

    log_entry = datastore.add_log(
        bundle.id,
        round=bundle.current_round,
        phase=bundle.current_phase,
        message=message,
        timestamp=datetime.now(UTC),
    )
    append_log(bundle, log_entry)

    if bundle.game.status == GameStatus.FINISHED:
        return True

    winner = determine_winner(bundle)
    if winner:
        updated_game, final_log = datastore.update_game_with_log(
            bundle.id,
            changes={"status": GameStatus.FINISHED, "winning_team": winner},
            log_round=bundle.current_round,
            log_phase=bundle.current_phase,
            log_message=f"Game ended. {winner} win!",
            timestamp=datetime.now(UTC),
        )
        if updated_game and final_log:
            sync_game_state(bundle, updated_game)
            append_log(bundle, final_log)
        return True

    return bundle.game.status == GameStatus.FINISHED


def require_game_bundle(game_id: int, datastore, current_user: User) -> GameAggregate:
    bundle = datastore.get_game_bundle(game_id)
    if not bundle:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found")
    ensure_game_owner(bundle, current_user)
    return bundle


@router.get("/", response_model=list[schemas.GameRead])
def list_games(
    status_filter: Optional[GameStatus] = None,
    current_user: User = Depends(get_current_user),
    datastore = Depends(get_datastore),
) -> list[schemas.GameRead]:
    logger.bind(user_id=current_user.id, status=status_filter).debug("Listing games")
    games = datastore.list_games(current_user.id, status_filter)
    return [schemas.GameRead.model_validate(game) for game in games]


@router.get("/{game_id}", response_model=schemas.GameDetail)
def get_game(
    game_id: int,
    current_user: User = Depends(get_current_user),
    datastore = Depends(get_datastore),
) -> schemas.GameDetail:
    logger.bind(game_id=game_id, user_id=current_user.id).debug("Fetching game detail")
    bundle = require_game_bundle(game_id, datastore, current_user)
    return serialize_game(bundle)


@router.post("/new", response_model=schemas.GameDetail, status_code=status.HTTP_201_CREATED)
def create_game(
    payload: schemas.GameCreateRequest,
    current_user: User = Depends(get_current_user),
    datastore = Depends(get_datastore),
) -> schemas.GameDetail:
    logger.bind(user_id=current_user.id).debug("Creating new game")
    game = datastore.create_game(current_user.id)

    bundle = GameAggregate(game=game, players=[], logs=[])

    players_payload = payload.players or [schemas.PlayerCreate(name=name) for name in payload.player_names]

    for player_payload in players_payload:
        raw_name = player_payload.name.strip()
        if not raw_name:
            continue

        friend = None
        if player_payload.friend_id is not None:
            friend = datastore.get_friend_for_user(player_payload.friend_id, current_user.id)
            if not friend:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid friend selection")

        name = friend.name.strip() if friend else raw_name
        avatar = (player_payload.avatar or "").strip() or (friend.image or "" if friend else "")
        avatar = avatar or random_animal_avatar()

        player = datastore.add_player(
            game.id,
            name=name,
            avatar=avatar,
            friend_id=friend.id if friend else None,
        )
        bundle.players.append(player)

    bundle.players.sort(key=lambda player: player.id)
    broadcast_state(bundle, "game_created")
    return serialize_game(bundle)


@router.post("/{game_id}/assign_roles", response_model=schemas.GameDetail)
def assign_roles(
    game_id: int,
    payload: schemas.AssignRolesRequest,
    current_user: User = Depends(get_current_user),
    datastore = Depends(get_datastore),
) -> schemas.GameDetail:
    logger.bind(game_id=game_id, user_id=current_user.id).debug("Assigning roles")
    bundle = require_game_bundle(game_id, datastore, current_user)
    player_map = {player.id: player for player in bundle.players}
    for assignment in payload.assignments:
        player = player_map.get(assignment.player_id)
        if not player:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid player {assignment.player_id}")
        datastore.update_player(player.id, bundle.id, role=assignment.role)
        player.role = assignment.role

    broadcast_state(bundle, "roles_assigned")
    return serialize_game(bundle)


@router.post("/{game_id}/start", response_model=schemas.GameDetail)
def start_game(
    game_id: int,
    current_user: User = Depends(get_current_user),
    datastore = Depends(get_datastore),
) -> schemas.GameDetail:
    logger.bind(game_id=game_id, user_id=current_user.id).debug("Starting game")
    bundle = require_game_bundle(game_id, datastore, current_user)

    if bundle.status != GameStatus.PENDING:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Game already started")

    updated_game, new_log = datastore.update_game_with_log(
        bundle.id,
        changes={
            "status": GameStatus.ACTIVE,
            "current_phase": GamePhase.DAY,
            "current_round": 1,
        },
        log_round=1,
        log_phase=GamePhase.DAY,
        log_message="Game started",
        timestamp=datetime.now(UTC),
    )
    if not updated_game or not new_log:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update game state")

    sync_game_state(bundle, updated_game)
    append_log(bundle, new_log)

    broadcast_state(bundle, "game_started")
    return serialize_game(bundle)


@router.post("/{game_id}/action", response_model=schemas.GameDetail)
def game_action(
    game_id: int,
    payload: schemas.GameActionRequest,
    current_user: User = Depends(get_current_user),
    datastore = Depends(get_datastore),
) -> schemas.GameDetail:
    logger.bind(game_id=game_id, action=payload.action_type, user_id=current_user.id).debug("Processing game action")
    bundle = require_game_bundle(game_id, datastore, current_user)

    process_game_action(bundle, datastore, payload)

    broadcast_state(bundle, "game_action", {"action": payload.action_type})
    return serialize_game(bundle)


@router.post("/{game_id}/night_actions", response_model=schemas.GameDetail)
def apply_night_actions(
    game_id: int,
    payload: schemas.NightActionsRequest,
    current_user: User = Depends(get_current_user),
    datastore = Depends(get_datastore),
) -> schemas.GameDetail:
    logger.bind(game_id=game_id, user_id=current_user.id).debug("Processing batched night actions")
    bundle = require_game_bundle(game_id, datastore, current_user)

    if bundle.status != GameStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Game not active")
    if bundle.current_phase != GamePhase.NIGHT:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Night actions only allowed during night phase")

    for action in payload.actions:
        finished = process_game_action(bundle, datastore, action)
        if finished:
            break

    broadcast_state(
        bundle,
        "night_actions_resolved",
        {"actions": [action.model_dump() for action in payload.actions]},
    )
    return serialize_game(bundle)


@router.post("/{game_id}/phase", response_model=schemas.GameDetail)
def change_phase(
    game_id: int,
    payload: schemas.PhaseChangeRequest,
    current_user: User = Depends(get_current_user),
    datastore = Depends(get_datastore),
) -> schemas.GameDetail:
    logger.bind(game_id=game_id, phase=payload.phase.value, user_id=current_user.id).debug("Changing phase")
    bundle = require_game_bundle(game_id, datastore, current_user)

    if bundle.status != GameStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Game is not active")

    previous_phase = bundle.current_phase
    new_round = bundle.current_round
    if previous_phase == GamePhase.NIGHT and payload.phase == GamePhase.DAY:
        new_round += 1

    updated_game, log_entry = datastore.update_game_with_log(
        bundle.id,
        changes={"current_phase": payload.phase, "current_round": new_round},
        log_round=new_round,
        log_phase=payload.phase,
        log_message=f"Phase switched to {payload.phase.value.capitalize()} {new_round}",
        timestamp=datetime.now(UTC),
    )
    if not updated_game or not log_entry:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to change phase")

    sync_game_state(bundle, updated_game)
    append_log(bundle, log_entry)

    broadcast_state(bundle, "phase_changed")
    return serialize_game(bundle)


@router.post("/{game_id}/finish", response_model=schemas.GameDetail)
def finish_game(
    game_id: int,
    payload: schemas.FinishGameRequest,
    current_user: User = Depends(get_current_user),
    datastore = Depends(get_datastore),
) -> schemas.GameDetail:
    logger.bind(game_id=game_id, user_id=current_user.id).debug("Finishing game")
    bundle = require_game_bundle(game_id, datastore, current_user)

    updated_game, log_entry = datastore.update_game_with_log(
        bundle.id,
        changes={"status": GameStatus.FINISHED, "winning_team": payload.winning_team},
        log_round=bundle.current_round,
        log_phase=bundle.current_phase,
        log_message=f"Game finished manually. Winner: {payload.winning_team}",
        timestamp=datetime.now(UTC),
    )
    if not updated_game or not log_entry:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to finish game")

    sync_game_state(bundle, updated_game)
    append_log(bundle, log_entry)

    broadcast_state(bundle, "game_finished")
    return serialize_game(bundle)


@router.post("/{game_id}/sync_night", response_model=schemas.GameDetail)
def sync_night_events(
    game_id: int,
    current_user: User = Depends(get_current_user),
    datastore = Depends(get_datastore),
) -> schemas.GameDetail:
    logger.bind(game_id=game_id, user_id=current_user.id).debug("Syncing night events")
    bundle = require_game_bundle(game_id, datastore, current_user)

    if bundle.status != GameStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Game is not active")

    log_entry = datastore.add_log(
        bundle.id,
        round=bundle.current_round,
        phase=bundle.current_phase,
        message="Night events synced to public view.",
        timestamp=datetime.now(UTC),
    )

    append_log(bundle, log_entry)

    broadcast_state(bundle, "night_synced")
    return serialize_game(bundle)
