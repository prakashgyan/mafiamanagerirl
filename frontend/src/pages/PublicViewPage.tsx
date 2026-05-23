import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useGameSocket } from "../hooks/useGameSocket";
import { api, GameDetail } from "../services/api";
import { useOptionalAuth } from "../context/AuthContext";
import BackdropLogo from "../components/BackdropLogo";
import { normalizeAvatar } from "../utils/avatarOptions";
import { cn } from "../utils/cn";
import TypewriterText from "../components/TypewriterText";
import { Stars, Sun, Moon, Clouds, FloatingParticles } from "../components/publicview/AnimatedBackground";
import ANIMATION_CONSTANTS from "../constants/animationConstants";

const PublicViewPage = () => {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState<GameDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const auth = useOptionalAuth();

  useEffect(() => {
    if (!gameId) return;
    void (async () => {
      try {
        const data = await api.getGame(gameId);
        setGame(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load game");
      }
    })();
  }, [gameId]);

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
        players: message.players,
        logs: message.logs,
      });
    },
  });

  const socketIndicator = useMemo(() => {
    switch (socketStatus) {
      case "open":
        return { color: "bg-emerald-400", label: "Live", showWarning: false };
      case "connecting":
        return { color: "bg-amber-400", label: "Connecting", showWarning: false };
      case "reconnecting":
        return { color: "bg-amber-400", label: "Reconnecting", showWarning: true };
      case "error":
        return { color: "bg-rose-500", label: "Error", showWarning: true };
      default:
        return { color: "bg-rose-500", label: "Offline", showWarning: true };
    }
  }, [socketStatus]);

  const activePlayers = useMemo(
    () => game?.players.filter((player) => (player.public_is_alive ?? player.is_alive)) ?? [],
    [game?.players]
  );
  const inactivePlayers = useMemo(
    () => game?.players.filter((player) => !(player.public_is_alive ?? player.is_alive)) ?? [],
    [game?.players]
  );
  const isDay = game?.current_phase === "day";
  const title = auth?.user?.username ? `${auth.user.username}'s game` : "Your game";
  const [isFullscreen, setIsFullscreen] = useState(false);

  const getPlayerCardStyles = useCallback((isAlive: boolean) => {
    const baseCardStyles = "relative w-32 h-40 overflow-hidden rounded-xl backdrop-blur-md transition-transform duration-300";
    const aliveCardTone = "bg-emerald-600/15 border-emerald-400/35 hover:bg-emerald-600/25";
    const deadCardTone = "bg-rose-600/20 border-rose-400/35 hover:bg-rose-600/30 opacity-75";
    const cardTone = isAlive ? aliveCardTone : deadCardTone;

    const topTone = isAlive ? "bg-white/35" : "bg-rose-200/35";
    const bottomTone = isAlive ? "bg-white/20" : "bg-rose-200/25";
    const dividerColor = isAlive ? "bg-white/50" : "bg-rose-100/60";
    const textColor = "text-white";

    return { baseCardStyles, cardTone, topTone, bottomTone, dividerColor, textColor };
  }, []);

  const renderPlayerCard = (
    player: GameDetail["players"][number],
    isAlive: boolean
  ) => {
    const styles = getPlayerCardStyles(isAlive);

    const normalizedAvatar = normalizeAvatar(player.avatar);
    const displayValue = normalizedAvatar ?? player.name?.trim().charAt(0)?.toUpperCase() ?? "🙂";
    const isImageAvatar = normalizedAvatar?.startsWith("http") || normalizedAvatar?.startsWith("data:");

    return (
      <div
        key={player.id}
        className={`${styles.baseCardStyles} ${styles.cardTone} border flex flex-col hover:scale-105`}
        role="article"
        aria-label={`${player.name}, ${isAlive ? 'active' : 'eliminated'}`}
      >
        <div className={`absolute top-[75%] left-4 right-4 h-px ${styles.dividerColor}`} />
        <div className="relative grid h-full grid-rows-[3fr_1fr]">
          <div className="relative flex items-center justify-center px-3 pt-4 pb-2">
            <div
              className={`pointer-events-none absolute inset-0 rounded-t-xl ${styles.topTone}`}
            />
            {isImageAvatar ? (
              <img
                src={displayValue}
                alt={player.name}
                className={`relative z-10 h-16 w-16 rounded-lg object-cover shadow-lg transition-all duration-500 ${
                  isAlive ? "" : "grayscale"
                }`}
              />
            ) : (
              <span
                className="relative z-10 text-4xl leading-none drop-shadow transition-all duration-500 text-white"
              >
                {displayValue}
              </span>
            )}
          </div>
          <div className="relative flex items-center justify-center px-2 pb-3">
            <div
              className={`pointer-events-none absolute inset-0 rounded-b-xl ${styles.bottomTone}`}
            />
            <span className={`relative z-10 text-center text-sm font-semibold leading-tight ${styles.textColor}`}>
              {player.name}
            </span>
          </div>
        </div>
      </div>
    );
  };

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
        // Try different methods for different browsers
        const docEl = document.documentElement;
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen();
        } else if ('webkitRequestFullscreen' in docEl && typeof docEl.webkitRequestFullscreen === 'function') {
          await docEl.webkitRequestFullscreen();
        } else if ('msRequestFullscreen' in docEl && typeof docEl.msRequestFullscreen === 'function') {
          await docEl.msRequestFullscreen();
        }
      } else {
        // Exit fullscreen
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ('webkitExitFullscreen' in document && typeof document.webkitExitFullscreen === 'function') {
          await document.webkitExitFullscreen();
        } else if ('msExitFullscreen' in document && typeof document.msExitFullscreen === 'function') {
          await document.msExitFullscreen();
        }
      }
    } catch (err) {
      console.error("Failed to toggle fullscreen", err);
    }
  }, []);

  useEffect(() => {
    if (game?.status === "finished") {
      navigate(`/games/${game.id}/over`, { replace: true });
    }
  }, [game?.status, game?.id, navigate]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center relative overflow-hidden">
        {/* Animated background for error state */}
        <div className="absolute inset-0 bg-gradient-to-br from-red-900 via-red-800 to-black">
          <Stars isDay={false} />
          <FloatingParticles isDay={false} />
        </div>
        <div className="relative z-10 text-center max-w-md px-6">
          <div className="text-6xl mb-4">⚠️</div>
          <div className="text-2xl font-bold text-red-200 mb-4">{error}</div>
          <button
            type="button"
            onClick={() => {
              setError(null);
              if (gameId) {
                void (async () => {
                  try {
                    const data = await api.getGame(gameId);
                    setGame(data);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Failed to load game");
                  }
                })();
              }
            }}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="ml-4 px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!game) {
    return null;
  }

  return (
    <div
      className="min-h-screen w-full relative overflow-hidden"
      role="main"
      aria-label="Public game view"
    >
      {/* Dynamic Animated Background with smooth phase transitions */}
      <div className="absolute inset-0" aria-hidden="true">
        {/* Night background - Always rendered as base layer */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-purple-950 to-black" />
        
        {/* Day background - Fades in/out on top */}
        <div 
          className={cn(
            "absolute inset-0 bg-gradient-to-br from-sky-300 via-blue-400 to-blue-600",
            ANIMATION_CONSTANTS.PHASE_TRANSITION_CSS,
            isDay ? 'opacity-100' : 'opacity-0'
          )}
        />
        
        {/* Animated Background Elements */}
        <Stars isDay={isDay} />
        <Sun key={`sun-${isDay}`} isDay={isDay} />
        <Moon key={`moon-${isDay}`} isDay={isDay} />
        <Clouds isDay={isDay} />
        <FloatingParticles isDay={isDay} />
        <BackdropLogo className="left-[20%] top-[2rem] w-[640px] opacity-5" />

        {/* Gradient overlay for better text readability */}
        <div className={cn(
          "absolute inset-0",
          ANIMATION_CONSTANTS.PHASE_TRANSITION_CSS,
          isDay 
            ? 'bg-gradient-to-r from-white/10 via-transparent to-black/20' 
            : 'bg-gradient-to-r from-black/20 via-transparent to-black/40'
        )} />
      </div>

      {/* Content Overlay - No background, transparent */}
      <div className="relative z-10 min-h-screen">
        {/* Phase and User name - Top left corner */}
        <div className="absolute top-6 left-6 space-y-2">
          <div role="status" aria-live="polite" aria-atomic="true">
            <TypewriterText 
              text={isDay ? 'Day Phase' : 'Night Phase'} 
              isDay={isDay}
            />
          </div>
          <h1 className={cn(
            "text-2xl font-bold drop-shadow-xl tracking-wide",
            ANIMATION_CONSTANTS.PHASE_TRANSITION_CSS,
            isDay ? 'text-yellow-200/90' : 'text-blue-200/80'
          )}>
            {title}
          </h1>
        </div>

        {/* Game info and Fullscreen - Bottom right corner */}
        <div className="absolute top-6 right-6 flex items-center gap-4">
          {socketIndicator.showWarning && (
            <div className={cn(
              "px-3 py-2 rounded-lg backdrop-blur-sm border text-sm font-medium",
              isDay 
                ? 'bg-amber-400/20 text-amber-900 border-amber-500/40' 
                : 'bg-amber-600/20 text-amber-100 border-amber-400/40'
            )}>
              {socketStatus === 'reconnecting' ? 'Reconnecting to server...' : 'Connection lost. Updates may be delayed.'}
            </div>
          )}
          <div className={cn(
            "inline-flex items-center gap-3 px-4 py-2 rounded-full backdrop-blur-sm border",
            ANIMATION_CONSTANTS.PHASE_TRANSITION_CSS,
            isDay 
              ? 'bg-yellow-400/20 text-yellow-100 border-yellow-300/30' 
              : 'bg-blue-600/20 text-blue-100 border-blue-400/30'
          )}>
            <span className="font-semibold">
              Game #{game.id} • {isDay ? "Day" : "Night"} {game.current_round}
            </span>
            <span
              className="flex items-center gap-2 text-[0.7rem] font-medium uppercase tracking-wide"
              title={`WebSocket status: ${socketIndicator.label}`}
            >
              <span className={cn("h-2.5 w-2.5 rounded-full shadow shadow-black/40", socketIndicator.color)} />
              <span>{socketIndicator.label}</span>
            </span>
          </div>

          {/* Fullscreen Toggle with square four corner icon */}
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            aria-pressed={isFullscreen}
            className={cn(
              "w-12 h-12 rounded-full backdrop-blur-sm hover:scale-110 active:scale-95 border flex items-center justify-center text-lg",
              ANIMATION_CONSTANTS.PHASE_TRANSITION_CSS,
              isDay
                ? 'bg-yellow-200/20 hover:bg-yellow-200/30 text-yellow-100 border-yellow-300/30'
                : 'bg-white/20 hover:bg-white/30 text-white border-white/30'
            )}
          >
            <span aria-hidden="true">{isFullscreen ? "⛶" : "⛶"}</span>
          </button>
        </div>

        {/* Alive Players - Bottom left */}
        {activePlayers.length > 0 && (
          <div 
            className="absolute bottom-6 left-6 flex max-w-2xl flex-wrap-reverse items-end content-end gap-4"
            role="region"
            aria-label="Active players"
          >
            {activePlayers.map((player) => renderPlayerCard(player, true))}
          </div>
        )}

        {/* Eliminated Players - Bottom right */}
        {inactivePlayers.length > 0 && (
          <div 
            className="absolute bottom-6 right-6 flex max-w-2xl flex-wrap-reverse items-end content-end justify-end gap-4"
            role="region"
            aria-label="Eliminated players"
          >
            {inactivePlayers.map((player) => renderPlayerCard(player, false))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicViewPage;
