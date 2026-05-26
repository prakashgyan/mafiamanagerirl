from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address
from starlette.websockets import WebSocketDisconnect

from loguru import logger

from .config import get_settings
from .database import get_datastore, init_db, get_db
from .logging_utils import configure_logging
from .router_registry import include_routers
from .services.game_service import GameService
from .socket_manager import manager

configure_logging()
settings = get_settings()

logger.bind(environment=settings.environment).info("Booting MafiaDesk backend")

limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initialising database…")
    t0 = asyncio.get_event_loop().time()
    await asyncio.to_thread(init_db)
    logger.info("Database ready in {:.2f}s", asyncio.get_event_loop().time() - t0)
    yield


app = FastAPI(title="MafiaDesk", version="1.0.0", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


include_routers(app)


@app.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@app.websocket("/ws/game/{game_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    game_id: str,
) -> None:
    await manager.connect(game_id, websocket)

    # Acquire DB only for the initial state broadcast, then release immediately.
    db_gen = get_db()
    db = next(db_gen)
    try:
        datastore = get_datastore(db)
        game_service = GameService(datastore)
        game_manager = game_service.get_game_manager(game_id)
        if game_manager:
            await manager.broadcast(game_id, game_manager.serialize_for_broadcast("init"))
    finally:
        try:
            next(db_gen)
        except StopIteration:
            pass

    # Hold the socket open without occupying a DB connection.
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(game_id, websocket)
    except Exception:  # pragma: no cover - safety net for unexpected websocket failures
        logger.exception("WebSocket error during session for game {}", game_id)
        manager.disconnect(game_id, websocket)
        await websocket.close(code=1011)
