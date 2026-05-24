import { Player } from "../../services/api";
import DraggablePlayerCard from "./DraggablePlayerCard";

type PlayerRosterProps = {
  players: Player[];
};

const PlayerRoster = ({ players }: PlayerRosterProps) => (
  <aside className="lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/60">
    <h2 className="text-lg font-semibold text-white">Players</h2>
    <p className="mb-4 text-xs uppercase tracking-wide text-slate-400">
      Drag living players into the targets.
    </p>
    <div className="grid grid-cols-2 gap-3">
      {players.map((player) => (
        <DraggablePlayerCard key={player.id} player={player} />
      ))}
    </div>
  </aside>
);

export default PlayerRoster;
