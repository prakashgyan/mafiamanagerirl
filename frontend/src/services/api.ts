export type User = {
  id: number;
  username: string;
};

export type Friend = {
  id: number;
  name: string;
  description?: string | null;
  image?: string | null;
};

export type Player = {
  id: number;
  name: string;
  role?: string | null;
  is_alive: boolean;
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
  id: number;
  status: GameStatus;
  current_phase: GamePhase;
  current_round: number;
  winning_team?: string | null;
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

const API_FALLBACKS = {
  development: "http://localhost:8000",
  production: "https://api.mafiadesk.com",
} as const;

const resolveApiBase = () => {
  const fromEnv = import.meta.env.VITE_API_BASE?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  if (import.meta.env.DEV) {
    return API_FALLBACKS.development;
  }

  if (typeof window !== "undefined") {
    const origin = window.location.origin.toLowerCase();
    if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
      return API_FALLBACKS.development;
    }
  }

  return API_FALLBACKS.production;
};

const API_BASE = resolveApiBase().replace(/\/+$/, "");

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
    const message = await response.text();
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
  logout: () => apiFetch<void>("/auth/logout", { method: "POST" }),
  me: () => apiFetch<User>("/auth/me"),

  listFriends: () => apiFetch<Friend[]>("/friends/"),
  createFriend: (payload: { name: string; description?: string; image?: string | null }) =>
    apiFetch<Friend>("/friends/", { method: "POST", body: JSON.stringify(payload) }),
  deleteFriend: (friendId: number) =>
    apiFetch<void>(`/friends/${friendId}`, { method: "DELETE" }),

  listGames: (status?: GameStatus) =>
    apiFetch<GameSummary[]>(status ? `/games/?status_filter=${status}` : "/games/"),
  getGame: (id: number) => apiFetch<GameDetail>(`/games/${id}`),
  createGame: (players: CreateGamePlayer[]) =>
    apiFetch<GameDetail>("/games/new", { method: "POST", body: JSON.stringify({ players }) }),
  assignRoles: (gameId: number, assignments: { player_id: number; role: string }[]) =>
    apiFetch<GameDetail>(`/games/${gameId}/assign_roles`, {
      method: "POST",
      body: JSON.stringify({ assignments }),
    }),
  startGame: (gameId: number) => apiFetch<GameDetail>(`/games/${gameId}/start`, { method: "POST" }),
  sendAction: (
    gameId: number,
    payload: { action_type: string; target_player_id?: number; actor_role?: string; note?: string }
  ) =>
    apiFetch<GameDetail>(`/games/${gameId}/action`, { method: "POST", body: JSON.stringify(payload) }),
  changePhase: (gameId: number, phase: GamePhase) =>
    apiFetch<GameDetail>(`/games/${gameId}/phase`, { method: "POST", body: JSON.stringify({ phase }) }),
  finishGame: (gameId: number, winningTeam: string) =>
    apiFetch<GameDetail>(`/games/${gameId}/finish`, {
      method: "POST",
      body: JSON.stringify({ winning_team: winningTeam }),
    }),
  syncNightEvents: (gameId: number) =>
    apiFetch<GameDetail>(`/games/${gameId}/sync_night`, { method: "POST" }),
};
