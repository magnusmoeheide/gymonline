import { useEffect, useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../firebase/auth";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getGymSlug } from "../../app/utils/getGymSlug";
import useGymSlug from "../../hooks/useGymSlug";

export default function Login() {
  const nav = useNavigate();
  const { userDoc } = useAuth();

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

  useEffect(() => {
    if (!userDoc) return;
    if (!slug) return;

    if (
      slugGymId &&
      userDoc.gymId !== slugGymId &&
      userDoc.role !== "SUPER_ADMIN"
    ) {
      alert("You are trying to log into the wrong gym subdomain.");
      // optional: sign out
      return;
    }

    if (["SUPER_ADMIN", "GYM_ADMIN", "STAFF"].includes(userDoc.role))
      nav("/admin");
    else nav("/app");
  }, [userDoc, nav, slug, slugGymId]);

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
      <div style={{ padding: 24, fontFamily: "system-ui" }}>
        <h2>GymOnline</h2>
        <div>Checking gym…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24, fontFamily: "system-ui", maxWidth: 700 }}>
        <h2>GymOnline</h2>
        <p style={{ color: "crimson" }}>
          Failed to check gym slug: {String(error?.message || error)}
        </p>
        <p style={{ opacity: 0.8 }}>
          Open DevTools → Console for the full error.
        </p>
      </div>
    );
  }

  if (slug && !exists) {
    return (
      <div style={{ padding: 24, fontFamily: "system-ui", maxWidth: 520 }}>
        <h2>GymOnline</h2>
        <p>
          Gym subdomain <b>{slug}</b> is not registered.
        </p>
        <p style={{ opacity: 0.8 }}>
          Create <code>slugs/{slug}</code> → <code>{`{ gymId }`}</code> in
          Firestore.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, fontFamily: "system-ui", maxWidth: 420 }}>
      <h2>GymOnline</h2>
      <div style={{ opacity: 0.7, marginBottom: 12 }}>
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
        />
        <input
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>

      {err ? (
        <div style={{ color: "crimson", marginTop: 10 }}>{err}</div>
      ) : null}

      <div style={{ marginTop: 16 }}>
        New gym/member? <a href="/join">Join this gym</a>
      </div>
    </div>
  );
}
