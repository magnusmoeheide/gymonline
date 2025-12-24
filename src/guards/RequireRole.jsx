import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function RequireRole({ roles, children }) {
  const { userDoc, loading } = useAuth();

  if (loading) return <div style={{ padding: 24 }}>Loading…</div>;
  if (!userDoc) return <Navigate to="/login" replace />;
  if (!roles.includes(userDoc.role)) return <Navigate to="/app" replace />;

  return children;
}
