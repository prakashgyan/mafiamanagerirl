from __future__ import annotations

from collections import defaultdict
from typing import Any, Dict, List

from fastapi import WebSocket
from starlette.websockets import WebSocketDisconnect


class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: Dict[int, List[WebSocket]] = defaultdict(list)

    async def connect(self, game_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections[game_id].append(websocket)

    def disconnect(self, game_id: int, websocket: WebSocket) -> None:
        if websocket in self.active_connections.get(game_id, []):
            self.active_connections[game_id].remove(websocket)
        if not self.active_connections[game_id]:
            self.active_connections.pop(game_id, None)

    async def broadcast(self, game_id: int, message: Dict[str, Any]) -> None:
        for connection in list(self.active_connections.get(game_id, [])):
            try:
                await connection.send_json(message)
            except (WebSocketDisconnect, RuntimeError):
                self.disconnect(game_id, connection)


manager = ConnectionManager()
