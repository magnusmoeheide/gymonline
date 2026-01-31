// src/routes/RequireAuth.jsx
import { Navigate, useLocation, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function RequireAuth({ children }) {
  const { authUser, loading } = useAuth();
  const loc = useLocation();
  const params = useParams();
  const slug = params?.slug ? String(params.slug) : "";
  const tenantLogin = slug ? `/${slug}/login` : "/login";

  if (loading) return <div style={{ padding: 24 }}>Loading…</div>;

  // safety: if someone accidentally wraps /login with RequireAuth, don't loop
  if (!authUser && !loc.pathname.startsWith("/login")) {
    return <Navigate to={tenantLogin} replace state={{ from: loc.pathname }} />;
  }

  return children;
}
