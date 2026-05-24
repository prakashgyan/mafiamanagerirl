export type User = {
  id: number;
  username: string;
  public_auto_sync_enabled: boolean;
};

export type Friend = {
  id: number;
  name: string;
  description?: string | null;
  image?: string | null;
};

export type LeaderboardEntry = {
  friend_id: number;
  name: string;
  image?: string | null;
  wins: number;
  games_played: number;
};

export type Player = {
  id: number;
  name: string;
  role?: string | null;
  is_alive: boolean;
  public_is_alive?: boolean;
  actual_is_alive?: boolean;
  avatar?: string | null;
  friend_id?: number | null;
};

export type LogEntry = {
  id: number;
  round: number;
  phase: "day" | "night";
  message: string;
  timestamp: string;
};

export type GameStatus = "pending" | "active" | "finished";
export type GamePhase = "day" | "night";

export type GameSummary = {
  id: string;
  status: GameStatus;
  current_phase: GamePhase;
  current_round: number;
  winning_team?: string | null;
  created_at?: string | null;
};

export type GameDetail = GameSummary & {
  players: Player[];
  logs: LogEntry[];
};

export type CreateGamePlayer = {
  name: string;
  avatar?: string | null;
  friend_id?: number | null;
};

export type GameActionPayload = {
  action_type: string;
  target_player_id?: number;
  actor_role?: string;
  note?: string;
};

export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnauthorizedError";
  }
}

let unauthorizedHandler: (() => void) | null = null;

export const setUnauthorizedHandler = (handler: () => void): void => {
  unauthorizedHandler = handler;
};

const API_FALLBACKS = {
  development: "http://localhost:8000",
  production: "https://backend.mafiadesk.com",
} as const;

const stripTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const isLocalHost = (origin: string) =>
  origin.includes("localhost") || origin.includes("127.0.0.1");

const resolveApiBase = () => {
  const fromEnv = import.meta.env.VITE_API_BASE?.trim();
  if (fromEnv) {
    return stripTrailingSlash(fromEnv);
  }

  if (import.meta.env.DEV) {
    return stripTrailingSlash(API_FALLBACKS.development);
  }

  if (typeof window !== "undefined") {
    const origin = window.location.origin.toLowerCase();
    if (isLocalHost(origin)) {
      return stripTrailingSlash(API_FALLBACKS.development);
    }

    if (origin.includes("backend.mafiadesk.com")) {
      return stripTrailingSlash(`${window.location.protocol}//${window.location.host}`);
    }
  }

  return stripTrailingSlash(API_FALLBACKS.production);
};

const API_BASE = resolveApiBase();

const buildUrl = (path: string) => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (!API_BASE) {
    return normalizedPath;
  }
  return `${API_BASE}${normalizedPath}`;
};

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(buildUrl(path), {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  if (!response.ok) {
    const raw = await response.text();
    let message = raw;
    try {
      const parsed = JSON.parse(raw) as { detail?: string | unknown };
      if (typeof parsed.detail === "string") {
        message = parsed.detail;
      } else if (parsed.detail !== undefined) {
        message = JSON.stringify(parsed.detail);
      }
    } catch {
      // raw text is not JSON — use as-is
    }
    if (response.status === 401) {
      unauthorizedHandler?.();
      throw new UnauthorizedError(message || "Unauthorized");
    }
    throw new Error(message || `Request failed with ${response.status}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const data: unknown = await (response.json() as Promise<unknown>);
  return data as T;
}

export const api = {
  signup: (username: string, password: string) =>
    apiFetch<User>("/auth/signup", { method: "POST", body: JSON.stringify({ username, password }) }),
  login: (username: string, password: string) =>
    apiFetch<User>("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  demoLogin: () => apiFetch<User>("/auth/demo-login", { method: "POST" }),
  logout: () => apiFetch<void>("/auth/logout", { method: "POST" }),
  me: () => apiFetch<User>("/auth/me"),
  updatePreferences: (payload: { public_auto_sync_enabled?: boolean }) =>
    apiFetch<User>("/auth/me/preferences", { method: "PATCH", body: JSON.stringify(payload) }),

  listFriends: () => apiFetch<Friend[]>("/friends/"),
  createFriend: (payload: { name: string; description?: string; image?: string | null }) =>
    apiFetch<Friend>("/friends/", { method: "POST", body: JSON.stringify(payload) }),
  deleteFriend: (friendId: number) =>
    apiFetch<void>(`/friends/${friendId}`, { method: "DELETE" }),

  getLeaderboard: () => apiFetch<LeaderboardEntry[]>("/stats/leaderboard"),

  listGames: (status?: GameStatus) =>
    apiFetch<GameSummary[]>(status ? `/games/?status_filter=${status}` : "/games/"),
  getGame: (id: string) => apiFetch<GameDetail>(`/games/${id}`),
  createGame: (players: CreateGamePlayer[]) =>
    apiFetch<GameDetail>("/games/new", { method: "POST", body: JSON.stringify({ players }) }),
  assignRoles: (gameId: string, assignments: { player_id: number; role: string }[]) =>
    apiFetch<GameDetail>(`/games/${gameId}/assign_roles`, {
      method: "POST",
      body: JSON.stringify({ assignments }),
    }),
  startGame: (gameId: string) => apiFetch<GameDetail>(`/games/${gameId}/start`, { method: "POST" }),
  sendAction: (gameId: string, payload: GameActionPayload) =>
    apiFetch<GameDetail>(`/games/${gameId}/action`, { method: "POST", body: JSON.stringify(payload) }),
  sendNightActions: (gameId: string, actions: GameActionPayload[]) =>
    apiFetch<GameDetail>(`/games/${gameId}/night_actions`, {
      method: "POST",
      body: JSON.stringify({ actions }),
    }),
  changePhase: (gameId: string, phase: GamePhase) =>
    apiFetch<GameDetail>(`/games/${gameId}/phase`, { method: "POST", body: JSON.stringify({ phase }) }),
  finishGame: (gameId: string, winningTeam: string) =>
    apiFetch<GameDetail>(`/games/${gameId}/finish`, {
      method: "POST",
      body: JSON.stringify({ winning_team: winningTeam }),
    }),
  syncNightEvents: (gameId: string) =>
    apiFetch<GameDetail>(`/games/${gameId}/sync_night`, { method: "POST" }),
};
