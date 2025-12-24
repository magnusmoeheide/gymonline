import { Routes, Route } from "react-router-dom";
import RequireAuth from "../guards/RequireAuth";
import Layout from "../../components/Layout";
import Dashboard from "../../pages/member/Dashboard";
import Membership from "../../pages/member/Membership";
import Store from "../../pages/member/Store";
import Orders from "../../pages/member/Orders";
import Profile from "../../pages/member/Profile";

export default function MemberRoutes() {
  return (
    <RequireAuth>
      <Layout mode="member">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/membership" element={<Membership />} />
          <Route path="/store" element={<Store />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </Layout>
    </RequireAuth>
  );
}
