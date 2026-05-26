import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";

import logoImage from "../assets/logo.png";
import BlobBackground from "../components/BlobBackground";
import { useAuth } from "../context/AuthContext";
import { getErrorMessage } from "../utils/errorMessage";

const features = [
  {
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-sky-400" aria-hidden>
        <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
      </svg>
    ),
    title: "Live game dashboards",
    description: "Track every phase, player status, and vote in one streamlined view.",
  },
  {
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-sky-400" aria-hidden>
        <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
      </svg>
    ),
    title: "Role assignment in seconds",
    description: "Shuffle, assign, and reveal roles with calm, consistent pacing.",
  },
  {
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-sky-400" aria-hidden>
        <path
          fillRule="evenodd"
          d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h8a1 1 0 110 2H4a1 1 0 01-1-1z"
          clipRule="evenodd"
        />
      </svg>
    ),
    title: "Automated log timeline",
    description: "Capture every accusation, alibi, and night action without missing a beat.",
  },
];

const AuthPage = () => {
  const { login, signup, loginAsDemo } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [demoSubmitting, setDemoSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setAuthSubmitting(true);
    try {
      if (mode === "login") {
        await login(username, password);
      } else {
        await signup(username, password);
      }
      navigate("/profile", { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, "Failed to authenticate"));
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleDemoLogin = async () => {
    setError(null);
    setDemoSubmitting(true);
    try {
      await loginAsDemo();
      navigate("/profile", { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, "Failed to start demo session"));
    } finally {
      setDemoSubmitting(false);
    }
  };

  const [watchCode, setWatchCode] = useState("");

  const handleWatch = (e: FormEvent) => {
    e.preventDefault();
    const code = watchCode.trim().toUpperCase();
    if (code) navigate(`/games/${code}/public`);
  };

  const isBusy = authSubmitting || demoSubmitting;

  return (
    <div className="relative flex min-h-screen overflow-hidden">
      <BlobBackground />

      {/* ── Left: form panel ── */}
      <div className="relative flex flex-1 flex-col justify-between px-6 py-14 lg:w-1/2">
        {/* Brand — top left */}
        <div className="flex items-center">
          <img src={logoImage} alt="MafiaDesk" className="h-7 w-auto" draggable={false} />
        </div>

        {/* Centered form */}
        <div className="flex flex-1 flex-col items-center justify-center">
        <div className="w-full max-w-sm">
          <div className="mb-8 space-y-1">
            <h2 className="text-2xl font-semibold text-white">
              {mode === "login" ? "Welcome back" : "Create your account"}
            </h2>
            <p className="text-sm text-slate-400">
              {mode === "login" ? "Sign in to continue to MafiaDesk." : "Set up your host account in seconds."}
            </p>
          </div>

          {/* Mode toggle */}
          <div className="mb-6 grid grid-cols-2 gap-1.5 rounded-full bg-slate-800/80 p-1">
            <button
              className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
                mode === "login" ? "bg-white text-slate-900 shadow" : "text-slate-400 hover:text-white"
              }`}
              onClick={() => { setMode("login"); setError(null); }}
              disabled={isBusy}
              type="button"
            >
              Login
            </button>
            <button
              className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
                mode === "signup" ? "bg-white text-slate-900 shadow" : "text-slate-400 hover:text-white"
              }`}
              onClick={() => { setMode("signup"); setError(null); }}
              disabled={isBusy}
              type="button"
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-slate-300">Username</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-xl border border-slate-700/80 bg-slate-800/60 px-4 py-3 text-slate-100 placeholder-slate-600 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                placeholder="Your username"
                required
                disabled={isBusy}
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-slate-300">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-700/80 bg-slate-800/60 px-4 py-3 text-slate-100 placeholder-slate-600 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                placeholder="At least 6 characters"
                required
                minLength={6}
                disabled={isBusy}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </label>

            {error && <p className="text-sm text-rose-400">{error}</p>}

            <button
              type="submit"
              className="mt-1 flex w-full items-center justify-center rounded-xl bg-sky-500 px-4 py-3 font-semibold text-slate-900 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isBusy}
            >
              {authSubmitting
                ? mode === "login"
                  ? "Logging in…"
                  : "Creating account…"
                : mode === "login"
                  ? "Login"
                  : "Create Account"}
            </button>
          </form>

          <div className="mt-5 space-y-4">
            <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
              <span className="h-px flex-1 bg-slate-800" aria-hidden />
              <span>Or</span>
              <span className="h-px flex-1 bg-slate-800" aria-hidden />
            </div>
            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={isBusy}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-sky-400/30 bg-sky-500/5 px-4 py-3 text-sm font-semibold text-sky-200 transition hover:border-sky-300/60 hover:bg-sky-500/10 hover:text-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {demoSubmitting ? "Preparing demo…" : "Try a Demo Login"}
            </button>
            <p className="text-center text-xs text-slate-600">
              Explore MafiaDesk with a ready-made roster. Resets every 24 hours.
            </p>

            {/* Watch a game — guest access */}
            <div className="flex items-center gap-3 pt-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
              <span className="h-px flex-1 bg-slate-800" aria-hidden />
              <span>Watch a game</span>
              <span className="h-px flex-1 bg-slate-800" aria-hidden />
            </div>
            <form onSubmit={handleWatch} className="flex gap-2">
              <input
                value={watchCode}
                onChange={(e) => setWatchCode(e.target.value)}
                placeholder="Game code e.g. 9D3XSQ"
                maxLength={12}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                className="min-w-0 flex-1 rounded-xl border border-slate-700/80 bg-slate-800/60 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/20"
              />
              <button
                type="submit"
                disabled={!watchCode.trim()}
                className="shrink-0 rounded-xl border border-slate-700/60 bg-slate-800/60 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Watch →
              </button>
            </form>
          </div>
        </div>
        </div>

        {/* Copyright — bottom left */}
        <p className="text-xs text-slate-600">© 2026 MafiaDesk. All rights reserved.</p>
      </div>

      {/* ── Right: brand panel ── */}
      <div className="relative hidden flex-col justify-center px-12 py-14 lg:flex lg:w-1/2">

        {/* Hero copy */}
        <div className="relative space-y-8">
          <div className="space-y-4">
            <h1 className="text-5xl font-semibold leading-tight text-white">
              Your Mafia game,
              <br />
              organized.
            </h1>
            <p className="max-w-sm text-base leading-relaxed text-slate-400">
              Run unforgettable Mafia nights without juggling notes or losing the thread. Keep the
              tension high and the chaos fun.
            </p>
          </div>

          <ul className="space-y-5">
            {features.map(({ icon, title, description }) => (
              <li key={title} className="flex items-start gap-4">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-sky-400/20 bg-sky-500/10">
                  {icon}
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="mt-0.5 text-sm text-slate-400">{description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

      </div>
    </div>
  );
};

export default AuthPage;
