import { useCallback, useEffect, useMemo, memo, useState } from "react";
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

// ─── PlayerCard ──────────────────────────────────────────────────────────────

type PlayerCardProps = {
  player: PublicGameDetail["players"][number];
  isAlive: boolean;
};

const PlayerCard = memo(({ player, isAlive }: PlayerCardProps) => {
  const normalizedAvatar = normalizeAvatar(player.avatar);
  const displayValue = normalizedAvatar ?? player.name?.trim().charAt(0)?.toUpperCase() ?? "🙂";
  const isImageAvatar = normalizedAvatar?.startsWith("http") || normalizedAvatar?.startsWith("data:");

  const cardTone = isAlive
    ? "bg-emerald-600/15 border-emerald-400/35 hover:bg-emerald-600/25"
    : "bg-rose-600/20 border-rose-400/35 hover:bg-rose-600/30 opacity-75";
  const topTone = isAlive ? "bg-white/35" : "bg-rose-200/35";
  const bottomTone = isAlive ? "bg-white/20" : "bg-rose-200/25";
  const dividerColor = isAlive ? "bg-white/50" : "bg-rose-100/60";

  return (
    <div
      className={`relative w-32 h-40 overflow-hidden rounded-xl backdrop-blur-md transition-transform duration-300 border flex flex-col hover:scale-105 ${cardTone}`}
      role="article"
      aria-label={`${player.name}, ${isAlive ? "active" : "eliminated"}`}
    >
      <div className={`absolute top-[75%] left-4 right-4 h-px ${dividerColor}`} />
      <div className="relative grid h-full grid-rows-[3fr_1fr]">
        <div className="relative flex items-center justify-center px-3 pt-4 pb-2">
          <div className={`pointer-events-none absolute inset-0 rounded-t-xl ${topTone}`} />
          {isImageAvatar ? (
            <img
              src={displayValue}
              alt={player.name}
              className={`relative z-10 h-16 w-16 rounded-lg object-cover shadow-lg transition-all duration-500 ${isAlive ? "" : "grayscale"}`}
            />
          ) : (
            <span className="relative z-10 text-4xl leading-none drop-shadow transition-all duration-500 text-white">
              {displayValue}
            </span>
          )}
        </div>
        <div className="relative flex items-center justify-center px-2 pb-3">
          <div className={`pointer-events-none absolute inset-0 rounded-b-xl ${bottomTone}`} />
          <span
            className="relative z-10 w-full text-center text-sm font-semibold leading-tight text-white truncate px-1"
            title={player.name}
          >
            {player.name}
          </span>
        </div>
      </div>
    </div>
  );
});
PlayerCard.displayName = "PlayerCard";

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

  // Fix #11: shared loadGame callback used by both useEffect and retry button
  const loadGame = useCallback(async () => {
    if (!gameId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getPublicGame(gameId);
      setGame(data);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load game"));
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    void loadGame();
  }, [loadGame]);

  const { status: socketStatus } = useGameSocket(gameId ?? null, {
    enabled: Boolean(gameId),
    onMessage: (message) => {
      if (message.game_id !== gameId) return;
      if (!message.players || !message.logs) return;

      setError(null);
      setGame({
        id: message.game_id,
        status: message.status,
        current_phase: message.phase,
        current_round: message.round,
        winning_team: message.winning_team ?? null,
        players: (message.players as Array<{ id: number; name: string; avatar?: string | null; public_is_alive?: boolean; is_alive?: boolean }>).map((p) => ({
          id: p.id,
          name: p.name,
          avatar: p.avatar ?? null,
          public_is_alive: p.public_is_alive ?? p.is_alive ?? true,
        })),
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

  const activePlayers = useMemo(
    () => game?.players.filter((p) => p.public_is_alive) ?? [],
    [game?.players]
  );
  const inactivePlayers = useMemo(
    () => game?.players.filter((p) => !p.public_is_alive) ?? [],
    [game?.players]
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
  const aliveCount = activePlayers.length;
  const eliminatedCount = inactivePlayers.length;

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

        {/* Fix #4/#10: Alive Players — labelled zone, overflow capped */}
        {activePlayers.length > 0 && (
          <div
            className="absolute bottom-6 left-6 flex flex-col items-start gap-2"
            role="region"
            aria-label="Active players"
          >
            <span
              className={cn(
                "text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded-full",
                ANIMATION_CONSTANTS.UI_TRANSITION_CSS,
                isDay ? "text-emerald-900 bg-emerald-300/60" : "text-emerald-200 bg-emerald-600/30"
              )}
            >
              ● Alive ({aliveCount})
            </span>
            <div className="flex max-w-2xl flex-wrap-reverse items-end content-end gap-3 max-h-[55vh] overflow-y-auto">
              {activePlayers.map((player) => (
                <PlayerCard key={player.id} player={player} isAlive={true} />
              ))}
            </div>
          </div>
        )}

        {/* Fix #4/#10: Eliminated Players — labelled zone, overflow capped */}
        {inactivePlayers.length > 0 && (
          <div
            className="absolute bottom-6 right-6 flex flex-col items-end gap-2"
            role="region"
            aria-label="Eliminated players"
          >
            <span
              className={cn(
                "text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded-full",
                ANIMATION_CONSTANTS.UI_TRANSITION_CSS,
                isDay ? "text-rose-900 bg-rose-300/60" : "text-rose-200 bg-rose-600/30"
              )}
            >
              ✕ Eliminated ({eliminatedCount})
            </span>
            <div className="flex max-w-2xl flex-wrap-reverse items-end content-end justify-end gap-3 max-h-[55vh] overflow-y-auto">
              {inactivePlayers.map((player) => (
                <PlayerCard key={player.id} player={player} isAlive={false} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicViewPage;

