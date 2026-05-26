import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { api, GameStatus, GameSummary } from "../services/api";
import Spinner from "../components/Spinner";
import EmptyState from "../components/EmptyState";
import GameStatusBadge, { GAME_STATUS_META } from "../components/GameStatusBadge";
import { getErrorMessage } from "../utils/errorMessage";

const phaseIcon: Record<string, string> = { day: "☀️", night: "🌙" };

type StatusFilter = GameStatus | "all";

const filterOptions: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: GAME_STATUS_META.pending.label },
  { id: "active", label: GAME_STATUS_META.active.label },
  { id: "finished", label: GAME_STATUS_META.finished.label },
];

const formatDate = (iso?: string | null) => {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(iso));
  } catch {
    return null;
  }
};

const cardTitle = (game: GameSummary) => {
  if (game.status === "pending") return "Setup Phase";
  if (game.status === "finished") return "Finale";
  return `Round ${game.current_round} · ${game.current_phase === "day" ? "Day" : "Night"}`;
};

const GameHistoryPage = () => {
  const [allGames, setAllGames] = useState<GameSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      try {
        const games = await api.listGames();
        setAllGames(games);
      } catch (err) {
        setError(getErrorMessage(err, "Failed to load game history"));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const filteredGames = useMemo(
    () =>
      statusFilter === "all"
        ? allGames
        : allGames.filter((g) => g.status === statusFilter),
    [allGames, statusFilter]
  );

  const totals = useMemo(
    () => ({
      all: allGames.length,
      pending: allGames.filter((g) => g.status === "pending").length,
      active: allGames.filter((g) => g.status === "active").length,
      finished: allGames.filter((g) => g.status === "finished").length,
    }),
    [allGames]
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
    <div className="relative min-h-screen text-slate-100">
      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-10 lg:py-14">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold uppercase tracking-widest text-sky-400">History</p>
            <h1 className="text-3xl font-semibold text-white sm:text-4xl">Game History</h1>
            <p className="mt-1 max-w-xl text-sm text-slate-400">
              Relive every accusation, vote, and reveal. Filter by status to jump back into unfinished games or review your greatest finales.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <Link
              to="/profile"
              className="text-sm font-semibold text-slate-400 transition hover:text-sky-300"
            >
              ← Back to Profile
            </Link>
            <button
              onClick={() => navigate("/games/new")}
              className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-sky-500/30 transition hover:bg-sky-400"
            >
              New Game
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter games by status">
          {filterOptions.map((option) => {
            const isActive = statusFilter === option.id;
            const count = option.id === "all" ? totals.all : totals[option.id];
            return (
              <button
                key={option.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setStatusFilter(option.id)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                  isActive
                    ? "bg-white text-slate-900 shadow"
                    : "border border-slate-700/60 text-slate-300 hover:border-slate-500 hover:text-white"
                }`}
              >
                {option.label}
                <span
                  className={`inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1 text-[0.65rem] ${
                    isActive ? "bg-slate-900/60 text-slate-300" : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <section className="space-y-6">
          {loading && <Spinner message="Loading game history…" fullScreen={false} />}

          {error && (
            <div className="rounded-3xl border border-rose-500/40 bg-rose-500/10 p-5 text-sm text-rose-200">
              {error}
            </div>
          )}

          {!loading && !error && filteredGames.length === 0 && (
            <EmptyState
              icon="🎲"
              title="No games here yet"
              message={
                statusFilter === "all"
                  ? "You haven't run any Mafia sessions. Start your first game!"
                  : `No ${statusFilter} games found. Try a different filter.`
              }
              action={
                statusFilter === "all" ? (
                  <button
                    onClick={() => navigate("/games/new")}
                    className="rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-sky-400"
                  >
                    Create New Game →
                  </button>
                ) : undefined
              }
              className="rounded-3xl border-slate-800 bg-slate-900/70 p-12"
            />
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            {filteredGames.map((game) => {
              const date = formatDate(game.created_at);
              return (
                <div
                  key={game.id}
                  className="group flex h-full flex-col justify-between rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl shadow-slate-950/40 transition hover:border-slate-700 hover:bg-slate-900/90"
                >
                  {/* Card header — clickable */}
                  <button
                    className="w-full text-left"
                    onClick={() => handleNavigateToGame(game)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-mono text-slate-500 tracking-wider">#{game.id}</p>
                        <h3 className="mt-0.5 text-xl font-semibold text-white group-hover:text-sky-200 transition">
                          {cardTitle(game)}
                        </h3>
                        {date && <p className="mt-1 text-xs text-slate-500">{date}</p>}
                      </div>
                      <GameStatusBadge status={game.status} className="shrink-0 px-3 py-1 text-xs" />
                    </div>

                    <div className="mt-4 space-y-1.5 text-sm text-slate-300">
                      {game.status !== "pending" && (
                        <p>
                          {phaseIcon[game.current_phase]}{" "}
                          <span className="font-semibold text-white">
                            {game.current_phase === "day" ? "Day" : "Night"} · Round {game.current_round}
                          </span>
                        </p>
                      )}
                      {game.status === "finished" && (
                        <p>
                          🏆 Winning team:{" "}
                          <span className="font-semibold text-emerald-200">{game.winning_team ?? "Undeclared"}</span>
                        </p>
                      )}
                    </div>
                  </button>

                  {/* Action buttons */}
                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      onClick={() => handleNavigateToGame(game)}
                      className="flex-1 rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-sky-500/30 transition hover:bg-sky-400"
                    >
                      {game.status === "finished" ? "View Summary" : game.status === "pending" ? "Set Up Game" : "Open Game"}
                    </button>
                    {game.status !== "pending" && (
                      <button
                        onClick={() => navigate(`/games/${game.id}/public`)}
                        className="flex-1 rounded-xl border border-slate-700/60 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-sky-400 hover:text-sky-200"
                      >
                        Public View
                      </button>
                    )}
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
