import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useGameSocket } from "../hooks/useGameSocket";
import { api, GameDetail, GamePhase, GameStatus } from "../services/api";
import { useOptionalAuth } from "../context/AuthContext";
import BackdropLogo from "../components/BackdropLogo";
import { normalizeAvatar } from "../utils/avatarOptions";

// Utility function for conditional classes
const cn = (...classes: (string | boolean | undefined)[]) => 
  classes.filter(Boolean).join(' ');

// Animation constants
const ANIMATION_CONSTANTS = {
  PHASE_TRANSITION_DURATION: 8000, // ms - Standard transition time for all phase changes
  PHASE_TRANSITION_CSS: 'transition-all duration-[8000ms] ease-in-out', // Consistent CSS class
  TYPEWRITER_DELETE_SPEED: 80, // ms
  TYPEWRITER_TYPE_SPEED: 120, // ms
  TYPEWRITER_PAUSE: 300, // ms
  STAR_COUNT: 100,
  CLOUD_COUNT: 6,
  PARTICLE_COUNT: 20,
  SUN_MOON_ARC_DISTANCE: 300, // px
  MOON_ARC_DISTANCE: 250, // px
} as const;

// Typewriter Component
const TypewriterText = ({ text, isDay }: { text: string; isDay: boolean }) => {
  const [displayText, setDisplayText] = useState(text);
  const [isAnimating, setIsAnimating] = useState(false);
  const prevTextRef = useRef(text);
  const timeoutRef = useRef<number>();
  const intervalRef = useRef<number>();
  
  useEffect(() => {
    // Only trigger animation if text actually changed
    if (prevTextRef.current === text) return;
    
    const previousText = prevTextRef.current;
    prevTextRef.current = text;
    
    // Clear any existing timers
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    
    setIsAnimating(true);
    
    // Delete animation: remove characters one by one
    let deleteIndex = previousText.length;
    intervalRef.current = window.setInterval(() => {
      if (deleteIndex > 0) {
        setDisplayText(previousText.slice(0, deleteIndex - 1));
        deleteIndex--;
      } else {
        if (intervalRef.current) window.clearInterval(intervalRef.current);
        intervalRef.current = undefined;
        
        // Small pause before typing new text
        timeoutRef.current = window.setTimeout(() => {
          timeoutRef.current = undefined;
          // Type animation: add characters one by one
          let typeIndex = 0;
          intervalRef.current = window.setInterval(() => {
            if (typeIndex <= text.length) {
              setDisplayText(text.slice(0, typeIndex));
              typeIndex++;
            } else {
              if (intervalRef.current) window.clearInterval(intervalRef.current);
              intervalRef.current = undefined;
              setIsAnimating(false);
            }
          }, ANIMATION_CONSTANTS.TYPEWRITER_TYPE_SPEED);
        }, ANIMATION_CONSTANTS.TYPEWRITER_PAUSE);
      }
    }, ANIMATION_CONSTANTS.TYPEWRITER_DELETE_SPEED);
    
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, [text]);
  
  return (
    <div className={cn(
      "text-5xl font-bold drop-shadow-2xl tracking-wide",
      ANIMATION_CONSTANTS.PHASE_TRANSITION_CSS,
      isDay ? 'text-yellow-100' : 'text-blue-100'
    )}>
      <span className="inline-block">
        {displayText}
        <span className={cn(
          "inline-block w-1 h-12 ml-2 bg-current transition-opacity duration-300",
          isAnimating ? 'opacity-100 animate-blink-cursor' : 'opacity-0'
        )} />
      </span>
    </div>
  );
};

// Animated Background Components
const Stars = ({ isDay }: { isDay: boolean }) => {
  const stars = useMemo(() => Array.from({ length: ANIMATION_CONSTANTS.STAR_COUNT }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2 + 1,
    opacity: Math.random() * 0.8 + 0.2,
    twinkleDelay: Math.random() * 8,
    twinkleDuration: Math.random() * 4 + 3, // 3-7 seconds for slower twinkling
  })), []);

  return (
    <div className={cn(
      "absolute inset-0 overflow-hidden",
      ANIMATION_CONSTANTS.PHASE_TRANSITION_CSS,
      isDay ? 'opacity-0' : 'opacity-100'
    )}>
      {stars.map((star) => (
        <div
          key={star.id}
          className="absolute animate-twinkle"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            opacity: star.opacity,
            animationDelay: `${star.twinkleDelay}s`,
            animationDuration: `${star.twinkleDuration}s`,
          }}
        >
          <div className="h-full w-full rounded-full bg-white shadow-sm shadow-white/50" />
        </div>
      ))}
    </div>
  );
};

