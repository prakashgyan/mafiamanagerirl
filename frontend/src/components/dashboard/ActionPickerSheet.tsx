import { useEffect, useRef } from "react";
import { Player } from "../../services/api";
import PlayerAvatar from "../PlayerAvatar";

type DashAction = "vote" | "kill" | "save" | "investigate";

type ActionItem = {
  id: DashAction;
  label: string;
  icon: string;
  enabled: boolean;
  hint?: string;
};

type ActionPickerSheetProps = {
  player: Player;
  isDay: boolean;
  eligibleForKill: boolean;
  hasAliveDoctors: boolean;
  eligibleForInvestigate: boolean;
  hasAliveDetectives: boolean;
  onAssign: (action: DashAction) => void;
  onClose: () => void;
};

const ActionPickerSheet = ({
  player,
  isDay,
  eligibleForKill,
  hasAliveDoctors,
  eligibleForInvestigate,
  hasAliveDetectives,
  onAssign,
  onClose,
}: ActionPickerSheetProps) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusable = dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();

    const trap = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };

    document.addEventListener("keydown", trap);
    return () => document.removeEventListener("keydown", trap);
  }, [onClose]);

  const actions: ActionItem[] = isDay
    ? [{ id: "vote", label: "Nominate for vote", icon: "🗳️", enabled: true }]
    : [
        {
          id: "kill",
          label: "Mafia Kill",
          icon: "🔪",
          enabled: eligibleForKill,
          hint: !eligibleForKill ? "Cannot target own faction" : undefined,
        },
        {
          id: "save",
          label: "Doctor Protect",
          icon: "🛡️",
          enabled: hasAliveDoctors,
          hint: !hasAliveDoctors ? "No doctors alive" : undefined,
        },
        {
          id: "investigate",
          label: "Detective Investigate",
          icon: "🔍",
          enabled: hasAliveDetectives && eligibleForInvestigate,
          hint: !hasAliveDetectives
            ? "No detectives alive"
            : !eligibleForInvestigate
            ? "Cannot investigate the detective"
            : undefined,
        },
      ];

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal
        aria-label={`Assign action for ${player.name}`}
        className="fixed bottom-0 left-0 right-0 z-50 overflow-y-auto rounded-t-3xl border-t border-white/10 bg-slate-900 px-5 pt-4 shadow-2xl"
        style={{ maxHeight: "75vh", paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-slate-700" />

        <div className="mb-4 flex items-center gap-3 border-b border-slate-800 pb-4">
          <PlayerAvatar value={player.avatar} fallbackLabel={player.name} size="sm" />
          <div>
            <p className="text-sm font-semibold text-white">{player.name}</p>
            <p className="text-xs text-slate-500">{player.role ?? "Unassigned"} · Choose an action</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="ml-auto rounded-full bg-slate-800 p-1.5 text-slate-400 transition hover:text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        <div className="space-y-2.5 pb-2">
          {actions.map(({ id, label, icon, enabled, hint }) => (
            <button
              key={id}
              disabled={!enabled}
              onClick={() => {
                onAssign(id);
                onClose();
              }}
              className={`flex w-full items-center gap-4 rounded-2xl border px-4 py-3.5 text-left transition ${
                enabled
                  ? "border-slate-700 bg-slate-800/60 text-white active:scale-[0.98] active:border-slate-500"
                  : "cursor-not-allowed border-slate-800 bg-slate-950/60 opacity-60"
              }`}
            >
              <span className="text-2xl" aria-hidden>
                {icon}
              </span>
              <div>
                <p className="text-sm font-semibold">{label}</p>
                {hint && <p className="text-xs text-slate-400">{hint}</p>}
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
};

export default ActionPickerSheet;
