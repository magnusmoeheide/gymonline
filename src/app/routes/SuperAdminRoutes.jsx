import { Routes, Route } from "react-router-dom";
import RequireAuth from "../guards/RequireAuth";
import RequireRole from "../guards/RequireRole";
import Layout from "../../components/Layout";
import Gyms from "../../pages/superadmin/Gyms";
import Balance from "../../pages/superadmin/Balance";
import Payments from "../../pages/superadmin/Payments";
import Settings from "../../pages/superadmin/Settings";

export default function SuperAdminRoutes() {
  return (
    <RequireAuth>
      <RequireRole allow={["SUPER_ADMIN"]}>
        <Layout mode="superadmin">
          <Routes>
            <Route index element={<Gyms />} />
            <Route path="balance" element={<Balance />} />
            <Route path="payments" element={<Payments />} />
            <Route path="settings" element={<Settings />} />
          </Routes>
        </Layout>
      </RequireRole>
    </RequireAuth>
  );
}
