import { FC, useEffect, useMemo, useRef, useState } from "react";
import { useDrag, useDrop, DragSourceMonitor, DropTargetMonitor } from "react-dnd";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { api, GameDetail, Player } from "../services/api";
import ResponsiveDndProvider from "../components/ResponsiveDndProvider";
import PlayerAvatar from "../components/PlayerAvatar";
import Spinner from "../components/Spinner";
import { ROLE_KEYS, RoleName, RoleCounts, DEFAULT_ROLE_COUNTS, PLAYER_DND_TYPE } from "../constants/roles";
import { useIsCompact } from "../hooks/useBreakpoint";

const isRoleName = (value: unknown): value is RoleName => ROLE_KEYS.includes(value as RoleName);

const DEFAULT_COUNTS: RoleCounts = DEFAULT_ROLE_COUNTS;

const DND_TYPE = PLAYER_DND_TYPE;

const ROLE_META: Record<RoleName, { icon: string; accent: string; dropActive: string; full: string }> = {
  Mafia:     { icon: "🔫", accent: "hover:border-rose-400/60",    dropActive: "border-rose-400/70 bg-rose-500/10",    full: "border-rose-400/50 bg-rose-500/10" },
  Detective: { icon: "🔍", accent: "hover:border-sky-400/60",     dropActive: "border-sky-400/70 bg-sky-500/10",      full: "border-amber-400/60 bg-amber-500/10" },
  Doctor:    { icon: "💊", accent: "hover:border-emerald-400/60", dropActive: "border-emerald-400/70 bg-emerald-500/10", full: "border-amber-400/60 bg-amber-500/10" },
  Villager:  { icon: "🏘️", accent: "hover:border-slate-500/60",   dropActive: "border-slate-400/70 bg-slate-500/10",  full: "border-amber-400/60 bg-amber-500/10" },
  Jester:    { icon: "🃏", accent: "hover:border-violet-400/60",  dropActive: "border-violet-400/70 bg-violet-500/10", full: "border-amber-400/60 bg-amber-500/10" },
};

type DragPayload = {
  player: Player;
};

type RoleColumnProps = {
  role: RoleName;
  capacity: number;
  players: Player[];
  onDrop: (player: Player) => void;
  onRemove: (playerId: number) => void;
  isMobile?: boolean;
};

