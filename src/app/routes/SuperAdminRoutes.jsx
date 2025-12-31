import { Routes, Route } from "react-router-dom";
import RequireAuth from "../guards/RequireAuth";
import RequireRole from "../guards/RequireRole";
import Layout from "../../components/Layout";
import Gyms from "../../pages/superadmin/Gyms";

export default function SuperAdminRoutes() {
  return (
    <RequireAuth>
      <RequireRole allow={["SUPER_ADMIN"]}>
        <Layout mode="superadmin">
          <Routes>
            <Route index element={<Gyms />} />
          </Routes>
        </Layout>
      </RequireRole>
    </RequireAuth>
  );
}
