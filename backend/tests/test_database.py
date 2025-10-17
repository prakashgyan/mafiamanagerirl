from __future__ import annotations

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_datastore, PostgresDataStore
from app.config import get_settings
from app.models import GameStatus, GamePhase

settings = get_settings()
engine = create_engine(settings.database_url)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)

@pytest.fixture()
def db():
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


def test_create_user(db):
    datastore = get_datastore(db)
    user = datastore.create_user("testuser", "password")
    assert user.username == "testuser"

    retrieved_user = datastore.get_user_by_username("testuser")
    assert retrieved_user.id == user.id

    retrieved_user_by_id = datastore.get_user_by_id(user.id)
    assert retrieved_user_by_id.username == user.username


def test_create_friend(db):
    datastore = get_datastore(db)
    user = datastore.create_user("testuser", "password")
    friend = datastore.create_friend(user.id, name="testfriend", description="a friend for testing", image="test.png")
    assert friend.name == "testfriend"

    friends = datastore.list_friends(user.id)
    assert len(friends) == 1
    assert friends[0].name == "testfriend"

    retrieved_friend = datastore.get_friend_for_user(friend.id, user.id)
    assert retrieved_friend.name == "testfriend"

    deleted = datastore.delete_friend(friend.id, user.id)
    assert deleted is True

    friends = datastore.list_friends(user.id)
    assert len(friends) == 0


def test_create_game(db):
    datastore = get_datastore(db)
    user = datastore.create_user("testuser", "password")
    game = datastore.create_game(user.id)
    assert game.host_id == user.id

    retrieved_game = datastore.get_game(game.id)
    assert retrieved_game.id == game.id

    games = datastore.list_games(user.id)
    assert len(games) == 1
    assert games[0].id == game.id

    updated_game = datastore.update_game(game.id, status=GameStatus.ACTIVE)
    assert updated_game.status == GameStatus.ACTIVE

    player = datastore.add_player(game.id, name="testplayer", avatar="test.png", friend_id=None)
    assert player.name == "testplayer"

    retrieved_player = datastore.get_player(game.id, player.id)
    assert retrieved_player.name == "testplayer"

    players = datastore.list_players(game.id)
    assert len(players) == 1
    assert players[0].name == "testplayer"

    updated_player = datastore.update_player(player.id, game.id, role="Mafia")
    assert updated_player.role == "Mafia"

    log = datastore.add_log(game.id, round=1, phase=GamePhase.DAY, message="test log")
    assert log.message == "test log"

    logs = datastore.list_logs(game.id)
    assert len(logs) == 1
    assert logs[0].message == "test log"

    bundle = datastore.get_game_bundle(game.id)
    assert bundle.game.id == game.id
    assert len(bundle.players) == 1
    assert len(bundle.logs) == 1