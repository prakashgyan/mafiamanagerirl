import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useGameSocket } from "../hooks/useGameSocket";
import { api, GameDetail, GamePhase, GameStatus } from "../services/api";
import { useOptionalAuth } from "../context/AuthContext";
import PlayerAvatar from "../components/PlayerAvatar";

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

  if (isDay) return null;

  return (
    <div className="absolute inset-0 overflow-hidden">
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
  if (!isDay) return null;

  return (
    <div className="absolute right-16 top-16 animate-pulse" style={{ animationDuration: "4s" }}>
      <div className="relative">
        {/* Sun body */}
        <div className="h-24 w-24 rounded-full bg-gradient-radial from-yellow-200 via-yellow-400 to-orange-500 shadow-lg shadow-yellow-400/50">
          <div className="h-full w-full rounded-full bg-gradient-to-br from-yellow-100/30 to-transparent" />
        </div>
      </div>
    </div>
  );
};

const Moon = ({ isDay }: { isDay: boolean }) => {
  if (isDay) return null;

  return (
    <div className="absolute right-20 top-20">
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
    <div className="absolute inset-0 overflow-hidden">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className={`absolute animate-bounce opacity-30 ${
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

  useGameSocket(game ? game.id : Number(gameId ?? 0), {
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

  const activePlayers = useMemo(() => game?.players.filter((player) => player.is_alive) ?? [], [game?.players]);
  const inactivePlayers = useMemo(
    () => game?.players.filter((player) => !player.is_alive) ?? [],
    [game?.players]
  );
  const isDay = game?.current_phase === "day";
  const title = auth?.user?.username ? `${auth.user.username}'s game` : "Your game";
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

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
    return (
      <div className="flex min-h-screen items-center justify-center relative overflow-hidden">
        {/* Animated background for loading state */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-blue-900 to-black">
          <Stars isDay={false} />
          <FloatingParticles isDay={false} />
        </div>
        <div className="relative z-10 text-center">
          <div className="animate-spin text-6xl mb-4">⏳</div>
          <div className="text-2xl font-bold text-blue-200">Loading public view...</div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="min-h-screen w-full relative overflow-hidden transition-all duration-1000"
    >
      {/* Dynamic Animated Background */}
      <div 
        className={`absolute inset-0 transition-all duration-2000 ${
          isDay 
            ? 'bg-gradient-to-br from-sky-300 via-blue-400 to-blue-600' 
            : 'bg-gradient-to-br from-indigo-950 via-purple-950 to-black'
        }`}
      >
        {/* Animated Background Elements */}
        <Stars isDay={isDay} />
        <Sun isDay={isDay} />
        <Moon isDay={isDay} />
        <Clouds isDay={isDay} />
        <FloatingParticles isDay={isDay} />
        
        {/* Gradient overlay for better text readability */}
        <div className={`absolute inset-0 ${
          isDay 
            ? 'bg-gradient-to-r from-white/10 via-transparent to-black/20' 
            : 'bg-gradient-to-r from-black/20 via-transparent to-black/40'
        }`} />
      </div>

      {/* Content Overlay - No background, transparent */}
      <div className="relative z-10 min-h-screen">
        {/* Phase and User name - Top left corner */}
        <div className="absolute top-6 left-6 space-y-2">
          <div className="text-5xl font-bold text-white drop-shadow-2xl tracking-wide">
            {isDay ? 'Day Phase' : 'Night Phase'}
          </div>
          <h1 className="text-2xl font-bold text-white/80 drop-shadow-xl tracking-wide">
            {title}
          </h1>
        </div>

        {/* Game info and Fullscreen - Bottom right corner */}
        <div className="absolute bottom-6 right-6 flex items-center gap-4">
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-sm border ${
            isDay 
              ? 'bg-yellow-400/20 text-yellow-100 border-yellow-300/30' 
              : 'bg-blue-600/20 text-blue-100 border-blue-400/30'
          }`}>
            <span className="text-xl">{isDay ? '☀️' : '🌙'}</span>
            <span className="font-semibold">
              Game #{game.id} • {isDay ? "Day" : "Night"} {game.current_round}
            </span>
          </div>

          {/* Fullscreen Toggle with square four corner icon */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="w-12 h-12 rounded-full backdrop-blur-sm bg-white/20 hover:bg-white/30 text-white border border-white/30 transition-all duration-300 hover:scale-110 active:scale-95 flex items-center justify-center text-lg"
          >
            {isFullscreen ? "⛶" : "⛶"}
          </button>
        </div>

        {/* Players - Bottom left corner */}
        <div className="absolute bottom-6 left-6 flex flex-wrap gap-3 max-w-2xl">
          {/* Active Players */}
          {activePlayers.length === 0 ? null : (
            activePlayers.map((player) => (
              <div
                key={player.id}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl backdrop-blur-sm bg-emerald-500/20 border border-emerald-400/30 hover:bg-emerald-500/30 transition-all duration-300 hover:scale-105 w-28 h-28"
              >
                <PlayerAvatar 
                  value={player.avatar} 
                  fallbackLabel={player.name} 
                  size="md" 
                  className="border-2 border-emerald-300/50" 
                />
                <span className="text-emerald-100 font-medium text-sm text-center leading-tight">
                  {player.name}
                </span>
              </div>
            ))
          )}

          {/* Eliminated Players */}
          {inactivePlayers.length === 0 ? null : (
            inactivePlayers.map((player) => (
              <div
                key={player.id}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl backdrop-blur-sm bg-rose-500/20 border border-rose-400/30 hover:bg-rose-500/30 transition-all duration-300 hover:scale-105 opacity-75 w-28 h-28"
              >
                <PlayerAvatar 
                  value={player.avatar} 
                  fallbackLabel={player.name} 
                  size="md" 
                  className="border-2 border-rose-300/50 grayscale" 
                />
                <span className="text-rose-100 font-medium text-sm text-center leading-tight">
                  {player.name}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default PublicViewPage;
