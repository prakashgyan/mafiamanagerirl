import { useEffect, useMemo, useRef, useState } from "react";

export type GameSocketMessage = {
  event: string;
  game_id: number;
  status: string;
  phase: string;
  round: number;
  public_auto_sync_enabled?: boolean;
  winning_team?: string | null;
  players?: Array<{
    id: number;
    name: string;
    role?: string | null;
    is_alive: boolean;
    public_is_alive?: boolean;
    actual_is_alive?: boolean;
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

export type ConnectionStatus = "connecting" | "open" | "reconnecting" | "closed" | "error";

type Options = {
  enabled?: boolean;
  onMessage?: (message: GameSocketMessage) => void;
  onStatusChange?: (status: ConnectionStatus) => void;
  reconnect?: {
    maximumDelayMs?: number;
  };
};

type UseGameSocketResult = {
  status: ConnectionStatus;
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

export const useGameSocket = (gameId: number | null, options: Options = {}): UseGameSocketResult => {
  const { enabled = true } = options;
  const [status, setStatus] = useState<ConnectionStatus>("closed");
  const optionsRef = useRef<Options>(options);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);

  optionsRef.current = options;

  useEffect(() => {
    optionsRef.current.onStatusChange?.(status);
  }, [status]);

  useEffect(() => {
    const cleanup = () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (socketRef.current) {
        socketRef.current.onopen = null;
        socketRef.current.onclose = null;
        socketRef.current.onerror = null;
        socketRef.current.onmessage = null;
        socketRef.current.close();
        socketRef.current = null;
      }
    };

    if (!gameId || !enabled) {
      cleanup();
      setStatus("closed");
      return cleanup;
    }

    let isActive = true;
    const baseUrl = resolveWebSocketBase();
    const { maximumDelayMs = 30_000 } = optionsRef.current.reconnect ?? {};

    const connect = () => {
      if (!isActive || !gameId || !enabled) {
        return;
      }

      const attemptCount = reconnectAttemptsRef.current;
      setStatus(attemptCount > 0 ? "reconnecting" : "connecting");

      const socket = new WebSocket(`${baseUrl}/ws/game/${gameId}`);
      socketRef.current = socket;

      socket.onopen = () => {
        if (!isActive) {
          return;
        }
        reconnectAttemptsRef.current = 0;
        setStatus("open");
      };

      socket.onmessage = (event) => {
        const message = parseSocketPayload(event.data);
        if (message) {
          optionsRef.current.onMessage?.(message);
        }
      };

      const scheduleReconnect = () => {
        if (!isActive || !enabled) {
          return;
        }
        const nextAttempt = reconnectAttemptsRef.current + 1;
        reconnectAttemptsRef.current = nextAttempt;
        const delay = Math.min(maximumDelayMs, 1000 * 2 ** Math.max(0, nextAttempt - 1));
        setStatus("reconnecting");
        reconnectTimerRef.current = window.setTimeout(() => {
          reconnectTimerRef.current = null;
          connect();
        }, delay);
      };

      socket.onclose = () => {
        if (!isActive) {
          return;
        }
        if (!enabled) {
          setStatus("closed");
          return;
        }
        scheduleReconnect();
      };

      socket.onerror = () => {
        if (!isActive) {
          return;
        }
        setStatus("error");
        try {
          socket.close();
        } catch {
          // Swallow close errors during retry handling
        }
      };
    };

    connect();

    return () => {
      isActive = false;
      cleanup();
    };
  }, [enabled, gameId]);

  return useMemo(() => ({ status }), [status]);
};
