import { Routes, Route, Navigate } from "react-router-dom";
import Login from "../../pages/public/Login";
import JoinGym from "../../pages/public/JoinGym";
import NotFound from "../../pages/public/NotFound";

export default function PublicRoutes() {
  return (
    <Routes>
      <Route index element={<Login />} />
      <Route path="login" element={<Login />} />
      <Route path="join" element={<JoinGym />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
