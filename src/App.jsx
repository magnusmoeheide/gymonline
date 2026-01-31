import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import PublicRoutes from "./app/routes/PublicRoutes";
import MemberRoutes from "./app/routes/MemberRoutes";
import AdminRoutes from "./app/routes/AdminRoutes";
import SuperAdminRoutes from "./app/routes/SuperAdminRoutes";
import NotFound from "./pages/public/NotFound";
import Landing from "./pages/public/Landing";
import CreateGym from "./pages/public/CreateGym";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Superadmin (global, no tenant) */}
        <Route path="/superadmin/*" element={<SuperAdminRoutes />} />

        {/* Main landing */}
        <Route path="/" element={<Landing />} />

        {/* Global public (login, create, etc) */}
        <Route path="/create/*" element={<CreateGym />} />
        <Route path="/join/*" element={<Navigate to="/create" replace />} />
        <Route path="/login/*" element={<PublicRoutes />} />

        {/* Tenant-aware */}
        <Route path="/:slug/admin/*" element={<AdminRoutes />} />
        <Route path="/:slug/app/*" element={<MemberRoutes />} />
        <Route path="/:slug/*" element={<PublicRoutes />} />

        {/* Legacy paths → force login */}
        <Route path="/admin/*" element={<Navigate to="/login" replace />} />
        <Route path="/app/*" element={<Navigate to="/login" replace />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
