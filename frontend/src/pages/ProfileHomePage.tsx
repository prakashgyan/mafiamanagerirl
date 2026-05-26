import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { api, Friend, GameSummary, LeaderboardEntry } from "../services/api";
import PlayerAvatar from "../components/PlayerAvatar";
import EmptyState from "../components/EmptyState";
import GameStatusBadge from "../components/GameStatusBadge";
import { getErrorMessage } from "../utils/errorMessage";

const Toast = ({ message }: { message: string }) => (
  <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-fade-in-up">
    <div className="flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-slate-900/95 px-4 py-2.5 text-sm font-semibold text-emerald-300 shadow-xl shadow-slate-950/60 backdrop-blur-sm">
      <span aria-hidden>✓</span>
      {message}
    </div>
  </div>
);

const ProfileHomePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [games, setGames] = useState<GameSummary[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setFriends([]);
      setGames([]);
      setLeaderboard([]);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const [friendData, gameData, leaderboardData] = await Promise.all([
          api.listFriends(),
          api.listGames(),
          api.getLeaderboard(),
        ]);
        if (!isMounted) return;
        setFriends(friendData);
        setGames(gameData);
        setLeaderboard(leaderboardData);
      } catch (err) {
        if (!isMounted) return;
        setError(getErrorMessage(err, "Unable to load profile data"));
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => { isMounted = false; };
  }, [user]);

  const pendingGames = useMemo(() => games.filter((g) => g.status === "pending"), [games]);
  const activeGames = useMemo(() => games.filter((g) => g.status === "active"), [games]);
  const finishedGames = useMemo(() => games.filter((g) => g.status === "finished"), [games]);
  const ongoingGames = useMemo(() => [...pendingGames, ...activeGames], [pendingGames, activeGames]);

  const [leaderboardExpanded, setLeaderboardExpanded] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2000);
  };

  const statCards = [
    { label: "Total Games", icon: "🎲", value: games.length, color: "text-white" },
    { label: "Active", icon: "⚡", value: activeGames.length, color: "text-emerald-300" },
    { label: "Finished", icon: "🏁", value: finishedGames.length, color: "text-sky-300" },
    { label: "Players", icon: "👥", value: friends.length, color: "text-violet-300" },
  ];

  return (
    <div className="relative min-h-screen text-slate-100">
      {toast && <Toast message={toast} />}
      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10 lg:py-14">

        {/* Hero */}
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold uppercase tracking-widest text-sky-400">Dashboard</p>
          <h1 className="text-3xl font-semibold text-white sm:text-4xl">
            Welcome back, <span className="text-sky-300">{user?.username}</span>
          </h1>
          <p className="mt-1 max-w-xl text-sm text-slate-400">
            Manage players, pick up where you left off, and review every twist in your Mafia nights.
          </p>
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200 shadow-lg shadow-rose-500/20">
            {error}
          </div>
        )}

        {/* Stats row */}
        {!loading && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Stat pills — left aligned */}
            <div className="flex flex-wrap items-stretch gap-3">
              {/* Games group */}
              <div className="flex divide-x divide-white/10 overflow-hidden rounded-xl border border-white/10 bg-slate-900/70 shadow-lg shadow-slate-950/50 backdrop-blur-sm">
                {statCards.slice(0, 3).map(({ label, value, color }) => (
                  <div key={label} className="flex items-center justify-between gap-4 px-5 py-3">
                    <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                    <p className={`text-lg font-bold ${color}`}>{value}</p>
                  </div>
                ))}
              </div>
              {/* Players card */}
              {(() => {
                const { label, value, color } = statCards[3];
                const isEmpty = value === 0;
                return (
                  <div className={`flex items-center gap-5 rounded-xl border px-5 py-3 shadow-lg shadow-slate-950/50 backdrop-blur-sm ${isEmpty ? "border-dashed border-slate-700 bg-slate-950/40" : "border-white/10 bg-slate-900/70"}`}>
                    <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                    <p className={`text-lg font-bold ${color}`}>{value}</p>
                    {isEmpty && (
                      <Link
                        to="/friends"
                        className="rounded-lg bg-violet-500/20 px-2 py-1 text-[0.6rem] font-semibold uppercase tracking-wide text-violet-300 hover:bg-violet-500/30"
                      >
                        Add →
                      </Link>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* New Game — right aligned */}
            <button
              onClick={() => navigate("/games/new")}
              className="rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-lg shadow-sky-500/30 transition hover:bg-sky-400 active:scale-95"
            >
              + New Game
            </button>
          </div>
        )}

        {/* Leaderboard */}
        {!loading && (
          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/60 backdrop-blur-sm">
            <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-white">Leaderboard Ranking</h2>
                <p className="text-sm text-slate-400">Your roster ranked by wins across finished games</p>
              </div>
              {leaderboard.length > 5 && (
                <button
                  type="button"
                  onClick={() => setLeaderboardExpanded((v) => !v)}
                  className="rounded-full border border-slate-700/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-300 transition hover:border-sky-400 hover:text-sky-200"
                >
                  {leaderboardExpanded ? "Show Less ↑" : `Show All ${leaderboard.length} ↓`}
                </button>
              )}
            </header>
            {leaderboard.length === 0 ? (
              <EmptyState
                icon="🏆"
                message="No wins recorded yet. Finish some games to see the leaderboard."
              />
            ) : (
              <ol className="space-y-2">
                {(leaderboardExpanded ? leaderboard : leaderboard.slice(0, 5)).map((entry, index) => {
                  const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : null;
                  const rankColor =
                    index === 0 ? "text-amber-300" : index === 1 ? "text-slate-300" : index === 2 ? "text-amber-600" : "text-slate-500";
                  const winPct = entry.games_played > 0 ? Math.round((entry.wins / entry.games_played) * 100) : 0;
                  return (
                    <li
                      key={entry.friend_id}
                      className={`flex items-center gap-4 rounded-2xl border px-4 py-3 transition ${
                        index === 0
                          ? "border-amber-400/30 bg-amber-400/5"
                          : "border-slate-800 bg-slate-900/80 hover:border-slate-700"
                      }`}
                    >
                      <span className={`w-6 text-center text-sm font-bold ${rankColor}`}>
                        {medal ?? `#${index + 1}`}
                      </span>
                      <PlayerAvatar value={entry.image} fallbackLabel={entry.name} size="sm" />
                      <span className="flex-1 truncate text-sm font-semibold text-white">{entry.name}</span>
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="text-sm font-bold text-emerald-300">{entry.wins} win{entry.wins !== 1 ? "s" : ""}</span>
                        <span className="text-[0.65rem] text-slate-500">{entry.games_played} played · {winPct}%</span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        )}

        <main className="grid gap-8 lg:grid-cols-[1.8fr_1fr]">
          {/* Continue Game */}
          <section className="space-y-8">
            <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/60 backdrop-blur-sm">
              <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-white">Continue Game</h2>
                  <p className="text-sm text-slate-400">Resume pending and active sessions</p>
                </div>
                <Link
                  to="/games/history"
                  className="rounded-full border border-slate-700/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-300 transition hover:border-sky-400 hover:text-sky-200"
                >
                  Game History
                </Link>
              </header>
              <div className="space-y-4">
                {loading && <p className="text-sm text-slate-400">Loading games…</p>}
                {ongoingGames.length === 0 && !loading && (
                  <EmptyState
                    icon="🃏"
                    message="No games in progress."
                    action={
                      <button
                        onClick={() => navigate("/games/new")}
                        className="rounded-xl bg-sky-500 px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-sky-400"
                      >
                        Start a Game →
                      </button>
                    }
                  />
                )}
                {ongoingGames.map((game) => {
                  const isPending = game.status === "pending";
                  const hoverBorder = isPending ? "hover:border-sky-400/60" : "hover:border-emerald-400/60";
                  const resumePath = isPending ? `/games/${game.id}/assign` : `/games/${game.id}/manage`;
                  const publicUrl = `${window.location.origin}/games/${game.id}/public`;

                  const startedAgo = (() => {
                    if (!game.created_at) return null;
                    const diffMs = Date.now() - new Date(game.created_at).getTime();
                    const days = Math.floor(diffMs / 86_400_000);
                    if (days === 0) return "today";
                    if (days === 1) return "1 day ago";
                    return `${days} days ago`;
                  })();

                  return (
                    <div
                      key={game.id}
                      className={`rounded-2xl border border-slate-800 bg-slate-900/80 px-5 py-4 transition ${hoverBorder}`}
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            title="Click to copy game ID"
                            onClick={() => {
                              void navigator.clipboard.writeText(game.id).then(() =>
                                showToast(`Copied game ID: ${game.id}`)
                              );
                            }}
                            className="group flex items-center gap-1.5 text-base font-medium text-white transition hover:text-sky-300"
                          >
                            Game #{game.id}
                            <span className="text-slate-600 transition group-hover:text-sky-400" aria-hidden>
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                                <path fillRule="evenodd" d="M10.986 3H12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h1.014A2.25 2.25 0 0 1 7.25 1h1.5a2.25 2.25 0 0 1 2.236 2ZM9.75 3.25a.75.75 0 0 0-.75-.75h-1.5a.75.75 0 0 0-.75.75v.5c0 .414.336.75.75.75h1.5a.75.75 0 0 0 .75-.75v-.5Z" clipRule="evenodd" />
                              </svg>
                            </span>
                          </button>
                          <GameStatusBadge status={game.status} className="px-3 py-1 text-xs" />
                          {startedAgo && (
                            <span className="text-xs text-slate-500">Started {startedAgo}</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => navigate(resumePath)}
                            className="rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-900 shadow-lg shadow-sky-500/30 transition hover:bg-sky-400"
                          >
                            Resume
                          </button>
                          <Link
                            to={`/games/${game.id}/public`}
                            className="rounded-lg border border-slate-700/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-300 transition hover:border-sky-400/60 hover:text-sky-200"
                          >
                            Public View →
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Players sidebar */}
          <aside className="space-y-8">
            <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/60 backdrop-blur-sm">
              <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white">Players</h2>
                  <p className="text-sm text-slate-400">
                    {friends.length > 0
                      ? `${friends.length} player${friends.length !== 1 ? "s" : ""} saved`
                      : "Track your regular players"}
                  </p>
                </div>
                <Link
                  to="/friends"
                  className="rounded-full border border-slate-700/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-300 transition hover:border-sky-400 hover:text-sky-200"
                >
                  View All
                </Link>
              </header>
              <ul className="space-y-3">
                {loading && <p className="text-sm text-slate-400">Loading players…</p>}
                {friends.slice(0, 6).map((friend) => (
                  <li
                    key={friend.id}
                    className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-3 transition hover:border-slate-600"
                  >
                    <PlayerAvatar value={friend.image} fallbackLabel={friend.name} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{friend.name}</p>
                      {friend.description && (
                        <p className="mt-0.5 truncate text-xs text-slate-400">{friend.description}</p>
                      )}
                    </div>
                  </li>
                ))}
                {friends.length === 0 && !loading && (
                  <li>
                    <EmptyState
                      icon="👥"
                      message="No players added yet."
                      action={
                        <Link
                          to="/friends"
                          className="inline-flex items-center gap-1 rounded-xl bg-sky-500 px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-sky-400"
                        >
                          Add Players →
                        </Link>
                      }
                      className="py-6"
                    />
                  </li>
                )}
              </ul>
              {friends.length > 0 && (
                <Link
                  to="/friends"
                  className="mt-5 flex w-full items-center justify-center rounded-xl border border-slate-700/60 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-sky-400 hover:text-sky-200"
                >
                  Manage Players →
                </Link>
              )}
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
};

export default ProfileHomePage;
