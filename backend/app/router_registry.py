from __future__ import annotations

from fastapi import FastAPI

from .routers import auth, friends, games


def include_routers(app: FastAPI) -> None:
    app.include_router(auth.router)
    app.include_router(friends.router)
    app.include_router(games.router)
