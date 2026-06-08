import { useCallback, useEffect, useMemo, memo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

import { useGameSocket } from "../hooks/useGameSocket";
import { api, PublicGameDetail } from "../services/api";
import BackdropLogo from "../components/BackdropLogo";
import { normalizeAvatar } from "../utils/avatarOptions";
import { cn } from "../utils/cn";
import TypewriterText from "../components/TypewriterText";
import { Stars, Sun, Moon, Clouds, FloatingParticles } from "../components/publicview/AnimatedBackground";
import ANIMATION_CONSTANTS from "../constants/animationConstants";
import { getErrorMessage } from "../utils/errorMessage";
import { SpinnerIcon } from "../components/Spinner";
import { computeSeats, type SeatArrangement } from "../utils/seatLayout";

const ARRANGEMENT_STORAGE_KEY = "mafia-public-view-arrangement";

// ─── PlayerCard ──────────────────────────────────────────────────────────────

type PlayerCardProps = {
  player: PublicGameDetail["players"][number];
  isAlive: boolean;
  isNewlyEliminated: boolean;
  isSuspense: boolean;
};

const PlayerCard = memo(({ player, isAlive, isNewlyEliminated, isSuspense }: PlayerCardProps) => {
  const normalizedAvatar = normalizeAvatar(player.avatar);
  const displayValue = normalizedAvatar ?? player.name?.trim().charAt(0)?.toUpperCase() ?? "🙂";
  const isImageAvatar = normalizedAvatar?.startsWith("http") || normalizedAvatar?.startsWith("data:");

  // No idle animation on alive cards for now — only suspense/death react to events.
  const animationClass = isAlive
    ? (isSuspense ? "animate-suspense-pulse" : "")
    : (isNewlyEliminated ? "animate-death-shake" : "");

  return (
    <div
      className={cn(
        // Sized for legibility from across a room — scales up with viewport.
        "relative flex flex-col overflow-hidden rounded-2xl border-2 backdrop-blur-md",
        "w-24 h-32 sm:w-28 sm:h-36 lg:w-32 lg:h-44 xl:w-40 xl:h-52",
        "bg-white/10 border-white/20",
        "transition-[filter,opacity] duration-700 ease-in-out",
        !isAlive && "grayscale opacity-55",
        animationClass,
      )}
      role="article"
      aria-label={`${player.name}, ${isAlive ? "active" : "eliminated"}`}
    >
      {/* Avatar — fills the top of the card like a photo/portrait */}
      <div className="relative flex-1">
        {isImageAvatar ? (
          <img src={displayValue} alt={player.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="text-4xl leading-none text-white sm:text-5xl lg:text-6xl xl:text-7xl">
              {displayValue}
            </span>
          </div>
        )}
      </div>

      {/* Divider — separates the avatar from the nameplate */}
      <div className="mx-auto h-px w-[72%] bg-white/20" aria-hidden="true" />

      {/* Nameplate */}
      <div className="w-full px-1.5 py-2 text-center sm:py-2.5">
        <span
          className={cn(
            "block truncate font-bold leading-tight drop-shadow",
            "text-xs sm:text-sm lg:text-base xl:text-lg",
            isAlive ? "text-white" : "text-slate-300",
          )}
          title={player.name}
        >
          {player.name}
        </span>
      </div>

      {/* Elimination treatment — bold "case closed" stamp, readable at a glance */}
      {!isAlive && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none overflow-hidden">
          <div className="rotate-[-16deg] rounded-md border-[3px] border-rose-500/80 bg-black/45 px-2.5 py-1 shadow-lg shadow-black/40 sm:px-3.5 sm:py-1.5">
            <span className="block text-sm font-black uppercase tracking-[0.3em] text-rose-400 sm:text-base lg:text-lg">
              Out
            </span>
          </div>
        </div>
      )}
    </div>
  );
});
PlayerCard.displayName = "PlayerCard";

// ─── Arrangement icons ────────────────────────────────────────────────────────

const CircleSeatsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="8" strokeDasharray="2 3" />
    <circle cx="12" cy="4" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="19.3" cy="8.5" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="19.3" cy="15.5" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="12" cy="20" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="4.7" cy="15.5" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="4.7" cy="8.5" r="1.6" fill="currentColor" stroke="none" />
  </svg>
);

const ClassroomSeatsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3.5" y="4" width="4" height="4" rx="1" />
    <rect x="10" y="4" width="4" height="4" rx="1" />
    <rect x="16.5" y="4" width="4" height="4" rx="1" />
    <rect x="3.5" y="11" width="4" height="4" rx="1" />
    <rect x="10" y="11" width="4" height="4" rx="1" />
    <rect x="16.5" y="11" width="4" height="4" rx="1" />
    <rect x="6.75" y="18" width="4" height="4" rx="1" />
    <rect x="13.25" y="18" width="4" height="4" rx="1" />
  </svg>
);

