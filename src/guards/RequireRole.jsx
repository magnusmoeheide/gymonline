import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Loading from "../../components/Loading";

export default function RequireRole({ roles, children }) {
  const { userDoc, loading } = useAuth();

  if (loading) return <Loading />;
  if (!userDoc) return <Navigate to="/login" replace />;
  if (!roles.includes(userDoc.role)) return <Navigate to="/app" replace />;

  return children;
}
