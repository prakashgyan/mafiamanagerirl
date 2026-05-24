import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { api, Friend, GameSummary } from "../services/api";
import PlayerAvatar from "../components/PlayerAvatar";

const STAT_CARDS = [
  { label: "Total Games", icon: "🎲", color: "text-white" },
  { label: "Active", icon: "⚡", color: "text-emerald-300" },
  { label: "Finished", icon: "🏁", color: "text-sky-300" },
  { label: "Friends", icon: "👥", color: "text-violet-300" },
];

const ProfileHomePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [games, setGames] = useState<GameSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setFriends([]);
      setGames([]);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const [friendData, gameData] = await Promise.all([api.listFriends(), api.listGames()]);
        if (!isMounted) return;
        setFriends(friendData);
        setGames(gameData);
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Unable to load profile data");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [user]);

  const pendingGames = useMemo(() => games.filter((game) => game.status === "pending"), [games]);
  const activeGames = useMemo(() => games.filter((game) => game.status === "active"), [games]);
  const ongoingGames = useMemo(() => [...pendingGames, ...activeGames], [pendingGames, activeGames]);

  const statValues = [
    games.length,
    games.filter((g) => g.status === "active").length,
    games.filter((g) => g.status === "finished").length,
    friends.length,
  ];

  return (
    <div className="relative min-h-screen text-slate-100">
      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10 lg:py-14">

        {/* Slim welcome hero — no card, just typography */}
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
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {STAT_CARDS.map(({ label, icon, color }, i) => (
              <div
                key={label}
                className="rounded-2xl border border-white/10 bg-slate-900/70 px-5 py-4 text-center shadow-xl shadow-slate-950/50 backdrop-blur-sm"
              >
                <p className="text-xl" aria-hidden>{icon}</p>
                <p className={`mt-1 text-2xl font-bold ${color}`}>{statValues[i]}</p>
                <p className="mt-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
              </div>
            ))}
          </div>
        )}

        <main className="grid gap-8 lg:grid-cols-[1.8fr_1fr]">
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
                {ongoingGames.length === 0 && !loading && (
                  <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 py-10 text-center">
                    <span className="text-4xl" aria-hidden>🃏</span>
                    <p className="text-sm text-slate-400">No games in progress.</p>
                    <button
                      onClick={() => navigate("/games/new")}
                      className="rounded-xl bg-sky-500 px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-sky-400"
                    >
                      Start a Game →
                    </button>
                  </div>
                )}
                {loading && <p className="text-sm text-slate-400">Loading games…</p>}
                {ongoingGames.map((game) => {
                  const isPending = game.status === "pending";
                  const statusLabel = isPending ? "Pending" : "Active";
                  const badgeStyles = isPending
                    ? "border-amber-400/40 bg-amber-400/10 text-amber-200"
                    : "border-emerald-400/40 bg-emerald-400/10 text-emerald-200";
                  const hoverBorder = isPending ? "hover:border-sky-400/60" : "hover:border-emerald-400/60";
                  const continuePath = isPending ? `/games/${game.id}/assign` : `/games/${game.id}/manage`;
                  const detailText = isPending
                    ? "Awaiting role assignment"
                    : `${game.current_phase === "day" ? "☀️ Day" : "🌙 Night"} ${game.current_round}`;

                  return (
                    <div
                      key={game.id}
                      className={`rounded-2xl border border-slate-800 bg-slate-900/80 px-5 py-4 transition ${hoverBorder}`}
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-base font-medium text-white">Game #{game.id}</span>
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${badgeStyles}`}
                          >
                            {statusLabel}
                          </span>
                          <span className="text-sm text-slate-400">{detailText}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => navigate(continuePath)}
                            className="rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-900 shadow-lg shadow-sky-500/30 transition hover:bg-sky-400"
                          >
                            Continue →
                          </button>
                          <Link
                            to={`/games/${game.id}/public`}
                            className="rounded-lg border border-slate-700/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-300 transition hover:border-slate-400 hover:text-white"
                          >
                            Public View
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <aside className="space-y-8">
            <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/60 backdrop-blur-sm">
              <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white">Friends</h2>
                  <p className="text-sm text-slate-400">
                    {friends.length > 0 ? `${friends.length} player${friends.length !== 1 ? "s" : ""} saved` : "Track your regular players"}
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
                {loading && <p className="text-sm text-slate-400">Loading friends…</p>}
                {friends.slice(0, 6).map((friend) => (
                  <li key={friend.id} className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-3 transition hover:border-slate-600">
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
                  <li className="space-y-3 py-6 text-center">
                    <p className="text-3xl" aria-hidden>👥</p>
                    <p className="text-sm text-slate-400">No friends added yet.</p>
                    <Link
                      to="/friends"
                      className="inline-flex items-center gap-1 rounded-xl bg-sky-500 px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-sky-400"
                    >
                      Add Your First Player →
                    </Link>
                  </li>
                )}
              </ul>
              {friends.length > 0 && (
                <Link
                  to="/friends"
                  className="mt-5 flex w-full items-center justify-center rounded-xl border border-slate-700/60 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-sky-400 hover:text-sky-200"
                >
                  Manage Friends →
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
