import { ChangeEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api, Friend } from "../services/api";
import PlayerAvatar from "../components/PlayerAvatar";
import { FRIEND_AVATAR_OPTIONS, getRandomFriendAvatar, normalizeAvatar } from "../utils/avatarOptions";
import BackdropLogo from "../components/BackdropLogo";

const FriendsPage = () => {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendName, setFriendName] = useState("");
  const [friendDescription, setFriendDescription] = useState("");
  const [friendAvatar, setFriendAvatar] = useState<string>(getRandomFriendAvatar());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const friendList = await api.listFriends();
        setFriends(friendList);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load friends");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const resetForm = () => {
    setFriendName("");
    setFriendDescription("");
    setFriendAvatar(getRandomFriendAvatar());
  };

  const handleAddFriend = async () => {
    if (!friendName.trim()) return;
    try {
      setError(null);
      setSuccess(null);
      setSaving(true);
      const created = await api.createFriend({
        name: friendName.trim(),
        description: friendDescription.trim(),
        image: normalizeAvatar(friendAvatar),
      });
      setFriends((prev) => [created, ...prev]);
      setSuccess(`${created.name} added to your roster`);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add friend");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFriend = async (friendId: number) => {
    try {
      setError(null);
      setSuccess(null);
      setDeletingId(friendId);
      await api.deleteFriend(friendId);
      setFriends((prev) => prev.filter((friend) => friend.id !== friendId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete friend");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[12%] top-0 h-80 w-80 rounded-full bg-sky-500/15 blur-3xl" />
        <div className="absolute bottom-0 right-[18%] h-96 w-96 rounded-full bg-emerald-400/12 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.16),_transparent_58%)]" />
      </div>
      <BackdropLogo className="right-[-10%] top-[-5rem] w-[700px] opacity-20" />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-12 lg:py-16">
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
                <h1 className="text-3xl font-semibold text-white sm:text-4xl">Friends & Regulars</h1>
                <p className="max-w-2xl text-base text-slate-300">
                  Curate your go-to players, add quick notes, and keep the perfect balance of personalities for every
                  Mafia session.
                </p>
              </div>
            </div>
            <Link
              to="/profile"
              className="inline-flex items-center justify-center rounded-xl border border-slate-700/60 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-sky-400 hover:text-sky-200"
            >
              Back to Profile
            </Link>
          </div>
        </header>

        <section className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-8">
            <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/60">
              <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-white">Add a friend</h2>
                  <p className="text-sm text-slate-400">Keep notes so every game starts on the right foot.</p>
                </div>
                <button
                  onClick={handleAddFriend}
                  disabled={saving || !friendName.trim()}
                  className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {saving ? "Saving..." : "Save Friend"}
                </button>
              </header>
              <div className="space-y-4">
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
                    rows={4}
                    placeholder="Role preferences, dramatic flair, favourite twists..."
                  />
                </label>
                <div className="space-y-3 text-sm">
                  <span className="block text-slate-300">Avatar</span>
                  <div className="flex flex-wrap items-center gap-3">
                    <PlayerAvatar value={friendAvatar} fallbackLabel={friendName} size="md" />
                    <button
                      type="button"
                      onClick={() => setFriendAvatar(getRandomFriendAvatar())}
                      className="rounded-full border border-slate-700/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-300 transition hover:border-sky-400 hover:text-sky-200"
                    >
                      Randomize
                    </button>
                  </div>
                  <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
                    {FRIEND_AVATAR_OPTIONS.map((option) => {
                      const isSelected = option === friendAvatar;
                      return (
                        <button
                          type="button"
                          key={option}
                          onClick={() => setFriendAvatar(option)}
                          className={`rounded-xl border px-2 py-2 text-lg transition ${
                            isSelected
                              ? "border-sky-400/70 bg-sky-500/15 text-sky-100"
                              : "border-slate-800 bg-slate-900/80 text-slate-200 hover:border-sky-400/60"
                          }`}
                        >
                          <span aria-hidden>{option}</span>
                          <span className="sr-only">Select avatar {option}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-slate-500">
                    Pick a signature look or let us roll one for you. Avatars appear across games and logs.
                  </p>
                </div>
                <p className="text-xs text-slate-500">
                  Tip: Use the notes to remember who loves playing detective or who thrives in night phases.
                </p>
              </div>
            </div>

            {(error || success) && (
              <div
                className={`rounded-2xl border px-4 py-3 text-sm ${
                  error
                    ? "border-rose-500/40 bg-rose-500/10 text-rose-200"
                    : "border-emerald-400/40 bg-emerald-400/10 text-emerald-100"
                }`}
              >
                {error ?? success}
              </div>
            )}

            <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/60">
              <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-white">Full roster</h2>
                  <p className="text-sm text-slate-400">{friends.length} friends</p>
                </div>
              </header>

              {loading && (
                <p className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 text-center text-sm text-slate-300">
                  Loading friends...
                </p>
              )}

              {!loading && friends.length === 0 && (
                <p className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 text-center text-sm text-slate-300">
                  No friends yet. Add your first ally above.
                </p>
              )}

              <ul className="space-y-4">
                {friends.map((friend) => (
                  <li
                    key={friend.id}
                    className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/30 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="flex items-start gap-3">
                      <PlayerAvatar value={friend.image} fallbackLabel={friend.name} size="sm" className="flex-shrink-0" />
                      <div>
                        <p className="text-base font-semibold text-white">{friend.name}</p>
                        {friend.description && <p className="mt-2 text-sm text-slate-400">{friend.description}</p>}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteFriend(friend.id)}
                      disabled={deletingId === friend.id}
                      className="self-start rounded-xl border border-rose-500/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-rose-200 transition hover:border-rose-400 hover:text-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {deletingId === friend.id ? "Removing..." : "Remove"}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <aside className="space-y-8">
            <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/60">
              <h2 className="text-lg font-semibold text-white">Quick tips</h2>
              <ul className="mt-4 space-y-3 text-sm text-slate-300">
                <li className="rounded-2xl border border-slate-800/70 bg-slate-900/80 p-4">
                  Pair players with opposite playstyles to keep every accusation unpredictable.
                </li>
                <li className="rounded-2xl border border-slate-800/70 bg-slate-900/80 p-4">
                  Flag dependable narrators or chaos agents in your notes to balance each round.
                </li>
                <li className="rounded-2xl border border-slate-800/70 bg-slate-900/80 p-4">
                  Rotate roles among regulars to keep everyone guessing.
                </li>
              </ul>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/60">
              <h2 className="text-lg font-semibold text-white">Next steps</h2>
              <p className="mt-3 text-sm text-slate-300">
                Ready for the next round? Head back to your profile to start a new game or pick up ongoing sessions.
              </p>
              <Link
                to="/profile"
                className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-sky-500/30 transition hover:bg-sky-400"
              >
                Go to Profile
              </Link>
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
};

export default FriendsPage;
