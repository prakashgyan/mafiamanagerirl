from __future__ import annotations

from unittest.mock import Mock, patch

import pytest
from fastapi import HTTPException

from app.database import InMemoryDataStore
from app.models import GamePhase, GameStatus, User
from app.schemas import (
    AssignRolesRequest,
    FinishGameRequest,
    GameActionRequest,
    GameCreateRequest,
    PhaseChangeRequest,
)
from app.services.game_service import GameManager, GameService


@pytest.fixture(autouse=True)
def mock_broadcast():
    with patch("app.services.game_service.GameManager.broadcast") as mock:
        yield mock


@pytest.fixture
def datastore() -> InMemoryDataStore:
    store = InMemoryDataStore()
    store.reset()
    return store


@pytest.fixture
def game_service(datastore: InMemoryDataStore) -> GameService:
    return GameService(datastore)


@pytest.fixture
def test_user(datastore: InMemoryDataStore) -> User:
    return datastore.create_user("testuser", "password")


@pytest.fixture
def created_game(game_service: GameService, test_user: User) -> GameManager:
    payload = GameCreateRequest(player_names=["Alice", "Bob", "Charlie", "David"])
    manager = game_service.create_game(payload, test_user)
    return manager


@pytest.fixture
def active_game(created_game: GameManager) -> GameManager:
    players = created_game.bundle.players
    assignments = [
        {"player_id": players[0].id, "role": "Mafia"},
        {"player_id": players[1].id, "role": "Villager"},
        {"player_id": players[2].id, "role": "Villager"},
        {"player_id": players[3].id, "role": "Villager"},
    ]
    created_game.assign_roles(AssignRolesRequest(assignments=assignments))
    created_game.start()
    return created_game


def test_create_game(game_service: GameService, test_user: User, mock_broadcast: Mock):
    payload = GameCreateRequest(player_names=["Alice", "Bob", "Charlie", "David"])
    manager = game_service.create_game(payload, test_user)

    assert manager.bundle is not None
    assert manager.bundle.host_id == test_user.id
    assert len(manager.bundle.players) == 4
    assert manager.bundle.players[0].name == "Alice"
    assert manager.bundle.status == GameStatus.PENDING
    mock_broadcast.assert_called_with("game_created")


def test_assign_roles(created_game: GameManager, mock_broadcast: Mock):
    mock_broadcast.reset_mock()
    assignments = [{"player_id": p.id, "role": "Villager"} for p in created_game.bundle.players]
    created_game.assign_roles(AssignRolesRequest(assignments=assignments))

    player = created_game.bundle.players[0]
    assert player.role == "Villager"
    mock_broadcast.assert_called_with("roles_assigned")


def test_start_game(created_game: GameManager, mock_broadcast: Mock):
    assignments = [{"player_id": p.id, "role": "Villager"} for p in created_game.bundle.players]
    created_game.assign_roles(AssignRolesRequest(assignments=assignments))

    mock_broadcast.reset_mock()
    created_game.start()

    assert created_game.bundle.status == GameStatus.ACTIVE
    assert created_game.bundle.current_phase == GamePhase.DAY
    assert created_game.bundle.current_round == 1
    mock_broadcast.assert_called_with("game_started")


def test_process_vote_action(active_game: GameManager):
    villager_to_vote = next(p for p in active_game.bundle.players if p.role == "Villager")
    action = GameActionRequest(action_type="vote", target_player_id=villager_to_vote.id)
    active_game.process_action(action)

    assert not villager_to_vote.is_alive
    assert "voted out" in active_game.bundle.logs[-1].message


def test_change_phase(active_game: GameManager, mock_broadcast: Mock):
    mock_broadcast.reset_mock()
    active_game.change_phase(PhaseChangeRequest(phase=GamePhase.NIGHT))
    assert active_game.bundle.current_phase == GamePhase.NIGHT
    mock_broadcast.assert_called_with("phase_changed")

    mock_broadcast.reset_mock()
    active_game.change_phase(PhaseChangeRequest(phase=GamePhase.DAY))
    assert active_game.bundle.current_phase == GamePhase.DAY
    assert active_game.bundle.current_round == 2
    mock_broadcast.assert_called_with("phase_changed")


def test_finish_game(active_game: GameManager, mock_broadcast: Mock):
    mock_broadcast.reset_mock()
    active_game.finish(FinishGameRequest(winning_team="Villagers"))
    assert active_game.bundle.status == GameStatus.FINISHED
    assert active_game.bundle.winning_team == "Villagers"
    mock_broadcast.assert_called_with("game_finished")


def test_invalid_action(active_game: GameManager):
    action = GameActionRequest(action_type="invalid_action", target_player_id=1)
    with pytest.raises(HTTPException) as exc_info:
        active_game.process_action(action)
    assert exc_info.value.status_code == 400
    assert "Unsupported action type" in exc_info.value.detail