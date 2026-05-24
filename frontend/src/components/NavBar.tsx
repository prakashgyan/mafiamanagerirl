import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import logoImage from "../assets/logo.png";

const NAV_LINKS = [
  { to: "/profile", label: "Profile", icon: "👤" },
  { to: "/games/history", label: "History", icon: "📋" },
  { to: "/friends", label: "Friends", icon: "👥" },
];

const NavBar = () => {
  const { pathname } = useLocation();
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <nav className="sticky top-0 z-50 border-b border-white/5 bg-transparent backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-3">
        {/* Logo — same image as login page */}
        <Link to="/profile" className="shrink-0">
          <img src={logoImage} alt="MafiaDesk" className="h-7 w-auto" draggable={false} />
        </Link>

        {/* Nav links */}
        <ul className="flex flex-1 items-center gap-1">
          {NAV_LINKS.map(({ to, label, icon }) => {
            const isActive = pathname === to || (to !== "/profile" && pathname.startsWith(to));
            return (
              <li key={to}>
                <Link
                  to={to}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                    isActive
                      ? "border border-sky-400/40 bg-sky-500/20 text-sky-200"
                      : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <span aria-hidden>{icon}</span>
                  <span className="hidden sm:inline">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Action buttons — same row as nav */}
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => navigate("/games/new")}
            className="rounded-xl bg-sky-500 px-4 py-2 text-xs font-semibold text-slate-900 shadow-lg shadow-sky-500/30 transition hover:bg-sky-400"
          >
            + New Game
          </button>
          <button
            onClick={() => logout()}
            className="rounded-xl border border-slate-700/60 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
};

export default NavBar;
