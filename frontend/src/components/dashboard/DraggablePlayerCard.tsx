import { useDrag } from "react-dnd";

import { Player } from "../../services/api";
import { getPlayerCardClasses, getRoleLabelClass } from "../../utils/playerStyles";
import PlayerAvatar from "../PlayerAvatar";
import { PLAYER_DND_TYPE } from "../../constants/roles";

type DragItem = { playerId: number };

type DraggablePlayerCardProps = {
  player: Player;
};

const DraggablePlayerCard = ({ player }: DraggablePlayerCardProps) => {
  const [{ isDragging }, dragRef] = useDrag<DragItem, void, { isDragging: boolean }>(
    () => ({
      type: PLAYER_DND_TYPE,
      item: { playerId: player.id },
      canDrag: player.is_alive,
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
    }),
    [player]
  );

  return (
    <div
      ref={dragRef}
      className={`flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm shadow-sm shadow-black/30 transition ${
        player.is_alive ? "cursor-grab hover:border-sky-400/60" : "cursor-not-allowed opacity-70"
      } ${isDragging ? "opacity-60" : ""} ${getPlayerCardClasses(player)}`}
      aria-disabled={!player.is_alive}
    >
      <PlayerAvatar value={player.avatar} fallbackLabel={player.name} size="sm" className="mt-1" />
      <div className="flex flex-col gap-1">
        <p className="font-semibold text-white">{player.name}</p>
        <p className={`text-xs uppercase tracking-wide ${getRoleLabelClass(player)}`}>
          {player.role ?? "Unassigned"}
        </p>
        {!player.is_alive && <p className="text-[0.65rem] text-slate-400">Eliminated</p>}
      </div>
    </div>
  );
};

export default DraggablePlayerCard;
