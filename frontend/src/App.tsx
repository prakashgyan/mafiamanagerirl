import { Component, ErrorInfo, ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import { useAuth } from "./context/AuthContext";
import BlobBackground from "./components/BlobBackground";
import AssignRolesPage from "./pages/AssignRolesPage";
import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import GameOverPage from "./pages/GameOverPage";
import GameHistoryPage from "./pages/GameHistoryPage";
import NewGamePage from "./pages/NewGamePage";
import ProfileHomePage from "./pages/ProfileHomePage";
import PublicViewPage from "./pages/PublicViewPage";
import FriendsPage from "./pages/FriendsPage";
import SupportPage from "./pages/SupportPage";
import NavBar from "./components/NavBar";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled render error:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 text-slate-100">
          <p className="text-2xl font-semibold text-rose-300">Something went wrong</p>
          <p className="text-sm text-slate-400">{(this.state.error as Error).message}</p>
          <button
            onClick={() => { this.setState({ error: null }); window.location.reload(); }}
            className="rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-sky-400"
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const RequireAuth = ({ children }: { children: JSX.Element }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900 text-slate-100">
        Loading...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  return (
    <>
      <BlobBackground />
      <NavBar />
      {children}
    </>
  );
};

const App = () => {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/profile" replace /> : <AuthPage />} />
      <Route
        path="/profile"
        element={
          <RequireAuth>
            <ProfileHomePage />
          </RequireAuth>
        }
      />
      <Route
        path="/games/history"
        element={
          <RequireAuth>
            <GameHistoryPage />
          </RequireAuth>
        }
      />
      <Route
        path="/games/new"
        element={
          <RequireAuth>
            <NewGamePage />
          </RequireAuth>
        }
      />
      <Route
        path="/friends"
        element={
          <RequireAuth>
            <FriendsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/games/:gameId/assign"
        element={
          <RequireAuth>
            <AssignRolesPage />
          </RequireAuth>
        }
      />
      <Route
        path="/games/:gameId/manage"
        element={
          <RequireAuth>
            <DashboardPage />
          </RequireAuth>
        }
      />
      {/* Public view is intentionally unauthenticated — shareable with players/observers */}
      <Route path="/games/:gameId/public" element={<PublicViewPage />} />
      <Route
        path="/games/:gameId/over"
        element={
          <RequireAuth>
            <GameOverPage />
          </RequireAuth>
        }
      />
      <Route
        path="/support"
        element={
          <RequireAuth>
            <SupportPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;

export { ErrorBoundary };
