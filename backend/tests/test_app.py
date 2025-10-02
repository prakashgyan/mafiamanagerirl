from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from app.database import InMemoryDataStore, get_datastore
from app.main import app

test_store = InMemoryDataStore()


def override_get_datastore() -> InMemoryDataStore:
    return test_store


def setup_module(module):  # noqa: D401 - pytest hook
    test_store.reset()
    app.dependency_overrides[get_datastore] = override_get_datastore


def teardown_module(module):  # noqa: D401 - pytest hook
    app.dependency_overrides.clear()
    test_store.reset()


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

    resp = test_client.post(
        "/friends/",
        json={"name": "Alice", "description": "Strategist", "image": "🦊"},
    )
    assert resp.status_code == 201
    friend = resp.json()
    alice_friend_id = friend["id"]

    resp = test_client.get("/friends/")
    assert resp.status_code == 200
    assert resp.json()[0]["name"] == "Alice"

    resp = test_client.post(
        "/games/new",
        json={
            "players": [
                {"name": "Alice", "friend_id": alice_friend_id},
                {"name": "Bob", "avatar": "🐻"},
                {"name": "Cara", "avatar": "🦁"},
                {"name": "Dylan", "avatar": "🐼"},
            ]
        },
    )
    assert resp.status_code == 201
    game = resp.json()
    game_id = game["id"]

    players = {player["name"]: player["id"] for player in game["players"]}
    alice_entry = next(player for player in game["players"] if player["name"] == "Alice")
    assert alice_entry["avatar"] == "🦊"
    assert alice_entry["friend_id"] == alice_friend_id

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
