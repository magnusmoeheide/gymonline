// src/pages/public/Login.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../firebase/auth";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import useGymSlug from "../../hooks/useGymSlug";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { getApp } from "firebase/app";

export default function Login() {
  const nav = useNavigate();
  const { userDoc, realUserDoc, loading: authLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const {
    slug,
    basePath,
    gymId: slugGymId,
    exists,
    loading: slugLoading,
    error,
  } = useGymSlug();

  const db = useMemo(() => {
    const app = getApp();
    return getFirestore(app, "gymonline-db");
  }, []);

  // Gym picker (only when NOT inside /g/<slug>)
  const [gymsLoading, setGymsLoading] = useState(false);
  const [gyms, setGyms] = useState([]); // { id, name, slug }
  const [selectedGymId, setSelectedGymId] = useState("");

  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Load gyms for picker (only when no slug)
  useEffect(() => {
    if (slug) return;

    (async () => {
      setGymsLoading(true);
      setErr("");

      try {
        const gymsSnap = await getDocs(collection(db, "gymsPublic"));

        const rows = gymsSnap.docs
          .map((d) => {
            const data = d.data() || {};
            return {
              id: d.id,
              name: data?.name || data?.gymName || d.id,
              slug: data?.slug || data?.subdomain || "",
            };
          })
          .filter((x) => x.slug) // need slug to enter /g/<slug>
          .sort((a, b) => String(a.name).localeCompare(String(b.name)));

        if (!mountedRef.current) return;

        setGyms(rows);
        setSelectedGymId((prev) =>
          prev && rows.some((g) => g.id === prev) ? prev : ""
        );
      } catch (e) {
        if (!mountedRef.current) return;
        setErr(`Failed to load gyms: ${e?.message || String(e)}`);
      } finally {
        if (mountedRef.current) setGymsLoading(false);
      }
    })();
  }, [db, slug]);

  // After login, route inside the tenant basePath
  useEffect(() => {
    if (!userDoc || !realUserDoc) return;

    // Superadmin can stay on root pages
    if (realUserDoc?.role === "SUPER_ADMIN") {
      nav("/superadmin");
      return;
    }

    // Tenant pages must have a slug (path-based)
    if (!slug) {
      setErr(
        "Open your gym link first (e.g. /g/<slug>) or select a gym below."
      );
      return;
    }

    // Validate slug -> gymId matches user
    if (slugGymId && userDoc.gymId !== slugGymId) {
      alert("You are trying to log into the wrong gym.");
      return;
    }

    if (["GYM_ADMIN", "STAFF"].includes(userDoc.role)) nav(`${basePath}/admin`);
    else nav(`${basePath}/app`);
  }, [userDoc, realUserDoc, nav, slug, slugGymId, basePath]);

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");

    if (!slug) {
      setErr("Select a gym first (or open /g/<slug>).");
      return;
    }

    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (e2) {
      setErr(e2?.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  function enterSelectedGym() {
    const gym = gyms.find((g) => g.id === selectedGymId);
    if (!gym?.slug) return;
    window.location.assign(`/g/${gym.slug}/login`);
  }

  const joinHref = slug ? `${basePath}/join` : "/join";

  // --- UI below unchanged except:
  // 1) show picker when !slug
  // 2) add "Enter gym" button that navigates to /g/<slug>/login

  // (keep your styles as-is)
  // ...
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#fff",
          borderRadius: 12,
          padding: 24,
          border: "1px solid #eee",
        }}
      >
        <h2 style={{ margin: 0 }}>GymOnline</h2>

        {!slug ? (
          <div
            style={{ marginTop: 12, marginBottom: 14, display: "grid", gap: 8 }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, opacity: 0.85 }}>
              Enter gym
            </div>

            <select
              value={selectedGymId}
              onChange={(e) => setSelectedGymId(e.target.value)}
              disabled={gymsLoading}
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #e6e9f0",
              }}
            >
              <option value="">
                {gymsLoading ? "Loading gyms…" : "Select a gym"}
              </option>
              {gyms.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              disabled={!selectedGymId || gymsLoading}
              onClick={enterSelectedGym}
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #e6e9f0",
                background: "#fff",
                cursor: "pointer",
              }}
            >
              Continue
            </button>

            {!gymsLoading && gyms.length === 0 ? (
              <div style={{ fontSize: 13, opacity: 0.75 }}>
                No gyms found in <code>gymsPublic</code> (or missing slug).
              </div>
            ) : null}
          </div>
        ) : (
          <div style={{ opacity: 0.7, marginTop: 10, marginBottom: 14 }}>
            Gym: <b>{slug}</b>
          </div>
        )}

        {slug && !exists ? (
          <div style={{ marginTop: 12 }}>
            Gym <b>{slug}</b> is not registered. Create{" "}
            <code>slugs/{slug}</code> → <code>{`{ gymId }`}</code>.
          </div>
        ) : null}

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
          <input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid #e6e9f0",
            }}
            autoComplete="username"
          />
          <input
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid #e6e9f0",
            }}
            autoComplete="current-password"
          />
          <button
            disabled={busy}
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              border: "none",
              background: "#2563eb",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
              opacity: busy ? 0.7 : 1,
            }}
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {err ? (
          <div style={{ color: "crimson", marginTop: 10 }}>{err}</div>
        ) : null}

        <div style={{ marginTop: 16, fontSize: 14 }}>
          New gym/member? <a href={joinHref}>Join this gym</a>
        </div>
      </div>
    </div>
  );
}
