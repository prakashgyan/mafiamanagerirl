import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api, Friend } from "../services/api";

const ROLE_KEYS = ["Mafia", "Detective", "Doctor", "Villager", "Jester"] as const;

type RoleCounts = Record<(typeof ROLE_KEYS)[number], number>;

const defaultRoleCounts: RoleCounts = {
  Mafia: 1,
  Detective: 1,
  Doctor: 1,
  Villager: 2,
  Jester: 0,
};

const NewGamePage = () => {
  const navigate = useNavigate();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriendIds, setSelectedFriendIds] = useState<number[]>([]);
  const [customName, setCustomName] = useState("");
  const [customPlayers, setCustomPlayers] = useState<string[]>([]);
  const [roleCounts, setRoleCounts] = useState<RoleCounts>(defaultRoleCounts);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const friendList = await api.listFriends();
        setFriends(friendList);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load friends");
      }
    })();
  }, []);

  const totalPlayers = useMemo(
    () => selectedFriendIds.length + customPlayers.length,
    [selectedFriendIds.length, customPlayers.length]
  );

  const totalRoles = useMemo(
    () => ROLE_KEYS.reduce((sum, role) => sum + (roleCounts[role] ?? 0), 0),
    [roleCounts]
  );

  const toggleFriend = (friendId: number) => {
    setSelectedFriendIds((prev: number[]) =>
      prev.includes(friendId) ? prev.filter((id: number) => id !== friendId) : [...prev, friendId]
    );
  };

  const removeCustomPlayer = (name: string) => {
    setCustomPlayers((prev: string[]) => prev.filter((entry: string) => entry !== name));
  };

  const handleAddCustomPlayer = () => {
    const trimmed = customName.trim();
    if (!trimmed) return;
    if (customPlayers.includes(trimmed)) {
      setError("Player already added");
      return;
    }
  setCustomPlayers((prev: string[]) => [...prev, trimmed]);
    setCustomName("");
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

    const friendNames = friends
      .filter((friend: Friend) => selectedFriendIds.includes(friend.id))
      .map((friend: Friend) => friend.name);

    const playerNames = [...friendNames, ...customPlayers];

    try {
      const game = await api.createGame(playerNames);
      navigate(`/games/${game.id}/assign`, { state: { roleCounts } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create game");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <button className="mb-6 text-sm text-sky-400" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <h1 className="mb-6 text-3xl font-semibold">New Game Setup</h1>

        <form onSubmit={handleSubmit} className="space-y-8">
          {error && <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-rose-200">{error}</div>}

          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <header className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Select Players</h2>
              <span className="text-sm text-slate-400">{totalPlayers} players</span>
            </header>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="mb-3 text-sm uppercase tracking-wide text-slate-400">Friends</h3>
                <div className="space-y-3">
                  {friends.map((friend) => (
                    <label
                      key={friend.id}
                      className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 hover:border-sky-400"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-600 bg-slate-800"
                        checked={selectedFriendIds.includes(friend.id)}
                        onChange={() => toggleFriend(friend.id)}
                      />
                      <div>
                        <p className="font-medium text-slate-100">{friend.name}</p>
                        {friend.description && <p className="text-xs text-slate-400">{friend.description}</p>}
                      </div>
                    </label>
                  ))}
                  {friends.length === 0 && <p className="text-sm text-slate-400">No friends saved yet.</p>}
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-sm uppercase tracking-wide text-slate-400">Custom Players</h3>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      value={customName}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => setCustomName(event.target.value)}
                      className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none"
                      placeholder="Enter a name"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomPlayer}
                      className="rounded-lg bg-sky-500 px-4 py-2 font-semibold text-slate-900 hover:bg-sky-400"
                    >
                      Add
                    </button>
                  </div>
                  <ul className="space-y-2">
                    {customPlayers.map((player) => (
                      <li
                        key={player}
                        className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2"
                      >
                        <span>{player}</span>
                        <button
                          type="button"
                          className="text-xs text-rose-300 hover:text-rose-200"
                          onClick={() => removeCustomPlayer(player)}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <header className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Role Distribution</h2>
              <span className="text-sm text-slate-400">{totalRoles} slots</span>
            </header>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {ROLE_KEYS.map((role) => (
                <label key={role} className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/70 p-4">
                  <span className="block text-sm font-semibold text-slate-100">{role}</span>
                  <input
                    type="number"
                    min={0}
                    value={roleCounts[role] ?? 0}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setRoleCounts((prev) => ({ ...prev, [role]: Number(event.target.value) }))
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none"
                  />
                </label>
              ))}
            </div>
            <p className="mt-3 text-sm text-slate-400">
              Ensure the number of role slots matches your player count to continue.
            </p>
          </section>

          <button
            type="submit"
            className="w-full rounded-lg bg-emerald-500 px-6 py-3 text-lg font-semibold text-slate-900 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
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
