import { useEffect, useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../firebase/auth";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getGymSlug } from "../../app/utils/getGymSlug";
import useGymSlug from "../../hooks/useGymSlug";

export default function Login() {
  const nav = useNavigate();
  const { userDoc, realUserDoc, loading: authLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const {
    slug,
    gymId: slugGymId,
    exists,
    loading: slugLoading,
    error,
  } = useGymSlug();

  const pageStyle = {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    background: "linear-gradient(180deg,#f6f9ff 0%,#ffffff 60%)",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
  };

  const cardStyle = {
    width: "100%",
    maxWidth: 420,
    background: "#ffffff",
    borderRadius: 12,
    boxShadow: "0 8px 30px rgba(16,24,40,0.08)",
    padding: 24,
    boxSizing: "border-box",
  };

  const inputStyle = {
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #e6e9f0",
    outline: "none",
    fontSize: 15,
    boxSizing: "border-box",
    width: "100%",
  };

  const buttonStyle = {
    padding: "10px 12px",
    borderRadius: 8,
    border: "none",
    background: "#2563eb",
    color: "white",
    fontWeight: 600,
    fontSize: 15,
    cursor: "pointer",
  };

  useEffect(() => {
    if (!userDoc || !realUserDoc) return;

    // Superadmins can log in without subdomain (to access global admin features)
    if (realUserDoc?.role !== "SUPER_ADMIN") {
      if (!slug) {
        // Non-superadmins need a valid subdomain
        alert("Please access the app via your gym's subdomain.");
        return;
      }
      if (slugGymId && userDoc.gymId !== slugGymId) {
        alert("You are trying to log into the wrong gym subdomain.");
        return;
      }
    }

    if (realUserDoc?.role === "SUPER_ADMIN") nav("/superadmin");
    else if (["GYM_ADMIN", "STAFF"].includes(userDoc.role)) nav("/admin");
    else nav("/app");
  }, [userDoc, realUserDoc, nav, slug, slugGymId]);

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (e2) {
      setErr(e2?.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  if (slugLoading) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <h2 style={{ margin: 0 }}>GymOnline</h2>
          <div style={{ marginTop: 12 }}>Checking gym…</div>
        </div>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <h2 style={{ margin: 0 }}>GymOnline</h2>
          <div style={{ marginTop: 12 }}>Checking authentication…</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <h2 style={{ margin: 0 }}>GymOnline</h2>
          <p style={{ color: "crimson", marginTop: 12 }}>
            Failed to check gym slug: {String(error?.message || error)}
          </p>
          <p style={{ opacity: 0.8 }}>
            Open DevTools → Console for the full error.
          </p>
        </div>
      </div>
    );
  }

  // src/pages/public/Login.jsx  (change the "not registered" check)
  if (slug && !exists) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <h2 style={{ margin: 0 }}>GymOnline</h2>
          <p style={{ marginTop: 12 }}>
            Gym subdomain <b>{slug}</b> is not registered.
          </p>
          <p style={{ opacity: 0.8 }}>
            Create <code>slugs/{slug}</code> → <code>{`{ gymId }`}</code> in
            Firestore.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <h2 style={{ margin: 0 }}>GymOnline</h2>
        <div style={{ opacity: 0.7, marginTop: 10, marginBottom: 14 }}>
          {slug ? (
            <>
              Gym: <b>{slug}</b>
            </>
          ) : (
            <>Local dev (no subdomain)</>
          )}
        </div>

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
          <input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
            autoComplete="username"
          />
          <input
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
            autoComplete="current-password"
          />
          <button
            disabled={busy}
            style={{ ...buttonStyle, opacity: busy ? 0.7 : 1 }}
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {err ? (
          <div style={{ color: "crimson", marginTop: 10 }}>{err}</div>
        ) : null}

        <div style={{ marginTop: 16, fontSize: 14 }}>
          New gym/member? <a href="/join">Join this gym</a>
        </div>
      </div>
    </div>
  );
}
