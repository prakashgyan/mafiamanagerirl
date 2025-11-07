import confetti from "canvas-confetti";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import LogsSection from "../components/LogTimeline";
import { api, GameDetail } from "../services/api";
import PlayerAvatar from "../components/PlayerAvatar";
import BackdropLogo from "../components/BackdropLogo";

const GameOverPage = () => {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState<GameDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!gameId) return;
    void (async () => {
      try {
        const data = await api.getGame(Number(gameId));
        setGame(data);
        if (data.status === "finished") {
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
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-rose-300">
        {error}
      </div>
    );
  }

  if (!game) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        Loading...
      </div>
    );
  }

  const alivePlayers = game.players.filter((player) => player.is_alive);
  const eliminatedPlayers = game.players.filter((player) => !player.is_alive);
  const winner = game.winning_team?.trim() ?? null;
  const winnerLower = winner?.toLowerCase() ?? "";
  const winnerPalette =
    winnerLower.includes("mafia")
      ? {
          border: "border-rose-400/50",
          background: "bg-rose-500/10",
          text: "text-rose-100",
          badge: "border-rose-400/40 bg-rose-500/15 text-rose-100",
        }
      : winnerLower.includes("villager") || winnerLower.includes("town")
        ? {
            border: "border-emerald-400/50",
            background: "bg-emerald-500/10",
            text: "text-emerald-100",
            badge: "border-emerald-400/40 bg-emerald-500/15 text-emerald-100",
          }
        : {
            border: "border-sky-400/50",
            background: "bg-sky-500/10",
            text: "text-sky-100",
            badge: "border-sky-400/40 bg-sky-500/15 text-sky-100",
          };

  const winnerLine = winner ? `${winner} Win!` : "Winner not declared";

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-950 via-slate-950 to-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[10%] top-0 h-72 w-72 rounded-full bg-sky-500/20 blur-3xl" />
        <div className="absolute bottom-[-6rem] right-[18%] h-96 w-96 rounded-full bg-emerald-400/15 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.14),_transparent_58%)]" />
      </div>
      <BackdropLogo className="right-[20%] top-[-2rem] w-[640px] opacity-40" />

      <div className="relative z-10 mx-auto max-w-5xl px-6 py-12 lg:py-16">
        <button
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-300 transition hover:text-white"
          onClick={() => navigate(-1)}
        >
          <span aria-hidden>←</span>
          Back
        </button>

        <header className="rounded-3xl border border-white/10 bg-slate-900/70 p-8 shadow-2xl shadow-slate-950/60 backdrop-blur-xl">
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
                <h1 className="text-3xl font-semibold text-white sm:text-4xl">Game over summary</h1>
                <p className="text-sm text-slate-300">
                  Game #{game.id} wrapped on round {game.current_round}. Review the final standings, then queue up your next
                  dramatic showdown.
                </p>
              </div>
            </div>
            <div className="grid auto-rows-fr gap-3 text-sm text-slate-200 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center">
                <p className="text-[0.65rem] uppercase tracking-wide text-slate-400">Game status</p>
                <p className="mt-1 text-lg font-semibold text-white capitalize">{game.status}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center">
                <p className="text-[0.65rem] uppercase tracking-wide text-slate-400">Survivors</p>
                <p className="mt-1 text-lg font-semibold text-emerald-200">{alivePlayers.length}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center">
                <p className="text-[0.65rem] uppercase tracking-wide text-slate-400">Eliminated</p>
                <p className="mt-1 text-lg font-semibold text-rose-200">{eliminatedPlayers.length}</p>
              </div>
            </div>
          </div>

          <div
            className={`mt-8 rounded-3xl border ${winnerPalette.border} ${winnerPalette.background} px-6 py-5 text-center shadow-inner shadow-black/20 lg:px-8 lg:py-6`}
          >
            <span className={`inline-flex items-center justify-center rounded-full border px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-wide ${winnerPalette.badge}`}>
              Final Verdict
            </span>
            <h2 className={`mt-3 text-2xl font-semibold sm:text-3xl ${winnerPalette.text}`}>{winnerLine}</h2>
            <p className="mt-3 text-sm text-slate-300">
              {winner
                ? "Celebrate the winning faction and study their path to victory."
                : "Declare a winner to close the loop, or re-open the game if a recount is needed."}
            </p>
          </div>
        </header>

        <section className="mt-10 space-y-6">
          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/60">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">Final roster</h3>
                <p className="text-xs uppercase tracking-wide text-slate-400">Who survived, who fell, and what they played.</p>
              </div>
              <p className="text-xs uppercase tracking-wide text-slate-400">{game.players.length} participants</p>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {game.players.map((player) => {
                const alive = player.is_alive;
                return (
                  <div
                    key={player.id}
                    className={`flex items-center gap-4 rounded-2xl border px-4 py-4 shadow-md shadow-black/20 transition ${
                      alive
                        ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-100"
                        : "border-slate-800 bg-slate-950/70 text-slate-400"
                    }`}
                  >
                    <PlayerAvatar value={player.avatar} fallbackLabel={player.name} size="sm" />
                    <div>
                      <p className="text-base font-semibold text-white">
                        {player.name}
                        {!alive && (
                          <span className="ml-2 text-xs font-normal uppercase tracking-wide text-rose-200">Eliminated</span>
                        )}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-wide text-slate-300">{player.role ?? "Unknown role"}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <LogsSection
            className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/60"
            title="Action log"
            subtitle="Auto-updated during play"
            logs={game.logs}
            players={game.players}
            emptyMessage="No actions logged for this game."
          />
        </section>

        <section className="mt-10 rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/60">
          <div className="flex flex-col gap-4 text-center sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2 text-left sm:text-left">
              <h3 className="text-lg font-semibold text-white">What&apos;s next?</h3>
              <p className="text-sm text-slate-300">
                Start a fresh session or head back to your profile to line up players for the next Mafia night.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                onClick={() => navigate("/profile")}
                className="inline-flex items-center justify-center rounded-2xl bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-sky-500/30 transition hover:bg-sky-400"
              >
                Return to profile
              </button>
              <button
                onClick={() => navigate("/games/new")}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-700/60 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-sky-400 hover:text-sky-200"
              >
                Start new game
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default GameOverPage;