const RoleColumn = ({ role, capacity, players, onDrop, onRemove, isMobile }: RoleColumnProps) => {
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

  const meta = ROLE_META[role];
  const full = capacity !== 0 && players.length >= capacity;

  return (
    <div
      ref={isMobile ? undefined : dropRef}
      className={`space-y-3 rounded-2xl border px-4 py-4 shadow-sm shadow-black/20 transition ${
        !isMobile && isOver && canDrop
          ? meta.dropActive
          : full
          ? meta.full
          : `border-slate-800 bg-slate-950/60 ${isMobile ? "" : meta.accent}`
      }`}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-base" aria-hidden>{meta.icon}</span>
          <div>
            <h3 className="text-sm font-semibold text-white">{role}</h3>
            <p className="text-[0.65rem] uppercase tracking-wide text-slate-500">
              {capacity === 0 ? "Unlimited" : `${capacity} slot${capacity !== 1 ? "s" : ""}`}
            </p>
          </div>
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
          <p className="rounded-xl border border-dashed border-slate-800 bg-slate-950/70 px-3 py-3 text-center text-xs text-slate-500">
            {isMobile ? "None assigned" : "Drop here"}
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
      aria-label={`Remove ${player.name} from role`}
      className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-wide text-rose-200 transition hover:bg-rose-500/20"
    >
      <span aria-hidden>✕</span>
    </button>
  </div>
);

type PlayerCardProps = {
  player: Player;
  isMobile?: boolean;
  onTap?: () => void;
};

const PlayerCard = ({ player, isMobile, onTap }: PlayerCardProps) => {
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

  if (isMobile) {
    return (
      <button
        onClick={onTap}
        className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-left text-sm text-slate-100 shadow-sm shadow-black/20 transition active:scale-[0.97] active:border-slate-500"
      >
        <span className="text-base text-sky-400 select-none" aria-hidden>+</span>
        <PlayerAvatar value={player.avatar} fallbackLabel={player.name} size="sm" />
        <span className="flex-1 font-semibold">{player.name}</span>
        <span className="text-[0.65rem] text-slate-500 uppercase tracking-wide">Tap</span>
      </button>
    );
  }

  return (
    <div
      ref={dragRef}
      className={`flex cursor-grab items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 shadow-sm shadow-black/20 transition active:cursor-grabbing ${
        isDragging ? "opacity-40 scale-95" : "opacity-100 hover:border-slate-600"
      }`}
    >
      <span className="text-slate-600 text-xs select-none" aria-hidden>⠿</span>
      <PlayerAvatar value={player.avatar} fallbackLabel={player.name} size="sm" />
      <span className="font-semibold">{player.name}</span>
    </div>
  );
};

type RolePickerSheetProps = {
  player: Player;
  playersByRole: Record<RoleName, Player[]>;
  counts: RoleCounts;
  onAssign: (role: RoleName) => void;
  onClose: () => void;
};

const RolePickerSheet = ({ player, playersByRole, counts, onAssign, onClose }: RolePickerSheetProps) => {
  const sheetRef = useRef<HTMLDivElement>(null);

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal
        aria-label={`Assign role for ${player.name}`}
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl border-t border-white/10 bg-slate-900 px-5 pb-safe-bottom pt-4 shadow-2xl"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        {/* Drag handle */}
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-slate-700" />

        {/* Player header */}
        <div className="mb-4 flex items-center gap-3 border-b border-slate-800 pb-4">
          <PlayerAvatar value={player.avatar} fallbackLabel={player.name} size="sm" />
          <div>
            <p className="text-sm font-semibold text-white">{player.name}</p>
            <p className="text-xs text-slate-500">Choose a role to assign</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="ml-auto rounded-full bg-slate-800 p-1.5 text-slate-400 transition hover:text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Role buttons */}
        <div className="space-y-2.5">
          {ROLE_KEYS.map((role) => {
            const meta = ROLE_META[role];
            const filled = playersByRole[role].length;
            const cap = counts[role];
            const full = cap !== 0 && filled >= cap;

            return (
              <button
                key={role}
                disabled={full}
                onClick={() => { onAssign(role); onClose(); }}
                className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-left transition ${
                  full
                    ? "cursor-not-allowed border-slate-800 bg-slate-950/60 opacity-40"
                    : "border-slate-700 bg-slate-800/60 active:scale-[0.98] active:border-slate-500"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl" aria-hidden>{meta.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-white">{role}</p>
                    <p className="text-[0.65rem] uppercase tracking-wide text-slate-500">
                      {cap === 0 ? "Unlimited" : `${cap} slot${cap !== 1 ? "s" : ""}`}
                    </p>
                  </div>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  full ? "bg-amber-500/10 text-amber-300" : "bg-slate-700/80 text-slate-300"
                }`}>
                  {filled}/{cap === 0 ? "∞" : cap}
                  {full && " · Full"}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
};

const AssignRolesPage = () => {
  const { state } = useLocation() as { state?: { roleCounts?: RoleCounts } };
  const { gameId } = useParams();
  const navigate = useNavigate();
  const isMobile = useIsCompact("lg");
  const [game, setGame] = useState<GameDetail | null>(null);
  const [assignments, setAssignments] = useState<Record<number, RoleName>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

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
        const data = await api.getGame(gameId);
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
    return <Spinner message="Loading game..." />;
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 text-rose-300">
        <p className="text-sm">{error}</p>
        <div className="flex gap-3">
          <button onClick={() => window.location.reload()} className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-sky-400">Retry</button>
          <a href="/profile" className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white">← Back to Profile</a>
        </div>
      </div>
    );
  }

  return (
    <ResponsiveDndProvider>
      <div className="relative min-h-screen bg-slate-950 text-slate-100">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-[12%] top-0 h-72 w-72 rounded-full bg-sky-500/15 blur-3xl" />
          <div className="absolute bottom-10 right-[18%] h-80 w-80 rounded-full bg-emerald-400/12 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.15),_transparent_55%)]" />
        </div>

        <div className="relative z-10 mx-auto max-w-6xl px-6 py-10 lg:py-14">

          {/* ── Slim hero — same style as NewGamePage ── */}
          <div className="mb-8">
            <button
              className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-400 transition hover:text-white"
              onClick={() => navigate("/profile")}
            >
              <span aria-hidden>←</span> Back to Profile
            </button>
            <p className="text-sm font-semibold uppercase tracking-widest text-sky-400">Game #{game.id}</p>
            <h1 className="text-3xl font-semibold text-white sm:text-4xl">Assign roles</h1>
            <p className="mt-1 max-w-xl text-sm text-slate-400">
              Drag each player into their faction. Once every slot is filled you can launch the game.
            </p>
          </div>

          {/* ── Stats strip — like ProfileHomePage ── */}
          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-stretch">
            <div className="flex divide-x divide-white/10 overflow-hidden rounded-xl border border-white/10 bg-slate-900/70 shadow-lg shadow-slate-950/50 backdrop-blur-sm">
              <div className="flex items-center justify-between gap-4 px-5 py-3">
                <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">Players</p>
                <p className="text-lg font-bold text-white">{game.players.length}</p>
              </div>
              <div className="flex items-center justify-between gap-4 px-5 py-3">
                <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">Assigned</p>
                <p className="text-lg font-bold text-emerald-300">{assignedPlayersCount}</p>
              </div>
              <div className="flex items-center justify-between gap-4 px-5 py-3">
                <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">Remaining</p>
                <p className="text-lg font-bold text-slate-300">{unassignedCount}</p>
              </div>
            </div>
            <div
              className={`flex items-center gap-5 rounded-xl border px-5 py-3 shadow-lg shadow-slate-950/50 backdrop-blur-sm ${
                slotsMatch
                  ? "border-emerald-400/50 bg-emerald-500/10"
                  : "border-rose-400/40 bg-rose-500/10"
              }`}
            >
              <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">Slots</p>
              <p className={`text-lg font-bold ${slotsMatch ? "text-emerald-200" : "text-rose-200"}`}>
                {totalSlots} / {game.players.length}
              </p>
              <span className={`text-[0.65rem] font-semibold uppercase ${slotsMatch ? "text-emerald-400" : "text-rose-400"}`}>
                {slotsMatch ? "Balanced ✓" : "Adjust roles"}
              </span>
            </div>
          </div>

          {/* ── Progress bar ── */}
          <div className="mb-8">
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Assignment progress</p>
              <p className="text-xs text-slate-400">
                {assignedPlayersCount} / {game.players.length} placed
              </p>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                style={{ width: game.players.length > 0 ? `${(assignedPlayersCount / game.players.length) * 100}%` : "0%" }}
              />
            </div>
          </div>

          {/* ── Two-column layout ── */}
          <div className="grid gap-8 lg:grid-cols-[1fr_2fr]">

            {/* Unassigned players — sticky on desktop */}
            <section className="lg:sticky lg:top-6 lg:self-start">
              <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/60">
                <header className="mb-4 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-white">Unassigned</h2>
                  <span className="rounded-full border border-slate-700/60 bg-slate-800/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-300">
                    {unassignedPlayers.length}
                  </span>
                </header>
                <p className="mb-3 text-[0.7rem] text-slate-500 uppercase tracking-wide">
                  {isMobile ? "Tap a player to assign a role →" : "Drag a card into a role →"}
                </p>
                <div className="space-y-2">
                  {unassignedPlayers.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/70 px-4 py-4 text-center text-xs text-slate-500">
                      Everyone seated ✓
                    </p>
                  ) : (
                    unassignedPlayers.map((player) => (
                      <PlayerCard
                        key={player.id}
                        player={player}
                        isMobile={isMobile}
                        onTap={() => setSelectedPlayer(player)}
                      />
                    ))
                  )}
                </div>
              </div>
            </section>

            {/* Role columns */}
            <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/60">
              <header className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-white">Roles</h2>
                  <p className="text-sm text-slate-400">
                    {isMobile ? "Tap a player above to place them" : "Drop players into a faction"}
                  </p>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-700/60 bg-slate-800/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-300">
                  {assignedPlayersCount} placed
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
                    isMobile={isMobile}
                  />
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>

      {selectedPlayer && (
        <RolePickerSheet
          player={selectedPlayer}
          playersByRole={playersByRole}
          counts={counts}
          onAssign={(role) => handleDrop(selectedPlayer, role)}
          onClose={() => setSelectedPlayer(null)}
        />
      )}

      {isComplete && (
        <div className="fixed bottom-0 left-0 right-0 z-[60] flex items-center justify-between gap-4 border-t border-emerald-500/30 bg-slate-950/90 px-6 py-4 backdrop-blur-xl">
          <div>
            <p className="text-sm font-semibold text-emerald-300">All players assigned — ready to launch!</p>
            <p className="text-xs text-slate-400">{game.players.length} players · {totalSlots} slots filled</p>
          </div>
          <button
            onClick={handleStartGame}
            className="rounded-2xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-emerald-500/40 transition hover:bg-emerald-400"
          >
            Start Game →
          </button>
        </div>
      )}
    </ResponsiveDndProvider>
  );
};

export default AssignRolesPage;
