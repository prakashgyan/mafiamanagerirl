# Backend

FastAPI service powering MafiaDesk — REST + WebSocket API for auth, friends, and game management.

## Requirements

- Python 3.11+
- PostgreSQL (local or hosted)

## Setup

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

Create a `.env` file:

```env
APP_SECRET_KEY=change-me
APP_ACCESS_TOKEN_EXPIRE_MINUTES=1440
APP_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
APP_DATABASE_HOST=localhost
APP_DATABASE_PORT=5432
APP_DATABASE_USER=postgres
APP_DATABASE_PASSWORD=postgres
APP_DATABASE_NAME=mafiadesk
```

Replace `APP_SECRET_KEY` and database credentials before deploying.

## Running

```bash
uvicorn app.main:app --reload --port 8000
```

## API overview

| Route | Description |
| --- | --- |
| `GET /health` | Readiness probe |
| `POST /auth/signup` `/auth/login` `/auth/logout` | Cookie-based auth |
| `GET /auth/me` | Current user |
| `GET/POST/DELETE /friends/` | Friend roster |
| `POST /games/new` | Create a game |
| `POST /games/{id}/assign_roles` | Assign factions |
| `POST /games/{id}/action` `/phase` `/finish` | Gameplay events |
| `WebSocket /ws/game/{id}` | Live state stream |

## Testing

```bash
pytest
```

Tests use an in-memory datastore — no database required.
