import { Link, useLocation } from "react-router-dom";

const NAV_LINKS = [
  { to: "/profile", label: "Profile", icon: "👤" },
  { to: "/games/history", label: "History", icon: "📋" },
  { to: "/friends", label: "Friends", icon: "👥" },
];

const NavBar = () => {
  const { pathname } = useLocation();

  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link
          to="/profile"
          className="inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-200 transition hover:border-sky-300/60 hover:text-sky-100"
        >
          MafiaDesk
        </Link>
        <ul className="flex items-center gap-1">
          {NAV_LINKS.map(({ to, label, icon }) => {
            const isActive = pathname === to || (to !== "/profile" && pathname.startsWith(to));
            return (
              <li key={to}>
                <Link
                  to={to}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                    isActive
                      ? "bg-sky-500/20 text-sky-200 border border-sky-400/40"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <span aria-hidden>{icon}</span>
                  <span className="hidden sm:inline">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
};

export default NavBar;
