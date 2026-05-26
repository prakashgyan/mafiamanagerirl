# MafiaDesk

A companion app for hosting in-person Mafia nights. A FastAPI backend + React dashboard lets hosts manage players, assign roles, log actions, and push live updates to everyone at the table.

## Stack

| Layer | Tech |
| --- | --- |
| Backend | FastAPI, SQLAlchemy, Pydantic, JWT auth, WebSockets |
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, React DnD |
| Database | PostgreSQL (via `APP_DATABASE_URL`), cookie-based auth |

## Quick start

Requires Python 3.11+ and Node 18+.

### Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# copy .env template from backend/README.md, then:
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The app expects the API at `http://localhost:8000` — override with `VITE_API_BASE` / `VITE_WS_BASE` if needed.

### Run a game

1. Sign up for a host account.
2. Add friends to your roster and create a game.
3. Assign roles, advance phases, and log actions — dashboards update live.

## Docs

- [`backend/README.md`](backend/README.md) — env vars, API routes, testing
- [`frontend/README.md`](frontend/README.md) — env vars, dev workflow
