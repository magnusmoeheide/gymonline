// src/pages/public/JoinGym.jsx
import { useMemo, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { signInWithEmailAndPassword, getAuth } from "firebase/auth";
import { functions } from "../../firebase/functionsClient";
import { getGymSlug } from "../../app/utils/getGymSlug";

/**
 * JoinGym
 * - If on root / no subdomain: show "Create new gym" (admin signup)
 * - If on a gym subdomain: keep your existing onboarding/invite info UI
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
    if ((adminPassword || "").length < 8) return alert("Password min 8 chars");

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
      await signInWithEmailAndPassword(
        getAuth(),
        adminEmail.trim().toLowerCase(),
        adminPassword.trim()
      );

      alert("Gym created! Now open your gym subdomain.");
      // If you have local subdomain dev: powergym.localhost:5173
      window.location.href = `http://${newSlug.trim()}.localhost:5173/login`;
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
      <div style={{ padding: 24, fontFamily: "system-ui", maxWidth: 700 }}>
        <h2>Join Gym</h2>

        <p>
          You are on <b>{slug}</b>.
        </p>

        <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 8 }}>
          <div style={{ marginBottom: 8 }}>
            <b>Recommended onboarding (secure)</b>
          </div>
          <ol style={{ margin: 0, paddingLeft: 18 }}>
            <li>Gym admin creates member in Admin → Members</li>
            <li>System sends invite SMS/email</li>
            <li>Member sets password and logs in</li>
          </ol>
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={{ opacity: 0.7, marginBottom: 6 }}>
            Share this join link:
          </div>
          <code
            style={{ display: "block", padding: 10, background: "#f7f7f7" }}
          >
            {inviteLink}
          </code>
          <button onClick={copy} style={{ marginTop: 8 }}>
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>

        <div style={{ marginTop: 16 }}>
          <a href="/login">Back to login</a>
        </div>
      </div>
    );
  }

  // No slug => admin creates new gym
  return (
    <div style={{ padding: 24, fontFamily: "system-ui", maxWidth: 700 }}>
      <h2>Create a new gym (Admin signup)</h2>

      <p style={{ opacity: 0.75 }}>
        No gym subdomain detected. Create a gym to get your own subdomain.
      </p>

      <form
        onSubmit={createGym}
        style={{ display: "grid", gap: 8, maxWidth: 520 }}
      >
        <input
          placeholder="Gym name"
          value={gymName}
          onChange={(e) => setGymName(e.target.value)}
        />
        <input
          placeholder="Slug / subdomain (e.g. powergym)"
          value={newSlug}
          onChange={(e) => setNewSlug(e.target.value)}
        />

        <hr />

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
          placeholder="Admin password (min 8 chars)"
          type="password"
          value={adminPassword}
          onChange={(e) => setAdminPassword(e.target.value)}
        />

        <button disabled={busy}>{busy ? "Creating…" : "Create gym"}</button>
      </form>

      <div style={{ marginTop: 16 }}>
        <a href="/login">Back to login</a>
      </div>
    </div>
  );
}
