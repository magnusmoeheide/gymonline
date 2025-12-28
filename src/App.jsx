import { BrowserRouter, Routes, Route } from "react-router-dom";
import PublicRoutes from "./app/routes/PublicRoutes";
import MemberRoutes from "./app/routes/MemberRoutes";
import AdminRoutes from "./app/routes/AdminRoutes";
import SuperAdminRoutes from "./app/routes/SuperAdminRoutes";
import NotFound from "./pages/public/NotFound";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/superadmin/*" element={<SuperAdminRoutes />} />
        <Route path="/admin/*" element={<AdminRoutes />} />
        <Route path="/app/*" element={<MemberRoutes />} />
        <Route path="/*" element={<PublicRoutes />} />
      </Routes>
    </BrowserRouter>
  );
}
