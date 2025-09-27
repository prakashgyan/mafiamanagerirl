import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import { useAuth } from "./context/AuthContext";
import AssignRolesPage from "./pages/AssignRolesPage";
import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import GameOverPage from "./pages/GameOverPage";
import GameHistoryPage from "./pages/GameHistoryPage";
import NewGamePage from "./pages/NewGamePage";
import ProfileHomePage from "./pages/ProfileHomePage";
import PublicViewPage from "./pages/PublicViewPage";
import FriendsPage from "./pages/FriendsPage";

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

  return children;
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
      <Route
        path="/games/:gameId/public"
        element={
          <RequireAuth>
            <PublicViewPage />
          </RequireAuth>
        }
      />
      <Route
        path="/games/:gameId/over"
        element={
          <RequireAuth>
            <GameOverPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
