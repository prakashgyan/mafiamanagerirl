import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import PlayerAvatar from "../components/PlayerAvatar";
import { api, CreateGamePlayer, Friend } from "../services/api";
import { getRandomAnimalAvatar, normalizeAvatar } from "../utils/avatarOptions";

const ROLE_KEYS = ["Mafia", "Detective", "Doctor", "Villager", "Jester"] as const;

type RoleCounts = Record<(typeof ROLE_KEYS)[number], number>;

const defaultRoleCounts: RoleCounts = {
  Mafia: 1,
  Detective: 1,
  Doctor: 1,
  Villager: 2,
  Jester: 0,
};

const getSuggestedRoleCounts = (playerCount: number): RoleCounts => {
  if (playerCount <= 0) {
    return { ...defaultRoleCounts };
  }

  const mafia = Math.max(1, Math.floor((playerCount + 2) / 4));
  const detective = playerCount >= 5 ? 1 : 0;
  const doctor = playerCount >= 6 ? 1 : 0;
  const jester = playerCount >= 9 ? 1 : 0;

  const base: RoleCounts = {
    Mafia: mafia,
    Detective: detective,
    Doctor: doctor,
    Jester: jester,
    Villager: 0,
  };

  let remaining = playerCount - (mafia + detective + doctor + jester);

  if (remaining < 0) {
    const adjustableRoles: Array<keyof RoleCounts> = ["Jester", "Doctor", "Detective", "Mafia"];
    for (const role of adjustableRoles) {
      while (remaining < 0) {
        const minimum = role === "Mafia" ? 1 : 0;
        if (base[role] > minimum) {
          base[role] -= 1;
          remaining += 1;
        } else {
          break;
        }
      }
    }
  }

  base.Villager = Math.max(0, remaining);

  return base;
};

