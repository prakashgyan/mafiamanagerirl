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
