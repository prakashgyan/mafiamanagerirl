"""
Migration: Convert game IDs from integer sequences to 6-character alphanumeric codes.

Run once against an existing database:
    python migrate_game_ids_to_codes.py

This script:
1. Adds a new `code` column to games, players, and logs
2. Generates unique codes for all existing games
3. Updates FK references in players and logs
4. Drops the old integer id and renames code -> id

WARNING: Back up your database before running this script.
"""
from __future__ import annotations

import secrets
import string
from sqlalchemy import create_engine, text

from app.config import get_settings

_ALPHABET = string.ascii_uppercase + string.digits


def _new_code(used: set[str]) -> str:
    while True:
        code = "".join(secrets.choice(_ALPHABET) for _ in range(6))
        if code not in used:
            used.add(code)
            return code


def run() -> None:
    settings = get_settings()
    engine = create_engine(settings.database_url)

    with engine.begin() as conn:
        # Fetch existing game rows
        games = conn.execute(text("SELECT id FROM games ORDER BY id")).fetchall()
        if not games:
            print("No games found — nothing to migrate.")
            return

        used_codes: set[str] = set()
        id_to_code: dict[int, str] = {}
        for (game_id,) in games:
            id_to_code[game_id] = _new_code(used_codes)

        print(f"Migrating {len(id_to_code)} game(s) ...")

        # Add temporary code columns
        conn.execute(text("ALTER TABLE games ADD COLUMN IF NOT EXISTS code VARCHAR(6)"))
        conn.execute(text("ALTER TABLE players ADD COLUMN IF NOT EXISTS game_code VARCHAR(6)"))
        conn.execute(text("ALTER TABLE logs ADD COLUMN IF NOT EXISTS game_code VARCHAR(6)"))

        # Populate codes
        for old_id, code in id_to_code.items():
            conn.execute(text("UPDATE games SET code = :code WHERE id = :id"), {"code": code, "id": old_id})
            conn.execute(text("UPDATE players SET game_code = :code WHERE game_id = :id"), {"code": code, "id": old_id})
            conn.execute(text("UPDATE logs SET game_code = :code WHERE game_id = :id"), {"code": code, "id": old_id})

        # Drop old FK constraints (PostgreSQL)
        conn.execute(text("ALTER TABLE players DROP CONSTRAINT IF EXISTS players_game_id_fkey"))
        conn.execute(text("ALTER TABLE logs DROP CONSTRAINT IF EXISTS logs_game_id_fkey"))

        # Swap columns in players
        conn.execute(text("ALTER TABLE players DROP COLUMN game_id"))
        conn.execute(text("ALTER TABLE players RENAME COLUMN game_code TO game_id"))

        # Swap columns in logs
        conn.execute(text("ALTER TABLE logs DROP COLUMN game_id"))
        conn.execute(text("ALTER TABLE logs RENAME COLUMN game_code TO game_id"))

        # Swap primary key in games
        conn.execute(text("ALTER TABLE games DROP CONSTRAINT games_pkey"))
        conn.execute(text("ALTER TABLE games DROP COLUMN id"))
        conn.execute(text("ALTER TABLE games RENAME COLUMN code TO id"))
        conn.execute(text("ALTER TABLE games ADD PRIMARY KEY (id)"))

        # Restore FK constraints
        conn.execute(text(
            "ALTER TABLE players ADD CONSTRAINT players_game_id_fkey "
            "FOREIGN KEY (game_id) REFERENCES games(id)"
        ))
        conn.execute(text(
            "ALTER TABLE logs ADD CONSTRAINT logs_game_id_fkey "
            "FOREIGN KEY (game_id) REFERENCES games(id)"
        ))

    print("Migration complete.")
    for old_id, code in sorted(id_to_code.items()):
        print(f"  Game {old_id} -> {code}")


if __name__ == "__main__":
    run()
