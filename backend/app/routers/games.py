from __future__ import annotations

from datetime import UTC, datetime
from typing import Optional

import random

from fastapi import APIRouter, Depends, HTTPException, status

from .. import schemas
from ..database import get_datastore
from ..deps import get_current_user
from ..game_logic import determine_winner, resolve_vote_elimination
from ..models import GameAggregate, GamePhase, GameStatus, Player, User
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

    import anyio

    anyio.from_thread.run(manager.broadcast, game.id, message)


def require_game_bundle(game_id: int, datastore, current_user: User) -> GameAggregate:
    bundle = datastore.get_game_bundle(game_id)
    if not bundle:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found")
    ensure_game_owner(bundle, current_user)
    return bundle


def load_bundle_or_500(datastore, game_id: int) -> GameAggregate:
    bundle = datastore.get_game_bundle(game_id)
    if not bundle:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Game data unavailable")
    return bundle


@router.get("/", response_model=list[schemas.GameRead])
def list_games(
    status_filter: Optional[GameStatus] = None,
    current_user: User = Depends(get_current_user),
    datastore = Depends(get_datastore),
) -> list[schemas.GameRead]:
    games = datastore.list_games(current_user.id, status_filter)
    return [schemas.GameRead.model_validate(game) for game in games]


@router.get("/{game_id}", response_model=schemas.GameDetail)
def get_game(
    game_id: int,
    current_user: User = Depends(get_current_user),
    datastore = Depends(get_datastore),
) -> schemas.GameDetail:
    bundle = require_game_bundle(game_id, datastore, current_user)
    return serialize_game(bundle)


@router.post("/new", response_model=schemas.GameDetail, status_code=status.HTTP_201_CREATED)
def create_game(
    payload: schemas.GameCreateRequest,
    current_user: User = Depends(get_current_user),
    datastore = Depends(get_datastore),
) -> schemas.GameDetail:
    game = datastore.create_game(current_user.id)

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

        datastore.add_player(
            game.id,
            name=name,
            avatar=avatar,
            friend_id=friend.id if friend else None,
        )

    bundle = load_bundle_or_500(datastore, game.id)
    broadcast_state(bundle, "game_created")
    return serialize_game(bundle)


@router.post("/{game_id}/assign_roles", response_model=schemas.GameDetail)
def assign_roles(
    game_id: int,
    payload: schemas.AssignRolesRequest,
    current_user: User = Depends(get_current_user),
    datastore = Depends(get_datastore),
) -> schemas.GameDetail:
    bundle = require_game_bundle(game_id, datastore, current_user)
    player_map = {player.id: player for player in bundle.players}
    for assignment in payload.assignments:
        player = player_map.get(assignment.player_id)
        if not player:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid player {assignment.player_id}")
        datastore.update_player(player.id, bundle.id, role=assignment.role)

    updated_bundle = load_bundle_or_500(datastore, bundle.id)
    broadcast_state(updated_bundle, "roles_assigned")
    return serialize_game(updated_bundle)


@router.post("/{game_id}/start", response_model=schemas.GameDetail)
def start_game(
    game_id: int,
    current_user: User = Depends(get_current_user),
    datastore = Depends(get_datastore),
) -> schemas.GameDetail:
    bundle = require_game_bundle(game_id, datastore, current_user)

    if bundle.status != GameStatus.PENDING:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Game already started")

    datastore.update_game(
        bundle.id,
        status=GameStatus.ACTIVE,
        current_phase=GamePhase.DAY,
        current_round=1,
    )
    datastore.add_log(
        bundle.id,
        round=1,
        phase=GamePhase.DAY,
        message="Game started",
        timestamp=datetime.now(UTC),
    )

    updated_bundle = load_bundle_or_500(datastore, bundle.id)
    broadcast_state(updated_bundle, "game_started")
    return serialize_game(updated_bundle)


