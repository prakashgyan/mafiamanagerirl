from __future__ import annotations

import logging

from fastapi import Depends, FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from starlette.websockets import WebSocketDisconnect

from .config import get_settings
from .database import Base, engine, get_db
from .models import Game
from .router_registry import include_routers
from .socket_manager import manager

settings = get_settings()
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="MafiaDesk", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine, checkfirst=True)


include_routers(app)


@app.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@app.websocket("/ws/game/{game_id}")
async def websocket_endpoint(websocket: WebSocket, game_id: int, db: Session = Depends(get_db)) -> None:
    await manager.connect(game_id, websocket)
    try:
        game = db.query(Game).filter(Game.id == game_id).first()
        if game:
            await manager.broadcast(
                game_id,
                {
                    "event": "init",
                    "game_id": game.id,
                    "status": game.status.value,
                    "phase": game.current_phase.value,
                    "round": game.current_round,
                    "winning_team": game.winning_team,
                    "players": [
                        {"id": player.id, "name": player.name, "role": player.role, "is_alive": player.is_alive}
                        for player in game.players
                    ],
                    "logs": [
                        {
                            "id": log.id,
                            "round": log.round,
                            "phase": log.phase.value,
                            "message": log.message,
                            "timestamp": log.timestamp.isoformat(),
                        }
                        for log in game.logs
                    ],
                },
            )
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(game_id, websocket)
    except Exception as exc:  # pragma: no cover - safety net for unexpected websocket failures
        logging.exception("WebSocket error: %s", exc)
        manager.disconnect(game_id, websocket)
        await websocket.close(code=1011)
