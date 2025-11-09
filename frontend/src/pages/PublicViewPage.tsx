import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useGameSocket } from "../hooks/useGameSocket";
import { api, GameDetail, GamePhase, GameStatus } from "../services/api";
import { useOptionalAuth } from "../context/AuthContext";
import BackdropLogo from "../components/BackdropLogo";
import { normalizeAvatar } from "../utils/avatarOptions";

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
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    
    setIsAnimating(true);
    
    // Delete animation: remove characters one by one
    let deleteIndex = previousText.length;
    intervalRef.current = window.setInterval(() => {
      if (deleteIndex > 0) {
        setDisplayText(previousText.slice(0, deleteIndex - 1));
        deleteIndex--;
      } else {
        if (intervalRef.current) clearInterval(intervalRef.current);
        
        // Small pause before typing new text
        timeoutRef.current = window.setTimeout(() => {
          // Type animation: add characters one by one
          let typeIndex = 0;
          intervalRef.current = window.setInterval(() => {
            if (typeIndex <= text.length) {
              setDisplayText(text.slice(0, typeIndex));
              typeIndex++;
            } else {
              if (intervalRef.current) clearInterval(intervalRef.current);
              setIsAnimating(false);
            }
          }, 120); // Typing speed
        }, 300); // Pause between delete and type
      }
    }, 80); // Delete speed
    
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [text]);
  
  return (
    <div className={`text-5xl font-bold drop-shadow-2xl tracking-wide transition-all duration-[8000ms] ease-in-out ${
      isDay ? 'text-yellow-100' : 'text-blue-100'
    }`}>
      <span className="inline-block">
        {displayText}
        <span className={`inline-block w-1 h-12 ml-2 bg-current transition-opacity duration-300 ${
          isAnimating ? 'opacity-100 animate-blink-cursor' : 'opacity-0'
        }`} />
      </span>
    </div>
  );
};

// Animated Background Components
const Stars = ({ isDay }: { isDay: boolean }) => {
  const stars = Array.from({ length: 100 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2 + 1,
    opacity: Math.random() * 0.8 + 0.2,
    twinkleDelay: Math.random() * 8,
    twinkleDuration: Math.random() * 4 + 3, // 3-7 seconds for slower twinkling
  }));

  return (
    <div className={`absolute inset-0 overflow-hidden transition-opacity duration-[8000ms] ease-in-out ${
      isDay ? 'opacity-0' : 'opacity-100'
    }`}>
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
            ? 'rotate(-120deg) translateX(300px) rotate(120deg) scale(0.8)' 
            : 'rotate(120deg) translateX(300px) rotate(-120deg) scale(1)',
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
            ? 'rotate(120deg) translateX(250px) rotate(-120deg) scale(1)' 
            : 'rotate(-120deg) translateX(250px) rotate(120deg) scale(0.8)',
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
  const clouds = Array.from({ length: 6 }, (_, i) => ({
    id: i,
    x: Math.random() * 220 - 20, // Start randomly across the entire screen (-20% to 200%)
    y: Math.random() * 30 + 10,
    scale: Math.random() * 0.5 + 0.5,
    speed: Math.random() * 80 + 80, // Much slower movement (80-160s)
    opacity: isDay ? Math.random() * 0.4 + 0.3 : Math.random() * 0.2 + 0.1,
    delay: Math.random() * 5, // Quick start delay (0-5s) so clouds appear immediately
  }));

  return (
    <div className="absolute inset-0 overflow-hidden">
      {clouds.map((cloud) => (
        <div
          key={cloud.id}
          className={`absolute animate-drift ${isDay ? 'text-white/70' : 'text-slate-700/50'}`}
          style={{
            left: `${cloud.x}%`,
            top: `${cloud.y}%`,
            transform: `scale(${cloud.scale})`,
            opacity: cloud.opacity,
            animationDuration: `${cloud.speed}s`,
            animationDelay: `${cloud.delay}s`,
          }}
        >
          <svg width="80" height="40" viewBox="0 0 80 40" fill="currentColor">
            <path d="M20 30c-6 0-10-4-10-10s4-10 10-10c2-6 8-10 15-10s13 4 15 10c6 0 10 4 10 10s-4 10-10 10H20z" />
          </svg>
        </div>
      ))}
    </div>
  );
};

