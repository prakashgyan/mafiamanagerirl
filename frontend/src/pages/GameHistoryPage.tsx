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

const STATUS_ORDER: Record<GameStatus, number> = {
  active: 0,
  pending: 1,
  finished: 2,
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

  const filteredGames = useMemo(() => {
    const games = statusFilter === "all" ? allGames : allGames.filter((g) => g.status === statusFilter);
    return [...games].sort((a, b) => {
      const statusDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      if (statusDiff !== 0) return statusDiff;
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA;
    });
  }, [allGames, statusFilter]);

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

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const handleDeleteGame = async (game: GameSummary) => {
    setDeletingId(game.id);
    try {
      await api.deleteGame(game.id);
      setAllGames((prev) => prev.filter((g) => g.id !== game.id));
    } catch (err) {
      setError(getErrorMessage(err, "Failed to delete game"));
    } finally {
      setDeletingId(null);
      setConfirmingId(null);
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

          <div className="flex w-full flex-col gap-3">
            {filteredGames.map((game) => {
              const date = formatDate(game.created_at);
              return (
                <div
                  key={game.id}
                  className="group flex w-full flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 px-5 py-3 shadow-lg shadow-slate-950/30 transition hover:border-slate-700 hover:bg-slate-900/90 sm:flex-row sm:items-center sm:justify-between"
                >
                  {/* Info — clickable */}
                  <button
                    className="flex flex-1 items-center gap-4 text-left"
                    onClick={() => handleNavigateToGame(game)}
                  >
                    <GameStatusBadge status={game.status} className="shrink-0 px-2.5 py-1 text-[0.65rem]" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <h3 className="text-base font-semibold text-white group-hover:text-sky-200 transition">
                          {cardTitle(game)}
                        </h3>
                        <p className="text-xs font-mono text-slate-500 tracking-wider">#{game.id}</p>
                        {date && <p className="text-xs text-slate-500">{date}</p>}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-slate-300">
                        {game.status !== "pending" && (
                          <span>
                            {phaseIcon[game.current_phase]}{" "}
                            <span className="font-semibold text-white">
                              {game.current_phase === "day" ? "Day" : "Night"} · Round {game.current_round}
                            </span>
                          </span>
                        )}
                        {game.status === "finished" && (
                          <span>
                            🏆{" "}
                            <span className="font-semibold text-emerald-200">{game.winning_team ?? "Undeclared"}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Action buttons */}
                  {confirmingId === game.id ? (
                    <div className="flex shrink-0 items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-sm text-rose-200">
                      <span className="whitespace-nowrap">Delete?</span>
                      <button
                        onClick={() => handleDeleteGame(game)}
                        disabled={deletingId === game.id}
                        className="rounded-lg bg-rose-500 px-3 py-1 text-xs font-semibold text-slate-900 transition hover:bg-rose-400 disabled:opacity-60"
                      >
                        {deletingId === game.id ? "Deleting…" : "Confirm"}
                      </button>
                      <button
                        onClick={() => setConfirmingId(null)}
                        disabled={deletingId === game.id}
                        className="rounded-lg border border-slate-700/60 px-3 py-1 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        onClick={() => handleNavigateToGame(game)}
                        className="rounded-xl bg-sky-500 px-3 py-1.5 text-sm font-semibold text-slate-900 shadow shadow-sky-500/30 transition hover:bg-sky-400"
                      >
                        {game.status === "finished" ? "View Summary" : game.status === "pending" ? "Set Up Game" : "Open Game"}
                      </button>
                      {game.status !== "pending" && (
                        <button
                          onClick={() => navigate(`/games/${game.id}/public`)}
                          className="rounded-xl border border-slate-700/60 px-3 py-1.5 text-sm font-semibold text-slate-200 transition hover:border-sky-400 hover:text-sky-200"
                        >
                          Public View
                        </button>
                      )}
                      <button
                        onClick={() => setConfirmingId(game.id)}
                        className="rounded-xl border border-slate-700/60 px-3 py-1.5 text-sm font-semibold text-slate-400 transition hover:border-rose-400/60 hover:text-rose-300"
                        aria-label="Delete game"
                        title="Delete game"
                      >
                        🗑️
                      </button>
                    </div>
                  )}
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
