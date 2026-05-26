import { useDrop } from "react-dnd";

import { Player } from "../../services/api";
import PlayerAvatar from "../PlayerAvatar";
import { PLAYER_DND_TYPE } from "../../constants/roles";

type DragItem = { playerId: number };

type Palette = {
  hoverBorder: string;
  readyBorder: string;
  idleBorder: string;
};

type DayPhasePanelProps = {
  alivePlayers: Player[];
  voteTarget: number | undefined;
  onVote: (playerId: number) => void;
  onClearVote: () => void;
  note: string;
  noteId: string;
  onNoteChange: (value: string) => void;
  palette: Palette;
  isMobile?: boolean;
  onTapVoteZone?: () => void;
};

const DayPhasePanel = ({
  alivePlayers,
  voteTarget,
  onVote,
  onClearVote,
  note,
  noteId,
  onNoteChange,
  palette,
  isMobile,
  onTapVoteZone,
}: DayPhasePanelProps) => {
  const voteEligibleIds = new Set(alivePlayers.map((p) => p.id));

  const [{ isOver, canDrop }, dropRef] = useDrop<DragItem, void, { isOver: boolean; canDrop: boolean }>(
    () => ({
      accept: PLAYER_DND_TYPE,
      canDrop: (item) => voteEligibleIds.has(item.playerId),
      drop: (item) => onVote(item.playerId),
      collect: (monitor) => ({
        isOver: monitor.isOver({ shallow: true }),
        canDrop: monitor.canDrop(),
      }),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [alivePlayers, onVote]
  );

  const selectedPlayer = alivePlayers.find((p) => p.id === voteTarget) ?? null;
  const baseClasses =
    "flex flex-col gap-3 rounded-2xl border-2 border-dashed px-5 py-4 text-sm transition-colors duration-200 shadow-sm shadow-black/30";
  const stateClasses =
    isOver && canDrop ? palette.hoverBorder : selectedPlayer ? palette.readyBorder : palette.idleBorder;
  const placeholder = alivePlayers.length === 0 ? "No eligible players" : isMobile ? "Tap to choose a player" : "Drag a player here";

  return (
    <section className="space-y-6 rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/60">
      <div>
        <h2 className="text-lg font-semibold text-white">Vote Phase</h2>
        <p className="text-xs uppercase tracking-wide text-slate-400">
          {isMobile
            ? "Tap the vote zone to pick a player to nominate. The elimination happens when you end the day."
            : "Drag an eligible player into the vote zone. The elimination happens when you end the day."}
        </p>
      </div>

      <div ref={dropRef} className={`${baseClasses} ${stateClasses}`}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold uppercase tracking-wide text-slate-200">Vote Out Player</span>
          {selectedPlayer && (
            <button
              type="button"
              onClick={onClearVote}
              className="text-xs font-semibold uppercase tracking-wide text-slate-300 transition hover:text-rose-300"
            >
              Clear
            </button>
          )}
        </div>
        {selectedPlayer ? (
          <button
            type="button"
            onClick={isMobile && onTapVoteZone ? onTapVoteZone : undefined}
            className={`flex w-full items-center gap-3 rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 ${isMobile && onTapVoteZone ? "active:opacity-70" : ""}`}
          >
            <PlayerAvatar value={selectedPlayer.avatar} fallbackLabel={selectedPlayer.name} size="sm" />
            <div className="flex flex-col text-left">
              <span className="font-semibold">{selectedPlayer.name}</span>
              <span className="text-[0.65rem] uppercase tracking-wide text-slate-400">
                {selectedPlayer.role ?? "Unassigned"}
              </span>
            </div>
            {isMobile && onTapVoteZone && (
              <span className="ml-auto text-xs text-slate-500">change</span>
            )}
          </button>
        ) : (
          <button
            type="button"
            disabled={alivePlayers.length === 0}
            onClick={isMobile && onTapVoteZone && alivePlayers.length > 0 ? onTapVoteZone : undefined}
            className={`flex w-full flex-col items-center gap-2 py-2 text-center ${isMobile && onTapVoteZone && alivePlayers.length > 0 ? "active:opacity-70" : "cursor-default"}`}
          >
            <span className="text-2xl" aria-hidden>👆</span>
            <p className="text-sm font-medium text-slate-300">
              {alivePlayers.length === 0
                ? "No eligible players"
                : isMobile
                ? "Tap to choose a player"
                : "Drag a player here to nominate them"}
            </p>
            <p className="text-xs text-slate-500">
              {alivePlayers.length === 0
                ? "No players currently meet the requirements."
                : isMobile
                ? "Opens player selection"
                : "Grab a player card from the roster on the right →"}
            </p>
          </button>
        )}
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

export default DayPhasePanel;
