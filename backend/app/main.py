from __future__ import annotations

from fastapi import Depends, FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from starlette.websockets import WebSocketDisconnect

from loguru import logger

from .config import get_settings
from .database import Datastore, get_datastore, init_db, get_db
from .logging_utils import configure_logging
from .router_registry import include_routers
from sqlalchemy.orm import Session
from .services.game_service import GameService
from .socket_manager import manager

configure_logging()
settings = get_settings()

logger.bind(environment=settings.environment).info("Booting MafiaDesk backend")

app = FastAPI(title="MafiaDesk", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


init_db()

include_routers(app)


@app.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


def get_game_service(db: Session = Depends(get_db)) -> GameService:
    datastore = get_datastore(db)
    return GameService(datastore)


from .database import SessionLocal

@app.websocket("/ws/game/{game_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    game_id: int,
) -> None:
    await manager.connect(game_id, websocket)
    db = SessionLocal()
    try:
        datastore = get_datastore(db)
        game_service = GameService(datastore)
        game_manager = game_service.get_game_manager(game_id)
        if game_manager:
            await manager.broadcast(game_id, game_manager.serialize_for_broadcast("init"))
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(game_id, websocket)
    except Exception:  # pragma: no cover - safety net for unexpected websocket failures
        logger.exception("WebSocket error during session for game {}", game_id)
        manager.disconnect(game_id, websocket)
        await websocket.close(code=1011)
    finally:
        db.close()
