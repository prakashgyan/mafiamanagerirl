import { FC, useEffect, useMemo, useState } from "react";
import { useDrag, useDrop, DragSourceMonitor, DropTargetMonitor } from "react-dnd";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { api, GameDetail, Player } from "../services/api";
import ResponsiveDndProvider from "../components/ResponsiveDndProvider";
import PlayerAvatar from "../components/PlayerAvatar";
import BackdropLogo from "../components/BackdropLogo";

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
      className={`space-y-3 rounded-2xl border px-4 py-4 shadow-sm shadow-black/20 transition ${
        isOver && canDrop
          ? "border-emerald-400/70 bg-emerald-500/15"
          : full
          ? "border-amber-400/60 bg-amber-500/10"
          : "border-slate-800 bg-slate-950/60 hover:border-sky-400/60"
      }`}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-white">{role}</h3>
          <p className="text-[0.65rem] uppercase tracking-wide text-slate-500">
            {capacity === 0 ? "Unlimited" : `${capacity} slots`}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-wide ${
            full ? "border border-amber-400/60 bg-amber-500/10 text-amber-200" : "border border-slate-700/60 bg-slate-900/80 text-slate-300"
          }`}
        >
          {players.length}/{capacity === 0 ? "∞" : capacity}
        </span>
      </header>
      <div className="space-y-2">
        {players.map((player) => (
          <AssignedPlayerCard key={player.id} player={player} onRemove={() => onRemove(player.id)} />
        ))}
        {players.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-500">
            Drop players here
          </p>
        )}
      </div>
    </div>
  );
};

type AssignedPlayerProps = {
  player: Player;
  onRemove: () => void;
};

const AssignedPlayerCard: FC<AssignedPlayerProps> = ({ player, onRemove }: AssignedPlayerProps) => (
  <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2">
    <div className="flex items-center gap-3">
      <PlayerAvatar value={player.avatar} fallbackLabel={player.name} size="sm" />
      <div className="flex flex-col">
        <span className="text-sm font-semibold text-slate-100">{player.name}</span>
        <span className="text-[0.65rem] uppercase tracking-wide text-slate-500">{player.role ?? "Unassigned"}</span>
      </div>
    </div>
    <button
      onClick={onRemove}
      className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-wide text-rose-200 transition hover:bg-rose-500/20"
    >
      X
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
      className={`flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 shadow-sm shadow-black/20 transition ${
        isDragging ? "opacity-40" : "opacity-100"
      }`}
    >
      <PlayerAvatar value={player.avatar} fallbackLabel={player.name} size="sm" />
      <div className="flex flex-col">
        <span className="font-semibold">{player.name}</span>
        <span className="text-[0.65rem] uppercase tracking-wide text-slate-500">{player.role ?? "Unassigned"}</span>
      </div>
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

  const totalSlots = useMemo(
    () => ROLE_KEYS.reduce((sum, role) => sum + (counts[role] ?? 0), 0),
    [counts]
  );

  const assignedPlayersCount = useMemo(() => Object.keys(assignments).length, [assignments]);

  const unassignedCount = game ? game.players.length - assignedPlayersCount : 0;

  const slotsMatch = game ? totalSlots === game.players.length : false;

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
    <ResponsiveDndProvider>
      <div className="relative min-h-screen bg-slate-950 text-slate-100">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-[12%] top-0 h-72 w-72 rounded-full bg-sky-500/15 blur-3xl" />
          <div className="absolute bottom-10 right-[18%] h-80 w-80 rounded-full bg-emerald-400/12 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.15),_transparent_55%)]" />
        </div>
  <BackdropLogo className="right-[-8%] top-[-4.5rem] w-[640px] opacity-20" />

        <div className="relative z-10 mx-auto max-w-6xl px-6 py-12">
          <button
            className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-slate-300 transition hover:text-white"
            onClick={() => navigate(-1)}
          >
            <span aria-hidden>←</span>
            Back to setup
          </button>

          <header className="mb-10 rounded-3xl border border-white/10 bg-slate-900/70 p-8 shadow-2xl shadow-slate-950/60 backdrop-blur-xl">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-4">
                <Link
                  to="/"
                  aria-label="Go to homepage"
                  className="inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-200 transition hover:border-sky-300/60 hover:text-sky-100"
                >
                  MafiaDesk
                </Link>
                <div className="space-y-2">
                  <h1 className="text-3xl font-semibold text-white sm:text-4xl">Assign roles with confidence</h1>
                  <p className="max-w-2xl text-base text-slate-300">
                    Drag each player into their faction and keep the balance tight. Once every slot is filled, launch the
                    next chapter of your Mafia night.
                  </p>
                </div>
              </div>
              <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-center">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Game</p>
                  <p className="mt-1 text-2xl font-semibold text-white">#{game.id}</p>
                  <p className="text-xs text-slate-500">{game.players.length} players</p>
                </div>
                <div
                  className={`rounded-2xl border px-4 py-3 text-center text-sm font-semibold ${
                    slotsMatch
                      ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-200"
                      : "border-rose-400/50 bg-rose-500/10 text-rose-200"
                  }`}
                >
                  <p className="text-xs uppercase tracking-wide">Players / Slots</p>
                  <p className="mt-1 text-lg">{game.players.length} / {totalSlots}</p>
                  <p className="text-[0.65rem] text-current">
                    {slotsMatch ? "Balanced" : "Adjust counts"}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-center sm:col-span-2">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Assignment progress</p>
                  <p className="mt-1 text-lg font-semibold text-white">
                    {assignedPlayersCount}/{game.players.length} players placed
                  </p>
                  <p className="text-[0.65rem] text-slate-400">{unassignedCount} remaining</p>
                </div>
              </div>
            </div>
          </header>

          <div className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            {error && (
              <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200 shadow-lg shadow-rose-500/20">
                {error}
              </div>
            )}
            <div className="flex flex-wrap gap-3 text-xs text-slate-400">
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-700/60 bg-slate-800/80 px-3 py-1 font-semibold uppercase tracking-wide">
                Drag & drop to assign
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-700/60 bg-slate-800/80 px-3 py-1 font-semibold uppercase tracking-wide">
                Remove to send back
              </span>
            </div>
            <button
              onClick={handleStartGame}
              disabled={!isComplete}
              className="inline-flex items-center justify-center rounded-2xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              Start Game
            </button>
          </div>

          <div className="grid gap-8 lg:grid-cols-[1fr_2fr]">
            <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/60">
              <header className="mb-5 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Unassigned players</h2>
                <span className="rounded-full border border-slate-700/60 bg-slate-800/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-300">
                  {unassignedPlayers.length} remaining
                </span>
              </header>
              <div className="space-y-2">
                {unassignedPlayers.length === 0 && (
                  <p className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/70 px-4 py-4 text-sm text-slate-400">
                    Everyone is seated. Make tweaks by removing a player from a role.
                  </p>
                )}
                {unassignedPlayers.map((player) => (
                  <PlayerCard key={player.id} player={player} />
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/60">
              <header className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Role columns</h2>
                  <p className="text-sm text-slate-400">Drop players into their roles. Columns fill based on available slots.</p>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-700/60 bg-slate-800/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-300">
                  {assignedPlayersCount} assigned
                </span>
              </header>
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
    </ResponsiveDndProvider>
  );
};

export default AssignRolesPage;