// ─── Fullscreen icons ─────────────────────────────────────────────────────────

const ExpandIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="15 3 21 3 21 9" />
    <polyline points="9 21 3 21 3 15" />
    <line x1="21" y1="3" x2="14" y2="10" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </svg>
);

const CompressIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="4 14 10 14 10 20" />
    <polyline points="20 10 14 10 14 4" />
    <line x1="10" y1="14" x2="3" y2="21" />
    <line x1="21" y1="3" x2="14" y2="10" />
  </svg>
);

// ─── Page ─────────────────────────────────────────────────────────────────────

const PublicViewPage = () => {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState<PublicGameDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Night reveal drama state
  const prevAliveRef = useRef<Map<number, boolean>>(new Map());
  const [newlyEliminatedIds, setNewlyEliminatedIds] = useState<Set<number>>(new Set());
  const [suspenseActive, setSuspenseActive] = useState(false);
  const suspenseTimerRef = useRef<number>();

  // Fix #11: shared loadGame callback used by both useEffect and retry button
  const loadGame = useCallback(async () => {
    if (!gameId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getPublicGame(gameId);
      setGame(data);
      // Seed the alive-state tracker so first WS message can detect transitions
      prevAliveRef.current = new Map(data.players.map((p) => [p.id, p.public_is_alive]));
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load game"));
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    void loadGame();
  }, [loadGame]);

  // Cleanup suspense timer on unmount
  useEffect(() => {
    return () => {
      if (suspenseTimerRef.current) window.clearTimeout(suspenseTimerRef.current);
    };
  }, []);

  const { status: socketStatus } = useGameSocket(gameId ?? null, {
    enabled: Boolean(gameId),
    onMessage: (message) => {
      if (message.game_id !== gameId) return;
      if (!message.players || !message.logs) return;

      setError(null);

      const newPlayers = (message.players as Array<{ id: number; name: string; avatar?: string | null; public_is_alive?: boolean; is_alive?: boolean }>).map((p) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar ?? null,
        public_is_alive: p.public_is_alive ?? p.is_alive ?? true,
      }));

      // Detect players that just switched from alive → eliminated
      const prevMap = prevAliveRef.current;
      const newlyEliminated = new Set<number>();
      for (const p of newPlayers) {
        if (prevMap.get(p.id) === true && !p.public_is_alive) {
          newlyEliminated.add(p.id);
        }
      }
      prevAliveRef.current = new Map(newPlayers.map((p) => [p.id, p.public_is_alive]));

      // Trigger dramatic suspense sequence on alive cards before revealing eliminations
      if (newlyEliminated.size > 0) {
        setSuspenseActive(true);
        setNewlyEliminatedIds(newlyEliminated);
        if (suspenseTimerRef.current) window.clearTimeout(suspenseTimerRef.current);
        suspenseTimerRef.current = window.setTimeout(() => {
          setSuspenseActive(false);
          setNewlyEliminatedIds(new Set());
        }, 3500);
      }

      setGame({
        id: message.game_id,
        status: message.status,
        current_phase: message.phase,
        current_round: message.round,
        winning_team: message.winning_team ?? null,
        players: newPlayers,
      });
    },
  });

  // Fix #13: merged connection state — no separate warning banner
  const socketIndicator = useMemo(() => {
    switch (socketStatus) {
      case "open":
        return { color: "bg-emerald-400", label: "Live", hasIssue: false };
      case "connecting":
        return { color: "bg-amber-400", label: "Connecting…", hasIssue: false };
      case "reconnecting":
        return { color: "bg-amber-400", label: "Reconnecting…", hasIssue: true };
      case "error":
        return { color: "bg-rose-500", label: "Connection error", hasIssue: true };
      default:
        return { color: "bg-rose-500", label: "Offline", hasIssue: true };
    }
  }, [socketStatus]);

  // Seats are assigned by sorted player id so every player keeps the same spot
  // on the stage all game long — eliminated players grey out in place rather
  // than relocating to a different zone.
  const seatedPlayers = useMemo(
    () => [...(game?.players ?? [])].sort((a, b) => a.id - b.id),
    [game?.players]
  );

  const [arrangement, setArrangement] = useState<SeatArrangement>(() => {
    const stored = window.localStorage.getItem(ARRANGEMENT_STORAGE_KEY);
    return stored === "classroom" ? "classroom" : "circle";
  });

  useEffect(() => {
    window.localStorage.setItem(ARRANGEMENT_STORAGE_KEY, arrangement);
  }, [arrangement]);

  const seats = useMemo(
    () => computeSeats(seatedPlayers.length, arrangement),
    [seatedPlayers.length, arrangement]
  );

  const isDay = game?.current_phase === "day";

  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement !== null);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("msfullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("msfullscreenchange", handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        const docEl = document.documentElement;
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen();
        } else if ("webkitRequestFullscreen" in docEl && typeof docEl.webkitRequestFullscreen === "function") {
          await docEl.webkitRequestFullscreen();
        } else if ("msRequestFullscreen" in docEl && typeof docEl.msRequestFullscreen === "function") {
          await docEl.msRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ("webkitExitFullscreen" in document && typeof document.webkitExitFullscreen === "function") {
          await document.webkitExitFullscreen();
        } else if ("msExitFullscreen" in document && typeof document.msExitFullscreen === "function") {
          await document.msExitFullscreen();
        }
      }
    } catch (err) {
      console.error("Failed to toggle fullscreen", err);
    }
  }, []);

  // Fix #1: proper loading state with animated background
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-purple-950 to-black" aria-hidden="true">
          <Stars isDay={false} />
        </div>
        <div className="relative z-10 flex flex-col items-center gap-4">
          <SpinnerIcon className="h-10 w-10 text-blue-300" />
          <p className="text-blue-200 text-lg font-medium tracking-wide">Loading game…</p>
        </div>
      </div>
    );
  }

  if (!game && error) {
    return (
      <div className="flex min-h-screen items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-red-900 via-red-800 to-black" aria-hidden="true">
          <Stars isDay={false} />
          <FloatingParticles isDay={false} />
        </div>
        <div className="relative z-10 text-center max-w-md px-6">
          <div className="text-6xl mb-4">⚠️</div>
          <div className="text-2xl font-bold text-red-200 mb-6">{error}</div>
          <div className="flex items-center justify-center gap-3">
            {/* Fix #11: reuse loadGame, Fix #12: useNavigate */}
            <button
              type="button"
              onClick={() => void loadGame()}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold transition-colors"
            >
              Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!game) return null;

  const isFinished = game.status === "finished";
  const aliveCount = game.players.filter((p) => p.public_is_alive).length;
  const eliminatedCount = game.players.length - aliveCount;

  return (
    <div
      className="min-h-screen w-full relative overflow-hidden"
      role="main"
      aria-label="Public game view"
    >
      {/* Dynamic Animated Background — uses full 8s PHASE_TRANSITION_CSS */}
      <div className="absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-purple-950 to-black" />
        <div
          className={cn(
            "absolute inset-0 bg-gradient-to-br from-sky-300 via-blue-400 to-blue-600",
            ANIMATION_CONSTANTS.PHASE_TRANSITION_CSS,
            isDay ? "opacity-100" : "opacity-0"
          )}
        />
        <Stars isDay={isDay} />
        <Sun key={`sun-${isDay}`} isDay={isDay} />
        <Moon key={`moon-${isDay}`} isDay={isDay} />
        <Clouds isDay={isDay} />
        <FloatingParticles isDay={isDay} />
        <BackdropLogo className="left-[20%] top-[2rem] w-[640px] opacity-5" />
        <div
          className={cn(
            "absolute inset-0",
            ANIMATION_CONSTANTS.PHASE_TRANSITION_CSS,
            isDay
              ? "bg-gradient-to-r from-white/10 via-transparent to-black/20"
              : "bg-gradient-to-r from-black/20 via-transparent to-black/40"
          )}
        />
      </div>

      {/* Content — UI elements use shorter UI_TRANSITION_CSS, not 8s */}
      <div className="relative z-10 min-h-screen">
        {/* Game Over overlay */}
        {isFinished && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="text-center px-8 py-10 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-md max-w-sm mx-4">
              <div className="text-6xl mb-4">🏆</div>
              <h2 className="text-3xl font-bold text-white drop-shadow-lg mb-2">Game Over</h2>
              {game.winning_team && (
                <p className="text-xl font-semibold text-yellow-300 mb-1">{game.winning_team} wins!</p>
              )}
              <p className="text-sm text-white/60 mt-4">Game #{game.id}</p>
            </div>
          </div>
        )}

        {/* Fix #5/#6: Top-left — Phase (hero) + Round (secondary). No game ID here. */}
        <div className="absolute top-6 left-6 space-y-1">
          <h1 role="status" aria-live="polite" aria-atomic="true">
            <TypewriterText text={isDay ? "Day Phase" : "Night Phase"} isDay={isDay} />
          </h1>
          <p
            className={cn(
              "text-xl font-semibold drop-shadow-lg tracking-wide",
              ANIMATION_CONSTANTS.UI_TRANSITION_CSS,
              isDay ? "text-yellow-200/80" : "text-blue-200/70"
            )}
          >
            Round {game.current_round}
          </p>
        </div>

        {/* Fix #5/#13: Top-right — player count + merged game/status pill + fullscreen */}
        <div className="absolute top-6 right-6 flex items-center gap-3">
          {/* Fix #5: player count summary pill */}
          <div
            className={cn(
              "px-3 py-1.5 rounded-full backdrop-blur-sm border text-sm font-medium",
              ANIMATION_CONSTANTS.UI_TRANSITION_CSS,
              isDay
                ? "bg-white/15 text-yellow-100 border-white/20"
                : "bg-white/10 text-blue-100 border-white/15"
            )}
          >
            <span className="text-emerald-300">●</span> {aliveCount} alive
            {eliminatedCount > 0 && (
              <> · <span className="text-rose-300">✕</span> {eliminatedCount} out</>
            )}
          </div>

          {/* Fix #13: single merged pill — game ID + live/connection status */}
          <div
            className={cn(
              "inline-flex items-center gap-3 px-4 py-2 rounded-full backdrop-blur-sm border",
              ANIMATION_CONSTANTS.UI_TRANSITION_CSS,
              socketIndicator.hasIssue
                ? "bg-amber-500/20 text-amber-100 border-amber-400/40"
                : isDay
                  ? "bg-yellow-400/20 text-yellow-100 border-yellow-300/30"
                  : "bg-blue-600/20 text-blue-100 border-blue-400/30"
            )}
          >
            <span className="font-semibold text-sm">Game #{game.id}</span>
            <span
              className="flex items-center gap-1.5 text-[0.7rem] font-medium uppercase tracking-wide"
              title={`WebSocket: ${socketIndicator.label}`}
            >
              <span className={cn("h-2.5 w-2.5 rounded-full shadow shadow-black/40", socketIndicator.color)} />
              <span>{socketIndicator.label}</span>
            </span>
          </div>

          {/* Seating arrangement toggle — switch the stage to match the room */}
          <div
            role="group"
            aria-label="Seating arrangement"
            className={cn(
              "flex items-center gap-1 rounded-full border p-1 backdrop-blur-sm",
              ANIMATION_CONSTANTS.UI_TRANSITION_CSS,
              isDay
                ? "bg-yellow-200/15 border-yellow-300/30"
                : "bg-white/10 border-white/25"
            )}
          >
            {(
              [
                { value: "circle" as const, label: "Circle seating", icon: <CircleSeatsIcon /> },
                { value: "classroom" as const, label: "Classroom seating", icon: <ClassroomSeatsIcon /> },
              ]
            ).map((option) => {
              const isActive = arrangement === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setArrangement(option.value)}
                  aria-label={option.label}
                  aria-pressed={isActive}
                  title={option.label}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-200",
                    isActive
                      ? isDay
                        ? "bg-yellow-100/80 text-yellow-900"
                        : "bg-white/80 text-slate-900"
                      : isDay
                        ? "text-yellow-100/70 hover:text-yellow-100"
                        : "text-white/60 hover:text-white"
                  )}
                >
                  {option.icon}
                </button>
              );
            })}
          </div>

          {/* Fix #2: distinct SVG icons for enter vs exit fullscreen */}
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            aria-pressed={isFullscreen}
            className={cn(
              "w-10 h-10 rounded-full backdrop-blur-sm hover:scale-110 active:scale-95 border flex items-center justify-center",
              ANIMATION_CONSTANTS.UI_TRANSITION_CSS,
              isDay
                ? "bg-yellow-200/20 hover:bg-yellow-200/30 text-yellow-100 border-yellow-300/30"
                : "bg-white/20 hover:bg-white/30 text-white border-white/30"
            )}
          >
            {isFullscreen ? <CompressIcon /> : <ExpandIcon />}
          </button>
        </div>

        {/* Seated stage — every player keeps a fixed seat all game long;
            eliminated players grey out in place instead of relocating. */}
        <div
          className="absolute inset-0 pointer-events-none"
          role="region"
          aria-label={`Players, seated ${arrangement === "circle" ? "in a circle" : "classroom-style"}`}
        >
          {seatedPlayers.map((player, index) => {
            const seat = seats[index];
            if (!seat) return null;
            const isAlive = player.public_is_alive;
            return (
              <div
                key={player.id}
                className="absolute transition-[left,top] duration-700 ease-in-out"
                style={{
                  left: `${seat.leftPct}%`,
                  top: `${seat.topPct}%`,
                  transform: `translate(-50%, -50%) scale(${seat.scale})`,
                }}
              >
                <PlayerCard
                  player={player}
                  isAlive={isAlive}
                  isNewlyEliminated={newlyEliminatedIds.has(player.id)}
                  isSuspense={isAlive && suspenseActive}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PublicViewPage;

