import { useDrop } from "react-dnd";

import { Player } from "../../services/api";
import PlayerAvatar from "../PlayerAvatar";
import { PLAYER_DND_TYPE } from "../../constants/roles";

type DragItem = { playerId: number };

type NightActionType = "kill" | "save" | "investigate";

type Palette = {
  hoverBorder: string;
  readyBorder: string;
  idleBorder: string;
};

type DropZoneProps = {
  action: NightActionType;
  label: string;
  allowedPlayers: Player[];
  selectedPlayer: Player | null | undefined;
  plannedKillId?: number;
  plannedSaveId?: number;
  isEnabled: boolean;
  disabledMessage?: string;
  palette: Palette;
  isMobile?: boolean;
  onDrop: (playerId: number) => void;
  onClear: () => void;
};

const NightDropZone = ({
  action,
  label,
  allowedPlayers,
  selectedPlayer,
  plannedKillId,
  plannedSaveId,
  isEnabled,
  disabledMessage,
  palette,
  isMobile,
  onDrop,
  onClear,
}: DropZoneProps) => {
  const eligibleIds = new Set(allowedPlayers.map((p) => p.id));

  const [{ isOver, canDrop }, dropRef] = useDrop<DragItem, void, { isOver: boolean; canDrop: boolean }>(
    () => ({
      accept: PLAYER_DND_TYPE,
      canDrop: (item) => isEnabled && eligibleIds.has(item.playerId),
      drop: (item) => onDrop(item.playerId),
      collect: (monitor) => ({
        isOver: monitor.isOver({ shallow: true }),
        canDrop: monitor.canDrop(),
      }),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isEnabled, allowedPlayers, onDrop]
  );

  const baseClasses =
    "flex flex-col gap-3 rounded-2xl border-2 border-dashed px-5 py-4 text-sm transition-colors duration-200 shadow-sm shadow-black/30";
  const stateClasses = !isEnabled
    ? "border-white/10 bg-slate-950/30 opacity-60"
    : isOver && canDrop
    ? palette.hoverBorder
    : selectedPlayer
    ? palette.readyBorder
    : palette.idleBorder;

  const placeholder = !isEnabled
    ? disabledMessage ?? "Role eliminated."
    : allowedPlayers.length === 0
    ? "No eligible players"
    : isMobile
    ? "Tap a player in the Roster tab"
    : "Drag a player here";

  return (
    <div ref={dropRef} className={`${baseClasses} ${stateClasses}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold uppercase tracking-wide text-slate-200">{label}</span>
        {selectedPlayer && isEnabled && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs font-semibold uppercase tracking-wide text-slate-300 transition hover:text-rose-300"
          >
            Clear
          </button>
        )}
      </div>
      {selectedPlayer && isEnabled ? (
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100">
          <PlayerAvatar value={selectedPlayer.avatar} fallbackLabel={selectedPlayer.name} size="sm" />
          <div className="flex flex-col">
            <span className="font-semibold">{selectedPlayer.name}</span>
            <span className="text-[0.65rem] uppercase tracking-wide text-slate-400">
              {selectedPlayer.role ?? "Unassigned"}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1 py-1 text-center">
          {isEnabled && allowedPlayers.length > 0 && <span className="text-xl" aria-hidden>👆</span>}
          <p className="text-sm text-slate-400">{placeholder}</p>
          {isEnabled && allowedPlayers.length > 0 && (
            <p className="text-xs text-slate-500">
              {isMobile ? "Go to the Roster tab and tap a player." : "Grab a player card from the roster →"}
            </p>
          )}
        </div>
      )}
      {isEnabled && action === "kill" && plannedSaveId && plannedSaveId === plannedKillId && (
        <p className="text-xs font-semibold text-amber-300">
          This target will survive; the log will record that the mafia tried to kill them.
        </p>
      )}
    </div>
  );
};

type NightPhasePanelProps = {
  alivePlayers: Player[];
  aliveNonMafiaPlayers: Player[];
  investigateTargets: Player[];
  hasAliveDoctors: boolean;
  hasAliveDetectives: boolean;
  plannedNightActions: Partial<Record<NightActionType, number>>;
  onPlanAction: (action: NightActionType, playerId: number) => void;
  onClearAction: (action: NightActionType) => void;
  note: string;
  noteId: string;
  onNoteChange: (value: string) => void;
  palette: Palette;
  isMobile?: boolean;
};

const NightPhasePanel = ({
  alivePlayers,
  aliveNonMafiaPlayers,
  investigateTargets,
  hasAliveDoctors,
  hasAliveDetectives,
  plannedNightActions,
  onPlanAction,
  onClearAction,
  note,
  noteId,
  onNoteChange,
  palette,
  isMobile,
}: NightPhasePanelProps) => {
  const killTargetPlayer = alivePlayers.find((p) => p.id === plannedNightActions.kill);
  const saveTargetPlayer = alivePlayers.find((p) => p.id === plannedNightActions.save);
  const investigateTargetPlayer = alivePlayers.find((p) => p.id === plannedNightActions.investigate);

  return (
    <section className="space-y-6 rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/60">
      <div>
        <h2 className="text-lg font-semibold text-white">Night Actions</h2>
        <p className="text-xs uppercase tracking-wide text-slate-400">
          {isMobile
            ? "Tap players in the Roster tab to assign actions. They resolve when you end the night."
            : "Queue the mafia, doctor, and detective actions. They resolve when you end the night."}
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <NightDropZone
          action="kill"
          label="Mafia Kill"
          allowedPlayers={aliveNonMafiaPlayers}
          selectedPlayer={killTargetPlayer}
          plannedKillId={plannedNightActions.kill}
          plannedSaveId={plannedNightActions.save}
          isEnabled
          palette={palette}
          isMobile={isMobile}
          onDrop={(id) => onPlanAction("kill", id)}
          onClear={() => onClearAction("kill")}
        />
        <NightDropZone
          action="save"
          label="Doctor Save"
          allowedPlayers={alivePlayers}
          selectedPlayer={saveTargetPlayer}
          isEnabled={hasAliveDoctors}
          disabledMessage="No living doctors — unable to save."
          palette={palette}
          isMobile={isMobile}
          onDrop={(id) => onPlanAction("save", id)}
          onClear={() => onClearAction("save")}
        />
        <NightDropZone
          action="investigate"
          label="Detective Investigate"
          allowedPlayers={investigateTargets}
          selectedPlayer={investigateTargetPlayer}
          isEnabled={hasAliveDetectives}
          disabledMessage="No living detectives — unable to investigate."
          palette={palette}
          isMobile={isMobile}
          onDrop={(id) => onPlanAction("investigate", id)}
          onClear={() => onClearAction("investigate")}
        />
      </div>

      <div>
        <label className="text-sm text-slate-300" htmlFor={noteId}>
          Notes / summary
        </label>
        <textarea
          id={noteId}
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          rows={3}
          className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
          placeholder="Optional log message to send with your next action"
        />
      </div>
    </section>
  );
};

export default NightPhasePanel;