@router.post("/{game_id}/action", response_model=schemas.GameDetail)
def game_action(
    game_id: int,
    payload: schemas.GameActionRequest,
    current_user: User = Depends(get_current_user),
    datastore = Depends(get_datastore),
) -> schemas.GameDetail:
    bundle = require_game_bundle(game_id, datastore, current_user)

    if bundle.status != GameStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Game not active")

    message = payload.note or ""

    target_player: Player | None = None
    if payload.action_type == "vote":
        if not payload.target_player_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Vote requires a target")
        target_player = datastore.get_player(bundle.id, payload.target_player_id)
        if not target_player:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Player not found")
        jester_win = resolve_vote_elimination(target_player)
        datastore.update_player(target_player.id, bundle.id, is_alive=False)
        message = message or f"{target_player.name} was voted out."
        if jester_win:
            datastore.update_game(bundle.id, status=GameStatus.FINISHED, winning_team=jester_win)
    elif payload.action_type == "kill":
        if not payload.target_player_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Kill requires a target")
        target_player = datastore.get_player(bundle.id, payload.target_player_id)
        if not target_player:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Player not found")
        datastore.update_player(target_player.id, bundle.id, is_alive=False)
        message = message or f"{target_player.name} was killed during the night."
    elif payload.action_type == "save":
        if not payload.target_player_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Save requires a target")
        target_player = datastore.get_player(bundle.id, payload.target_player_id)
        if not target_player:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Player not found")
        datastore.update_player(target_player.id, bundle.id, is_alive=True)
        message = message or f"{target_player.name} was saved by the doctor."
    elif payload.action_type == "investigate":
        if not payload.target_player_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Investigate requires a target")
        target_player = datastore.get_player(bundle.id, payload.target_player_id)
        if not target_player:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Player not found")
        role_info = target_player.role or "Unknown"
        message = message or f"Detective investigated {target_player.name}: {role_info}."
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported action type")

    datastore.add_log(
        bundle.id,
        round=bundle.current_round,
        phase=bundle.current_phase,
        message=message,
        timestamp=datetime.now(UTC),
    )

    updated_bundle = load_bundle_or_500(datastore, bundle.id)
    if updated_bundle.status != GameStatus.FINISHED:
        winner = determine_winner(updated_bundle)
        if winner:
            datastore.update_game(updated_bundle.id, status=GameStatus.FINISHED, winning_team=winner)
            datastore.add_log(
                updated_bundle.id,
                round=updated_bundle.current_round,
                phase=updated_bundle.current_phase,
                message=f"Game ended. {winner} win!",
                timestamp=datetime.now(UTC),
            )
            updated_bundle = load_bundle_or_500(datastore, updated_bundle.id)

    broadcast_state(updated_bundle, "game_action", {"action": payload.action_type})
    return serialize_game(updated_bundle)


@router.post("/{game_id}/phase", response_model=schemas.GameDetail)
def change_phase(
    game_id: int,
    payload: schemas.PhaseChangeRequest,
    current_user: User = Depends(get_current_user),
    datastore = Depends(get_datastore),
) -> schemas.GameDetail:
    bundle = require_game_bundle(game_id, datastore, current_user)

    if bundle.status != GameStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Game is not active")

    previous_phase = bundle.current_phase
    new_round = bundle.current_round
    if previous_phase == GamePhase.NIGHT and payload.phase == GamePhase.DAY:
        new_round += 1

    datastore.update_game(bundle.id, current_phase=payload.phase, current_round=new_round)
    datastore.add_log(
        bundle.id,
        round=new_round,
        phase=payload.phase,
        message=f"Phase switched to {payload.phase.value.capitalize()} {new_round}",
        timestamp=datetime.now(UTC),
    )

    updated_bundle = load_bundle_or_500(datastore, bundle.id)

    broadcast_state(updated_bundle, "phase_changed")
    return serialize_game(updated_bundle)


@router.post("/{game_id}/finish", response_model=schemas.GameDetail)
def finish_game(
    game_id: int,
    payload: schemas.FinishGameRequest,
    current_user: User = Depends(get_current_user),
    datastore = Depends(get_datastore),
) -> schemas.GameDetail:
    bundle = require_game_bundle(game_id, datastore, current_user)

    datastore.update_game(bundle.id, status=GameStatus.FINISHED, winning_team=payload.winning_team)
    datastore.add_log(
        bundle.id,
        round=bundle.current_round,
        phase=bundle.current_phase,
        message=f"Game finished manually. Winner: {payload.winning_team}",
        timestamp=datetime.now(UTC),
    )

    updated_bundle = load_bundle_or_500(datastore, bundle.id)

    broadcast_state(updated_bundle, "game_finished")
    return serialize_game(updated_bundle)


@router.post("/{game_id}/sync_night", response_model=schemas.GameDetail)
def sync_night_events(
    game_id: int,
    current_user: User = Depends(get_current_user),
    datastore = Depends(get_datastore),
) -> schemas.GameDetail:
    bundle = require_game_bundle(game_id, datastore, current_user)

    if bundle.status != GameStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Game is not active")

    datastore.add_log(
        bundle.id,
        round=bundle.current_round,
        phase=bundle.current_phase,
        message="Night events synced to public view.",
        timestamp=datetime.now(UTC),
    )

    updated_bundle = load_bundle_or_500(datastore, bundle.id)

    broadcast_state(updated_bundle, "night_synced")
    return serialize_game(updated_bundle)
