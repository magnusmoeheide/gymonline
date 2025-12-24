import { BrowserRouter, Routes, Route } from "react-router-dom";
import PublicRoutes from "./app/routes/PublicRoutes";
import MemberRoutes from "./app/routes/MemberRoutes";
import AdminRoutes from "./app/routes/AdminRoutes";
import NotFound from "./pages/public/NotFound";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/*" element={<PublicRoutes />} />
        <Route path="/app/*" element={<MemberRoutes />} />
        <Route path="/admin/*" element={<AdminRoutes />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
