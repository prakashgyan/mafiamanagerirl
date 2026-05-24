const ROLE_BADGE_CLASSES: Record<string, string> = {
  mafia: "bg-rose-500/20 text-rose-300 border border-rose-500/40",
  detective: "bg-violet-500/20 text-violet-300 border border-violet-500/40",
  doctor: "bg-sky-500/20 text-sky-300 border border-sky-500/40",
  villager: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40",
  jester: "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40",
};

const ROLE_ICONS: Record<string, string> = {
  mafia: "🔪",
  detective: "🔍",
  doctor: "💉",
  villager: "🌾",
  jester: "🃏",
};

interface RoleBadgeProps {
  role: string | null | undefined;
  showIcon?: boolean;
  className?: string;
}

export const RoleBadge = ({ role, showIcon = true, className = "" }: RoleBadgeProps) => {
  if (!role) {
    return (
      <span className={`rounded-full bg-slate-700/60 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400 ${className}`}>
        No Role
      </span>
    );
  }

  const key = role.toLowerCase();
  const badgeClass = ROLE_BADGE_CLASSES[key] ?? "bg-slate-700/60 text-slate-300 border border-slate-600/40";
  const icon = showIcon ? ROLE_ICONS[key] : null;

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ${badgeClass} ${className}`}>
      {icon && <span aria-hidden>{icon}</span>}
      {role}
    </span>
  );
};
