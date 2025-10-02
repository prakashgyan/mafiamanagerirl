import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { api, Friend, GameSummary } from "../services/api";

const ProfileHomePage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [games, setGames] = useState<GameSummary[]>([]);
  const [friendFormOpen, setFriendFormOpen] = useState(false);
  const [friendName, setFriendName] = useState("");
  const [friendDescription, setFriendDescription] = useState("");
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
  const finishedGames = useMemo(() => games.filter((game) => game.status === "finished"), [games]);

  const handleAddFriend = async () => {
    const trimmedName = friendName.trim();
    if (!trimmedName) {
      setError("Friend name cannot be empty.");
      return;
    }

    try {
      setError(null);
      const newFriend = await api.createFriend({ name: trimmedName, description: friendDescription.trim() || undefined });
      setFriends((prev) => [newFriend, ...prev]);
      setFriendName("");
      setFriendDescription("");
      setFriendFormOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save friend");
    }
  };
  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[10%] top-0 h-72 w-72 rounded-full bg-sky-500/15 blur-3xl" />
        <div className="absolute bottom-0 right-[15%] h-80 w-80 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.14),_transparent_55%)]" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10 lg:py-16">
        <header className="rounded-3xl border border-white/10 bg-slate-900/70 p-8 shadow-2xl shadow-slate-950/60 backdrop-blur-xl">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-5">
              <Link
                to="/"
                aria-label="Go to homepage"
                className="inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-200 transition hover:border-sky-300/60 hover:text-sky-100"
              >
                MafiaDesk
              </Link>
              <div className="space-y-3">
                <h1 className="text-3xl font-semibold text-white sm:text-4xl">Welcome back, {user?.username}</h1>
                <p className="max-w-2xl text-base text-slate-300">
                  Keep the intrigue flowing. Manage players, pick up where you left off, and review every twist in
                  your Mafia nights.
                </p>
              </div>
            </div>
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <button
                onClick={() => navigate("/games/new")}
                className="rounded-xl bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-sky-500/30 transition hover:bg-sky-400"
              >
                Create New Game
              </button>
              <button
                onClick={() => logout()}
                className="rounded-xl border border-slate-700/60 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:border-slate-500"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        {error && (
          <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200 shadow-lg shadow-rose-500/20">
            {error}
          </div>
        )}

        <main className="grid gap-8 lg:grid-cols-[1.8fr_1fr]">
          <section className="space-y-8">
            <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/60">
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
                {[...pendingGames, ...activeGames].length === 0 && !loading && (
                  <p className="text-sm text-slate-400">No games in progress. Start a new one!</p>
                )}
                {loading && <p className="text-sm text-slate-400">Loading games…</p>}
                {pendingGames.map((game) => (
                  <div
                    key={game.id}
                    className="rounded-2xl border border-slate-800 bg-slate-900/80 transition hover:border-sky-400"
                  >
                    <button
                      type="button"
                      className="w-full rounded-2xl px-5 py-4 text-left"
                      onClick={() => navigate(`/games/${game.id}/assign`)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-base font-medium text-white">Game #{game.id}</span>
                        <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-200">
                          Pending
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-400">Awaiting role assignment</p>
                    </button>
                    <div className="flex justify-end border-t border-slate-800/70 px-5 py-3">
                      <button
                        type="button"
                        onClick={() => navigate(`/games/${game.id}/public`)}
                        className="rounded-lg border border-slate-700/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-300 transition hover:border-sky-400 hover:text-slate-100"
                      >
                        Public View
                      </button>
                    </div>
                  </div>
                ))}
                {activeGames.map((game) => (
                  <div
                    key={game.id}
                    className="rounded-2xl border border-slate-800 bg-slate-900/80 transition hover:border-emerald-400"
                  >
                    <button
                      type="button"
                      className="w-full rounded-2xl px-5 py-4 text-left"
                      onClick={() => navigate(`/games/${game.id}/manage`)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-base font-medium text-white">Game #{game.id}</span>
                        <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-200">
                          Active
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-400">
                        {game.current_phase === "day" ? "Day" : "Night"} {game.current_round}
                      </p>
                    </button>
                    <div className="flex justify-end border-t border-slate-800/70 px-5 py-3">
                      <button
                        type="button"
                        onClick={() => navigate(`/games/${game.id}/public`)}
                        className="rounded-lg border border-slate-700/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-300 transition hover:border-emerald-400 hover:text-slate-100"
                      >
                        Public View
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/60">
              <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-white">Game History</h2>
                  <p className="text-sm text-slate-400">Recent conclusions</p>
                </div>
                <Link
                  to="/games/history"
                  className="rounded-full border border-slate-700/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-300 transition hover:border-sky-400 hover:text-sky-200"
                >
                  View All
                </Link>
              </header>
              <div className="space-y-4">
                {loading && <p className="text-sm text-slate-400">Loading games…</p>}
                {finishedGames.length === 0 && !loading && (
                  <p className="text-sm text-slate-400">No completed games yet.</p>
                )}
                {finishedGames.slice(0, 10).map((game) => (
                  <div
                    key={game.id}
                    className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-base font-medium text-white">Game #{game.id}</p>
                      <p className="text-sm text-slate-400">
                        Winner: {game.winning_team ? game.winning_team : "Undeclared"}
                      </p>
                    </div>
                    <button
                      className="self-start rounded-xl border border-slate-700/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-300 transition hover:border-slate-400 hover:text-white"
                      onClick={() => navigate(`/games/${game.id}/over`)}
                    >
                      View Summary
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <aside className="space-y-8">
            <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/60">
              <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white">Friends</h2>
                  <p className="text-sm text-slate-400">Track your regular players</p>
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
                  <li key={friend.id} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                    <p className="text-sm font-semibold text-white">{friend.name}</p>
                    {friend.description && <p className="mt-1 text-xs text-slate-400">{friend.description}</p>}
                  </li>
                ))}
                {friends.length === 0 && !loading && <p className="text-sm text-slate-400">No friends added yet.</p>}
              </ul>
              <button
                onClick={() => setFriendFormOpen((prev) => !prev)}
                className="mt-5 flex w-full items-center justify-center rounded-xl border border-slate-700/60 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-sky-400 hover:text-sky-200"
              >
                {friendFormOpen ? "Close Friend Form" : "Quick Add Friend"}
              </button>
              {friendFormOpen && (
                <div className="mt-5 space-y-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-5">
                  <label className="block text-sm">
                    <span className="text-slate-300">Name</span>
                    <input
                      value={friendName}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => setFriendName(event.target.value)}
                      className="mt-2 w-full rounded-xl border border-slate-700/80 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                      placeholder="Player name"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-slate-300">Notes</span>
                    <textarea
                      value={friendDescription}
                      onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setFriendDescription(event.target.value)}
                      className="mt-2 w-full rounded-xl border border-slate-700/80 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                      rows={3}
                      placeholder="Role preferences, energy level, favourite twists..."
                    />
                  </label>
                  <button
                    onClick={handleAddFriend}
                    className="w-full rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400"
                  >
                    Save Friend
                  </button>
                </div>
              )}
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
};

export default ProfileHomePage;
