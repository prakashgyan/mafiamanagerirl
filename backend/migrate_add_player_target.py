"""
Migration: Add `target_player_id` column to players.

Supports the Executioner role, which is assigned a target player they
must get voted out to win. The target is tracked manually by the host;
this column just persists that assignment.

Run once against an existing database:
    python migrate_add_player_target.py

WARNING: Back up your database before running this script.
"""
from __future__ import annotations

from sqlalchemy import create_engine, text

from app.config import get_settings


def run() -> None:
    settings = get_settings()
    engine = create_engine(settings.database_url)

    with engine.begin() as conn:
        conn.execute(text(
            "ALTER TABLE players ADD COLUMN IF NOT EXISTS target_player_id INTEGER "
            "REFERENCES players(id)"
        ))
        print("Ensured players.target_player_id column exists.")

    print("Migration complete.")


if __name__ == "__main__":
    run()
