# Backend – FastAPI service

This directory contains the FastAPI application that powers MafiaDesk. It exposes REST endpoints for authentication, friend management, and game orchestration plus a WebSocket channel for live state updates.

## Requirements

- Python 3.11 or newer
- pip (comes with Python) and a virtual environment tool of your choice
- Access to Google Firestore (either a project or the local emulator)
- A service-account credential with Firestore permissions (`home-projects-access.json` is provided for local work)

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
APP_FIRESTORE_PROJECT_ID=mafiadesk
APP_FIRESTORE_CREDENTIALS_FILE=home-projects-access.json
# If you're using the local emulator instead of a live project, uncomment:
# APP_FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
# Optional cookies tuning for custom domains
# APP_AUTH_COOKIE_DOMAIN=example.com
# APP_AUTH_COOKIE_SECURE=true
# APP_AUTH_COOKIE_SAMESITE=none
EOF
```

> Secrets such as `APP_SECRET_KEY` should be replaced before deploying. The default credentials path points at the repo-level `home-projects-access.json`; adjust it to match your environment or set `GOOGLE_APPLICATION_CREDENTIALS` directly.

### Firestore composite indexes

All production queries rely on Firestore composite indexes that are tracked in `backend/firestore.indexes.json`. Deploy them to your project before running the FastAPI service against a live Firestore instance:

```bash
cd backend
gcloud firestore indexes composite create \
  --database=mafiadesk \
  --config=firestore.indexes.json \
  --project="$APP_FIRESTORE_PROJECT_ID"
```

If you prefer the Firebase CLI, run the following once you have a matching `firebase.json` pointing at your project:

```bash
firebase deploy --only firestore:indexes
```

When using the Firestore emulator, copy the same file into your emulator config or load it with `gcloud beta emulators firestore start --import`.

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

Authentication uses signed JWT cookies. The WebSocket manager keeps per-game rooms and rebroadcasts serialized state when Firestore documents change.

## Testing

```bash
pytest
```

The test suite swaps the Firestore implementation for an in-memory datastore so it can execute end-to-end flows without touching external services.

## Data persistence notes

- Production reads and writes go through Google Firestore collections. IDs remain numeric by using counter documents.
- Credentials are loaded from the configured service-account JSON. Keep this file out of version control in real deployments.
- For development or CI without cloud access, point `APP_FIRESTORE_EMULATOR_HOST` at a running Firestore emulator instance.
