import { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import PlayerAvatar from "../components/PlayerAvatar";
import { api, CreateGamePlayer, Friend } from "../services/api";
import { getRandomAnimalAvatar, normalizeAvatar } from "../utils/avatarOptions";
import { ROLE_KEYS, RoleCounts, DEFAULT_ROLE_COUNTS, ROLE_DESCRIPTIONS, ROLE_ICONS } from "../constants/roles";

const defaultRoleCounts: RoleCounts = DEFAULT_ROLE_COUNTS;

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
    Survivor: 0,
    Executioner: 0,
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
  const canSubmit = totalPlayers > 0 && slotsMatch;

  const handleCustomPlayerKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddCustomPlayer();
    }
  };


  return (
    <div className="relative min-h-screen text-slate-100">
      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10 lg:py-14">

        {/* Page header — slim, matching profile style */}
        <div>
          <button
            className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-400 transition hover:text-white"
            onClick={() => navigate("/profile")}
          >
            <span aria-hidden>←</span> Back to Profile
          </button>
          <p className="text-sm font-semibold uppercase tracking-widest text-sky-400">New Game</p>
          <h1 className="text-3xl font-semibold text-white sm:text-4xl">Spin up a Mafia night</h1>
          <p className="mt-1 max-w-xl text-sm text-slate-400">
            Pick your crew, balance the roles, and let the storytelling begin.
          </p>
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200 shadow-lg shadow-rose-500/20">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">

          {/* ── Two-column layout — equal halves ── */}
          <div className="grid gap-8 lg:grid-cols-2">

            {/* LEFT — Players list */}
            <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/60 backdrop-blur-sm">
              <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-white">Players</h2>
                  <p className="text-sm text-slate-400">Tap to toggle a player in or out</p>
                </div>
                <span className="rounded-full border border-slate-700/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-300">
                  {selectedFriendIds.length} / {friends.length} selected
                </span>
              </header>

              {loading && (
                <p className="text-sm text-slate-400">Loading friends…</p>
              )}

              {!loading && friends.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 px-4 py-8 text-center">
                  <p className="text-sm text-slate-400">No friends saved yet.</p>
                  <p className="mt-1 text-xs text-slate-500">Add custom players on the right, or visit Friends to build your roster.</p>
                </div>
              )}

              {/* Two-column player grid */}
              <ul className="grid gap-2 sm:grid-cols-2">
                {friends.map((friend) => {
                  const active = selectedFriendIds.includes(friend.id);
                  return (
                    <li key={friend.id}>
                      <button
                        type="button"
                        onClick={() => toggleFriend(friend.id)}
                        className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                          active
                            ? "border-sky-400/70 bg-sky-500/15 shadow-lg shadow-sky-500/10"
                            : "border-slate-800 bg-slate-900/70 hover:border-sky-400/40"
                        }`}
                      >
                        <PlayerAvatar value={friend.image} fallbackLabel={friend.name} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-white">{friend.name}</p>
                          {friend.description && (
                            <p className="truncate text-xs text-slate-400">{friend.description}</p>
                          )}
                        </div>
                        {/* Checkmark indicator */}
                        <span
                          className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border text-xs transition ${
                            active
                              ? "border-sky-400 bg-sky-500/30 text-sky-200"
                              : "border-slate-700 text-slate-600"
                          }`}
                          aria-hidden
                        >
                          {active ? "✓" : ""}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* RIGHT — Crew panel */}
            <aside className="space-y-6">

              {/* Selected crew */}
              <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/60 backdrop-blur-sm">
                <header className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-white">Your crew</h2>
                    <p className="text-sm text-slate-400">
                      {totalPlayers > 0
                        ? `${totalPlayers} player${totalPlayers !== 1 ? "s" : ""} in the game`
                        : "No one added yet"}
                    </p>
                  </div>
                  <span className="text-2xl font-bold text-white">{totalPlayers}</span>
                </header>

                {totalPlayers === 0 && (
                  <p className="rounded-xl border border-dashed border-slate-700 bg-slate-950/40 py-5 text-center text-xs text-slate-500">
                    Select friends on the left or add custom names below.
                  </p>
                )}

                <ul className="grid gap-2 sm:grid-cols-2">
                  {/* Friends already selected */}
                  {selectedFriends.map((friend) => (
                    <li
                      key={`friend-${friend.id}`}
                      className="flex items-center gap-3 rounded-2xl border border-sky-400/30 bg-sky-500/10 px-3 py-2"
                    >
                      <PlayerAvatar value={friend.image} fallbackLabel={friend.name} size="sm" />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">{friend.name}</span>
                      <button
                        type="button"
                        onClick={() => toggleFriend(friend.id)}
                        className="flex-shrink-0 rounded-lg border border-slate-700/60 px-2 py-0.5 text-xs text-slate-400 transition hover:border-rose-400/50 hover:text-rose-300"
                        aria-label={`Remove ${friend.name}`}
                      >
                        ✕
                      </button>
                    </li>
                  ))}

                  {/* Custom players */}
                  {customPlayers.map((player) => (
                    <li
                      key={`custom-${player}`}
                      className="flex items-center gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2"
                    >
                      <PlayerAvatar value={customPlayerAvatars[player]} fallbackLabel={player} size="sm" />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">{player}</span>
                      <button
                        type="button"
                        onClick={() => rerollCustomAvatar(player)}
                        className="flex-shrink-0 rounded-lg border border-slate-700/60 px-2 py-0.5 text-xs text-slate-400 transition hover:border-emerald-400/50 hover:text-emerald-300"
                        title="Reroll avatar"
                        aria-label={`Reroll avatar for ${player}`}
                      >
                        🎲
                      </button>
                      <button
                        type="button"
                        onClick={() => removeCustomPlayer(player)}
                        className="flex-shrink-0 rounded-lg border border-slate-700/60 px-2 py-0.5 text-xs text-slate-400 transition hover:border-rose-400/50 hover:text-rose-300"
                        aria-label={`Remove ${player}`}
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>

                {/* Add custom player */}
                <div className="mt-4 border-t border-slate-800 pt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Add a guest</p>
                  <div className="flex gap-2">
                    <input
                      value={customName}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => setCustomName(event.target.value)}
                      onKeyDown={handleCustomPlayerKeyDown}
                      className="flex-1 rounded-xl border border-slate-700/70 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                      placeholder="Enter a name…"
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
              </div>
            </aside>
          </div>

          {/* ── Role distribution — compact row layout ── */}
          <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/60 backdrop-blur-sm">
            <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-white">Role distribution</h2>
                <p className="text-sm text-slate-400">Balance factions — role slots must equal players.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={applySuggestedRoles}
                  disabled={totalPlayers <= 0}
                  className="rounded-full border border-sky-400/50 bg-sky-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky-100 transition hover:border-sky-300/70 hover:text-sky-50 disabled:cursor-not-allowed disabled:border-slate-700/60 disabled:bg-slate-800/70 disabled:text-slate-400"
                >
                  Use suggested
                </button>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                    slotsMatch
                      ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-200"
                      : "border-rose-400/50 bg-rose-500/10 text-rose-200"
                  }`}
                >
                  {totalPlayers}P / {totalRoles} slots
                </span>
              </div>
            </header>

            {/* Compact horizontal rows — one per role */}
            <div className="space-y-3">
              {ROLE_KEYS.map((role) => (
                <div
                  key={role}
                  className="flex items-center gap-4 rounded-2xl border border-slate-800 bg-slate-950/70 px-5 py-3 transition hover:border-slate-700"
                >
                  <span className="text-xl" aria-hidden>{ROLE_ICONS[role.toLowerCase()]}</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white">{role}</p>
                    <p className="text-xs text-slate-400">{ROLE_DESCRIPTIONS[role]}</p>
                  </div>
                  <div className="flex items-center gap-3" role="group" aria-label={`${role} count`}>
                    <button
                      type="button"
                      onClick={() => adjustRoleCount(role, -1)}
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-700/70 bg-slate-900 text-base font-semibold text-slate-300 transition hover:border-sky-400 hover:text-white"
                      aria-label={`Decrease ${role}`}
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-lg font-bold text-white">{roleCounts[role] ?? 0}</span>
                    <button
                      type="button"
                      onClick={() => adjustRoleCount(role, 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-700/70 bg-slate-900 text-base font-semibold text-slate-300 transition hover:border-sky-400 hover:text-white"
                      aria-label={`Increase ${role}`}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-4 text-xs text-slate-400">
              {slotsMatch
                ? "✓ Role slots match your player count — you're ready to go."
                : `Adjust roles until the slot count equals ${totalPlayers} player${totalPlayers !== 1 ? "s" : ""}.`}
            </p>
          </section>

          {/* Submit */}
          <div className="relative" title={!canSubmit ? (totalPlayers === 0 ? "Add at least one player" : `Role slots (${totalRoles}) must equal players (${totalPlayers})`) : undefined}>
            <button
              type="submit"
              className="w-full rounded-2xl bg-emerald-500 px-6 py-4 text-lg font-semibold text-slate-900 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              disabled={!canSubmit}
            >
              Create Game & Assign Roles →
            </button>
            {!canSubmit && totalPlayers > 0 && (
              <p className="mt-2 text-center text-xs text-rose-300">
                {slotsMatch ? "" : `Role slots (${totalRoles}) don't match player count (${totalPlayers}) — adjust above.`}
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewGamePage;
