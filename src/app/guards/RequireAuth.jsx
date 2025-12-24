// src/routes/RequireAuth.jsx
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function RequireAuth({ children }) {
  const { authUser, loading } = useAuth();
  const loc = useLocation();

  if (loading) return <div style={{ padding: 24 }}>Loading…</div>;

  // safety: if someone accidentally wraps /login with RequireAuth, don't loop
  if (!authUser && loc.pathname !== "/login") {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }

  return children;
}
