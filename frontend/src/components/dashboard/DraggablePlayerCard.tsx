import { useDrag } from "react-dnd";

import { Player } from "../../services/api";
import { getPlayerCardClasses } from "../../utils/playerStyles";
import PlayerAvatar from "../PlayerAvatar";
import { RoleBadge } from "../RoleBadge";
import { PLAYER_DND_TYPE } from "../../constants/roles";

type DragItem = { playerId: number };

type DraggablePlayerCardProps = {
  player: Player;
  isMobile?: boolean;
  onTap?: (player: Player) => void;
};

const DraggablePlayerCard = ({ player, isMobile, onTap }: DraggablePlayerCardProps) => {
  const [{ isDragging }, dragRef] = useDrag<DragItem, void, { isDragging: boolean }>(
    () => ({
      type: PLAYER_DND_TYPE,
      item: { playerId: player.id },
      canDrag: player.is_alive && !isMobile,
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
    }),
    [player, isMobile]
  );

  if (isMobile) {
    return (
      <button
        onClick={() => player.is_alive && onTap?.(player)}
        disabled={!player.is_alive}
        className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left text-sm transition active:scale-[0.97] ${
          player.is_alive
            ? "border-slate-700 bg-slate-800/60 text-slate-100 hover:border-slate-500"
            : "cursor-not-allowed border-slate-800 bg-slate-950/40 opacity-50"
        } ${getPlayerCardClasses(player)}`}
        aria-disabled={!player.is_alive}
      >
        <PlayerAvatar value={player.avatar} fallbackLabel={player.name} size="sm" className="mt-0.5 shrink-0" />
        <div className="flex flex-1 flex-col gap-0.5">
          <p className="font-semibold text-white">{player.name}</p>
          <RoleBadge role={player.role} />
          {!player.is_alive && <p className="text-[0.65rem] text-rose-300/80">Eliminated</p>}
        </div>
        {player.is_alive && <span className="shrink-0 text-xs text-slate-500">Tap →</span>}
      </button>
    );
  }

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
        <RoleBadge role={player.role} />
        {!player.is_alive && <p className="text-[0.65rem] text-rose-300/80">Eliminated</p>}
      </div>
    </div>
  );
};

export default DraggablePlayerCard;
