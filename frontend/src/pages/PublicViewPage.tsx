import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useGameSocket } from "../hooks/useGameSocket";
import { api, GameDetail, GamePhase, GameStatus } from "../services/api";
import { useOptionalAuth } from "../context/AuthContext";
import PlayerAvatar from "../components/PlayerAvatar";

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
    if (!containerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen?.();
      } else if (document.exitFullscreen) {
        await document.exitFullscreen();
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
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-rose-300">
        {error}
      </div>
    );
  }

  if (!game) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        Loading public view...
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`min-h-screen bg-gradient-to-br ${
        isDay ? "from-slate-700 via-slate-600 to-slate-700" : "from-slate-950 via-night to-slate-950"
      } text-slate-100 transition`}
    >
      <div className="mx-auto max-w-7xl px-10 py-12 lg:px-14 xl:px-20 xl:py-16">
        <header className="mb-12 flex flex-col items-center gap-6 text-center lg:flex-row lg:items-start lg:justify-between lg:text-left">
          <div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl xl:text-6xl">{title}</h1>
            <p className="mt-3 text-base uppercase tracking-[0.35em] text-slate-200/80 sm:text-lg">
              Game #{game.id} • {isDay ? "Day" : "Night"} {game.current_round}
            </p>
          </div>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="inline-flex min-w-[12rem] items-center justify-center rounded-full border border-slate-200/30 bg-slate-100/10 px-6 py-3 text-lg font-semibold uppercase tracking-wide text-slate-50 transition hover:border-slate-100/60 hover:bg-slate-100/20 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-200/40"
          >
            {isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          </button>
        </header>

        <section className="rounded-3xl border border-slate-200/20 bg-slate-100/10 p-8 shadow-xl backdrop-blur">
          <h2 className="text-3xl font-semibold uppercase tracking-[0.28em] text-slate-100/90">Active Players</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {activePlayers.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-emerald-400/40 bg-emerald-900/40 py-8 text-center text-2xl font-semibold text-emerald-50">
                No active players
              </div>
            ) : (
              activePlayers.map((player) => (
                <div
                  key={player.id}
                  className="flex flex-col items-center gap-3 rounded-3xl border border-emerald-400/40 bg-emerald-900/60 px-6 py-6 text-center text-emerald-50 shadow-lg shadow-emerald-900/30 transition-transform duration-300 hover:scale-[1.02] hover:shadow-emerald-700/50"
                >
                  <PlayerAvatar value={player.avatar} fallbackLabel={player.name} size="lg" className="border-emerald-300/40 bg-emerald-800/40" />
                  <span className="text-2xl font-semibold">{player.name}</span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="mt-10 rounded-3xl border border-slate-200/20 bg-slate-100/5 p-8 shadow-xl backdrop-blur">
          <h2 className="text-3xl font-semibold uppercase tracking-[0.28em] text-slate-100/90">Inactive Players</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {inactivePlayers.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-rose-400/40 bg-rose-900/40 py-8 text-center text-2xl font-semibold text-rose-100">
                Everyone is still in the game
              </div>
            ) : (
              inactivePlayers.map((player) => (
                <div
                  key={player.id}
                  className="flex flex-col items-center gap-3 rounded-3xl border border-rose-400/40 bg-rose-900/60 px-6 py-6 text-center text-rose-100 shadow-lg shadow-rose-900/30 transition-transform duration-300 hover:scale-[1.02] hover:shadow-rose-700/50"
                >
                  <PlayerAvatar value={player.avatar} fallbackLabel={player.name} size="lg" className="border-rose-300/40 bg-rose-800/40" />
                  <span className="text-2xl font-semibold">{player.name}</span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default PublicViewPage;
