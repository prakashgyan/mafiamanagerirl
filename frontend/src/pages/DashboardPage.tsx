import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useDrag, useDrop } from "react-dnd";
import type { ConnectDropTarget } from "react-dnd";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useGameSocket } from "../hooks/useGameSocket";
import LogsSection from "../components/LogTimeline";
import { api, GameActionPayload, GameDetail, GamePhase, Player } from "../services/api";
import { getPlayerCardClasses, getRoleLabelClass } from "../utils/playerStyles";
import ResponsiveDndProvider from "../components/ResponsiveDndProvider";
import PlayerAvatar from "../components/PlayerAvatar";
import BackdropLogo from "../components/BackdropLogo";

const DND_TYPE = "PLAYER";

type DragItem = {
  playerId: number;
};

type DraggablePlayerCardProps = {
  player: Player;
};

const DraggablePlayerCard = ({ player }: DraggablePlayerCardProps) => {
  const [{ isDragging }, dragRef] = useDrag<DragItem, void, { isDragging: boolean }>(
    () => ({
      type: DND_TYPE,
      item: { playerId: player.id },
      canDrag: player.is_alive,
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
    }),
    [player]
  );

  return (
    <div
      ref={dragRef}
      className={`flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm shadow-sm shadow-black/30 transition ${
        player.is_alive ? "cursor-grab hover:border-sky-400/60" : "cursor-not-allowed opacity-70"
      } ${isDragging ? "opacity-60" : ""} ${getPlayerCardClasses(player)}`}
      aria-disabled={!player.is_alive}
    >
      <PlayerAvatar value={player.avatar} fallbackLabel={player.name} size="sm" className="mt-1" />
      <div className="flex flex-col gap-1">
        <p className="font-semibold text-white">{player.name}</p>
        <p className={`text-xs uppercase tracking-wide ${getRoleLabelClass(player)}`}>
          {player.role ?? "Unassigned"}
        </p>
        {!player.is_alive && <p className="text-[0.65rem] text-slate-400">Eliminated</p>}
      </div>
    </div>
  );
};

type NightActionType = "kill" | "save" | "investigate";

