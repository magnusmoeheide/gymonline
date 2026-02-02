import { useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { useAuth } from "../../context/AuthContext";
import { functions } from "../../firebase/functionsClient";
import PageInfo from "../../components/PageInfo";

export default function Profile() {
  const { user, userDoc } = useAuth();
  const name =
    userDoc?.name || userDoc?.fullName || userDoc?.displayName || userDoc?.email || user?.email;
  const phone = userDoc?.phoneE164 || userDoc?.phone || user?.phoneNumber;
  const email = userDoc?.email || user?.email || "";
  const role = userDoc?.role;

  const [selfEmail, setSelfEmail] = useState("");
  const [selfName, setSelfName] = useState("");
  const [selfPhoneE164, setSelfPhoneE164] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setSelfEmail(userDoc?.email || user?.email || "");
    setSelfName(userDoc?.name || userDoc?.fullName || userDoc?.displayName || "");
    setSelfPhoneE164(userDoc?.phoneE164 || userDoc?.phone || "");
  }, [user?.email, userDoc?.email, userDoc?.name, userDoc?.fullName, userDoc?.displayName, userDoc?.phoneE164, userDoc?.phone]);

  async function updateProfile(e) {
    e.preventDefault();
    setMsg("");
    const nextEmail = String(selfEmail || "").trim().toLowerCase();
    if (!nextEmail) return setMsg("Email required");
    if (selfPhoneE164 && !selfPhoneE164.trim().startsWith("+")) {
      return setMsg("Phone must be E.164 (+...)");
    }
    setBusy(true);
    try {
      const fn = httpsCallable(functions, "updateOwnProfile");
      await fn({
        email: nextEmail,
        name: String(selfName || "").trim(),
        phoneE164: String(selfPhoneE164 || "").trim(),
      });
      setMsg("Profile updated");
    } catch (err) {
      console.error(err);
      setMsg(err?.message || "Failed to update profile");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2>Profile</h2>
      <PageInfo>
        View and update your personal details.
      </PageInfo>
      <div style={{ display: "grid", gap: 4, marginBottom: 14 }}>
        <div>
          Email: <b>{email || "-"}</b>
        </div>
        <div>
          Name: <b>{name || "-"}</b>
        </div>
        <div>
          Phone: <b>{phone || "-"}</b>
        </div>
        <div>
          Role: <b>{role || "-"}</b>
        </div>
      </div>

      <div className="card" style={{ padding: 16, maxWidth: 420 }}>
        <h3 style={{ marginTop: 0 }}>Update info</h3>
        <form onSubmit={updateProfile} style={{ display: "grid", gap: 8 }}>
          <input
            placeholder="Your name"
            value={selfName}
            onChange={(e) => setSelfName(e.target.value)}
          />
          <input
            placeholder="Your phone (E.164 +...)"
            value={selfPhoneE164}
            onChange={(e) => setSelfPhoneE164(e.target.value)}
          />
          <input
            placeholder="Your email"
            value={selfEmail}
            onChange={(e) => setSelfEmail(e.target.value)}
          />
          <button className="btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        </form>
        {msg ? (
          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
            {msg}
          </div>
        ) : null}
      </div>
    </div>
  );
}
