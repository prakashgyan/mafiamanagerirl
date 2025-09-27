import { Player } from "../services/api";

type VisualVariant = "dark" | "light";

type RoleStyle = Record<VisualVariant, { border: string; background: string; text: string }>;

const ROLE_STYLE_MAP: Record<string, RoleStyle> = {
  mafia: {
    dark: {
      border: "border-rose-500",
      background: "bg-rose-500/10",
      text: "text-rose-200",
    },
    light: {
      border: "border-rose-500",
      background: "bg-rose-100",
      text: "text-rose-700",
    },
  },
  villager: {
    dark: {
      border: "border-emerald-400",
      background: "bg-emerald-500/10",
      text: "text-emerald-200",
    },
    light: {
      border: "border-emerald-400",
      background: "bg-emerald-100",
      text: "text-emerald-700",
    },
  },
  doctor: {
    dark: {
      border: "border-sky-400",
      background: "bg-sky-500/10",
      text: "text-sky-200",
    },
    light: {
      border: "border-sky-400",
      background: "bg-sky-100",
      text: "text-sky-700",
    },
  },
  jester: {
    dark: {
      border: "border-cyan-400",
      background: "bg-cyan-500/10",
      text: "text-cyan-200",
    },
    light: {
      border: "border-cyan-400",
      background: "bg-cyan-100",
      text: "text-cyan-700",
    },
  },
  detective: {
    dark: {
      border: "border-violet-400",
      background: "bg-violet-500/10",
      text: "text-violet-200",
    },
    light: {
      border: "border-violet-400",
      background: "bg-violet-100",
      text: "text-violet-700",
    },
  },
};

const DEFAULT_ALIVE_STYLE: Record<VisualVariant, { border: string; background: string; text: string }> = {
  dark: {
    border: "border-slate-600",
    background: "bg-slate-800/60",
    text: "text-slate-200",
  },
  light: {
    border: "border-slate-300",
    background: "bg-slate-100",
    text: "text-slate-700",
  },
};

const ELIMINATED_STYLE: Record<VisualVariant, { border: string; background: string; text: string }> = {
  dark: {
    border: "border-slate-700",
    background: "bg-slate-900/70",
    text: "text-slate-500",
  },
  light: {
    border: "border-slate-300",
    background: "bg-slate-100",
    text: "text-slate-400",
  },
};

export const getPlayerCardClasses = (player: Player, variant: VisualVariant = "dark"): string => {
  if (!player.is_alive) {
    const eliminated = ELIMINATED_STYLE[variant];
    return `${eliminated.border} ${eliminated.background} ${eliminated.text} line-through`;
  }

  const roleKey = player.role?.toLowerCase() ?? "";
  const roleStyle = ROLE_STYLE_MAP[roleKey]?.[variant] ?? DEFAULT_ALIVE_STYLE[variant];

  return `${roleStyle.border} ${roleStyle.background} ${roleStyle.text}`;
};

export const getRoleLabelClass = (player: Player, variant: VisualVariant = "dark"): string => {
  if (!player.is_alive) {
    return variant === "light" ? "text-slate-400" : "text-slate-400";
  }

  return variant === "light" ? "text-slate-700" : "text-current";
};
