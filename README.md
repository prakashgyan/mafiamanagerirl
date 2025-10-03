# MafiaDesk

Modern companion app for running in-person Mafia social deduction nights. It combines a FastAPI backend with a Vite-powered React dashboard so a game host can manage players, assign roles, record actions, and keep everyone in sync in real time.

## Highlights

- **Host-first workflow** – sign up, curate a reusable friend roster, and spin up new games in minutes.
- **Role & phase management** – assign factions, resolve day/night actions, and progress rounds with guardrails.
- **Live event feed** – instant updates flow to connected clients over WebSockets for dashboards and public displays.
- **Persistent history** – SQLite keeps games, players, and logs so you can revisit outcomes later.
- **Type-safe UI** – React + TypeScript + Tailwind deliver a responsive control room tailored for tablets and laptops.

## Tech stack

| Layer | Stack |
| --- | --- |
| Backend | FastAPI, SQLAlchemy, Pydantic, JWT auth, AnyIO WebSockets |
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, React DnD |
| Data & infra | SQLite by default (swap via `APP_DATABASE_URL`), cookie-based auth |

## Repository layout

| Path | Purpose |
| --- | --- |
| `backend/` | FastAPI application, Firestore integration, business logic, and API tests. See [`backend/README.md`](backend/README.md). |
| `frontend/` | Vite + React web client used by game hosts. See [`frontend/README.md`](frontend/README.md). |

## Quick start

You can run the backend and frontend in separate terminals. Requirements: Python 3.11+, Node 18+, and npm.

### 1. Start the API locally

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# create a .env file (see backend/README.md for the required keys)
uvicorn app.main:app --reload --port 8000
```

> The backend README includes an `.env` template and additional configuration notes.

### 2. Start the web client

```bash
cd frontend
npm install
npm run dev
```

Visit [http://localhost:5173](http://localhost:5173) in your browser (the Vite dev server proxies static assets). The frontend expects the API at `http://localhost:8000` and the WebSocket endpoint at `ws://localhost:8000`. Configure `VITE_API_BASE` and `VITE_WS_BASE` if you need different hosts.

### 3. Sign up and run a table

1. Create a host account via the UI (or `POST /auth/signup`).
2. Add friends to your roster, then assemble a new game.
3. Assign roles, advance phases, and log events; connected dashboards update instantly.

## Tooling & scripts

- **Backend** – run `pytest` from `backend/` to execute the end-to-end API test suite.
- **Frontend** – run `npm run lint` for TypeScript/ESLint checks; `npm run build` generates a production bundle.
- **Database** – uses Google Firestore for data persistence. See `backend/.env` for Firestore configuration options.

## Environments

The FastAPI settings system reads variables with the `APP_` prefix (see [`backend/app/config.py`](backend/app/config.py)). The web client reads Vite-style env vars prefixed with `VITE_`.


APP_FIRESTORE_PROJECT_ID=mafiadesk

- Keep backend tests green (`pytest`) and frontend lint clean before committing.
- Consider adding production deployment notes (containerization, migrations) once the hosting target is chosen.
- Issues and feature requests can document new game mechanics or spectator modes.

For deeper service-specific instructions, dive into the linked READMEs inside `backend/` and `frontend/`.
