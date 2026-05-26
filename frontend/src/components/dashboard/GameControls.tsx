import { GamePhase, User } from "../../services/api";
import { SpinnerIcon } from "../Spinner";

type Palette = {
  primaryButton: string;
  syncButton: string;
};

type GameControlsProps = {
  isDay: boolean;
  processingQueuedActions: boolean;
  instantPublicUpdates: boolean;
  updatingPublicPreference: boolean;
  user: User | null;
  palette: Palette;
  onSwitchPhase: (phase: GamePhase) => void;
  onTogglePublicSync: () => void;
  onSyncNightEvents: () => void;
};


const GameControls = ({
  isDay,
  processingQueuedActions,
  instantPublicUpdates,
  updatingPublicPreference,
  user,
  palette,
  onSwitchPhase,
  onTogglePublicSync,
  onSyncNightEvents,
}: GameControlsProps) => {

  return (
    <div className="mb-8 rounded-3xl border border-white/10 bg-slate-900/70 px-6 py-5 shadow-xl shadow-slate-950/60">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        {/* Public sync toggle */}
        <div className="flex items-center gap-3 text-slate-200">
          <button
            type="button"
            role="switch"
            aria-checked={instantPublicUpdates}
            aria-label="Toggle instant public view updates"
            aria-busy={updatingPublicPreference}
            onClick={onTogglePublicSync}
            disabled={updatingPublicPreference || !user}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full border transition ${
              instantPublicUpdates ? "border-emerald-400/70 bg-emerald-500/60" : "border-white/20 bg-slate-800"
            } ${updatingPublicPreference || !user ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
          >
            {updatingPublicPreference ? (
              <span className="absolute inset-0 flex items-center justify-center">
                <SpinnerIcon className="h-3 w-3" />
              </span>
            ) : (
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                  instantPublicUpdates ? "translate-x-5" : "translate-x-1"
                }`}
              />
            )}
          </button>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-white">Instant public view</span>
            <span className="text-[0.65rem] uppercase tracking-wide text-slate-400">
              {instantPublicUpdates
                ? "Live updates pushed to public screen."
                : "OFF — use the button below to reveal manually."}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:items-end">
          {/* Primary phase action + reveal */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => onSwitchPhase(isDay ? "night" : "day")}
              disabled={processingQueuedActions}
              className={`inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-2 text-sm font-semibold transition ${palette.primaryButton} ${
                processingQueuedActions ? "cursor-not-allowed opacity-80" : ""
              }`}
            >
              {processingQueuedActions && <SpinnerIcon />}
              {processingQueuedActions ? "Resolving…" : `End ${isDay ? "Day" : "Night"}`}
            </button>
            {!instantPublicUpdates && (
              <button
                onClick={onSyncNightEvents}
                className={`inline-flex items-center justify-center rounded-2xl px-4 py-2 text-sm font-semibold transition ${palette.syncButton}`}
                disabled={updatingPublicPreference}
              >
                Reveal to Public Now
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameControls;
