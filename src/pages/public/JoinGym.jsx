// src/pages/public/JoinGym.jsx
import { useMemo, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, authPersistenceReady } from "../../firebase/auth";
import { functions } from "../../firebase/functionsClient";
import { getGymSlug } from "../../app/utils/getGymSlug";

/**
 * JoinGym
 * - If on root / no slug: show "Create new gym" (admin signup)
 * - If on a gym slug: keep your existing onboarding/invite info UI
 */
export default function JoinGym() {
  const slug = useMemo(() => getGymSlug(), []);

  // existing invite UI state
  const [copied, setCopied] = useState(false);

  // create gym state
  const [busy, setBusy] = useState(false);
  const [gymName, setGymName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminPhoneE164, setAdminPhoneE164] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  const inviteLink = `${window.location.origin}/join`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  }

  async function createGym(e) {
    e.preventDefault();

    if (!gymName.trim()) return alert("Gym name required");
    if (!newSlug.trim()) return alert("Slug required (e.g. powergym)");
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
        slug: newSlug.trim(),
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
      window.location.href = `http://localhost:5173/g/${newSlug
        .trim()
        .toLowerCase()}/login`;
    } catch (err) {
      console.error(err);
      alert(err?.message || "Failed to create gym");
    } finally {
      setBusy(false);
    }
  }

  // If slug detected => keep existing onboarding UI
  if (slug) {
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
          <div style={{ display: "grid", gap: 6, marginBottom: 12 }}>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em" }}>
              Join Gym
            </div>
            <div style={{ fontSize: 13, opacity: 0.75 }}>
              You are on <b>{slug}</b>.
            </div>
          </div>

          <div
            style={{
              padding: 12,
              border: "1px solid rgba(28,24,19,.12)",
              borderRadius: 12,
              background: "#fff7ed",
            }}
          >
            <div style={{ marginBottom: 8, fontWeight: 700 }}>
              Recommended onboarding (secure)
            </div>
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
              <li>Gym admin creates member in Admin → Members</li>
              <li>System sends invite SMS/email</li>
              <li>Member sets password and logs in</li>
            </ol>
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={{ opacity: 0.7, marginBottom: 6, fontSize: 13 }}>
              Share this join link:
            </div>
            <code
              style={{
                display: "block",
                padding: 10,
                background: "#f7f7f7",
                borderRadius: 10,
                border: "1px solid #eee",
                fontSize: 12,
              }}
            >
              {inviteLink}
            </code>
            <button
              onClick={copy}
              className="btn-primary"
              style={{ marginTop: 10 }}
            >
              {copied ? "Copied!" : "Copy link"}
            </button>
          </div>

          <div style={{ marginTop: 16, fontSize: 13, opacity: 0.9 }}>
            <a href="/login">Back to login</a>
          </div>
        </div>
      </div>
    );
  }

  // No slug => admin creates new gym
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
          <input
            placeholder="Slug (e.g. powergym)"
            value={newSlug}
            onChange={(e) => setNewSlug(e.target.value)}
          />

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
