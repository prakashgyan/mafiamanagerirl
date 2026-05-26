import type { GameStatus } from "../services/api";

export const GAME_STATUS_META: Record<GameStatus, { label: string; accent: string }> = {
  pending: { label: "Setup", accent: "text-amber-200 border-amber-400/40 bg-amber-400/10" },
  active: { label: "Active", accent: "text-emerald-200 border-emerald-400/40 bg-emerald-400/10" },
  finished: { label: "Finished", accent: "text-slate-200 border-slate-400/40 bg-slate-400/10" },
};

interface GameStatusBadgeProps {
  status: GameStatus;
  className?: string;
}

const GameStatusBadge = ({ status, className = "" }: GameStatusBadgeProps) => {
  const { label, accent } = GAME_STATUS_META[status] ?? GAME_STATUS_META.finished;
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ${accent} ${className}`}
    >
      {label}
    </span>
  );
};

export default GameStatusBadge;
