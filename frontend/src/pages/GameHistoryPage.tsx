import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { api, GameStatus, GameSummary } from "../services/api";

const statusLabels: Record<GameStatus, { label: string; accent: string }> = {
  pending: { label: "Pending", accent: "text-amber-200 border-amber-400/40 bg-amber-400/10" },
  active: { label: "Active", accent: "text-emerald-200 border-emerald-400/40 bg-emerald-400/10" },
  finished: { label: "Finished", accent: "text-slate-200 border-slate-400/40 bg-slate-400/10" },
};

type StatusFilter = GameStatus | "all";

const filterOptions: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "active", label: "Active" },
  { id: "finished", label: "Finished" },
];

const GameHistoryPage = () => {
  const [games, setGames] = useState<GameSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      try {
        const allGames = await api.listGames();
        setGames(allGames);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load game history");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const filteredGames = useMemo(() => {
    if (statusFilter === "all") return games;
    return games.filter((game) => game.status === statusFilter);
  }, [games, statusFilter]);

  const totals = useMemo(
    () => ({
      all: games.length,
      pending: games.filter((game) => game.status === "pending").length,
      active: games.filter((game) => game.status === "active").length,
      finished: games.filter((game) => game.status === "finished").length,
    }),
    [games]
  );

  const handleNavigateToGame = (game: GameSummary) => {
    if (game.status === "pending") {
      navigate(`/games/${game.id}/assign`);
    } else if (game.status === "active") {
      navigate(`/games/${game.id}/manage`);
    } else {
      navigate(`/games/${game.id}/over`);
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[5%] top-0 h-80 w-80 rounded-full bg-sky-500/15 blur-3xl" />
        <div className="absolute bottom-0 right-[10%] h-96 w-96 rounded-full bg-emerald-400/12 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.16),_transparent_58%)]" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-12 lg:py-16">
        <header className="rounded-3xl border border-white/10 bg-slate-900/70 p-8 shadow-2xl shadow-slate-950/60 backdrop-blur-xl">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-5">
              <span className="inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-200">
                MafiaDesk
              </span>
              <div className="space-y-3">
                <h1 className="text-3xl font-semibold text-white sm:text-4xl">Game History</h1>
                <p className="max-w-2xl text-base text-slate-300">
                  Relive every accusation, vote, and reveal. Filter by status to jump back into unfinished games or
                  review your greatest finales.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                to="/profile"
                className="inline-flex items-center justify-center rounded-xl border border-slate-700/60 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-sky-400 hover:text-sky-200"
              >
                Back to Profile
              </Link>
              <button
                onClick={() => navigate("/games/new")}
                className="rounded-xl bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-sky-500/30 transition hover:bg-sky-400"
              >
                Create New Game
              </button>
            </div>
          </div>
        </header>

        <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/60">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Filter by status</h2>
              <p className="text-sm text-slate-400">Select a phase to focus on the games that matter right now.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {filterOptions.map((option) => {
                const isActive = statusFilter === option.id;
                const count = option.id === "all" ? totals.all : totals[option.id];
                return (
                  <button
                    key={option.id}
                    onClick={() => setStatusFilter(option.id)}
                    className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                      isActive
                        ? "bg-white text-slate-900 shadow"
                        : "border border-slate-700/60 text-slate-300 hover:border-slate-500"
                    }`}
                  >
                    {option.label}
                    <span className="ml-2 inline-flex h-6 min-w-[2.5rem] items-center justify-center rounded-full bg-slate-900/60 px-2 text-[0.7rem] text-slate-300">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="space-y-6">
          {loading && (
            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-8 text-center text-sm text-slate-300">
              Loading game history...
            </div>
          )}

          {error && (
            <div className="rounded-3xl border border-rose-500/40 bg-rose-500/10 p-5 text-sm text-rose-200">
              {error}
            </div>
          )}

          {!loading && !error && filteredGames.length === 0 && (
            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-8 text-center text-sm text-slate-300">
              No games found for this filter.
            </div>
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            {filteredGames.map((game) => {
              const statusInfo = statusLabels[game.status];
              return (
                <div
                  key={game.id}
                  className="flex h-full flex-col justify-between rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl shadow-slate-950/40"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-400">Game #{game.id}</p>
                      <h3 className="text-xl font-semibold text-white">
                        {game.status === "finished" ? "Finale Recap" : "In Progress"}
                      </h3>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusInfo.accent}`}>
                      {statusInfo.label}
                    </span>
                  </div>

                  <div className="mt-5 space-y-2 text-sm text-slate-300">
                    <p>
                      Current phase: <span className="font-semibold text-white">{game.current_phase === "day" ? "Day" : "Night"}</span>
                    </p>
                    <p>
                      Current round: <span className="font-semibold text-white">{game.current_round}</span>
                    </p>
                    {game.status === "finished" && (
                      <p>
                        Winning team: <span className="font-semibold text-emerald-200">{game.winning_team ?? "Undeclared"}</span>
                      </p>
                    )}
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      onClick={() => handleNavigateToGame(game)}
                      className="flex-1 rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-sky-500/30 transition hover:bg-sky-400"
                    >
                      {game.status === "finished" ? "View Summary" : "Open Game"}
                    </button>
                    <button
                      onClick={() => navigate(`/games/${game.id}/public`)}
                      className="flex-1 rounded-xl border border-slate-700/60 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-sky-400 hover:text-sky-200"
                    >
                      Public View
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};

export default GameHistoryPage;
