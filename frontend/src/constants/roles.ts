export const ROLE_KEYS = ["Mafia", "Detective", "Doctor", "Villager", "Jester"] as const;

export type RoleName = (typeof ROLE_KEYS)[number];

export type RoleCounts = Record<RoleName, number>;

export const DEFAULT_ROLE_COUNTS: RoleCounts = {
  Mafia: 1,
  Detective: 1,
  Doctor: 1,
  Villager: 2,
  Jester: 0,
};

/** Shared DnD item type for player dragging across game pages. */
export const PLAYER_DND_TYPE = "PLAYER";

/** Tailwind classes for role badge chips (lowercase role key). */
export const ROLE_BADGE_CLASSES: Record<string, string> = {
  mafia: "bg-rose-500/20 text-rose-300 border border-rose-500/40",
  detective: "bg-violet-500/20 text-violet-300 border border-violet-500/40",
  doctor: "bg-sky-500/20 text-sky-300 border border-sky-500/40",
  villager: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40",
  jester: "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40",
};

/** Emoji icons for each role (lowercase role key). */
export const ROLE_ICONS: Record<string, string> = {
  mafia: "🔪",
  detective: "🔍",
  doctor: "💉",
  villager: "🌾",
  jester: "🃏",
};
