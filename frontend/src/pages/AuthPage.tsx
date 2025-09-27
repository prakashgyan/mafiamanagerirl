import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

const AuthPage = () => {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    try {
      if (mode === "login") {
        await login(username, password);
      } else {
        await signup(username, password);
      }
      navigate("/profile", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to authenticate");
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-12">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-64 w-[70%] -translate-x-1/2 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="absolute bottom-16 right-10 h-52 w-52 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.12),_transparent_55%)]" />
      </div>

      <div className="relative z-10 w-full max-w-6xl rounded-3xl border border-white/10 bg-slate-900/70 shadow-2xl shadow-slate-950/70 backdrop-blur-xl">
        <div className="grid gap-10 p-8 sm:p-12 lg:grid-cols-[1.1fr_1fr]">
          <section className="flex flex-col justify-center gap-8 text-left">
            <div className="space-y-4">
              <span className="inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-200">
                MafiaDesk
              </span>
              <h1 className="text-4xl font-semibold text-white sm:text-5xl">Your Mafia game, organized</h1>
              <p className="max-w-xl text-base leading-relaxed text-slate-300">
                Run unforgettable Mafia nights without juggling notes or losing the thread. MafiaDesk keeps
                your players, roles, and story arcs aligned so the tension stays high and the chaos stays fun.
              </p>
            </div>

            <dl className="grid gap-4 text-left sm:grid-cols-2">
              <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-5 shadow-lg shadow-black/30">
                <dt className="text-sm font-semibold text-white">Live game dashboards</dt>
                <dd className="mt-1 text-sm text-slate-300">
                  Track every phase, player status, and vote in a single streamlined view.
                </dd>
              </div>
              <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-5 shadow-lg shadow-black/30">
                <dt className="text-sm font-semibold text-white">Role assignment in seconds</dt>
                <dd className="mt-1 text-sm text-slate-300">
                  Shuffle, assign, and reveal roles with calm, consistent pacing.
                </dd>
              </div>
              <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-5 shadow-lg shadow-black/30">
                <dt className="text-sm font-semibold text-white">Automated log timeline</dt>
                <dd className="mt-1 text-sm text-slate-300">
                  Capture every accusation, alibi, and night action without missing a beat.
                </dd>
              </div>
              <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-5 shadow-lg shadow-black/30">
                <dt className="text-sm font-semibold text-white">Ready for any group</dt>
                <dd className="mt-1 text-sm text-slate-300">
                  Built for living-room classics, campus events, and everything in between.
                </dd>
              </div>
            </dl>

            <p className="text-sm text-slate-400">
              New to MafiaDesk? Create an account in moments, then return anytime to continue your story.
            </p>
          </section>

          <section className="flex items-center justify-center">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-950/80 p-7 shadow-lg shadow-black/40">
              <div className="mb-6 flex justify-between">
                <h2 className="text-lg font-semibold text-white">Join the table</h2>
                <p className="text-sm text-slate-400">Sign in or create a host account</p>
              </div>
              <div className="mb-6 grid grid-cols-2 gap-2 rounded-full bg-slate-800/80 p-1">
                <button
                  className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
                    mode === "login"
                      ? "bg-white text-slate-900 shadow"
                      : "text-slate-300 hover:text-white"
                  }`}
                  onClick={() => setMode("login")}
                  type="button"
                >
                  Login
                </button>
                <button
                  className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
                    mode === "signup"
                      ? "bg-white text-slate-900 shadow"
                      : "text-slate-300 hover:text-white"
                  }`}
                  onClick={() => setMode("signup")}
                  type="button"
                >
                  Sign Up
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <label className="block text-sm">
                  <span className="text-slate-300">Username</span>
                  <input
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-700/80 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                    placeholder="Choose a memorable name"
                    required
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-slate-300">Password</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-700/80 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                    placeholder="At least 6 characters"
                    required
                    minLength={6}
                  />
                </label>
                {error && <p className="text-sm text-rose-400">{error}</p>}
                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 py-2 font-semibold text-slate-900 transition hover:bg-sky-400"
                >
                  {mode === "login" ? "Login" : "Create Account"}
                </button>
              </form>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
