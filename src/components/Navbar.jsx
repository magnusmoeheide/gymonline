// src/components/Navbar.jsx
import { memo, useCallback, useMemo } from "react";
import { NavLink, useNavigate, useParams } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase/auth";
import { useAuth } from "../context/AuthContext";

function normPath(p) {
  const s = String(p || "").trim();
  if (!s) return "";
  return s.startsWith("/") ? s : `/${s}`;
}

function join(basePath, p) {
  const b = normPath(basePath);
  const path = normPath(p);
  if (!b) return path || "/";
  if (!path) return b;
  if (path === "/") return b;
  return `${b}${path}`;
}

const MEMBER_LINKS = [
  { to: "/app", label: "Dashboard", end: true },
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

const SUPERADMIN_LINKS = [{ to: "/superadmin", label: "Gyms", end: true }];

function Navbar({ mode = "member" }) {
  const nav = useNavigate();
  const params = useParams(); // will include slug on /g/:slug/*
  const slug = params?.slug ? String(params.slug) : "";
  const basePath = slug ? `/g/${slug}` : "";

  const { userDoc, stopSimulation, isSimulated, realUserDoc } = useAuth();

  const links = useMemo(() => {
    if (mode === "superadmin") return SUPERADMIN_LINKS;

    const raw = mode === "admin" ? ADMIN_LINKS : MEMBER_LINKS;

    // If there is NO slug in the URL, don't prefix anything (superadmin/global pages)
    if (!basePath) return raw;

    // Prefix tenant basePath so links work under /g/:slug/*
    return raw.map((l) => ({
      ...l,
      to: join(basePath, l.to),
    }));
  }, [mode, basePath]);

  const handleLogout = useCallback(async () => {
    stopSimulation();
    await signOut(auth);
    nav(basePath ? `${basePath}/login` : "/login");
  }, [nav, stopSimulation, basePath]);

  const exitSim = useCallback(() => {
    stopSimulation();
    if (realUserDoc?.role === "SUPER_ADMIN") {
      nav("/superadmin");
      return;
    }
    // if we're in a tenant route, go back to that tenant admin home
    nav(basePath ? `${basePath}/admin` : "/login");
  }, [nav, stopSimulation, realUserDoc, basePath]);

  const name = userDoc?.name || "";
  const role = userDoc?.role || "";

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
          {mode === "superadmin" ? "Super Admin" : "Gym"} Intranet
        </div>
        <div style={{ fontSize: 12, opacity: 0.65 }}>
          {isSimulated ? (
            <>
              Simulating: <b>{name || "user"}</b>
            </>
          ) : (
            <>User: {name}</>
          )}
        </div>
        {role ? (
          <div style={{ fontSize: 12, opacity: 0.65 }}>
            Role: <b>{role}</b>
          </div>
        ) : null}
      </div>

      <nav style={{ display: "grid", gap: 6, marginTop: 10 }}>
        {links.map((l) => (
          <NavLink
            key={`${l.to}-${l.label}`}
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
          {mode === "admin"
            ? "Admin"
            : mode === "superadmin"
            ? "Superadmin"
            : "Member"}{" "}
          view
        </div>
      </div>
    </aside>
  );
}

export default memo(Navbar);