const Sun = ({ isDay }: { isDay: boolean }) => {
  return (
    <div className="absolute top-16 right-16 w-0 h-0 pointer-events-none"> {/* Center point moved to top-right corner */}
      <div 
        className={`absolute -translate-x-1/2 -translate-y-1/2 ${
          isDay 
            ? 'animate-sun-rise' 
            : 'animate-sun-set'
        }`}
        style={{ 
          animationFillMode: 'forwards',
          transformOrigin: 'center center',
          // Initial position for sun-set (visible) or sun-rise (hidden)
          transform: isDay 
            ? `rotate(-120deg) translateX(${ANIMATION_CONSTANTS.SUN_MOON_ARC_DISTANCE}px) rotate(120deg) scale(0.8)` 
            : `rotate(120deg) translateX(${ANIMATION_CONSTANTS.SUN_MOON_ARC_DISTANCE}px) rotate(-120deg) scale(1)`,
          opacity: isDay ? 0 : 1
        }}
      >
        <div className="relative">
          {/* Sun body */}
          <div className={`h-24 w-24 rounded-full bg-gradient-radial from-yellow-200 via-yellow-400 to-orange-500 shadow-lg shadow-yellow-400/50 ${
            isDay ? 'animate-pulse' : ''
          }`} style={{ animationDuration: "4s" }}>
            <div className="h-full w-full rounded-full bg-gradient-to-br from-yellow-100/30 to-transparent" />
          </div>
        </div>
      </div>
    </div>
  );
};

const Moon = ({ isDay }: { isDay: boolean }) => {
  return (
    <div className="absolute top-16 right-16 w-0 h-0 pointer-events-none"> {/* Center point moved to top-right corner */}
      <div 
        className={`absolute -translate-x-1/2 -translate-y-1/2 ${
          isDay 
            ? 'animate-moon-set' 
            : 'animate-moon-rise'
        }`}
        style={{ 
          animationFillMode: 'forwards',
          transformOrigin: 'center center',
          // Initial position for moon-rise (hidden) or moon-set (visible)
          transform: isDay 
            ? `rotate(120deg) translateX(${ANIMATION_CONSTANTS.MOON_ARC_DISTANCE}px) rotate(-120deg) scale(1)` 
            : `rotate(-120deg) translateX(${ANIMATION_CONSTANTS.MOON_ARC_DISTANCE}px) rotate(120deg) scale(0.8)`,
          opacity: isDay ? 1 : 0
        }}
      >
        <div className="relative h-20 w-20">
          {/* Moon glow */}
          <div className="absolute -inset-4 rounded-full bg-blue-200/10 blur-xl animate-pulse" />
          {/* Moon body */}
          <div className="relative h-full w-full rounded-full bg-gradient-to-br from-slate-200 via-slate-300 to-slate-400 shadow-lg shadow-blue-200/30">
            {/* Moon craters */}
            <div className="absolute left-3 top-2 h-2 w-2 rounded-full bg-slate-400/50" />
            <div className="absolute right-4 top-4 h-1 w-1 rounded-full bg-slate-400/50" />
            <div className="absolute bottom-3 left-5 h-1.5 w-1.5 rounded-full bg-slate-400/50" />
          </div>
        </div>
      </div>
    </div>
  );
};

