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
  { to: "/app", label: "Dashboard", end: true, icon: "fa-solid fa-house" },
  { to: "/app/membership", label: "Membership", icon: "fa-solid fa-id-card" },
  { to: "/app/orders", label: "Orders", icon: "fa-solid fa-receipt" },
  { to: "/app/store", label: "Store", icon: "fa-solid fa-cart-shopping" },
  { to: "/app/profile", label: "Profile", icon: "fa-solid fa-user" },
];

const ADMIN_LINKS = [
  { to: "/admin", label: "Overview", end: true, icon: "fa-solid fa-chart-line" },
  { to: "/admin/members", label: "Members", icon: "fa-solid fa-users" },
  { to: "/admin/subscriptions", label: "Subscriptions", icon: "fa-solid fa-clipboard-list" },
  { to: "/admin/revenue", label: "Revenue", icon: "fa-solid fa-coins" },
  { to: "/admin/orders", label: "Orders", icon: "fa-solid fa-receipt" },
  { to: "/admin/website", label: "Website", icon: "fa-solid fa-globe" },
  { to: "/admin/communication", label: "Communication", icon: "fa-solid fa-message" },
  { to: "/admin/plans", label: "Plans", icon: "fa-solid fa-calendar-check" },
  { to: "/admin/products", label: "Products", icon: "fa-solid fa-box-open" },
  { to: "/admin/balance", label: "Balance", icon: "fa-solid fa-wallet" },
  { to: "/admin/settings", label: "Settings", icon: "fa-solid fa-gear" },
];

const SUPERADMIN_LINKS = [
  { to: "/superadmin", label: "Gyms", end: true, icon: "fa-solid fa-dumbbell" },
  { to: "/superadmin/balance", label: "Balance", icon: "fa-solid fa-wallet" },
  { to: "/superadmin/rates", label: "Rates", icon: "fa-solid fa-tag" },
  { to: "/superadmin/settings", label: "Settings", icon: "fa-solid fa-gear" },
];

function Navbar({ mode = "member" }) {
  const nav = useNavigate();
  const params = useParams(); // will include slug on /:slug/*
  const slug = params?.slug ? String(params.slug) : "";
  const basePath = slug ? `/${slug}` : "";

  const { userDoc, stopSimulation, isSimulated, realUserDoc, gymName } = useAuth();

  const links = useMemo(() => {
    if (mode === "superadmin") return SUPERADMIN_LINKS;

    const raw = mode === "admin" ? ADMIN_LINKS : MEMBER_LINKS;

    // If there is NO slug in the URL, don't prefix anything (superadmin/global pages)
    if (!basePath) return raw;

    // Prefix tenant basePath so links work under /:slug/*
    return raw.map((l) => ({
      ...l,
      to: join(basePath, l.to),
    }));
  }, [mode, basePath]);

  const handleLogout = useCallback(async () => {
    stopSimulation();
    signOut(auth).catch(() => {});
    window.location.replace("/");
  }, [stopSimulation]);

  const exitSim = useCallback(() => {
    stopSimulation();
    if (realUserDoc?.role === "SUPER_ADMIN") {
      nav("/superadmin");
      return;
    }
    // if we're in a tenant route, go back to that tenant admin home
    nav(basePath ? `${basePath}/admin` : "/login");
  }, [nav, stopSimulation, realUserDoc, basePath]);

  const name =
    userDoc?.name ||
    userDoc?.fullName ||
    userDoc?.displayName ||
    auth?.currentUser?.displayName ||
    auth?.currentUser?.email ||
    "";
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
          {mode === "superadmin" ? "Super Admin" : gymName || "Gym"}
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
            <i
              className={l.icon}
              aria-hidden="true"
              style={{ width: 16, textAlign: "center", marginRight: 12 }}
            />
            <span>{l.label}</span>
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
