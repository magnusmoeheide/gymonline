import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import PublicRoutes from "./app/routes/PublicRoutes";
import MemberRoutes from "./app/routes/MemberRoutes";
import AdminRoutes from "./app/routes/AdminRoutes";
import SuperAdminRoutes from "./app/routes/SuperAdminRoutes";
import NotFound from "./pages/public/NotFound";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Superadmin (global, no tenant) */}
        <Route path="/superadmin/*" element={<SuperAdminRoutes />} />

        {/* Tenant-aware */}
        <Route path="/g/:slug/admin/*" element={<AdminRoutes />} />
        <Route path="/g/:slug/app/*" element={<MemberRoutes />} />
        <Route path="/g/:slug/*" element={<PublicRoutes />} />

        {/* Global public (login, join, etc) */}
        <Route path="/login/*" element={<PublicRoutes />} />
        <Route path="/*" element={<PublicRoutes />} />

        {/* Legacy paths → force login */}
        <Route path="/admin/*" element={<Navigate to="/login" replace />} />
        <Route path="/app/*" element={<Navigate to="/login" replace />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
