import { DragEvent, useCallback, useEffect, useId, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useGameSocket } from "../hooks/useGameSocket";
import LogsSection from "../components/LogTimeline";
import { api, GameDetail, GamePhase, Player } from "../services/api";
import { getPlayerCardClasses, getRoleLabelClass } from "../utils/playerStyles";

type NightActionType = "kill" | "save" | "investigate";
type DropZoneType = "vote" | NightActionType;

const DashboardPage = () => {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState<GameDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [voteTarget, setVoteTarget] = useState<number | undefined>(undefined);
  const [plannedNightActions, setPlannedNightActions] = useState<Partial<Record<NightActionType, number>>>({});
  const [processingQueuedActions, setProcessingQueuedActions] = useState(false);
  const [note, setNote] = useState("");
  const noteFieldId = useId();

  const loadGame = useCallback(async () => {
    if (!gameId) return;
    try {
      const data = await api.getGame(Number(gameId));
      setGame(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load game");
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    void loadGame();
  }, [loadGame]);

  useGameSocket(game ? game.id : null, {
    enabled: true,
    onMessage: (message) => {
      if (!gameId || message.game_id !== Number(gameId)) return;
      void loadGame();
    },
  });

  useEffect(() => {
    if (!game || game.status !== "finished") {
      return;
    }

    navigate(`/games/${game.id}/over`, { replace: true });
  }, [game, navigate]);

  const alivePlayers = useMemo(() => game?.players.filter((player) => player.is_alive) ?? [], [game]);
  const aliveNonMafiaPlayers = useMemo(
    () => alivePlayers.filter((player) => (player.role?.toLowerCase() ?? "") !== "mafia"),
    [alivePlayers]
  );
  const aliveDetectives = useMemo(
    () => alivePlayers.filter((player) => (player.role?.toLowerCase() ?? "") === "detective"),
    [alivePlayers]
  );
  const investigateTargets = useMemo(() => {
    if (aliveDetectives.length === 1) {
      const detectiveId = aliveDetectives[0].id;
      return alivePlayers.filter((player) => player.id !== detectiveId);
    }
    return alivePlayers;
  }, [alivePlayers, aliveDetectives]);

  const killTargetPlayer = useMemo(
    () => game?.players.find((player) => player.id === plannedNightActions.kill),
    [game, plannedNightActions.kill]
  );
  const saveTargetPlayer = useMemo(
    () => game?.players.find((player) => player.id === plannedNightActions.save),
    [game, plannedNightActions.save]
  );
  const investigateTargetPlayer = useMemo(
    () => game?.players.find((player) => player.id === plannedNightActions.investigate),
    [game, plannedNightActions.investigate]
  );

  const voteEligibleIds = useMemo(() => new Set(alivePlayers.map((player) => player.id)), [alivePlayers]);
  const killEligibleIds = useMemo(() => new Set(aliveNonMafiaPlayers.map((player) => player.id)), [aliveNonMafiaPlayers]);
  const saveEligibleIds = useMemo(() => new Set(alivePlayers.map((player) => player.id)), [alivePlayers]);
  const investigateEligibleIds = useMemo(
    () => new Set(investigateTargets.map((player) => player.id)),
    [investigateTargets]
  );

  const handleDragStart = (event: DragEvent<HTMLDivElement>, playerId: number) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-player-id", String(playerId));
    event.dataTransfer.setData("text/plain", String(playerId));
  };

  const [activeDropZone, setActiveDropZone] = useState<DropZoneType | null>(null);

  const clearNightAction = (action: "kill" | "save" | "investigate") => {
    setPlannedNightActions((prev) => {
      const next = { ...prev };
      delete next[action];
      return next;
    });
  };

  const handleNightActionDrop = (
    event: DragEvent<HTMLDivElement>,
    action: "kill" | "save" | "investigate",
    allowedIds: Set<number>
  ) => {
    event.preventDefault();
    setActiveDropZone(null);
    const raw = event.dataTransfer.getData("application/x-player-id") || event.dataTransfer.getData("text/plain");
    const playerId = Number(raw);
    if (!playerId || !allowedIds.has(playerId)) {
      return;
    }
    setPlannedNightActions((prev) => ({ ...prev, [action]: playerId }));
  };

  const handleVoteDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setActiveDropZone(null);
    const raw = event.dataTransfer.getData("application/x-player-id") || event.dataTransfer.getData("text/plain");
    const playerId = Number(raw);
    if (!playerId || !voteEligibleIds.has(playerId)) {
      return;
    }
    setVoteTarget(playerId);
  };

  const processDayActions = useCallback(async () => {
    if (!game || !voteTarget) return;

    const trimmedNote = note.trim();
    const response = await api.sendAction(game.id, {
      action_type: "vote",
      target_player_id: voteTarget,
      note: trimmedNote ? trimmedNote : undefined,
    });
    setGame(response);
    setVoteTarget(undefined);
    if (trimmedNote) {
      setNote("");
    }
  }, [game, note, voteTarget]);

  const processNightActions = useCallback(async () => {
    if (!game) return;

    let latestGame = game;
    const killTargetId = plannedNightActions.kill;
    const saveTargetId = plannedNightActions.save;
    const investigateTargetId = plannedNightActions.investigate;
    const trimmedNote = note.trim();
    let noteConsumed = false;

    const resolvePlayerName = (playerId?: number) =>
      playerId ? latestGame.players.find((player) => player.id === playerId)?.name ?? "Unknown" : "Unknown";

    const executeAction = async (
      actionType: "kill" | "save" | "investigate",
      targetId: number,
      overrideNote?: string
    ) => {
      const payloadNote = overrideNote ?? (!noteConsumed && trimmedNote ? trimmedNote : undefined);
      if (!overrideNote && payloadNote) {
        noteConsumed = true;
      }
      if (overrideNote) {
        noteConsumed = noteConsumed || false;
      }
      const response = await api.sendAction(latestGame.id, {
        action_type: actionType,
        target_player_id: targetId,
        note: payloadNote,
      });
      latestGame = response;
      setGame(response);
    };

    if (killTargetId) {
      let killNote: string | undefined;
      if (saveTargetId && saveTargetId === killTargetId) {
        const name = resolvePlayerName(killTargetId);
        killNote = `Mafia tried to kill ${name}.`;
      }
      await executeAction("kill", killTargetId, killNote);
    }

    if (saveTargetId) {
      await executeAction("save", saveTargetId);
    }

    if (investigateTargetId) {
      await executeAction("investigate", investigateTargetId);
    }

    if (noteConsumed) {
      setNote("");
    }
    setPlannedNightActions({});
  }, [game, note, plannedNightActions]);

  const switchPhase = async (phase: GamePhase) => {
    if (!game) return;

    if ((phase === "day" && game.current_phase === "night") || (phase === "night" && game.current_phase === "day")) {
      setProcessingQueuedActions(true);
      try {
        setError(null);
        if (phase === "day") {
          await processNightActions();
        } else {
          await processDayActions();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to process queued actions");
        setProcessingQueuedActions(false);
        return;
      }
    }

    try {
      const updated = await api.changePhase(game.id, phase);
      setGame(updated);
      setError(null);
      if (phase === "night") {
        setPlannedNightActions({});
        setVoteTarget(undefined);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to switch phase");
    } finally {
      if ((phase === "day" && game.current_phase === "night") || (phase === "night" && game.current_phase === "day")) {
        setProcessingQueuedActions(false);
      }
    }
  };

  const finishGame = async (winningTeam: string) => {
    if (!game) return;
    try {
      const updated = await api.finishGame(game.id, winningTeam);
      setGame(updated);
      setError(null);
      navigate(`/games/${game.id}/over`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to end game");
    }
  };

  const syncNightEvents = async () => {
    if (!game) return;
    try {
      const updated = await api.syncNightEvents(game.id);
      setGame(updated);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sync night events");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        Loading dashboard...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-rose-300">
        {error}
      </div>
    );
  }

  if (!game) return null;

  const isDay = game.current_phase === "day";

  const renderVoteDropZone = () => {
    const selectedPlayer = game?.players.find((player) => player.id === voteTarget) ?? null;
    const allowedPlayers = alivePlayers;
    const isActive = activeDropZone === "vote";
    const baseClasses =
      "flex flex-col gap-3 rounded-xl border-2 border-dashed px-4 py-4 transition-colors duration-200";
    const stateClasses = isActive
      ? "border-sky-400 bg-slate-800/70"
      : selectedPlayer
        ? "border-emerald-400/70 bg-slate-900/70"
        : "border-slate-700 bg-slate-900/50";
    const placeholder = allowedPlayers.length === 0 ? "No eligible players" : "Drag a player here";

    return (
      <div
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        }}
        onDragEnter={() => setActiveDropZone("vote")}
        onDragLeave={() => setActiveDropZone((current) => (current === "vote" ? null : current))}
        onDrop={handleVoteDrop}
        className={`${baseClasses} ${stateClasses}`}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold uppercase tracking-wide text-slate-200">Vote Out Player</span>
          {selectedPlayer && (
            <button
              type="button"
              onClick={() => setVoteTarget(undefined)}
              className="text-xs font-semibold uppercase tracking-wide text-slate-300 transition hover:text-rose-300"
            >
              Clear
            </button>
          )}
        </div>
        {selectedPlayer ? (
          <div className="rounded-lg border border-slate-600 bg-slate-900/80 px-3 py-2 text-sm text-slate-100">
            {selectedPlayer.name}
          </div>
        ) : (
          <p className="text-sm text-slate-400">{placeholder}</p>
        )}
        <p className="text-xs text-slate-500">
          {allowedPlayers.length === 0
            ? "No players currently meet the requirements."
            : "Drag from the players list on the right."}
        </p>
      </div>
    );
  };

  const renderNightActionDropZone = (
    action: NightActionType,
    label: string,
    allowedPlayers: Player[],
    selectedPlayer?: Player | null
  ) => {
    const allowedIds =
      action === "kill" ? killEligibleIds : action === "save" ? saveEligibleIds : investigateEligibleIds;
    const isActive = activeDropZone === action;
    const baseClasses =
      "flex flex-col gap-3 rounded-xl border-2 border-dashed px-4 py-4 transition-colors duration-200";
    const stateClasses = isActive
      ? "border-sky-400 bg-slate-800/70"
      : selectedPlayer
        ? "border-emerald-400/70 bg-slate-900/70"
        : "border-slate-700 bg-slate-900/50";
    const placeholder = allowedPlayers.length === 0 ? "No eligible players" : "Drag a player here";

    return (
      <div
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        }}
        onDragEnter={() => setActiveDropZone(action)}
        onDragLeave={() => setActiveDropZone((current) => (current === action ? null : current))}
        onDrop={(event) => handleNightActionDrop(event, action, allowedIds)}
        className={`${baseClasses} ${stateClasses}`}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold uppercase tracking-wide text-slate-200">{label}</span>
          {selectedPlayer && (
            <button
              type="button"
              onClick={() => clearNightAction(action)}
              className="text-xs font-semibold uppercase tracking-wide text-slate-300 transition hover:text-rose-300"
            >
              Clear
            </button>
          )}
        </div>
        {selectedPlayer ? (
          <div className="rounded-lg border border-slate-600 bg-slate-900/80 px-3 py-2 text-sm text-slate-100">
            {selectedPlayer.name}
          </div>
        ) : (
          <p className="text-sm text-slate-400">{placeholder}</p>
        )}
        <p className="text-xs text-slate-500">
          {allowedPlayers.length === 0
            ? "No players currently meet the requirements."
            : "Drag from the players list on the right."}
        </p>
        {action === "kill" && plannedNightActions.save && plannedNightActions.save === plannedNightActions.kill && (
          <p className="text-xs font-semibold text-amber-300">
            This target will survive; the log will record that the mafia tried to kill them.
          </p>
        )}
      </div>
    );
  };

  return (
  <div className={`min-h-screen bg-gradient-to-br ${isDay ? "from-slate-700 via-slate-600 to-slate-700" : "from-slate-950 via-night to-slate-950"} text-slate-100`}>
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <button className="mb-2 text-sm text-slate-300" onClick={() => navigate(-1)}>
              ← Back
            </button>
            <h1 className="text-3xl font-semibold">Management Dashboard</h1>
            <p className="text-sm text-slate-300">
              Game #{game.id} • {game.current_phase === "day" ? "Day" : "Night"} {game.current_round}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => switchPhase(isDay ? "night" : "day")}
              disabled={processingQueuedActions}
              className={`rounded-lg px-4 py-2 font-semibold text-slate-900 transition ${
                processingQueuedActions
                  ? "bg-amber-400/60 cursor-not-allowed"
                  : "bg-amber-400 hover:bg-amber-300"
              }`}
            >
              {processingQueuedActions ? "Resolving Actions..." : `End ${isDay ? "Day" : "Night"}`}
            </button>
            <button
              onClick={() => finishGame("Villagers")}
              className="rounded-lg border border-emerald-400 px-4 py-2 text-sm text-emerald-300"
            >
              Villagers Win
            </button>
            <button
              onClick={() => finishGame("Mafia")}
              className="rounded-lg border border-rose-400 px-4 py-2 text-sm text-rose-300"
            >
              Mafia Win
            </button>
            <button
              onClick={syncNightEvents}
              className="rounded-lg bg-indigo-400 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-indigo-300"
            >
              Sync Night Events
            </button>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <section className="space-y-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="text-xl font-semibold">Control Center</h2>
            <p className="text-xs uppercase tracking-wide text-slate-400">
              {isDay
                ? "Drag an eligible player into the vote zone. The elimination happens when you end the day."
                : "Drag eligible players into each role. Actions are queued until you end the night."}
            </p>
            <div className="grid gap-5 md:grid-cols-2">
              {isDay ? (
                renderVoteDropZone()
              ) : (
                <>
                  {renderNightActionDropZone("kill", "Mafia Kill", aliveNonMafiaPlayers, killTargetPlayer)}
                  {renderNightActionDropZone("save", "Doctor Save", alivePlayers, saveTargetPlayer)}
                  {renderNightActionDropZone(
                    "investigate",
                    "Detective Investigate",
                    investigateTargets,
                    investigateTargetPlayer
                  )}
                </>
              )}
            </div>
            <div>
              <label className="text-sm text-slate-300" htmlFor={noteFieldId}>
                Notes / Summary
              </label>
              <textarea
                id={noteFieldId}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none"
                placeholder="Optional note to include in the log entry"
              />
            </div>
          </section>

          <aside className="space-y-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="text-xl font-semibold">Players</h2>
            <div className="grid grid-cols-2 gap-3">
              {game.players.map((player) => (
                <div
                  key={player.id}
                  draggable={player.is_alive}
                  onDragStart={(event) => player.is_alive && handleDragStart(event, player.id)}
                  onDragEnd={() => setActiveDropZone(null)}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    player.is_alive ? "cursor-grab" : "cursor-not-allowed"
                  } ${getPlayerCardClasses(player)}`}
                >
                  <p className="font-semibold">{player.name}</p>
                  <p className={`text-xs uppercase tracking-wide ${getRoleLabelClass(player)}`}>
                    {player.role ?? "Unassigned"}
                  </p>
                </div>
              ))}
            </div>
          </aside>
        </div>

        <LogsSection
          className="mt-6"
          logs={game.logs}
          players={game.players}
          title="Logs"
          subtitle="Auto-updating"
        />
      </div>
    </div>
  );
};

export default DashboardPage;
