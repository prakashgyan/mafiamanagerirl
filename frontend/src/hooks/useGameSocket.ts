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

export const useGameSocket = (gameId: number | null, options: Options = {}) => {
  const { enabled = true, onMessage } = options;
  const handlerRef = useRef<Options["onMessage"]>(onMessage);
  handlerRef.current = onMessage;

  useEffect(() => {
    if (!gameId || !enabled) {
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const defaultWsBase = "wss://api.mafiadesk.com";
    const rawWsBase = import.meta.env.VITE_WS_BASE ?? defaultWsBase;
    const wsBase = (rawWsBase || `${protocol}://${window.location.host}`).replace(/\/+$/, "");
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
