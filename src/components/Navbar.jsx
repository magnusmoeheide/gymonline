// src/components/Navbar.jsx (or wherever your sidebar navbar is)
import { memo, useCallback, useMemo } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase/auth";
import { useAuth } from "../context/AuthContext";

const MEMBER_LINKS = [
  { to: "/app", label: "Dashboard" },
  { to: "/app/membership", label: "Membership" },
  { to: "/app/orders", label: "Orders" },
  { to: "/app/store", label: "Store" },
  { to: "/app/profile", label: "Profile" },
];

const ADMIN_LINKS = [
  { to: "/admin", label: "Overview", end: true },
  { to: "/admin/members", label: "Members" },
  { to: "/admin/subscriptions", label: "Subscriptions" },
  { to: "/admin/orders", label: "Orders" },
  { to: "/admin/plans", label: "Plans" },
  { to: "/admin/products", label: "Products" },
  { to: "/admin/settings", label: "Settings" },
];

function Navbar({ mode = "member" }) {
  const nav = useNavigate();
  const { userDoc, gymName, stopSimulation, isSimulated, realUserDoc } =
    useAuth();

  const links = useMemo(
    () => (mode === "admin" ? ADMIN_LINKS : MEMBER_LINKS),
    [mode]
  );

  const handleLogout = useCallback(async () => {
    stopSimulation();
    await signOut(auth);
    nav("/login");
  }, [nav, stopSimulation]);

  const exitSim = useCallback(() => {
    stopSimulation();
    nav("/admin"); // go back to admin overview
  }, [nav, stopSimulation]);

  const name = userDoc?.name || "";
  const role = userDoc?.role || "";
  const realRole = realUserDoc?.role || "";

  return (
    <aside
      style={{
        width: 240,
        minWidth: 240,
        borderRight: "1px solid #eee",
        background: "#fff",
        display: "flex",
        flexDirection: "column",
        padding: 16,
        gap: 12,
        position: "sticky",
        top: 0,
        height: "100vh",
        overflow: "auto",
      }}
    >
      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ fontWeight: 800, letterSpacing: 0.2 }}>
          {gymName || "Gym"} Intranet
        </div>
        <div style={{ fontSize: 12, opacity: 0.65 }}>
          {!isSimulated && <>User: {name}</>}
        </div>
        <div style={{ fontSize: 12, opacity: 0.65 }}>
          {isSimulated ? (
            <>
              Simulating: <b>{name || "user"}</b> <br />
              Role: <b>{role || "undefined"}</b>
            </>
          ) : role ? (
            <>Role: {role}</>
          ) : null}
        </div>
      </div>

      <nav style={{ display: "grid", gap: 6, marginTop: 10 }}>
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            style={({ isActive }) => ({
              display: "flex",
              alignItems: "center",
              padding: "10px 12px",
              borderRadius: 10,
              textDecoration: "none",
              color: isActive ? "#111" : "#444",
              background: isActive ? "#f3f4f6" : "transparent",
              border: "1px solid",
              borderColor: isActive ? "#e5e7eb" : "transparent",
              fontWeight: isActive ? 650 : 500,
            })}
          >
            {l.label}
          </NavLink>
        ))}
      </nav>

      <div style={{ marginTop: "auto", display: "grid", gap: 10 }}>
        {isSimulated ? (
          <button
            onClick={exitSim}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #eee",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            Exit simulation
          </button>
        ) : null}

        <button
          onClick={handleLogout}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #eee",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          Log out
        </button>

        <div style={{ fontSize: 12, opacity: 0.55 }}>
          {mode === "admin" ? "Admin" : "Member"} view
        </div>
      </div>
    </aside>
  );
}

export default memo(Navbar);