const DashboardPageContent = () => {
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

  const hasAliveDoctors = aliveDoctors.length > 0;
  const hasAliveDetectives = aliveDetectives.length > 0;

  const plannedSaveId = plannedNightActions.save;
  const plannedInvestigateId = plannedNightActions.investigate;

  const isDayPhase = game?.current_phase === "day";

  const [{ isOver: isVoteOver, canDrop: canVoteDrop }, voteDropRef] = useDrop<DragItem, void, { isOver: boolean; canDrop: boolean }>(() => ({
    accept: DND_TYPE,
    canDrop: (item) => voteEligibleIds.has(item.playerId),
    drop: (item) => setVoteTarget(item.playerId),
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
      canDrop: monitor.canDrop(),
    }),
  }), [voteEligibleIds]);

  const [{ isOver: isKillOver, canDrop: canKillDrop }, killDropRef] = useDrop<DragItem, void, { isOver: boolean; canDrop: boolean }>(() => ({
    accept: DND_TYPE,
    canDrop: (item) => !isDayPhase && killEligibleIds.has(item.playerId),
    drop: (item) => setPlannedNightActions((prev) => ({ ...prev, kill: item.playerId })),
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
      canDrop: monitor.canDrop(),
    }),
  }), [isDayPhase, killEligibleIds]);

  const [{ isOver: isSaveOver, canDrop: canSaveDrop }, saveDropRef] = useDrop<DragItem, void, { isOver: boolean; canDrop: boolean }>(() => ({
    accept: DND_TYPE,
    canDrop: (item) => !isDayPhase && hasAliveDoctors && saveEligibleIds.has(item.playerId),
    drop: (item) => setPlannedNightActions((prev) => ({ ...prev, save: item.playerId })),
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
      canDrop: monitor.canDrop(),
    }),
  }), [hasAliveDoctors, isDayPhase, saveEligibleIds]);

  const [{ isOver: isInvestigateOver, canDrop: canInvestigateDrop }, investigateDropRef] = useDrop<DragItem, void, { isOver: boolean; canDrop: boolean }>(() => ({
    accept: DND_TYPE,
    canDrop: (item) => !isDayPhase && hasAliveDetectives && investigateEligibleIds.has(item.playerId),
    drop: (item) => setPlannedNightActions((prev) => ({ ...prev, investigate: item.playerId })),
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
      canDrop: monitor.canDrop(),
    }),
  }), [hasAliveDetectives, investigateEligibleIds, isDayPhase]);

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

  const renderVoteDropZone = () => {
    const selectedPlayer = game?.players.find((player) => player.id === voteTarget) ?? null;
    const allowedPlayers = alivePlayers;
    const baseClasses =
      "flex flex-col gap-3 rounded-2xl border-2 border-dashed px-5 py-4 text-sm transition-colors duration-200 shadow-sm shadow-black/30";
    const stateClasses = isVoteOver && canVoteDrop
      ? palette.hoverBorder
      : selectedPlayer
        ? palette.readyBorder
        : palette.idleBorder;
    const placeholder = allowedPlayers.length === 0 ? "No eligible players" : "Drag a player here";

    return (
      <div ref={voteDropRef} className={`${baseClasses} ${stateClasses}`}>
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
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100">
            <PlayerAvatar value={selectedPlayer.avatar} fallbackLabel={selectedPlayer.name} size="sm" />
            <div className="flex flex-col">
              <span className="font-semibold">{selectedPlayer.name}</span>
              <span className="text-[0.65rem] uppercase tracking-wide text-slate-400">{selectedPlayer.role ?? "Unassigned"}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400">{placeholder}</p>
        )}
        <p className="text-[0.7rem] text-slate-500">
          {allowedPlayers.length === 0
            ? "No players currently meet the requirements."
            : "Drag from the players list on the right."}
        </p>
      </div>
    );
  };

  type NightDropZoneConfig = {
    dropRef: ConnectDropTarget;
    isOver: boolean;
    canDrop: boolean;
    isEnabled: boolean;
    disabledMessage?: string;
  };

  const renderNightActionDropZone = (
    action: NightActionType,
    label: string,
    allowedPlayers: Player[],
    selectedPlayer: Player | null | undefined,
    { dropRef, isOver, canDrop, isEnabled, disabledMessage }: NightDropZoneConfig
  ) => {
    const baseClasses =
      "flex flex-col gap-3 rounded-2xl border-2 border-dashed px-5 py-4 text-sm transition-colors duration-200 shadow-sm shadow-black/30";
    const stateClasses = !isEnabled
      ? "border-white/10 bg-slate-950/30 opacity-60"
      : isOver && canDrop
      ? palette.hoverBorder
      : selectedPlayer
        ? palette.readyBorder
        : palette.idleBorder;
    const placeholder = !isEnabled
      ? disabledMessage ?? "Role eliminated."
      : allowedPlayers.length === 0
      ? "No eligible players"
      : "Drag a player here";

    return (
      <div ref={dropRef} className={`${baseClasses} ${stateClasses}`}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold uppercase tracking-wide text-slate-200">{label}</span>
          {selectedPlayer && isEnabled && (
            <button
              type="button"
              onClick={() => clearNightAction(action)}
              className="text-xs font-semibold uppercase tracking-wide text-slate-300 transition hover:text-rose-300"
            >
              Clear
            </button>
          )}
        </div>
        {selectedPlayer && isEnabled ? (
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100">
            <PlayerAvatar value={selectedPlayer.avatar} fallbackLabel={selectedPlayer.name} size="sm" />
            <div className="flex flex-col">
              <span className="font-semibold">{selectedPlayer.name}</span>
              <span className="text-[0.65rem] uppercase tracking-wide text-slate-400">{selectedPlayer.role ?? "Unassigned"}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400">{placeholder}</p>
        )}
        <p className="text-[0.7rem] text-slate-500">
          {!isEnabled
            ? disabledMessage ?? "This action is unavailable."
            : allowedPlayers.length === 0
            ? "No players currently meet the requirements."
            : "Drag from the players list on the right."}
        </p>
        {isEnabled &&
          action === "kill" &&
          plannedNightActions.save &&
          plannedNightActions.save === plannedNightActions.kill && (
          <p className="text-xs font-semibold text-amber-300">
            This target will survive; the log will record that the mafia tried to kill them.
          </p>
        )}
      </div>
    );
  };

  return (
    <div className={`relative min-h-screen ${palette.background} text-slate-100`}>
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className={`absolute left-[12%] top-0 h-72 w-72 rounded-full blur-3xl ${palette.glowPrimary}`} />
          <div className={`absolute bottom-14 right-[16%] h-80 w-80 rounded-full blur-3xl ${palette.glowSecondary}`} />
          <div className={`absolute inset-0 ${palette.radial}`} />
        </div>
        <BackdropLogo className="right-[-10%] top-[-5rem] w-[700px] opacity-20" />

        <div className="relative z-10 mx-auto max-w-6xl px-6 py-12">
          <button
            className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-300 transition hover:text-white"
            onClick={() => navigate(-1)}
          >
            <span aria-hidden>←</span>
            Back
          </button>

          <header className="mb-10 rounded-3xl border border-white/10 bg-slate-900/70 p-8 shadow-2xl shadow-slate-950/60 backdrop-blur-xl">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-4">
                <Link
                  to="/"
                  aria-label="Go to homepage"
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] transition hover:opacity-90 ${palette.badge}`}
                >
                  MafiaDesk
                </Link>
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

          <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-end">
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => switchPhase(isDay ? "night" : "day")}
                disabled={processingQueuedActions}
                className={`inline-flex items-center justify-center rounded-2xl px-5 py-2 text-sm font-semibold transition ${palette.primaryButton} ${
                  processingQueuedActions ? "cursor-not-allowed opacity-80" : ""
                }`}
              >
                {processingQueuedActions ? "Resolving Actions..." : `End ${isDay ? "Day" : "Night"}`}
              </button>
              <button
                onClick={() => finishGame("Villagers")}
                className="inline-flex items-center justify-center rounded-2xl border border-emerald-400/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-200 transition hover:border-emerald-300"
              >
                Villagers Win
              </button>
              <button
                onClick={() => finishGame("Mafia")}
                className="inline-flex items-center justify-center rounded-2xl border border-rose-400/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-rose-200 transition hover:border-rose-300"
              >
                Mafia Win
              </button>
              <button
                onClick={syncNightEvents}
                className={`inline-flex items-center justify-center rounded-2xl px-4 py-2 text-sm font-semibold transition ${palette.syncButton}`}
              >
                Sync Night Events
              </button>
            </div>
          </div>

          <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
            <section className="space-y-6 rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/60">
              <div>
                <h2 className="text-lg font-semibold text-white">Control center</h2>
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  {isDay
                    ? "Drag an eligible player into the vote zone. The elimination happens when you end the day."
                    : "Queue the mafia, doctor, and detective actions. They resolve when you end the night."}
                </p>
              </div>
              <div className={`grid gap-5 ${isDay ? "md:grid-cols-1" : "md:grid-cols-2 xl:grid-cols-3"}`}>
                {isDay ? (
                  renderVoteDropZone()
                ) : (
                  <>
                    {renderNightActionDropZone(
                      "kill",
                      "Mafia Kill",
                      aliveNonMafiaPlayers,
                      killTargetPlayer,
                      {
                        dropRef: killDropRef,
                        isOver: isKillOver,
                        canDrop: canKillDrop,
                        isEnabled: !isDay,
                      }
                    )}
                    {renderNightActionDropZone(
                      "save",
                      "Doctor Save",
                      alivePlayers,
                      saveTargetPlayer,
                      {
                        dropRef: saveDropRef,
                        isOver: isSaveOver,
                        canDrop: canSaveDrop,
                        isEnabled: !isDay && hasAliveDoctors,
                        disabledMessage: "No living doctors — unable to save.",
                      }
                    )}
                    {renderNightActionDropZone(
                      "investigate",
                      "Detective Investigate",
                      investigateTargets,
                      investigateTargetPlayer,
                      {
                        dropRef: investigateDropRef,
                        isOver: isInvestigateOver,
                        canDrop: canInvestigateDrop,
                        isEnabled: !isDay && hasAliveDetectives,
                        disabledMessage: "No living detectives — unable to investigate.",
                      }
                    )}
                  </>
                )}
              </div>
              <div>
                <label className="text-sm text-slate-300" htmlFor={noteFieldId}>
                  Notes / summary
                </label>
                <textarea
                  id={noteFieldId}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={3}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  placeholder="Optional log message to send with your next action"
                />
              </div>
            </section>

            <aside className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/60">
              <h2 className="text-lg font-semibold text-white">Players</h2>
              <p className="mb-4 text-xs uppercase tracking-wide text-slate-400">Drag living players into the targets.</p>
              <div className="grid grid-cols-2 gap-3">
                {game.players.map((player) => (
                  <DraggablePlayerCard key={player.id} player={player} />
                ))}
              </div>
            </aside>
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