const NewGamePage = () => {
  const navigate = useNavigate();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriendIds, setSelectedFriendIds] = useState<number[]>([]);
  const [customName, setCustomName] = useState("");
  const [customPlayers, setCustomPlayers] = useState<string[]>([]);
  const [customPlayerAvatars, setCustomPlayerAvatars] = useState<Record<string, string>>({});
  const [roleCounts, setRoleCounts] = useState<RoleCounts>(defaultRoleCounts);
  const [hasManualRoleEdits, setHasManualRoleEdits] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const friendList = await api.listFriends();
        if (!isMounted) return;
        setFriends(friendList);
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Failed to load friends");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const totalPlayers = useMemo(
    () => selectedFriendIds.length + customPlayers.length,
    [selectedFriendIds.length, customPlayers.length]
  );

  const totalRoles = useMemo(
    () => ROLE_KEYS.reduce((sum, role) => sum + (roleCounts[role] ?? 0), 0),
    [roleCounts]
  );

  const selectedFriends = useMemo(
    () => friends.filter((friend) => selectedFriendIds.includes(friend.id)),
    [friends, selectedFriendIds]
  );

  const toggleFriend = (friendId: number) => {
    setSelectedFriendIds((prev: number[]) =>
      prev.includes(friendId) ? prev.filter((id: number) => id !== friendId) : [...prev, friendId]
    );
  };

  const removeCustomPlayer = (name: string) => {
    setCustomPlayers((prev: string[]) => prev.filter((entry: string) => entry !== name));
    setCustomPlayerAvatars((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const handleAddCustomPlayer = () => {
    const trimmed = customName.trim();
    if (!trimmed) return;
    if (customPlayers.includes(trimmed) || selectedFriends.some((friend) => friend.name === trimmed)) {
      setError("Player already added");
      return;
    }
    setCustomPlayers((prev: string[]) => [...prev, trimmed]);
    setCustomPlayerAvatars((prev) => ({ ...prev, [trimmed]: getRandomAnimalAvatar() }));
    setCustomName("");
  };

  const rerollCustomAvatar = (name: string) => {
    setCustomPlayerAvatars((prev) => ({ ...prev, [name]: getRandomAnimalAvatar() }));
  };

  useEffect(() => {
    if (totalPlayers <= 0) {
      setRoleCounts(defaultRoleCounts);
      setHasManualRoleEdits(false);
      return;
    }

    if (!hasManualRoleEdits) {
      setRoleCounts((prev) => {
        const suggested = getSuggestedRoleCounts(totalPlayers);
        const matches = ROLE_KEYS.every((role) => prev[role] === suggested[role]);
        return matches ? prev : suggested;
      });
    }
  }, [totalPlayers, hasManualRoleEdits]);

  const adjustRoleCount = (role: (typeof ROLE_KEYS)[number], delta: number) => {
    setRoleCounts((prev) => {
      const nextValue = Math.max(0, (prev[role] ?? 0) + delta);
      if (nextValue === prev[role]) {
        return prev;
      }
      return { ...prev, [role]: nextValue };
    });
    setHasManualRoleEdits(true);
  };

  const applySuggestedRoles = () => {
    const suggested = getSuggestedRoleCounts(totalPlayers);
    setRoleCounts(suggested);
    setHasManualRoleEdits(false);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (totalPlayers === 0) {
      setError("Add at least one player");
      return;
    }

    if (totalRoles !== totalPlayers) {
      setError(`Role slots (${totalRoles}) must match player count (${totalPlayers})`);
      return;
    }

    const playersPayload: CreateGamePlayer[] = [];

    for (const friend of selectedFriends) {
      playersPayload.push({
        name: friend.name,
        friend_id: friend.id,
        avatar: normalizeAvatar(friend.image) ?? getRandomAnimalAvatar(),
      });
    }

    for (const playerName of customPlayers) {
      playersPayload.push({
        name: playerName,
        avatar: normalizeAvatar(customPlayerAvatars[playerName]) ?? getRandomAnimalAvatar(),
      });
    }

    try {
      const game = await api.createGame(playersPayload);
      navigate(`/games/${game.id}/assign`, { state: { roleCounts } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create game");
    }
  };

  const slotsMatch = totalPlayers === totalRoles;

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[12%] top-0 h-64 w-64 rounded-full bg-sky-500/15 blur-3xl" />
        <div className="absolute bottom-10 right-[18%] h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.14),_transparent_55%)]" />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl px-6 py-12">
        <button
          className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-slate-300 transition hover:text-white"
          onClick={() => navigate(-1)}
        >
          <span aria-hidden>←</span>
          Back to dashboard
        </button>

        <header className="mb-10 rounded-3xl border border-white/10 bg-slate-900/70 p-8 shadow-2xl shadow-slate-950/60 backdrop-blur-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-4">
              <Link
                to="/"
                aria-label="Go to homepage"
                className="inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-200 transition hover:border-sky-300/60 hover:text-sky-100"
              >
                MafiaDesk
              </Link>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold text-white sm:text-4xl">Spin up a fresh Mafia night</h1>
                <p className="max-w-2xl text-base text-slate-300">
                  Pick your crew, balance the roles, and let the storytelling begin. We’ll handle the setup so you can
                  keep the suspense dialed in.
                </p>
              </div>
            </div>
            <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-center">
                <p className="text-xs uppercase tracking-wide text-slate-400">Players Selected</p>
                <p className="mt-1 text-2xl font-semibold text-white">{totalPlayers}</p>
              </div>
              <div
                className={`rounded-2xl border px-4 py-3 text-center text-sm font-semibold ${
                  slotsMatch
                    ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-200"
                    : "border-rose-400/50 bg-rose-500/10 text-rose-200"
                }`}
              >
                <p className="text-xs uppercase tracking-wide">Players / Slots</p>
                <p className="mt-1 text-lg">{totalPlayers} players / {totalRoles} slots</p>
              </div>
            </div>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="space-y-10">
          {error && (
            <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200 shadow-lg shadow-rose-500/20">
              {error}
            </div>
          )}

          <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/60">
            <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">Build your player list</h2>
                <p className="text-sm text-slate-400">Mix regulars and custom guests. Everyone you add appears below.</p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-700/60 bg-slate-800/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-300">
                {totalPlayers} players selected
              </span>
            </header>

            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.9fr]">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Friends list</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {friends.map((friend) => {
                    const active = selectedFriendIds.includes(friend.id);
                    return (
                      <button
                        type="button"
                        key={friend.id}
                        onClick={() => toggleFriend(friend.id)}
                        className={`flex w-full flex-col items-start gap-2 rounded-2xl border px-4 py-3 text-left transition ${
                          active
                            ? "border-sky-400/70 bg-sky-500/15 text-white shadow-lg shadow-sky-500/20"
                            : "border-slate-800 bg-slate-900/70 hover:border-sky-400/60"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <PlayerAvatar value={friend.image} fallbackLabel={friend.name} size="sm" />
                          <span className="text-sm font-semibold">{friend.name}</span>
                        </div>
                        {friend.description && <span className="text-xs text-slate-300">{friend.description}</span>}
                        <span
                          className={`mt-1 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ${
                            active ? "bg-sky-500/30 text-sky-200" : "bg-slate-800/80 text-slate-400"
                          }`}
                        >
                          {active ? "Selected" : "Tap to add"}
                        </span>
                      </button>
                    );
                  })}
                  {!loading && friends.length === 0 && (
                    <p className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/70 px-4 py-5 text-sm text-slate-400">
                      No friends saved yet. Add custom players below or visit the Friends page to build your roster.
                    </p>
                  )}
                  {loading && (
                    <p className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-5 text-sm text-slate-400">
                      Loading friends…
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Add custom players</h3>
                  <div className="mt-3 flex gap-2">
                    <input
                      value={customName}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => setCustomName(event.target.value)}
                      className="flex-1 rounded-xl border border-slate-700/70 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                      placeholder="Enter a name"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomPlayer}
                      className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-sky-400"
                    >
                      Add
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                  <h4 className="text-xs uppercase tracking-wide text-slate-400">Currently selected</h4>
                  {totalPlayers === 0 && <p className="mt-3 text-sm text-slate-500">No players yet. Add at least one to continue.</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedFriends.map((friend) => (
                      <span
                        key={`friend-${friend.id}`}
                        className="group inline-flex items-center gap-2 rounded-full border border-sky-400/40 bg-sky-500/15 px-3 py-1 text-xs font-medium text-sky-100"
                      >
                        <PlayerAvatar value={friend.image} fallbackLabel={friend.name} size="xs" />
                        <span>{friend.name}</span>
                        <button
                          type="button"
                          onClick={() => toggleFriend(friend.id)}
                          className="rounded-full bg-slate-900/60 px-1 text-[0.65rem] uppercase tracking-wide text-sky-200 opacity-0 transition group-hover:opacity-100"
                        >
                          Remove
                        </button>
                      </span>
                    ))}
                    {customPlayers.map((player) => (
                      <span
                        key={`custom-${player}`}
                        className="group inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-100"
                      >
                        <PlayerAvatar value={customPlayerAvatars[player]} fallbackLabel={player} size="xs" />
                        <span>{player}</span>
                        <button
                          type="button"
                          onClick={() => rerollCustomAvatar(player)}
                          className="rounded-full bg-slate-900/60 px-1 text-[0.65rem] uppercase tracking-wide text-emerald-200 opacity-0 transition group-hover:opacity-100"
                        >
                          Reroll
                        </button>
                        <button
                          type="button"
                          onClick={() => removeCustomPlayer(player)}
                          className="rounded-full bg-slate-900/60 px-1 text-[0.65rem] uppercase tracking-wide text-emerald-200 opacity-0 transition group-hover:opacity-100"
                        >
                          Remove
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/60">
            <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">Role distribution</h2>
                <p className="text-sm text-slate-400">Balance your factions and keep the mystery tight.</p>
              </div>
              <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={applySuggestedRoles}
                  disabled={totalPlayers <= 0}
                  className="inline-flex items-center justify-center rounded-full border border-sky-400/50 bg-sky-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky-100 transition hover:border-sky-300/70 hover:text-sky-50 disabled:cursor-not-allowed disabled:border-slate-700/60 disabled:bg-slate-800/70 disabled:text-slate-400"
                >
                  Use suggested
                </button>
                <span
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                    slotsMatch
                      ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-200"
                      : "border-rose-400/50 bg-rose-500/10 text-rose-200"
                  }`}
                >
                  {totalPlayers} players / {totalRoles} slots
                </span>
              </div>
            </header>

            <div className="grid gap-4 sm:grid-cols-3">
              {ROLE_KEYS.map((role) => (
                <label
                  key={role}
                  className="space-y-2 rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-sm shadow-black/20 transition hover:border-sky-400/60"
                >
                  <span className="block text-sm font-semibold text-white">{role}</span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => adjustRoleCount(role, -1)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700/70 bg-slate-900 text-lg font-semibold text-slate-300 transition hover:border-sky-400 hover:text-white"
                      aria-label={`Decrease ${role}`}
                    >
                      -
                    </button>
                    <span className="min-w-[2.5rem] text-center text-lg font-semibold text-white">{roleCounts[role] ?? 0}</span>
                    <button
                      type="button"
                      onClick={() => adjustRoleCount(role, 1)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700/70 bg-slate-900 text-lg font-semibold text-slate-300 transition hover:border-sky-400 hover:text-white"
                      aria-label={`Increase ${role}`}
                    >
                      +
                    </button>
                  </div>
                </label>
              ))}
            </div>
            <p className="mt-4 text-xs text-slate-400">
              {slotsMatch
                ? "Perfect! Your player count matches the available roles."
                : "You’ll need the same number of role slots as players before starting the game."}
            </p>
          </section>

          <button
            type="submit"
            className="w-full rounded-2xl bg-emerald-500 px-6 py-3 text-lg font-semibold text-slate-900 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            disabled={totalPlayers === 0}
          >
            Create Game & Assign Roles
          </button>
        </form>
      </div>
    </div>
  );
};

export default NewGamePage;
