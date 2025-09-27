import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [friendList, gameList] = await Promise.all([api.listFriends(), api.listGames()]);
        setFriends(friendList);
        setGames(gameList);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard");
      }
    };

    void load();
  }, []);

  const pendingGames = useMemo(
    () => games.filter((game: GameSummary) => game.status === "pending"),
    [games]
  );
  const activeGames = useMemo(
    () => games.filter((game: GameSummary) => game.status === "active"),
    [games]
  );
  const finishedGames = useMemo(
    () => games.filter((game: GameSummary) => game.status === "finished"),
    [games]
  );

  const handleAddFriend = async () => {
    if (!friendName.trim()) return;
    try {
      const created = await api.createFriend({ name: friendName.trim(), description: friendDescription.trim() });
      setFriends((prev: Friend[]) => [...prev, created]);
      setFriendName("");
      setFriendDescription("");
      setFriendFormOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add friend");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/70 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-sm text-slate-400">Logged in as</p>
            <h1 className="text-2xl font-semibold">{user?.username}</h1>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => navigate("/games/new")}
              className="rounded-lg bg-sky-500 px-4 py-2 font-semibold text-slate-900 transition hover:bg-sky-400"
            >
              Create New Game
            </button>
            <button
              onClick={() => logout()}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-slate-500"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 px-6 py-8 md:grid-cols-[2fr_1fr]">
        <section className="space-y-6">
          {error && <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-rose-200">{error}</div>}

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <header className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-100">Continue Game</h2>
              <span className="text-sm text-slate-400">Pending & Active</span>
            </header>
            <div className="space-y-3">
              {[...pendingGames, ...activeGames].length === 0 && (
                <p className="text-sm text-slate-400">No games in progress. Start a new one!</p>
              )}
              {pendingGames.map((game) => (
                <div
                  key={game.id}
                  className="rounded-lg border border-slate-700 bg-slate-900/70 transition hover:border-sky-400"
                >
                  <button
                    type="button"
                    className="w-full px-4 py-3 text-left"
                    onClick={() => navigate(`/games/${game.id}/assign`)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-100">Game #{game.id}</span>
                      <span className="text-xs uppercase tracking-wide text-amber-400">Pending</span>
                    </div>
                    <p className="text-sm text-slate-400">Awaiting role assignment</p>
                  </button>
                  <div className="flex justify-end border-t border-slate-800 bg-slate-900/80 px-4 py-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/games/${game.id}/public`)}
                      className="rounded-md border border-slate-700 px-3 py-1 text-xs uppercase tracking-wide text-slate-300 transition hover:border-sky-400 hover:text-slate-100"
                    >
                      Public View
                    </button>
                  </div>
                </div>
              ))}
              {activeGames.map((game) => (
                <div
                  key={game.id}
                  className="rounded-lg border border-slate-700 bg-slate-900/70 transition hover:border-emerald-400"
                >
                  <button
                    type="button"
                    className="w-full px-4 py-3 text-left"
                    onClick={() => navigate(`/games/${game.id}/manage`)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-100">Game #{game.id}</span>
                      <span className="text-xs uppercase tracking-wide text-emerald-400">Active</span>
                    </div>
                    <p className="text-sm text-slate-400">
                      {game.current_phase === "day" ? "Day" : "Night"} {game.current_round}
                    </p>
                  </button>
                  <div className="flex justify-end border-t border-slate-800 bg-slate-900/80 px-4 py-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/games/${game.id}/public`)}
                      className="rounded-md border border-slate-700 px-3 py-1 text-xs uppercase tracking-wide text-slate-300 transition hover:border-emerald-400 hover:text-slate-100"
                    >
                      Public View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <header className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-100">Game History</h2>
              <span className="text-sm text-slate-400">Finished games</span>
            </header>
            <div className="space-y-3">
              {finishedGames.length === 0 && <p className="text-sm text-slate-400">No completed games yet.</p>}
              {finishedGames.map((game) => (
                <div
                  key={game.id}
                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/70 px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-slate-100">Game #{game.id}</p>
                    <p className="text-sm text-slate-400">
                      Winner: {game.winning_team ? game.winning_team : "Undeclared"}
                    </p>
                  </div>
                  <button
                    className="rounded-lg border border-slate-700 px-3 py-1 text-xs uppercase tracking-wide text-slate-300 hover:border-slate-500"
                    onClick={() => navigate(`/games/${game.id}/over`)}
                  >
                    View
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <header className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-100">Friends</h2>
              <button
                onClick={() => setFriendFormOpen((prev) => !prev)}
                className="rounded-full border border-slate-700 px-3 py-1 text-xs uppercase tracking-wide text-slate-300 hover:border-slate-500"
              >
                {friendFormOpen ? "Close" : "Add"}
              </button>
            </header>
            <ul className="space-y-3">
              {friends.map((friend) => (
                <li key={friend.id} className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
                  <p className="font-medium text-slate-100">{friend.name}</p>
                  {friend.description && <p className="text-sm text-slate-400">{friend.description}</p>}
                </li>
              ))}
              {friends.length === 0 && <p className="text-sm text-slate-400">No friends added yet.</p>}
            </ul>
            {friendFormOpen && (
              <div className="mt-4 space-y-3 rounded-lg border border-slate-800 bg-slate-900/80 p-4">
                <label className="block text-sm">
                  <span className="text-slate-300">Name</span>
                  <input
                    value={friendName}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => setFriendName(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none"
                    placeholder="Player name"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-slate-300">Notes</span>
                  <textarea
                    value={friendDescription}
                    onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setFriendDescription(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none"
                    rows={2}
                    placeholder="Role preferences, behaviour..."
                  />
                </label>
                <button
                  onClick={handleAddFriend}
                  className="w-full rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-slate-900 transition hover:bg-emerald-400"
                >
                  Save Friend
                </button>
              </div>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
};

export default ProfileHomePage;
