// src/pages/public/CreateGym.jsx
import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { doc, getDoc } from "firebase/firestore";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, authPersistenceReady } from "../../firebase/auth";
import { functions } from "../../firebase/functionsClient";
import { db } from "../../firebase/db";

/**
 * CreateGym
 * - Create a new gym (admin signup)
 * - Joining a gym should be handled by gym admins (see onboarding note)
 */
export default function CreateGym() {
  // create gym state
  const [busy, setBusy] = useState(false);
  const [gymName, setGymName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminPhoneE164, setAdminPhoneE164] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  async function createGym(e) {
    e.preventDefault();

    if (!gymName.trim()) return alert("Gym name required");
    const derivedSlug = gymName.replace(/\s+/g, "").toLowerCase();
    if (!derivedSlug) return alert("Gym name required");
    const slugSnap = await getDoc(doc(db, "slugs", derivedSlug));
    if (slugSnap.exists()) {
      return alert("That gym name is taken. Please choose a different name.");
    }
    if (!adminName.trim()) return alert("Admin name required");
    if (!adminPhoneE164.trim().startsWith("+"))
      return alert("Phone must be E.164 (+...)");
    if (!adminEmail.trim()) return alert("Admin email required");
    if ((adminPassword || "").length < 6) return alert("Password min 6 chars");

    setBusy(true);
    try {
      const fn = httpsCallable(functions, "createGymAndAdmin");
      await fn({
        gymName: gymName.trim(),
        slug: derivedSlug,
        adminName: adminName.trim(),
        adminPhoneE164: adminPhoneE164.trim(),
        adminEmail: adminEmail.trim().toLowerCase(),
        adminPassword: adminPassword.trim(),
      });

      // login right away
      await authPersistenceReady;
      await signInWithEmailAndPassword(
        auth,
        adminEmail.trim().toLowerCase(),
        adminPassword.trim()
      );

      alert("Gym created! Now open your gym login page.");
      window.location.href = `${window.location.origin}/${derivedSlug}/login`;
    } catch (err) {
      console.error(err);
      alert(err?.message || "Failed to create gym");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <div className="card" style={{ width: "100%", maxWidth: 520, padding: 22 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 14,
            padding: 10,
            borderRadius: 12,
            background: "#fff7ed",
            border: "1px solid rgba(28,24,19,.12)",
            fontSize: 12,
          }}
        >
          <span
            style={{
              fontWeight: 800,
              padding: "4px 8px",
              borderRadius: 999,
              background: "#fff",
              border: "1px solid rgba(28,24,19,.12)",
            }}
          >
            Info
          </span>
          <div style={{ opacity: 0.8 }}>
            Looking to join a gym? Recommended onboarding: gym admin creates
            the member in Admin → Members, system sends invite SMS/email, member
            sets password and logs in.
          </div>
        </div>

        <div style={{ display: "grid", gap: 6, marginBottom: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em" }}>
            Create a new gym
          </div>
          <div style={{ fontSize: 13, opacity: 0.75 }}>
            No gym slug detected. Create a gym to get your own slug.
          </div>
        </div>

        <form onSubmit={createGym} style={{ display: "grid", gap: 10 }}>
          <input
            placeholder="Gym name"
            value={gymName}
            onChange={(e) => setGymName(e.target.value)}
          />
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Slug: <b>{gymName.replace(/\s+/g, "").toLowerCase() || "—"}</b>
          </div>

          <div style={{ height: 1, background: "#eee", margin: "6px 0" }} />

          <input
            placeholder="Admin full name"
            value={adminName}
            onChange={(e) => setAdminName(e.target.value)}
          />
          <input
            placeholder="Admin phone (E.164) e.g. +2547..."
            value={adminPhoneE164}
            onChange={(e) => setAdminPhoneE164(e.target.value)}
          />
          <input
            placeholder="Admin email"
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
          />
          <input
            placeholder="Admin password (min 6 chars)"
            type="password"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
          />

          <button className="btn-primary" disabled={busy}>
            {busy ? "Creating…" : "Create gym"}
          </button>
        </form>

        <div style={{ marginTop: 16, fontSize: 13, opacity: 0.9 }}>
          <a href="/login">Back to login</a>
        </div>
      </div>
    </div>
  );
}
