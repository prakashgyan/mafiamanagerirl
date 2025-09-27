import { FC, useEffect, useMemo, useState } from "react";
import { DndProvider, useDrag, useDrop, DragSourceMonitor, DropTargetMonitor } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { api, GameDetail, Player } from "../services/api";

const ROLE_KEYS = ["Mafia", "Detective", "Doctor", "Villager", "Jester"] as const;

type RoleName = (typeof ROLE_KEYS)[number];

const isRoleName = (value: unknown): value is RoleName => ROLE_KEYS.includes(value as RoleName);

type RoleCounts = Record<RoleName, number>;

const DEFAULT_COUNTS: RoleCounts = {
  Mafia: 1,
  Detective: 1,
  Doctor: 1,
  Villager: 2,
  Jester: 0,
};

const DND_TYPE = "PLAYER";

type DragPayload = {
  player: Player;
};

type RoleColumnProps = {
  role: RoleName;
  capacity: number;
  players: Player[];
  onDrop: (player: Player) => void;
  onRemove: (playerId: number) => void;
};

const RoleColumn = ({ role, capacity, players, onDrop, onRemove }: RoleColumnProps) => {
  const [{ isOver, canDrop }, dropRef] = useDrop<DragPayload, void, { isOver: boolean; canDrop: boolean }>(
    {
      accept: DND_TYPE,
      canDrop: () => players.length < capacity || capacity === 0,
      drop: (item: DragPayload) => onDrop(item.player),
      collect: (monitor: DropTargetMonitor<DragPayload, void>) => ({
        isOver: monitor.isOver(),
        canDrop: monitor.canDrop(),
      }),
    },
    [players.length, capacity, onDrop]
  );

  const full = capacity !== 0 && players.length >= capacity;

  return (
    <div
      ref={dropRef}
      className={`space-y-3 rounded-xl border p-4 transition ${
        isOver && canDrop
          ? "border-emerald-400 bg-emerald-500/10"
          : full
          ? "border-slate-700 bg-slate-900/50"
          : "border-slate-700 bg-slate-900/60"
      }`}
    >
      <header className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-100">{role}</h3>
        <span className="text-xs uppercase tracking-wide text-slate-400">
          {players.length}/{capacity === 0 ? "∞" : capacity}
        </span>
      </header>
      <div className="space-y-2">
        {players.map((player) => (
          <AssignedPlayerCard key={player.id} player={player} onRemove={() => onRemove(player.id)} />
        ))}
        {players.length === 0 && <p className="text-sm text-slate-500">Drop players here</p>}
      </div>
    </div>
  );
};

type AssignedPlayerProps = {
  player: Player;
  onRemove: () => void;
};

const AssignedPlayerCard: FC<AssignedPlayerProps> = ({ player, onRemove }: AssignedPlayerProps) => (
  <div className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2">
    <span>{player.name}</span>
    <button onClick={onRemove} className="text-xs text-rose-300 hover:text-rose-200">
      Remove
    </button>
  </div>
);

type PlayerCardProps = {
  player: Player;
};

const PlayerCard = ({ player }: PlayerCardProps) => {
  const [{ isDragging }, dragRef] = useDrag<DragPayload, void, { isDragging: boolean }>(
    () => ({
      type: DND_TYPE,
      item: { player },
      collect: (monitor: DragSourceMonitor<DragPayload, void>) => ({
        isDragging: monitor.isDragging(),
      }),
    }),
    [player]
  );

  return (
    <div
      ref={dragRef}
      className={`rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 transition ${
        isDragging ? "opacity-40" : "opacity-100"
      }`}
    >
      {player.name}
    </div>
  );
};

const AssignRolesPage = () => {
  const { state } = useLocation() as { state?: { roleCounts?: RoleCounts } };
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState<GameDetail | null>(null);
  const [assignments, setAssignments] = useState<Record<number, RoleName>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const counts = useMemo<RoleCounts>(
    () => ({
      ...DEFAULT_COUNTS,
      ...(state?.roleCounts ?? {}),
    }),
    [state?.roleCounts]
  );

  useEffect(() => {
    if (!gameId) return;
    const load = async () => {
      try {
        const data = await api.getGame(Number(gameId));
        setGame(data);
        const preAssigned = data.players.reduce<Record<number, RoleName>>((acc, player) => {
          if (isRoleName(player.role)) {
            acc[player.id] = player.role;
          }
          return acc;
        }, {});
        setAssignments(preAssigned);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load game");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [gameId]);

  const playersByRole = useMemo(() => {
    const map: Record<RoleName, Player[]> = {
      Mafia: [],
      Detective: [],
      Doctor: [],
      Villager: [],
      Jester: [],
    };
    if (!game) return map;
    for (const player of game.players) {
      const assignedRole = assignments[player.id];
      if (assignedRole) {
        map[assignedRole].push(player);
      }
    }
    return map;
  }, [assignments, game]);

  const unassignedPlayers = useMemo(() => {
    if (!game) return [];
    return game.players.filter((player: Player) => !assignments[player.id]);
  }, [assignments, game]);

  const handleDrop = (player: Player, role: RoleName) => {
    setAssignments((prev: Record<number, RoleName>) => ({ ...prev, [player.id]: role }));
  };

  const handleRemove = (playerId: number) => {
    setAssignments((prev: Record<number, RoleName>) => {
      const updated = { ...prev };
      delete updated[playerId];
      return updated;
    });
  };

  const isComplete = useMemo(() => {
    if (!game) return false;
    if (Object.keys(assignments).length !== game.players.length) return false;
    return ROLE_KEYS.every((role) => {
      const assignedCount = Object.values(assignments).filter((assigned) => assigned === role).length;
      return counts[role] === 0 || assignedCount === counts[role];
    });
  }, [assignments, counts, game]);

  const handleStartGame = async () => {
    if (!game) return;
    try {
      const assignmentsPayload = Object.entries(assignments).map(([playerId, roleValue]) => ({
        player_id: Number(playerId),
        role: roleValue,
      }));
      await api.assignRoles(game.id, assignmentsPayload);
      const updated = await api.startGame(game.id);
      navigate(`/games/${updated.id}/manage`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start game");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        Loading game...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-rose-300">
        {error}
      </div>
    );
  }

  if (!game) return null;

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <button className="mb-6 text-sm text-sky-400" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <header className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold">Assign Roles</h1>
              <p className="text-sm text-slate-400">Game #{game.id} • {game.players.length} players</p>
            </div>
            <button
              onClick={handleStartGame}
              disabled={!isComplete}
              className="rounded-lg bg-emerald-500 px-5 py-2 font-semibold text-slate-900 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              Start Game
            </button>
          </header>

          <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
            <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
              <h2 className="text-xl font-semibold">Unassigned Players</h2>
              <div className="space-y-2">
                {unassignedPlayers.length === 0 && (
                  <p className="text-sm text-slate-400">All players assigned.</p>
                )}
                {unassignedPlayers.map((player) => (
                  <PlayerCard key={player.id} player={player} />
                ))}
              </div>
            </section>

            <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
              <h2 className="text-xl font-semibold">Roles</h2>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {ROLE_KEYS.map((role) => (
                  <RoleColumn
                    key={role}
                    role={role}
                    capacity={counts[role]}
                    players={playersByRole[role]}
                    onDrop={(player) => handleDrop(player, role)}
                    onRemove={handleRemove}
                  />
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </DndProvider>
  );
};

export default AssignRolesPage;
