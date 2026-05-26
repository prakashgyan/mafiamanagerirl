import confetti from "canvas-confetti";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import LogsSection from "../components/LogTimeline";
import { api, GameDetail } from "../services/api";
import PlayerAvatar from "../components/PlayerAvatar";
import Spinner from "../components/Spinner";
import { RoleBadge } from "../components/RoleBadge";

const GameOverPage = () => {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState<GameDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const confettiFired = useRef(false);

  useEffect(() => {
    if (!gameId) return;
    void (async () => {
      try {
        const data = await api.getGame(gameId);
        setGame(data);
        if (data.status === "finished" && !confettiFired.current) {
          confettiFired.current = true;
          void confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load game");
      }
    })();
  }, [gameId]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 text-rose-300">
        <p className="text-sm">{error}</p>
        <div className="flex gap-3">
          <button onClick={() => window.location.reload()} className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-sky-400">Retry</button>
          <a href="/profile" className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white">← Back to Profile</a>
        </div>
      </div>
    );
  }

  if (!game) {
    return <Spinner message="Loading..." />;
  }

  const alivePlayers = game.players.filter((p) => p.is_alive);
  const eliminatedPlayers = game.players.filter((p) => !p.is_alive);
  // Survivors first, then eliminated — makes the roster scannable at a glance
  const sortedPlayers = [...alivePlayers, ...eliminatedPlayers];

  const winner = game.winning_team?.trim() ?? null;
  const winnerLower = winner?.toLowerCase() ?? "";

  const isMafia = winnerLower.includes("mafia");
  const isTown = winnerLower.includes("villager") || winnerLower.includes("town");
  const isJester = winnerLower.includes("jester");

  const winnerPalette = isMafia
    ? {
        border: "border-rose-400/50",
        background: "bg-rose-500/10",
        text: "text-rose-100",
        badge: "border-rose-400/40 bg-rose-500/15 text-rose-100",
        blob1: "bg-rose-600/25",
        blob2: "bg-rose-900/20",
        radial: "rgba(244,63,94,0.18)",
      }
    : isTown
      ? {
          border: "border-emerald-400/50",
          background: "bg-emerald-500/10",
          text: "text-emerald-100",
          badge: "border-emerald-400/40 bg-emerald-500/15 text-emerald-100",
          blob1: "bg-emerald-500/20",
          blob2: "bg-teal-400/15",
          radial: "rgba(52,211,153,0.14)",
        }
      : {
          border: "border-sky-400/50",
          background: "bg-sky-500/10",
          text: "text-sky-100",
          badge: "border-sky-400/40 bg-sky-500/15 text-sky-100",
          blob1: "bg-sky-500/20",
          blob2: "bg-indigo-400/15",
          radial: "rgba(56,189,248,0.14)",
        };

  const winnerEmoji =
    isMafia ? "🔪" :
    isJester ? "🃏" :
    isTown ? "🌾" : "🏆";

  const winnerLine = winner ? `${winner} Win!` : "Winner not declared";

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100">
      {/* Ambient blobs — colours reflect winner */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className={`absolute left-[10%] top-0 h-72 w-72 rounded-full blur-3xl ${winnerPalette.blob1}`} />
        <div className={`absolute bottom-[-6rem] right-[18%] h-96 w-96 rounded-full blur-3xl ${winnerPalette.blob2}`} />
        <div
          className="absolute inset-0"
          style={{ background: `radial-gradient(circle at top, ${winnerPalette.radial}, transparent 58%)` }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl px-6 py-12 lg:py-16">
        {/* Back button with focus ring */}
        <button
          className="mb-6 inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-slate-300 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
          onClick={() => navigate("/profile")}
        >
          <span aria-hidden>←</span>
          Back to Profile
        </button>

        {/* Winner hero */}
        <div
          className={`mb-8 rounded-3xl border ${winnerPalette.border} ${winnerPalette.background} px-6 py-12 text-center shadow-2xl shadow-black/40 backdrop-blur-xl lg:py-16`}
          role="region"
          aria-label="Game result"
        >
          <div className="text-6xl mb-4" role="img" aria-label={winnerEmoji}>{winnerEmoji}</div>
          <span className={`inline-flex items-center justify-center rounded-full border px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-widest ${winnerPalette.badge} mb-4`}>
            Final Verdict — Game #{game.id}
          </span>
          <h1 className={`text-4xl font-bold sm:text-5xl lg:text-6xl ${winnerPalette.text} drop-shadow-lg`}>
            {winnerLine}
          </h1>
          <p className="mt-4 text-base text-slate-300 max-w-md mx-auto">
            {winner
              ? `${game.current_round} round${game.current_round !== 1 ? "s" : ""} played · ${alivePlayers.length} survivor${alivePlayers.length !== 1 ? "s" : ""} · ${eliminatedPlayers.length} eliminated`
              : "The host hasn't declared a winner yet."}
          </p>
        </div>

        {/* Summary stats — removed redundant "Game status: finished" and "Game #id · Round n" repeat */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-4 text-center shadow-md shadow-black/20 backdrop-blur-xl">
            <p className="text-[0.65rem] uppercase tracking-wide text-slate-400">Total rounds</p>
            <p className="mt-1 text-2xl font-bold text-white">{game.current_round}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-4 text-center shadow-md shadow-black/20 backdrop-blur-xl">
            <p className="text-[0.65rem] uppercase tracking-wide text-slate-400">Survivors</p>
            <p className="mt-1 text-2xl font-bold text-emerald-200">{alivePlayers.length}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-4 text-center shadow-md shadow-black/20 backdrop-blur-xl">
            <p className="text-[0.65rem] uppercase tracking-wide text-slate-400">Eliminated</p>
            <p className="mt-1 text-2xl font-bold text-rose-200">{eliminatedPlayers.length}</p>
          </div>
        </div>

        <div className="mt-10 space-y-6">
          {/* Final roster */}
          <section aria-labelledby="roster-heading" className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/60">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 id="roster-heading" className="text-lg font-semibold text-white">Final roster</h2>
                <p className="text-xs uppercase tracking-wide text-slate-400">Who survived, who fell, and what they played.</p>
              </div>
              <p className="text-xs uppercase tracking-wide text-slate-400">{game.players.length} participants</p>
            </div>

            {game.players.length === 0 ? (
              <p className="mt-6 text-sm text-slate-400">No players recorded for this game.</p>
            ) : (
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {sortedPlayers.map((player) => {
                  const alive = player.is_alive;
                  return (
                    <div
                      key={player.id}
                      className={`flex items-center gap-4 rounded-2xl border px-4 py-4 shadow-md shadow-black/20 transition ${
                        alive
                          ? "border-emerald-400/60 bg-emerald-500/10"
                          : "border-slate-800 bg-slate-950/60 opacity-70"
                      }`}
                    >
                      <PlayerAvatar value={player.avatar} fallbackLabel={player.name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-x-2 text-base font-semibold text-white">
                          <span className="truncate">{player.name}</span>
                          {!alive && (
                            <span className="inline-flex items-center gap-1 text-xs font-normal uppercase tracking-wide text-rose-300">
                              <span aria-hidden>💀</span> Eliminated
                            </span>
                          )}
                        </p>
                        <RoleBadge role={player.role} className="mt-1" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Action log — subtitle updated to reflect completed game */}
          <LogsSection
            className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/60"
            title="Action log"
            subtitle="Full game history"
            logs={game.logs}
            players={game.players}
            emptyMessage="No actions logged for this game."
          />
        </div>

        {/* What's next */}
        <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/60">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-white">What&apos;s next?</h2>
            <p className="text-sm text-slate-300">
              Start a fresh session or head back to your profile.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              onClick={() => navigate("/profile")}
              className="inline-flex items-center justify-center rounded-2xl bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-sky-500/30 transition hover:bg-sky-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
            >
              Return to profile
            </button>
            <button
              onClick={() => navigate("/games/new")}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-700/60 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-sky-400 hover:text-sky-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
            >
              Start new game
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameOverPage;