const Clouds = ({ isDay }: { isDay: boolean }) => {
  const clouds = useMemo(() => Array.from({ length: ANIMATION_CONSTANTS.CLOUD_COUNT }, (_, i) => ({
    id: i,
    x: Math.random() * 220 - 20, // Start randomly across the entire screen (-20% to 200%)
    y: Math.random() * 30 + 10,
    scale: Math.random() * 0.5 + 0.5,
    speed: Math.random() * 80 + 80, // Much slower movement (80-160s)
    delay: Math.random() * 5, // Quick start delay (0-5s) so clouds appear immediately
  })), []);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {clouds.map((cloud) => (
        <div
          key={cloud.id}
          className="absolute animate-drift"
          style={{
            left: `${cloud.x}%`,
            top: `${cloud.y}%`,
            transform: `scale(${cloud.scale})`,
            animationDuration: `${cloud.speed}s`,
            animationDelay: `${cloud.delay}s`,
          }}
        >
          <svg 
            width="80" 
            height="40" 
            viewBox="0 0 80 40" 
            className={cn(
              ANIMATION_CONSTANTS.PHASE_TRANSITION_CSS,
              isDay ? 'text-white/70' : 'text-slate-700/50'
            )}
            style={{
              fill: 'currentColor'
            }}
          >
            <path d="M20 30c-6 0-10-4-10-10s4-10 10-10c2-6 8-10 15-10s13 4 15 10c6 0 10 4 10 10s-4 10-10 10H20z" />
          </svg>
        </div>
      ))}
    </div>
  );
};

const FloatingParticles = ({ isDay }: { isDay: boolean }) => {
  const particles = useMemo(() => Array.from({ length: ANIMATION_CONSTANTS.PARTICLE_COUNT }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 4 + 2,
    duration: Math.random() * 10 + 10,
    delay: Math.random() * 5,
  })), []);

  return (
    <div className={cn(
      "absolute inset-0 overflow-hidden",
      ANIMATION_CONSTANTS.PHASE_TRANSITION_CSS,
      isDay ? 'opacity-60' : 'opacity-30'
    )}>
      {particles.map((particle) => (
        <div
          key={particle.id}
          className={cn(
            "absolute animate-bounce rounded-full blur-sm",
            ANIMATION_CONSTANTS.PHASE_TRANSITION_CSS,
            isDay ? 'bg-yellow-200' : 'bg-blue-200'
          )}
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            animationDuration: `${particle.duration}s`,
            animationDelay: `${particle.delay}s`,
          }}
        />
      ))}
    </div>
  );
};

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
        const data = await api.getGame(Number(gameId));
        setGame(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load game");
      }
    })();
  }, [gameId]);

  const { status: socketStatus } = useGameSocket(Number(gameId ?? 0), {
    enabled: Boolean(gameId),
    onMessage: (message) => {
      if (message.game_id !== Number(gameId)) return;

      setError(null);
      setGame({
        id: message.game_id,
        status: message.status as GameStatus,
        current_phase: message.phase as GamePhase,
        current_round: message.round,
        winning_team: message.winning_team ?? null,
        players:
          message.players?.map((player) => ({
            id: player.id,
            name: player.name,
            role: player.role,
            is_alive: player.is_alive,
            public_is_alive: player.public_is_alive,
            actual_is_alive: player.actual_is_alive,
            avatar: player.avatar,
            friend_id: player.friend_id ?? null,
          })) ?? [],
        logs:
          message.logs?.map((log) => ({
            id: log.id,
            round: log.round,
            phase: log.phase as GamePhase,
            message: log.message,
            timestamp: log.timestamp,
          })) ?? [],
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
                    const data = await api.getGame(Number(gameId));
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
