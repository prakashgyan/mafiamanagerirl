from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, status
from loguru import logger

from .. import schemas
from ..database import Datastore, get_datastore
from ..deps import get_current_user
from ..models import GameStatus, User
from ..services.game_service import GameService

router = APIRouter(prefix="/games", tags=["games"])


def get_game_service(datastore: Datastore = Depends(get_datastore)) -> GameService:
    return GameService(datastore)


@router.get("/", response_model=list[schemas.GameRead])
def list_games(
    status_filter: Optional[GameStatus] = None,
    current_user: User = Depends(get_current_user),
    game_service: GameService = Depends(get_game_service),
) -> list[schemas.GameRead]:
    logger.bind(user_id=current_user.id, status=status_filter).debug("Listing games")
    return game_service.list_games(current_user, status_filter)


@router.post("/new", response_model=schemas.GameDetail, status_code=status.HTTP_201_CREATED)
def create_game(
    payload: schemas.GameCreateRequest,
    current_user: User = Depends(get_current_user),
    game_service: GameService = Depends(get_game_service),
) -> schemas.GameDetail:
    logger.bind(user_id=current_user.id).debug("Creating new game")
    game_manager = game_service.create_game(payload, current_user)
    return game_manager.serialize_for_api()


@router.get("/{game_id}", response_model=schemas.GameDetail)
def get_game(
    game_id: int,
    current_user: User = Depends(get_current_user),
    game_service: GameService = Depends(get_game_service),
) -> schemas.GameDetail:
    logger.bind(game_id=game_id, user_id=current_user.id).debug("Fetching game detail")
    game_manager = game_service.get_game_manager(game_id, current_user)
    return game_manager.serialize_for_api()


@router.post("/{game_id}/assign_roles", response_model=schemas.GameDetail)
def assign_roles(
    game_id: int,
    payload: schemas.AssignRolesRequest,
    current_user: User = Depends(get_current_user),
    game_service: GameService = Depends(get_game_service),
) -> schemas.GameDetail:
    logger.bind(game_id=game_id, user_id=current_user.id).debug("Assigning roles")
    game_manager = game_service.get_game_manager(game_id, current_user)
    game_manager.assign_roles(payload)
    return game_manager.serialize_for_api()


@router.post("/{game_id}/start", response_model=schemas.GameDetail)
def start_game(
    game_id: int,
    current_user: User = Depends(get_current_user),
    game_service: GameService = Depends(get_game_service),
) -> schemas.GameDetail:
    logger.bind(game_id=game_id, user_id=current_user.id).debug("Starting game")
    game_manager = game_service.get_game_manager(game_id, current_user)
    game_manager.start()
    return game_manager.serialize_for_api()


@router.post("/{game_id}/action", response_model=schemas.GameDetail)
def game_action(
    game_id: int,
    payload: schemas.GameActionRequest,
    current_user: User = Depends(get_current_user),
    game_service: GameService = Depends(get_game_service),
) -> schemas.GameDetail:
    logger.bind(game_id=game_id, action=payload.action_type, user_id=current_user.id).debug("Processing game action")
    game_manager = game_service.get_game_manager(game_id, current_user)
    game_manager.process_action(payload)
    game_manager.broadcast("game_action", {"action": payload.action_type})
    return game_manager.serialize_for_api()


@router.post("/{game_id}/night_actions", response_model=schemas.GameDetail)
def apply_night_actions(
    game_id: int,
    payload: schemas.NightActionsRequest,
    current_user: User = Depends(get_current_user),
    game_service: GameService = Depends(get_game_service),
) -> schemas.GameDetail:
    logger.bind(game_id=game_id, user_id=current_user.id).debug("Processing batched night actions")
    game_manager = game_service.get_game_manager(game_id, current_user)
    game_manager.apply_night_actions(payload)
    return game_manager.serialize_for_api()


@router.post("/{game_id}/phase", response_model=schemas.GameDetail)
def change_phase(
    game_id: int,
    payload: schemas.PhaseChangeRequest,
    current_user: User = Depends(get_current_user),
    game_service: GameService = Depends(get_game_service),
) -> schemas.GameDetail:
    logger.bind(game_id=game_id, phase=payload.phase.value, user_id=current_user.id).debug("Changing phase")
    game_manager = game_service.get_game_manager(game_id, current_user)
    game_manager.change_phase(payload)
    return game_manager.serialize_for_api()


@router.post("/{game_id}/finish", response_model=schemas.GameDetail)
def finish_game(
    game_id: int,
    payload: schemas.FinishGameRequest,
    current_user: User = Depends(get_current_user),
    game_service: GameService = Depends(get_game_service),
) -> schemas.GameDetail:
    logger.bind(game_id=game_id, user_id=current_user.id).debug("Finishing game")
    game_manager = game_service.get_game_manager(game_id, current_user)
    game_manager.finish(payload)
    return game_manager.serialize_for_api()


@router.post("/{game_id}/sync_night", response_model=schemas.GameDetail)
def sync_night_events(
    game_id: int,
    current_user: User = Depends(get_current_user),
    game_service: GameService = Depends(get_game_service),
) -> schemas.GameDetail:
    logger.bind(game_id=game_id, user_id=current_user.id).debug("Syncing night events")
    game_manager = game_service.get_game_manager(game_id, current_user)
    game_manager.sync_night_events()
    return game_manager.serialize_for_api()