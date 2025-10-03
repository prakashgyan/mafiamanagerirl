from __future__ import annotations

from typing import Iterable

from .models import GameAggregate, Player

MAFIA_ROLES = {"Mafia"}
GOOD_ROLES = {"Villager", "Doctor", "Detective", "Jester"}

# Precompute lowercase role sets to avoid recomputation on every function call
MAFIA_ROLES_LOWER = {role.lower() for role in MAFIA_ROLES}


def alive_players(players: Iterable[Player]) -> list[Player]:
    return [player for player in players if player.is_alive]


def count_mafia(players: Iterable[Player]) -> int:
    return sum(1 for player in players if player.is_alive and (player.role or "").lower() in MAFIA_ROLES_LOWER)


def count_non_mafia(players: Iterable[Player]) -> int:
    return sum(
        1
        for player in players
        if player.is_alive and (player.role or "").lower() not in MAFIA_ROLES_LOWER
    )


def resolve_vote_elimination(player: Player) -> str | None:
    role = (player.role or "").lower()
    if role == "jester":
        return "Jester"
    return None


def determine_winner(game: GameAggregate) -> str | None:
    mafia_alive = count_mafia(game.players)
    others_alive = count_non_mafia(game.players)

    if mafia_alive == 0:
        return "Villagers"
    if mafia_alive >= others_alive and mafia_alive > 0:
        return "Mafia"
    return None
