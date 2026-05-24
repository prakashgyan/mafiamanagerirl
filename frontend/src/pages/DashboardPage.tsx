import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useGameSocket } from "../hooks/useGameSocket";
import LogsSection from "../components/LogTimeline";
import { api, GameActionPayload, GameDetail, GamePhase, Player } from "../services/api";
import ResponsiveDndProvider from "../components/ResponsiveDndProvider";
import BackdropLogo from "../components/BackdropLogo";
import Spinner from "../components/Spinner";
import DayPhasePanel from "../components/dashboard/DayPhasePanel";
import NightPhasePanel from "../components/dashboard/NightPhasePanel";
import PlayerRoster from "../components/dashboard/PlayerRoster";
import GameControls from "../components/dashboard/GameControls";
import { useAuth } from "../context/AuthContext";

type NightActionType = "kill" | "save" | "investigate";

const DashboardPageContent = () => {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [game, setGame] = useState<GameDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [voteTarget, setVoteTarget] = useState<number | undefined>(undefined);
  const [plannedNightActions, setPlannedNightActions] = useState<Partial<Record<NightActionType, number>>>({});
  const [processingQueuedActions, setProcessingQueuedActions] = useState(false);
  const [note, setNote] = useState("");
  const [instantPublicUpdates, setInstantPublicUpdates] = useState<boolean>(user?.public_auto_sync_enabled ?? true);
  const [updatingPublicPreference, setUpdatingPublicPreference] = useState(false);
  const noteFieldId = useId();

  const loadGame = useCallback(async () => {
    if (!gameId) return;
    try {
      const data = await api.getGame(gameId);
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

  useEffect(() => {
    setInstantPublicUpdates(user?.public_auto_sync_enabled ?? true);
  }, [user?.public_auto_sync_enabled]);

  useGameSocket(game ? game.id : null, {
    enabled: true,
    onMessage: (message) => {
      if (!gameId || message.game_id !== gameId) return;

      // Apply WS payload directly when it carries full game state
      if (message.players && message.logs) {
        setGame((prev) => {
          const updated: GameDetail = {
            id: message.game_id,
            status: message.status,
            current_phase: message.phase,
            current_round: message.round,
            winning_team: message.winning_team,
            players: message.players!,
            logs: message.logs!,
          };

          // F02: clear stale vote/night targets if the previously selected player
          // is no longer alive in the updated game state
          const aliveIds = new Set(updated.players.filter((p) => p.is_alive).map((p) => p.id));
          setVoteTarget((prev) => (prev !== undefined && !aliveIds.has(prev) ? undefined : prev));
          setPlannedNightActions((prev) => {
            const next = { ...prev };
            let changed = false;
            for (const key of ["kill", "save", "investigate"] as const) {
              if (next[key] !== undefined && !aliveIds.has(next[key]!)) {
                delete next[key];
                changed = true;
              }
            }
            return changed ? next : prev;
          });

          return updated;
        });
        setError(null);
        setLoading(false);
      } else {
        // Fallback: full HTTP refresh for events without embedded state
        void loadGame();
      }
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
  const aliveDoctors = useMemo(
    () => alivePlayers.filter((player) => (player.role?.toLowerCase() ?? "") === "doctor"),
    [alivePlayers]
  );
  const investigateTargets = useMemo(() => {
    if (aliveDetectives.length === 1) {
      const detectiveId = aliveDetectives[0].id;
      return alivePlayers.filter((player) => player.id !== detectiveId);
    }
    return alivePlayers;
  }, [alivePlayers, aliveDetectives]);

  const sortedPlayers = useMemo(() => {
    if (!game) return [] as Player[];
    return [...game.players].sort((first, second) => Number(second.is_alive) - Number(first.is_alive));
  }, [game]);

  const hasAliveDoctors = aliveDoctors.length > 0;
  const hasAliveDetectives = aliveDetectives.length > 0;

  const plannedSaveId = plannedNightActions.save;
  const plannedInvestigateId = plannedNightActions.investigate;

  useEffect(() => {
    if (hasAliveDoctors || !plannedSaveId) {
      return;
    }
    setPlannedNightActions((prev) => {
      if (!prev.save) return prev;
      const next = { ...prev };
      delete next.save;
      return next;
    });
  }, [hasAliveDoctors, plannedSaveId]);

  useEffect(() => {
    if (hasAliveDetectives || !plannedInvestigateId) {
      return;
    }
    setPlannedNightActions((prev) => {
      if (!prev.investigate) return prev;
      const next = { ...prev };
      delete next.investigate;
      return next;
    });
  }, [hasAliveDetectives, plannedInvestigateId]);

  const clearNightAction = (action: "kill" | "save" | "investigate") => {
    setPlannedNightActions((prev) => {
      const next = { ...prev };
      delete next[action];
      return next;
    });
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

    const killTargetId = plannedNightActions.kill;
    const saveTargetId = plannedNightActions.save;
    const investigateTargetId = plannedNightActions.investigate;

    if (!killTargetId && !saveTargetId && !investigateTargetId) {
      return;
    }

    const trimmedNote = note.trim();
    const actions: GameActionPayload[] = [];
    let noteConsumed = false;

    const resolvePlayerName = (playerId?: number) =>
      playerId ? game.players.find((player) => player.id === playerId)?.name ?? "Unknown" : "Unknown";

    if (killTargetId) {
      const killAction: GameActionPayload = {
        action_type: "kill",
        target_player_id: killTargetId,
      };
      if (saveTargetId && saveTargetId === killTargetId) {
        const name = resolvePlayerName(killTargetId);
        killAction.note = `Mafia tried to kill ${name}.`;
      }
      actions.push(killAction);
    }

    if (saveTargetId) {
      actions.push({ action_type: "save", target_player_id: saveTargetId });
    }

    if (investigateTargetId) {
      actions.push({ action_type: "investigate", target_player_id: investigateTargetId });
    }

    if (!actions.length) {
      return;
    }

    if (trimmedNote) {
      const targetAction = actions.find((action) => !action.note);
      if (targetAction) {
        targetAction.note = trimmedNote;
        noteConsumed = true;
      }
    }

    const response = await api.sendNightActions(game.id, actions);
    setGame(response);
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

  const syncNightEvents = useCallback(async () => {
    if (!game) return;
    try {
      const updated = await api.syncNightEvents(game.id);
      setGame(updated);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sync night events");
    }
  }, [game]);

  const handleTogglePublicSync = useCallback(async () => {
    if (!user || updatingPublicPreference) {
      return;
    }

    const previousValue = instantPublicUpdates;
    const nextValue = !instantPublicUpdates;
    setInstantPublicUpdates(nextValue);
    setUpdatingPublicPreference(true);
    setError(null);

    try {
      await api.updatePreferences({ public_auto_sync_enabled: nextValue });
      await refreshUser();
      if (nextValue) {
        await syncNightEvents();
      }
    } catch (err) {
      setInstantPublicUpdates(previousValue);
      setError(err instanceof Error ? err.message : "Failed to update public view preference");
    } finally {
      setUpdatingPublicPreference(false);
    }
  }, [instantPublicUpdates, refreshUser, syncNightEvents, updatingPublicPreference, user]);

  if (loading) {
    return <Spinner message="Loading dashboard..." />;
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 text-rose-300">
        <p className="text-sm">{error}</p>
        <div className="flex gap-3">
          <button onClick={() => void loadGame()} className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-sky-400">Retry</button>
          <a href="/profile" className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white">← Back to Profile</a>
        </div>
      </div>
    );
  }

  if (!game) return null;

  const isDay = game.current_phase === "day";

  const palette = isDay
    ? {
        background: "bg-gradient-to-br from-sky-950 via-slate-950 to-slate-950",
        glowPrimary: "bg-sky-500/25",
        glowSecondary: "bg-amber-300/15",
        radial: "bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_55%)]",
        badge: "border-sky-400/30 bg-sky-500/10 text-sky-200",
        hoverBorder: "border-sky-400/70 bg-sky-500/15",
        readyBorder: "border-emerald-400/70 bg-emerald-500/10",
        idleBorder: "border-white/10 bg-slate-900/55",
        primaryButton: "bg-amber-400 hover:bg-amber-300 text-slate-900",
        syncButton: "bg-sky-500 hover:bg-sky-400 text-slate-900",
        phaseBadge: "border-amber-400/60 bg-amber-500/10 text-amber-200",
      }
    : {
        background: "bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950",
        glowPrimary: "bg-indigo-500/25",
        glowSecondary: "bg-purple-500/20",
        radial: "bg-[radial-gradient(circle_at_top,_rgba(129,140,248,0.2),_transparent_55%)]",
        badge: "border-indigo-400/40 bg-indigo-500/15 text-indigo-200",
        hoverBorder: "border-indigo-400/70 bg-indigo-500/15",
        readyBorder: "border-emerald-400/70 bg-emerald-500/10",
        idleBorder: "border-white/10 bg-slate-900/55",
        primaryButton: "bg-indigo-400 hover:bg-indigo-300 text-slate-900",
        syncButton: "bg-sky-500 hover:bg-sky-400 text-slate-900",
        phaseBadge: "border-amber-400/60 bg-amber-500/10 text-amber-200",
      };

  return (
    <div className={`relative min-h-screen ${palette.background} text-slate-100`}>
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className={`absolute left-[12%] top-0 h-72 w-72 rounded-full blur-3xl ${palette.glowPrimary}`} />
          <div className={`absolute bottom-14 right-[16%] h-80 w-80 rounded-full blur-3xl ${palette.glowSecondary}`} />
          <div className={`absolute inset-0 ${palette.radial}`} />
        </div>
        <BackdropLogo className="right-[20%] top-[-2rem] w-[640px] opacity-40" />

        <div className="relative z-10 mx-auto max-w-6xl px-6 py-12">
          <button
            className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-300 transition hover:text-white"
            onClick={() => navigate("/profile")}
          >
            <span aria-hidden>←</span>
            Back
          </button>

          <header className="mb-10 rounded-3xl border border-white/10 bg-slate-900/70 p-8 shadow-2xl shadow-slate-950/60 backdrop-blur-xl">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-4">
                <div className="space-y-2">
                  <h1 className="text-3xl font-semibold text-white sm:text-4xl">Management dashboard</h1>
                  <p className="text-sm text-slate-300">
                    {isDay
                      ? "Steer the town through accusations, votes, and reveals."
                      : "Coordinate the night plan and keep every role in sync."}
                  </p>
                </div>
              </div>
              <div className="grid auto-rows-fr gap-3 text-sm text-slate-200 sm:grid-cols-2">
                <div className={`rounded-2xl border px-4 py-3 text-center ${palette.phaseBadge}`}>
                  <p className="text-[0.65rem] uppercase tracking-wide">Current phase</p>
                  <p className="mt-1 min-h-[1.75rem] text-lg font-semibold">
                    {isDay ? "Day" : "Night"} {game.current_round}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center">
                  <p className="text-[0.65rem] uppercase tracking-wide text-slate-300">Alive players</p>
                  <p className="mt-1 min-h-[1.75rem] text-lg font-semibold text-white">{alivePlayers.length}</p>
                </div>
              </div>
            </div>
          </header>

          <GameControls
            isDay={isDay}
            processingQueuedActions={processingQueuedActions}
            instantPublicUpdates={instantPublicUpdates}
            updatingPublicPreference={updatingPublicPreference}
            user={user}
            palette={palette}
            onSwitchPhase={(phase) => void switchPhase(phase)}
            onFinishGame={(team) => void finishGame(team)}
            onTogglePublicSync={() => void handleTogglePublicSync()}
            onSyncNightEvents={() => void syncNightEvents()}
          />

          <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
            {isDay ? (
              <DayPhasePanel
                alivePlayers={alivePlayers}
                voteTarget={voteTarget}
                onVote={setVoteTarget}
                onClearVote={() => setVoteTarget(undefined)}
                note={note}
                noteId={noteFieldId}
                onNoteChange={setNote}
                palette={palette}
              />
            ) : (
              <NightPhasePanel
                alivePlayers={alivePlayers}
                aliveNonMafiaPlayers={aliveNonMafiaPlayers}
                investigateTargets={investigateTargets}
                hasAliveDoctors={hasAliveDoctors}
                hasAliveDetectives={hasAliveDetectives}
                plannedNightActions={plannedNightActions}
                onPlanAction={(action, id) =>
                  setPlannedNightActions((prev) => ({ ...prev, [action]: id }))
                }
                onClearAction={clearNightAction}
                note={note}
                noteId={noteFieldId}
                onNoteChange={setNote}
                palette={palette}
              />
            )}

            <PlayerRoster players={sortedPlayers} />
          </div>

          <LogsSection
            className="mt-8 border-white/10 bg-slate-900/70 shadow-2xl shadow-slate-950/60"
            logs={game.logs}
            players={game.players}
            title="Logs"
            subtitle="Auto-updating"
          />
        </div>
      </div>
  );
};

const DashboardPage = () => (
  <ResponsiveDndProvider>
    <DashboardPageContent />
  </ResponsiveDndProvider>
);

export default DashboardPage;
