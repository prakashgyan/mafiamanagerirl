import { GamePhase, User } from "../../services/api";

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
  onFinishGame: (team: string) => void;
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
  onFinishGame,
  onTogglePublicSync,
  onSyncNightEvents,
}: GameControlsProps) => (
  <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
    <div className="flex flex-col gap-3 text-slate-200 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex items-center gap-3">
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
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
              instantPublicUpdates ? "translate-x-5" : "translate-x-1"
            }`}
          />
        </button>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-white">Instantly update public view</span>
          <span className="text-[0.65rem] uppercase tracking-wide text-slate-400">
            {instantPublicUpdates
              ? "Player status pushes live to the public screen."
              : "Hold player status until you reveal night events."}
          </span>
        </div>
      </div>
    </div>
    <div className="flex flex-wrap gap-3 lg:justify-end">
      <button
        onClick={() => onSwitchPhase(isDay ? "night" : "day")}
        disabled={processingQueuedActions}
        className={`inline-flex items-center justify-center rounded-2xl px-5 py-2 text-sm font-semibold transition ${palette.primaryButton} ${
          processingQueuedActions ? "cursor-not-allowed opacity-80" : ""
        }`}
      >
        {processingQueuedActions ? "Resolving Actions..." : `End ${isDay ? "Day" : "Night"}`}
      </button>
      <button
        onClick={() => onFinishGame("Villagers")}
        className="inline-flex items-center justify-center rounded-2xl border border-emerald-400/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-200 transition hover:border-emerald-300"
      >
        Villagers Win
      </button>
      <button
        onClick={() => onFinishGame("Mafia")}
        className="inline-flex items-center justify-center rounded-2xl border border-rose-400/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-rose-200 transition hover:border-rose-300"
      >
        Mafia Win
      </button>
      {!instantPublicUpdates && (
        <button
          onClick={onSyncNightEvents}
          className={`inline-flex items-center justify-center rounded-2xl px-4 py-2 text-sm font-semibold transition ${palette.syncButton}`}
          disabled={updatingPublicPreference}
        >
          Reveal Night Events
        </button>
      )}
    </div>
  </div>
);

export default GameControls;