const FloatingParticles = ({ isDay }: { isDay: boolean }) => {
  const particles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 4 + 2,
    duration: Math.random() * 10 + 10,
    delay: Math.random() * 5,
  }));

  return (
    <div className={`absolute inset-0 overflow-hidden transition-all duration-[8000ms] ease-in-out ${
      isDay ? 'opacity-60' : 'opacity-30'
    }`}>
      {particles.map((particle) => (
        <div
          key={particle.id}
          className={`absolute animate-bounce transition-all duration-[8000ms] ease-in-out ${
            isDay ? 'bg-yellow-200' : 'bg-blue-200'
          } rounded-full blur-sm`}
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
        return { color: "bg-emerald-400", label: "Live" };
      case "connecting":
        return { color: "bg-amber-400", label: "Connecting" };
      case "reconnecting":
        return { color: "bg-amber-400", label: "Reconnecting" };
      case "error":
        return { color: "bg-rose-500", label: "Error" };
      default:
        return { color: "bg-rose-500", label: "Offline" };
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const renderPlayerCard = (
    player: GameDetail["players"][number],
    isAlive: boolean
  ) => {
    const baseCardStyles = "relative w-32 h-40 overflow-hidden rounded-xl backdrop-blur-md transition-transform duration-300";
    const aliveCardTone = "bg-emerald-600/15 border-emerald-400/35 hover:bg-emerald-600/25";
    const deadCardTone = "bg-rose-600/20 border-rose-400/35 hover:bg-rose-600/30";
    const cardTone = isAlive ? aliveCardTone : `${deadCardTone} opacity-75`;

    const topTone = isAlive ? "bg-white/35" : "bg-rose-200/35";
    const bottomTone = isAlive ? "bg-white/20" : "bg-rose-200/25";

    const dividerColor = isAlive ? "bg-white/50" : "bg-rose-100/60";
    const textColor = "text-white";

    const normalizedAvatar = normalizeAvatar(player.avatar);
    const displayValue = normalizedAvatar ?? player.name?.trim().charAt(0)?.toUpperCase() ?? "🙂";
    const isImageAvatar = normalizedAvatar?.startsWith("http") || normalizedAvatar?.startsWith("data:");

    return (
      <div
        key={player.id}
        className={`${baseCardStyles} ${cardTone} border flex flex-col hover:scale-105`}
      >
        <div className={`absolute top-[75%] left-4 right-4 h-px ${dividerColor}`} />
        <div className="relative grid h-full grid-rows-[3fr_1fr]">
          <div className="relative flex items-center justify-center px-3 pt-4 pb-2">
            <div
              className={`pointer-events-none absolute inset-0 rounded-t-xl ${topTone}`}
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
              className={`pointer-events-none absolute inset-0 rounded-b-xl ${bottomTone}`}
            />
            <span className={`relative z-10 text-center text-sm font-semibold leading-tight ${textColor}`}>
              {player.name}
            </span>
          </div>
        </div>
      </div>
    );
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        // Try different methods for different browsers
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        } else if ((document.documentElement as any).webkitRequestFullscreen) {
          await (document.documentElement as any).webkitRequestFullscreen();
        } else if ((document.documentElement as any).msRequestFullscreen) {
          await (document.documentElement as any).msRequestFullscreen();
        }
      } else {
        // Exit fullscreen
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        } else if ((document as any).msExitFullscreen) {
          await (document as any).msExitFullscreen();
        }
      }
    } catch (err) {
      console.error("Failed to toggle fullscreen", err);
    }
  }, []);

  useEffect(() => {
    if (!game || game.status !== "finished") {
      return;
    }

    navigate(`/games/${game.id}/over`, { replace: true });
  }, [game, navigate]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center relative overflow-hidden">
        {/* Animated background for error state */}
        <div className="absolute inset-0 bg-gradient-to-br from-red-900 via-red-800 to-black">
          <Stars isDay={false} />
          <FloatingParticles isDay={false} />
        </div>
        <div className="relative z-10 text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <div className="text-2xl font-bold text-red-200">{error}</div>
        </div>
      </div>
    );
  }

  if (!game) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="min-h-screen w-full relative overflow-hidden"
    >
      {/* Dynamic Animated Background with smooth phase transitions */}
      <div className="absolute inset-0">
        {/* Day background */}
        <div 
          className={`absolute inset-0 bg-gradient-to-br from-sky-300 via-blue-400 to-blue-600 transition-opacity duration-[8000ms] ease-in-out ${
            isDay ? 'opacity-100' : 'opacity-0'
          }`}
        />
        {/* Night background */}
        <div 
          className={`absolute inset-0 bg-gradient-to-br from-indigo-950 via-purple-950 to-black transition-opacity duration-[8000ms] ease-in-out ${
            isDay ? 'opacity-0' : 'opacity-100'
          }`}
        />
        
        {/* Animated Background Elements */}
        <Stars isDay={isDay} />
        <Sun key={`sun-${isDay}`} isDay={isDay} />
        <Moon key={`moon-${isDay}`} isDay={isDay} />
        <Clouds isDay={isDay} />
        <FloatingParticles isDay={isDay} />
        <BackdropLogo className="left-[20%] top-[2rem] w-[640px] opacity-5" />

        {/* Gradient overlay for better text readability */}
        <div className={`absolute inset-0 transition-all duration-[8000ms] ease-in-out ${
          isDay 
            ? 'bg-gradient-to-r from-white/10 via-transparent to-black/20' 
            : 'bg-gradient-to-r from-black/20 via-transparent to-black/40'
        }`} />
      </div>

      {/* Content Overlay - No background, transparent */}
      <div className="relative z-10 min-h-screen">
        {/* Phase and User name - Top left corner */}
        <div className="absolute top-6 left-6 space-y-2">
          <TypewriterText 
            text={isDay ? 'Day Phase' : 'Night Phase'} 
            isDay={isDay}
          />
          <h1 className={`text-2xl font-bold drop-shadow-xl tracking-wide transition-all duration-[8000ms] ease-in-out ${
            isDay ? 'text-yellow-200/90' : 'text-blue-200/80'
          }`}>
            {title}
          </h1>
        </div>

        {/* Game info and Fullscreen - Bottom right corner */}
        <div className="absolute top-6 right-6 flex items-center gap-4">
          <div className={`inline-flex items-center gap-3 px-4 py-2 rounded-full backdrop-blur-sm border transition-all duration-[8000ms] ease-in-out ${
            isDay 
              ? 'bg-yellow-400/20 text-yellow-100 border-yellow-300/30' 
              : 'bg-blue-600/20 text-blue-100 border-blue-400/30'
          }`}>
            <span className="font-semibold">
              Game #{game.id} • {isDay ? "Day" : "Night"} {game.current_round}
            </span>
            <span
              className="flex items-center gap-2 text-[0.7rem] font-medium uppercase tracking-wide"
              title={`WebSocket status: ${socketIndicator.label}`}
            >
              <span className={`h-2.5 w-2.5 rounded-full shadow shadow-black/40 ${socketIndicator.color}`} />
              <span>{socketIndicator.label}</span>
            </span>
          </div>

          {/* Fullscreen Toggle with square four corner icon */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className={`w-12 h-12 rounded-full backdrop-blur-sm hover:scale-110 active:scale-95 border transition-all duration-[8000ms] ease-in-out flex items-center justify-center text-lg ${
              isDay
                ? 'bg-yellow-200/20 hover:bg-yellow-200/30 text-yellow-100 border-yellow-300/30'
                : 'bg-white/20 hover:bg-white/30 text-white border-white/30'
            }`}
          >
            {isFullscreen ? "⛶" : "⛶"}
          </button>
        </div>

        {/* Alive Players - Bottom left */}
        {activePlayers.length > 0 && (
          <div className="absolute bottom-6 left-6 flex max-w-2xl flex-wrap items-end gap-4">
            {activePlayers.map((player) => renderPlayerCard(player, true))}
          </div>
        )}

        {/* Eliminated Players - Bottom right */}
        {inactivePlayers.length > 0 && (
          <div className="absolute bottom-6 right-6 flex max-w-2xl flex-wrap items-end justify-end gap-4">
            {inactivePlayers.map((player) => renderPlayerCard(player, false))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicViewPage;
