import { Routes, Route } from "react-router-dom";
import RequireAuth from "../guards/RequireAuth";
import RequireRole from "../guards/RequireRole";
import Layout from "../../components/Layout";
import Overview from "../../pages/admin/Overview";
import Members from "../../pages/admin/Members";
import Subscriptions from "../../pages/admin/Subscriptions";
import Plans from "../../pages/admin/Plans";
import Products from "../../pages/admin/Products";
import Orders from "../../pages/admin/Orders";
import Settings from "../../pages/admin/Settings";

export default function AdminRoutes() {
  return (
    <RequireAuth>
      <RequireRole allow={["SUPER_ADMIN", "GYM_ADMIN", "STAFF"]}>
        <Layout mode="admin">
          <Routes>
            <Route index element={<Overview />} />
            <Route path="members" element={<Members />} />
            <Route path="subscriptions" element={<Subscriptions />} />
            <Route path="plans" element={<Plans />} />
            <Route path="products" element={<Products />} />
            <Route path="orders" element={<Orders />} />
            <Route path="settings" element={<Settings />} />
          </Routes>
        </Layout>
      </RequireRole>
    </RequireAuth>
  );
}
