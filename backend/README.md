# Backend – FastAPI service

This directory contains the FastAPI application that powers MafiaDesk. It exposes REST endpoints for authentication, friend management, and game orchestration plus a WebSocket channel for live state updates.

## Requirements

- Python 3.11 or newer
- pip (comes with Python) and a virtual environment tool of your choice
- A reachable PostgreSQL instance (local Docker container or hosted service)

## Installation

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Configuration

Settings are defined in `app/config.py` and loaded from environment variables with the `APP_` prefix. Create a `.env` file in `backend/` to keep local defaults:

```bash
cat <<'EOF' > .env
APP_SECRET_KEY=change-me
APP_ACCESS_TOKEN_EXPIRE_MINUTES=1440
APP_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
APP_DATABASE_HOST=localhost
APP_DATABASE_PORT=5432
APP_DATABASE_USER=postgres
APP_DATABASE_PASSWORD=postgres
APP_DATABASE_NAME=mafiadesk
# APP_DATABASE_SSL_MODE=require
# Optional cookies tuning for custom domains
# APP_AUTH_COOKIE_DOMAIN=example.com
# APP_AUTH_COOKIE_SECURE=true
# APP_AUTH_COOKIE_SAMESITE=none
EOF
```

> Secrets such as `APP_SECRET_KEY` and database credentials should be replaced before deploying. The example values above assume a local PostgreSQL server.

## Running the server

Start the API with live reload on port 8000:

```bash
uvicorn app.main:app --reload --port 8000
```

Key routes:

- `GET /health` – simple readiness probe.
- `POST /auth/signup`, `/auth/login`, `/auth/logout`, `GET /auth/me` – cookie-based auth flow.
- `GET/POST/DELETE /friends/` – curate reusable player rosters.
- `GET /games/`, `POST /games/new`, `POST /games/{id}/assign_roles` … – create and control Mafia games.
- `POST /games/{id}/action`, `POST /games/{id}/phase`, `POST /games/{id}/finish` – record gameplay events and progress rounds.
- `POST /games/{id}/sync_night` – push night actions to public displays.
- `WebSocket /ws/game/{id}` – broadcast real-time game state to dashboards.

Authentication uses signed JWT cookies. The WebSocket manager keeps per-game rooms and rebroadcasts serialized state whenever game data changes.

## Logging

Logging is powered by [Loguru](https://loguru.readthedocs.io). Verbosity automatically adapts to the configured environment:

- `development` / `test`: rich, colorized debug logs with stack traces to ease troubleshooting.
- `staging`: concise structured info-level logs suitable for shared environments.
- `production`: warning-level output only, keeping noise to a minimum.

Data-layer operations and key API handlers emit structured debug events. Sensitive fields such as passwords are automatically redacted before they reach the log stream.

## Testing

```bash
pytest
```

The test suite swaps the PostgreSQL-backed datastore for an in-memory implementation so it can execute end-to-end flows without touching external services.

## Data persistence notes

- Production reads and writes go through PostgreSQL using SQLAlchemy models defined in `app/database.py`.
- Set the connection string through `APP_DATABASE_URL` or individual `APP_DATABASE_*` environment variables.
