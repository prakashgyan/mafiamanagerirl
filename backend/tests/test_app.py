from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.main import app

TEST_DB_PATH = Path("test_mafia_manager.db")
TEST_DATABASE_URL = f"sqlite:///{TEST_DB_PATH}"

test_engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(bind=test_engine, autocommit=False, autoflush=False)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


def setup_module(module):  # noqa: D401 - pytest hook
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    app.dependency_overrides[get_db] = override_get_db


def teardown_module(module):  # noqa: D401 - pytest hook
    app.dependency_overrides.clear()
    if TEST_DB_PATH.exists():
        TEST_DB_PATH.unlink()


@pytest.fixture()
def test_client() -> TestClient:
    return TestClient(app)


def test_full_flow(test_client: TestClient) -> None:
    resp = test_client.post("/auth/signup", json={"username": "host", "password": "password123"})
    assert resp.status_code == 201
    assert resp.json()["username"] == "host"

    # Ensure the authenticated session is active
    resp = test_client.get("/auth/me")
    assert resp.status_code == 200

    # Logging out should clear the cookie so future requests are unauthorized
    resp = test_client.post("/auth/logout")
    assert resp.status_code == 204

    resp = test_client.get("/auth/me")
    assert resp.status_code == 401

    resp = test_client.post("/auth/login", json={"username": "host", "password": "password123"})
    assert resp.status_code == 200

    resp = test_client.post("/friends/", json={"name": "Alice", "description": "Strategist"})
    assert resp.status_code == 201

    resp = test_client.get("/friends/")
    assert resp.status_code == 200
    assert resp.json()[0]["name"] == "Alice"

    resp = test_client.post("/games/new", json={"player_names": ["Alice", "Bob", "Cara", "Dylan"]})
    assert resp.status_code == 201
    game = resp.json()
    game_id = game["id"]

    players = {player["name"]: player["id"] for player in game["players"]}

    assignments = [
        {"player_id": players["Alice"], "role": "Mafia"},
        {"player_id": players["Bob"], "role": "Detective"},
        {"player_id": players["Cara"], "role": "Doctor"},
        {"player_id": players["Dylan"], "role": "Villager"},
    ]
    resp = test_client.post(f"/games/{game_id}/assign_roles", json={"assignments": assignments})
    assert resp.status_code == 200

    resp = test_client.post(f"/games/{game_id}/start")
    assert resp.status_code == 200
    assert resp.json()["status"] == "active"

    resp = test_client.post(
        f"/games/{game_id}/action",
        json={"action_type": "kill", "target_player_id": players["Dylan"]},
    )
    assert resp.status_code == 200

    resp = test_client.post(
        f"/games/{game_id}/action",
        json={"action_type": "save", "target_player_id": players["Dylan"]},
    )
    assert resp.status_code == 200

    resp = test_client.post(f"/games/{game_id}/phase", json={"phase": "night"})
    assert resp.status_code == 200

    resp = test_client.post(f"/games/{game_id}/phase", json={"phase": "day"})
    assert resp.status_code == 200

    resp = test_client.post(f"/games/{game_id}/sync_night")
    assert resp.status_code == 200

    resp = test_client.post(
        f"/games/{game_id}/action",
        json={"action_type": "vote", "target_player_id": players["Alice"]},
    )
    assert resp.status_code == 200

    resp = test_client.post(f"/games/{game_id}/finish", json={"winning_team": "Villagers"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "finished"
