import { useRef } from "react";
import { Player } from "../../services/api";
import PlayerAvatar from "../PlayerAvatar";
import { useModalFocusTrap } from "../../hooks/useModalFocusTrap";

type PlayerPickerSheetProps = {
  label: string;
  icon: string;
  players: Player[];
  onSelect: (playerId: number) => void;
  onClose: () => void;
};

const PlayerPickerSheet = ({ label, icon, players, onSelect, onClose }: PlayerPickerSheetProps) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalFocusTrap(dialogRef, onClose);

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
        aria-label={`Choose player for ${label}`}
        className="fixed bottom-0 left-0 right-0 z-50 overflow-y-auto rounded-t-3xl border-t border-white/10 bg-slate-900 px-5 pt-4 shadow-2xl"
        style={{ maxHeight: "75vh", paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-slate-700" />

        <div className="mb-4 flex items-center gap-3 border-b border-slate-800 pb-4">
          <span className="text-2xl" aria-hidden>{icon}</span>
          <div>
            <p className="text-sm font-semibold text-white">{label}</p>
            <p className="text-xs text-slate-500">Choose a player to target</p>
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

        {players.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">No eligible players.</p>
        ) : (
          <div className="space-y-2.5 pb-2">
            {players.map((player) => (
              <button
                key={player.id}
                type="button"
                onClick={() => {
                  onSelect(player.id);
                  onClose();
                }}
                className="flex w-full items-center gap-4 rounded-2xl border border-slate-700 bg-slate-800/60 px-4 py-3.5 text-left transition active:scale-[0.98] active:border-slate-500"
              >
                <PlayerAvatar value={player.avatar} fallbackLabel={player.name} size="sm" />
                <div>
                  <p className="text-sm font-semibold text-white">{player.name}</p>
                  <p className="text-xs text-slate-400">{player.role ?? "Unassigned"}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default PlayerPickerSheet;
