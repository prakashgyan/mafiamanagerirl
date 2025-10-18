import { useEffect, useRef } from "react";

export type GameSocketMessage = {
  event: string;
  game_id: number;
  status: string;
  phase: string;
  round: number;
  winning_team?: string | null;
  players?: Array<{
    id: number;
    name: string;
    role?: string | null;
    is_alive: boolean;
    avatar?: string | null;
    friend_id?: number | null;
  }>;
  logs?: Array<{ id: number; round: number; phase: string; message: string; timestamp: string }>;
};

const isGameSocketMessage = (value: unknown): value is GameSocketMessage => {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<GameSocketMessage>;
  return (
    typeof candidate.event === "string" &&
    typeof candidate.status === "string" &&
    typeof candidate.game_id === "number" &&
    typeof candidate.phase === "string" &&
    typeof candidate.round === "number"
  );
};

const parseSocketPayload = (payload: unknown): GameSocketMessage | null => {
  if (typeof payload !== "string") {
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const parsed: unknown = JSON.parse(payload);
    return isGameSocketMessage(parsed) ? parsed : null;
  } catch (error) {
    console.warn("Invalid websocket payload", error);
    return null;
  }
};

type Options = {
  enabled?: boolean;
  onMessage?: (message: GameSocketMessage) => void;
};

const WS_FALLBACKS = {
  development: "ws://localhost:8000",
  production: "wss://backend.mafiadesk.com",
} as const;

const stripTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const isLocalOrigin = (origin: string) =>
  origin.includes("localhost") || origin.includes("127.0.0.1");

const inferWebSocketFromHttp = (maybeHttpBase: string) => {
  try {
    const url = new URL(maybeHttpBase);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return stripTrailingSlash(url.toString());
  } catch {
    return "";
  }
};

const resolveWebSocketBase = () => {
  const fromEnv = import.meta.env.VITE_WS_BASE?.trim();
  if (fromEnv) {
    return stripTrailingSlash(fromEnv);
  }

  const inferredFromApi = import.meta.env.VITE_API_BASE?.trim();
  if (inferredFromApi) {
    const derived = inferWebSocketFromHttp(inferredFromApi);
    if (derived) {
      return derived;
    }
  }

  if (import.meta.env.DEV) {
    return stripTrailingSlash(WS_FALLBACKS.development);
  }

  if (typeof window !== "undefined") {
    const origin = window.location.origin.toLowerCase();
    if (isLocalOrigin(origin)) {
      return stripTrailingSlash(WS_FALLBACKS.development);
    }

    if (origin.includes("backend.mafiadesk.com")) {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      return stripTrailingSlash(`${protocol}//${window.location.host}`);
    }
  }

  return stripTrailingSlash(WS_FALLBACKS.production);
};

export const useGameSocket = (gameId: number | null, options: Options = {}) => {
  const { enabled = true, onMessage } = options;
  const handlerRef = useRef<Options["onMessage"]>(onMessage);
  handlerRef.current = onMessage;

  useEffect(() => {
    if (!gameId || !enabled) {
      return;
    }

    const wsBase = resolveWebSocketBase();
    const socket = new WebSocket(`${wsBase}/ws/game/${gameId}`);

    socket.onmessage = (event) => {
      const message = parseSocketPayload(event.data);
      if (message) {
        handlerRef.current?.(message);
      }
    };

    return () => {
      socket.close();
    };
  }, [enabled, gameId]);
};
