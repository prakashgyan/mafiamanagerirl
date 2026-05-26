import { Player } from "../../services/api";
import DraggablePlayerCard from "./DraggablePlayerCard";

type PlayerRosterProps = {
  players: Player[];
  isMobile?: boolean;
  onTap?: (player: Player) => void;
};

const PlayerRoster = ({ players, isMobile, onTap }: PlayerRosterProps) => {
  const alive = players.filter((p) => p.is_alive);
  const eliminated = players.filter((p) => !p.is_alive);

  const gridClass = isMobile ? "space-y-2" : "grid grid-cols-1 sm:grid-cols-2 gap-3";

  return (
    <aside className="lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/60">
      <h2 className="text-lg font-semibold text-white">Players</h2>
      <p className="mb-5 text-xs uppercase tracking-wide text-slate-400">
        {isMobile ? "Tap an alive player to assign an action." : "Drag alive players to any drop zone."}
      </p>

      {/* Alive section */}
      <div className="mb-5">
        <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-wide text-emerald-400">
          Alive · {alive.length}
        </p>
        {alive.length > 0 ? (
          <div className={gridClass}>
            {alive.map((player) => (
              <DraggablePlayerCard key={player.id} player={player} isMobile={isMobile} onTap={onTap} />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-800 py-3 text-center text-xs text-slate-500">
            No players alive
          </p>
        )}
      </div>

      {/* Eliminated section */}
      {eliminated.length > 0 && (
        <div>
          <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-wide text-rose-400">
            Eliminated · {eliminated.length}
          </p>
          <div className={gridClass}>
            {eliminated.map((player) => (
              <DraggablePlayerCard key={player.id} player={player} isMobile={isMobile} onTap={onTap} />
            ))}
          </div>
        </div>
      )}
    </aside>
  );
};

export default PlayerRoster;
