import { Routes, Route, Navigate } from "react-router-dom";
import Login from "../../pages/public/Login";
import CreateGym from "../../pages/public/CreateGym";
import NotFound from "../../pages/public/NotFound";

export default function PublicRoutes() {
  return (
    <Routes>
      <Route index element={<Login />} />
      <Route path="login" element={<Login />} />
      <Route path="create" element={<CreateGym />} />
      <Route path="join" element={<Navigate to="create" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
