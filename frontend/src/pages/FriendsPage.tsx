import { ChangeEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api, Friend } from "../services/api";
import PlayerAvatar from "../components/PlayerAvatar";
import { FRIEND_AVATAR_OPTIONS, getRandomFriendAvatar, normalizeAvatar } from "../utils/avatarOptions";

const ANIMAL_COUNT = 20; // first 20 in FRIEND_AVATAR_OPTIONS are animals
const animalAvatars = FRIEND_AVATAR_OPTIONS.slice(0, ANIMAL_COUNT);
const symbolAvatars = FRIEND_AVATAR_OPTIONS.slice(ANIMAL_COUNT);

const FriendsPage = () => {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendName, setFriendName] = useState("");
  const [friendDescription, setFriendDescription] = useState("");
  const [friendAvatar, setFriendAvatar] = useState<string>(getRandomFriendAvatar());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [rosterSearch, setRosterSearch] = useState("");

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

  const sortedFriends = useMemo(
    () => [...friends].sort((a, b) => a.name.localeCompare(b.name)),
    [friends]
  );

  const visibleFriends = useMemo(() => {
    const q = rosterSearch.trim().toLowerCase();
    if (!q) return sortedFriends;
    return sortedFriends.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        (f.description ?? "").toLowerCase().includes(q)
    );
  }, [sortedFriends, rosterSearch]);

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

  const handleNameKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && friendName.trim() && !saving) {
      void handleAddFriend();
    }
  };

  const handleDeleteFriend = async (friendId: number) => {
    try {
      setError(null);
      setSuccess(null);
      setDeletingId(friendId);
      setConfirmDeleteId(null);
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

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-12 lg:py-16">
        <header className="rounded-3xl border border-white/10 bg-slate-900/70 p-8 shadow-2xl shadow-slate-950/60 backdrop-blur-xl">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold text-white sm:text-4xl">Players & Regulars</h1>
              <p className="max-w-2xl text-base text-slate-300">
                Curate your go-to players, add quick notes, and keep the perfect balance of personalities for every
                Mafia session.
              </p>
            </div>
            <Link
              to="/profile"
              className="inline-flex items-center justify-center rounded-xl border border-slate-700/60 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-sky-400 hover:text-sky-200"
            >
              ← Back to Profile
            </Link>
          </div>
        </header>

        <section className="space-y-8">
          {/* Add Player Form */}
          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/60">
            <header className="mb-5">
              <h2 className="text-xl font-semibold text-white">Add a Player</h2>
              <p className="text-sm text-slate-400">Keep notes so every game starts on the right foot.</p>
            </header>

            <div className="space-y-4">
              <label className="block text-sm">
                <span className="text-slate-300">Name</span>
                <input
                  value={friendName}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setFriendName(event.target.value)}
                  onKeyDown={handleNameKeyDown}
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
                  placeholder="Role preferences, dramatic flair, favourite twists..."
                />
              </label>

              {/* Avatar picker */}
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

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Animals</p>
                  <div className="grid grid-cols-8 gap-2 sm:grid-cols-10">
                    {animalAvatars.map((option) => {
                      const isSelected = option === friendAvatar;
                      return (
                        <button
                          type="button"
                          key={option}
                          onClick={() => setFriendAvatar(option)}
                          className={`rounded-xl border px-1 py-2 text-lg transition ${
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
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Symbols</p>
                  <div className="grid grid-cols-8 gap-2 sm:grid-cols-10">
                    {symbolAvatars.map((option) => {
                      const isSelected = option === friendAvatar;
                      return (
                        <button
                          type="button"
                          key={option}
                          onClick={() => setFriendAvatar(option)}
                          className={`rounded-xl border px-1 py-2 text-lg transition ${
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
                </div>
              </div>

              {/* Error / success banner inside the form card */}
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

              <div className="flex items-center justify-between pt-1">
                <p className="text-xs text-slate-500">
                  Tip: Use notes to remember who loves playing detective or who thrives in night phases.
                </p>
                <button
                  onClick={() => void handleAddFriend()}
                  disabled={saving || !friendName.trim()}
                  className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {saving ? "Saving…" : "Save Player"}
                </button>
              </div>
            </div>
          </div>

          {/* Full Roster */}
          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/60">
            <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-white">Full Roster</h2>
                <p className="text-sm text-slate-400">
                  {friends.length} player{friends.length !== 1 ? "s" : ""}
                </p>
              </div>
              {friends.length > 0 && (
                <input
                  value={rosterSearch}
                  onChange={(e) => setRosterSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-700/80 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40 sm:w-56"
                  placeholder="Search roster…"
                />
              )}
            </header>

            {loading && (
              <p className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 text-center text-sm text-slate-300">
                Loading players…
              </p>
            )}

            {!loading && friends.length === 0 && (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-8 text-center">
                <span className="text-4xl" aria-hidden>🎭</span>
                <p className="text-sm font-semibold text-slate-200">No players yet</p>
                <p className="text-xs text-slate-400">Add your first player using the form above.</p>
              </div>
            )}

            {!loading && friends.length > 0 && visibleFriends.length === 0 && (
              <p className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 text-center text-sm text-slate-400">
                No players match "{rosterSearch}"
              </p>
            )}

            <ul className="space-y-4">
              {visibleFriends.map((friend) => (
                <li
                  key={friend.id}
                  className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/30 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="flex items-start gap-3">
                    <PlayerAvatar value={friend.image} fallbackLabel={friend.name} size="sm" className="flex-shrink-0" />
                    <div>
                      <p className="text-base font-semibold text-white">{friend.name}</p>
                      {friend.description && <p className="mt-1 text-sm text-slate-400">{friend.description}</p>}
                    </div>
                  </div>

                  {/* Two-step delete confirmation */}
                  {confirmDeleteId === friend.id ? (
                    <div className="flex items-center gap-2 self-start">
                      <span className="text-xs text-rose-300">Remove this player?</span>
                      <button
                        onClick={() => void handleDeleteFriend(friend.id)}
                        disabled={deletingId === friend.id}
                        className="rounded-xl bg-rose-500/80 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-500 disabled:opacity-40"
                      >
                        {deletingId === friend.id ? "Removing…" : "Yes, remove"}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="rounded-xl border border-slate-700/60 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(friend.id)}
                      className="self-start rounded-xl border border-rose-500/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-rose-200 transition hover:border-rose-400 hover:text-rose-100"
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
};

export default FriendsPage;
