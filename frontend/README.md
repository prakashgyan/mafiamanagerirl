# Frontend

React 18 dashboard for MafiaDesk — hosts authenticate, manage friends, run games, and monitor live updates.

## Requirements

- Node.js 18+

## Setup

```bash
cd frontend
npm install
```

## Environment variables

Create `.env.local` to override defaults:

```env
VITE_API_BASE=http://localhost:8000
VITE_WS_BASE=ws://localhost:8000
```

Both default to `localhost:8000` in dev. In production builds they fall back to `https://backend.mafiadesk.com` / `wss://backend.mafiadesk.com`.

## Dev

```bash
npm run dev      # http://localhost:5173
npm run lint     # ESLint + TypeScript
npm run build    # Production bundle → dist/
```
