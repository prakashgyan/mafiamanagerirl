from __future__ import annotations

from typing import Iterable

from .models import Game, Player

MAFIA_ROLES = {"Mafia"}
GOOD_ROLES = {"Villager", "Doctor", "Detective", "Jester"}


def alive_players(players: Iterable[Player]) -> list[Player]:
    return [player for player in players if player.is_alive]


def count_mafia(players: Iterable[Player]) -> int:
    return sum(1 for player in players if player.is_alive and (player.role or "").lower() in {role.lower() for role in MAFIA_ROLES})


def count_non_mafia(players: Iterable[Player]) -> int:
    return sum(
        1
        for player in players
        if player.is_alive and (player.role or "").lower() not in {role.lower() for role in MAFIA_ROLES}
    )


def resolve_vote_elimination(player: Player) -> str | None:
    role = (player.role or "").lower()
    if role == "jester":
        return "Jester"
    return None


def determine_winner(game: Game) -> str | None:
    mafia_alive = count_mafia(game.players)
    others_alive = count_non_mafia(game.players)

    if mafia_alive == 0:
        return "Villagers"
    if mafia_alive >= others_alive and mafia_alive > 0:
        return "Mafia"
    return None
