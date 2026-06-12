import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import logoImage from "../assets/logo.png";

const MENU_ITEMS = [
  { to: "/profile", label: "Profile", icon: "👤" },
  { to: "/games/history", label: "History", icon: "📋" },
  { to: "/friends", label: "Players", icon: "👥" },
  { to: "/support", label: "Support", icon: "❤️" },
];

const NavBar = () => {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const initials = user?.username?.slice(0, 2).toUpperCase() ?? "??";

  return (
    <nav className="sticky top-0 z-50 border-b border-white/5 bg-transparent backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center px-6 py-3">
        {/* Logo */}
        <Link to="/profile" className="shrink-0">
          <img src={logoImage} alt="MafiaDesk" className="h-7 w-auto" draggable={false} />
        </Link>

        <div className="flex flex-1" />

        {/* Right side: Bug report + Avatar */}
        <div className="flex shrink-0 items-center gap-3">
          <a
            href="https://www.patreon.com/mafiadesk"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-[#f96854]/30 bg-[#f96854]/10 px-3 py-1.5 text-xs text-[#f96854] transition hover:border-[#f96854]/50 hover:bg-[#f96854]/15"
          >
            <span aria-hidden>🐛</span>
            Report issue
          </a>
          {/* Avatar button */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setOpen((v) => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-slate-200 ring-2 ring-transparent transition hover:ring-sky-500/60"
              aria-label="User menu"
              aria-expanded={open}
            >
              {initials}
            </button>

            {/* Dropdown */}
            {open && (
              <div className="absolute right-0 mt-2 w-44 origin-top-right rounded-xl border border-white/10 bg-slate-900 py-1 shadow-xl shadow-black/40">
                {user && (
                  <p className="truncate border-b border-white/10 px-4 py-2 text-xs text-slate-400">
                    @{user.username}
                  </p>
                )}
                {MENU_ITEMS.map(({ to, label, icon }) => (
                  <Link
                    key={to}
                    to={to}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-800 hover:text-white"
                  >
                    <span aria-hidden>{icon}</span>
                    {label}
                  </Link>
                ))}
                <div className="my-1 border-t border-white/10" />
                <button
                  onClick={() => { setOpen(false); void logout(); }}
                  className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-red-400 transition hover:bg-slate-800 hover:text-red-300"
                >
                  <span aria-hidden>🚪</span>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default NavBar;
