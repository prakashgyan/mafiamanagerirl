# Frontend – Vite + React client

The frontend is a React 18 dashboard styled with Tailwind CSS. It lets hosts authenticate, manage friends, spin up new Mafia games, assign roles via drag-and-drop, and monitor the action with live updates.

## Requirements

- Node.js 18 or newer
- npm (bundled with Node)

## Installation

```bash
cd frontend
npm install
```

## Environment variables

The client reads Vite-style variables (all prefixed with `VITE_`). Create a `.env.local` file next to `package.json` when you need to override defaults:

```bash
cat <<'EOF' > .env.local
VITE_API_BASE=http://localhost:8000
VITE_WS_BASE=ws://localhost:8000
EOF
```

- `VITE_API_BASE` – base URL for REST calls. Defaults to the local FastAPI server in dev and `https://backend.mafiadesk.com` in production builds.
- `VITE_WS_BASE` – WebSocket origin used by the live dashboard. If omitted, the app infers it from `VITE_API_BASE`/window origin.

## Development workflow

Start Vite in watch mode:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) to interact with the UI. Keep the FastAPI backend running on port 8000 so authentication and game actions succeed.

## Quality checks

```bash
npm run lint
npm run build
```

- `npm run lint` executes ESLint + TypeScript checks.
- `npm run build` produces an optimized bundle in `dist/` which you can preview with `npm run preview`.

## Feature tour

- **Authentication** – wraps the API in an `AuthProvider` that stores the current session and guards routes.
- **Friend roster** – save frequently used players and reuse them when creating games.
- **Game creation** – mix friends and custom names, balance role counts, and launch a new session.
- **Real-time dashboards** – subscribe to `/ws/game/{id}` for synchronized player states, logs, and phase changes.
- **Responsive layout** – the UI adapts to tablets and desktops with Tailwind utility classes and custom breakpoints.

For broader project context and backend instructions, see the root [`README.md`](../README.md).
