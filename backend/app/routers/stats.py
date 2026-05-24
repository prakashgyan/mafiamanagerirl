from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_datastore, get_db
from ..deps import get_current_user
from ..game_logic import MAFIA_ROLES_LOWER
from ..models import GameStatus, User

router = APIRouter(prefix="/stats", tags=["stats"])


class LeaderboardEntry(BaseModel):
    friend_id: int
    name: str
    image: str | None
    wins: int
    games_played: int


@router.get("/leaderboard", response_model=list[LeaderboardEntry])
def get_leaderboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    datastore = get_datastore(db)

    friends = datastore.list_friends(current_user.id)
    if not friends:
        return []

    friend_map = {f.id: f for f in friends}
    wins: dict[int, int] = {f.id: 0 for f in friends}
    played: dict[int, int] = {f.id: 0 for f in friends}

    finished_games = datastore.list_games(current_user.id, status_filter=GameStatus.FINISHED)
    for game in finished_games:
        bundle = datastore.get_game_bundle(game.id)
        if bundle is None or bundle.winning_team is None:
            continue
        winning_team = bundle.winning_team.lower()
        for player in bundle.players:
            if player.friend_id is None or player.friend_id not in friend_map:
                continue
            played[player.friend_id] = played.get(player.friend_id, 0) + 1
            role_lower = (player.role or "").lower()
            is_mafia = role_lower in MAFIA_ROLES_LOWER
            if (is_mafia and winning_team == "mafia") or (not is_mafia and winning_team != "mafia"):
                wins[player.friend_id] = wins.get(player.friend_id, 0) + 1

    entries = [
        LeaderboardEntry(
            friend_id=fid,
            name=friend_map[fid].name,
            image=friend_map[fid].image,
            wins=wins.get(fid, 0),
            games_played=played.get(fid, 0),
        )
        for fid in friend_map
        if played.get(fid, 0) > 0
    ]

    entries.sort(key=lambda e: e.wins, reverse=True)
    return entries[:10]
