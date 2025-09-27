from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import schemas
from ..database import get_db
from ..deps import get_current_user
from ..game_logic import determine_winner, resolve_vote_elimination
from ..models import Game, GamePhase, GameStatus, Log, Player, User
from ..socket_manager import manager

router = APIRouter(prefix="/games", tags=["games"])


def ensure_game_owner(game: Game, user: User) -> None:
    if game.host_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not permitted for this game")


def serialize_game(game: Game) -> schemas.GameDetail:
    return schemas.GameDetail(
        id=game.id,
        status=game.status,
        current_phase=game.current_phase,
        current_round=game.current_round,
        winning_team=game.winning_team,
        players=[schemas.PlayerRead.model_validate(player) for player in game.players],
        logs=[schemas.LogRead.model_validate(log) for log in game.logs],
    )


def broadcast_state(game: Game, event: str, payload: dict | None = None) -> None:
    message = {
        "event": event,
        "game_id": game.id,
        "status": game.status.value,
        "phase": game.current_phase.value,
        "round": game.current_round,
        "winning_team": game.winning_team,
        "players": [
            {"id": player.id, "name": player.name, "role": player.role, "is_alive": player.is_alive}
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


@router.get("/", response_model=list[schemas.GameRead])
def list_games(
    status_filter: Optional[GameStatus] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[schemas.GameRead]:
    query = db.query(Game).filter(Game.host_id == current_user.id)
    if status_filter:
        query = query.filter(Game.status == status_filter)
    games = query.order_by(Game.id.desc()).all()
    return [schemas.GameRead.model_validate(game) for game in games]


@router.get("/{game_id}", response_model=schemas.GameDetail)
def get_game(
    game_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> schemas.GameDetail:
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found")
    ensure_game_owner(game, current_user)
    return serialize_game(game)


@router.post("/new", response_model=schemas.GameDetail, status_code=status.HTTP_201_CREATED)
def create_game(
    payload: schemas.GameCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> schemas.GameDetail:
    game = Game(host_id=current_user.id, status=GameStatus.PENDING, current_phase=GamePhase.DAY, current_round=1)
    db.add(game)
    db.flush()

    for name in payload.player_names:
        if name.strip():
            db.add(Player(game_id=game.id, name=name.strip()))

    db.commit()
    db.refresh(game)
    broadcast_state(game, "game_created")
    return serialize_game(game)


@router.post("/{game_id}/assign_roles", response_model=schemas.GameDetail)
def assign_roles(
    game_id: int,
    payload: schemas.AssignRolesRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> schemas.GameDetail:
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found")
    ensure_game_owner(game, current_user)

    player_map = {player.id: player for player in game.players}
    for assignment in payload.assignments:
        player = player_map.get(assignment.player_id)
        if not player:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid player {assignment.player_id}")
        player.role = assignment.role

    db.commit()
    db.refresh(game)

    broadcast_state(game, "roles_assigned")
    return serialize_game(game)


@router.post("/{game_id}/start", response_model=schemas.GameDetail)
def start_game(
    game_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> schemas.GameDetail:
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found")
    ensure_game_owner(game, current_user)

    if game.status != GameStatus.PENDING:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Game already started")

    game.status = GameStatus.ACTIVE
    game.current_phase = GamePhase.DAY
    game.current_round = 1

    db.add(Log(game_id=game.id, round=game.current_round, phase=game.current_phase, message="Game started"))
    db.commit()
    db.refresh(game)

    broadcast_state(game, "game_started")
    return serialize_game(game)


def get_player_or_404(game: Game, player_id: int) -> Player:
    for player in game.players:
        if player.id == player_id:
            return player
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Player not found")


@router.post("/{game_id}/action", response_model=schemas.GameDetail)
def game_action(
    game_id: int,
    payload: schemas.GameActionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> schemas.GameDetail:
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found")
    ensure_game_owner(game, current_user)

    if game.status != GameStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Game not active")

    message = payload.note or ""

    if payload.action_type == "vote":
        if not payload.target_player_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Vote requires a target")
        player = get_player_or_404(game, payload.target_player_id)
        player.is_alive = False
        player.game = game
        jester_win = resolve_vote_elimination(player)
        message = message or f"{player.name} was voted out."
        if jester_win:
            game.status = GameStatus.FINISHED
            game.winning_team = jester_win
    elif payload.action_type == "kill":
        if not payload.target_player_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Kill requires a target")
        player = get_player_or_404(game, payload.target_player_id)
        player.is_alive = False
        message = message or f"{player.name} was killed during the night."
    elif payload.action_type == "save":
        if not payload.target_player_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Save requires a target")
        player = get_player_or_404(game, payload.target_player_id)
        player.is_alive = True
        message = message or f"{player.name} was saved by the doctor."
    elif payload.action_type == "investigate":
        if not payload.target_player_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Investigate requires a target")
        player = get_player_or_404(game, payload.target_player_id)
        role_info = player.role or "Unknown"
        message = message or f"Detective investigated {player.name}: {role_info}."
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported action type")

    db.add(
        Log(
            game_id=game.id,
            round=game.current_round,
            phase=game.current_phase,
            message=message,
            timestamp=datetime.utcnow(),
        )
    )

    if game.status != GameStatus.FINISHED:
        winner = determine_winner(game)
        if winner:
            game.status = GameStatus.FINISHED
            game.winning_team = winner
            db.add(
                Log(
                    game_id=game.id,
                    round=game.current_round,
                    phase=game.current_phase,
                    message=f"Game ended. {winner} win!",
                    timestamp=datetime.utcnow(),
                )
            )

    db.commit()
    db.refresh(game)

    broadcast_state(game, "game_action", {"action": payload.action_type})
    return serialize_game(game)


@router.post("/{game_id}/phase", response_model=schemas.GameDetail)
def change_phase(
    game_id: int,
    payload: schemas.PhaseChangeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> schemas.GameDetail:
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found")
    ensure_game_owner(game, current_user)

    if game.status != GameStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Game is not active")

    previous_phase = game.current_phase
    game.current_phase = payload.phase
    if previous_phase == GamePhase.NIGHT and payload.phase == GamePhase.DAY:
        game.current_round += 1

    db.add(
        Log(
            game_id=game.id,
            round=game.current_round,
            phase=game.current_phase,
            message=f"Phase switched to {payload.phase.value.capitalize()} {game.current_round}",
            timestamp=datetime.utcnow(),
        )
    )

    db.commit()
    db.refresh(game)

    broadcast_state(game, "phase_changed")
    return serialize_game(game)


@router.post("/{game_id}/finish", response_model=schemas.GameDetail)
def finish_game(
    game_id: int,
    payload: schemas.FinishGameRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> schemas.GameDetail:
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found")
    ensure_game_owner(game, current_user)

    game.status = GameStatus.FINISHED
    game.winning_team = payload.winning_team

    db.add(
        Log(
            game_id=game.id,
            round=game.current_round,
            phase=game.current_phase,
            message=f"Game finished manually. Winner: {payload.winning_team}",
            timestamp=datetime.utcnow(),
        )
    )

    db.commit()
    db.refresh(game)

    broadcast_state(game, "game_finished")
    return serialize_game(game)


@router.post("/{game_id}/sync_night", response_model=schemas.GameDetail)
def sync_night_events(
    game_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> schemas.GameDetail:
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found")
    ensure_game_owner(game, current_user)

    if game.status != GameStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Game is not active")

    db.add(
        Log(
            game_id=game.id,
            round=game.current_round,
            phase=game.current_phase,
            message="Night events synced to public view.",
            timestamp=datetime.utcnow(),
        )
    )

    db.commit()
    db.refresh(game)

    broadcast_state(game, "night_synced")
    return serialize_game(game)
