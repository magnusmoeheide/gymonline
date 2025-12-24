import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Loading from "../../components/Loading";

export default function RequireRole({ allow = [], children }) {
  const { userDoc, loading } = useAuth();

  if (loading) return <Loading />;

  if (!userDoc) return <Navigate to="/login" replace />;

  const role = userDoc.role;
  if (!allow.includes(role)) return <Navigate to="/app" replace />;

  return children;
}
