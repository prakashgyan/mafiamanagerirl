import confetti from "canvas-confetti";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import LogsSection from "../components/LogTimeline";
import { api, GameDetail } from "../services/api";

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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-4xl px-6 py-12 text-center">
        <h1 className="text-4xl font-semibold">Game Over</h1>
        <p className="mt-2 text-sm uppercase tracking-wide text-slate-400">
          Game #{game.id} • Round {game.current_round}
        </p>
        <div className="mt-8 rounded-3xl border border-emerald-400/40 bg-emerald-400/10 p-8">
          <h2 className="text-2xl font-semibold text-emerald-200">
            {game.winning_team ? `${game.winning_team} Win!` : "Winner not declared"}
          </h2>
          <p className="mt-3 text-sm text-slate-300">
            Relive the final moments below or start a new session to keep the tension rolling.
          </p>
        </div>

        <section className="mt-10 text-left">
          <h3 className="text-xl font-semibold">Final Player Status</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {game.players.map((player) => (
              <div
                key={player.id}
                className={`rounded-2xl border px-4 py-3 ${
                  player.is_alive
                    ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-200"
                    : "border-slate-800 bg-slate-900/70 text-slate-500 line-through"
                }`}
              >
                <p className="text-lg font-semibold">{player.name}</p>
                <p className="text-xs uppercase tracking-wide text-slate-300">{player.role ?? "Unknown"}</p>
              </div>
            ))}
          </div>
        </section>

        <LogsSection
          className="mt-10 text-left"
          title="Action Log"
          logs={game.logs}
          players={game.players}
          emptyMessage="No actions logged for this game."
        />

        <div className="mt-12 flex justify-center gap-4">
          <button
            onClick={() => navigate("/profile")}
            className="rounded-lg bg-sky-500 px-6 py-3 font-semibold text-slate-900 hover:bg-sky-400"
          >
            Return to Dashboard
          </button>
          <button
            onClick={() => navigate("/games/new")}
            className="rounded-lg border border-slate-700 px-6 py-3 text-slate-300 hover:border-slate-500"
          >
            Start New Game
          </button>
        </div>
      </div>
    </div>
  );
};

export default GameOverPage;
