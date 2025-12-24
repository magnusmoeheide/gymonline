// src/pages/admin/Settings.jsx
import { useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../firebase/db";
import { functions } from "../../firebase/functionsClient";
import { useAuth } from "../../context/AuthContext";

export default function Settings() {
  const { userDoc } = useAuth();
  const gymId = userDoc?.gymId;

  // templates (keep your placeholders)
  const [expiring7, setExpiring7] = useState(
    "Hi {{name}}, your membership expires on {{date}}. Renew to stay active."
  );
  const [expiring1, setExpiring1] = useState(
    "Reminder: membership expires tomorrow ({{date}})."
  );
  const [expired, setExpired] = useState(
    "Your membership expired on {{date}}. Renew anytime."
  );

  // admins table
  const [admins, setAdmins] = useState([]);
  const [busy, setBusy] = useState(false);

  // add admin form
  const [adminName, setAdminName] = useState("");
  const [adminPhoneE164, setAdminPhoneE164] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminTempPassword, setAdminTempPassword] = useState("");

  async function loadAdmins() {
    if (!gymId) return;
    setBusy(true);
    try {
      const qAdmins = query(
        collection(db, "users"),
        where("gymId", "==", gymId),
        where("role", "==", "GYM_ADMIN")
      );
      const snap = await getDocs(qAdmins);
      setAdmins(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    loadAdmins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gymId]);

  async function addGymAdmin(e) {
    e.preventDefault();
    if (!gymId) return;

    if (!adminName.trim()) return alert("Admin name required");
    if (!adminPhoneE164.trim().startsWith("+"))
      return alert("Phone must be E.164 (+...)");
    if (!adminEmail.trim()) return alert("Email required");
    if ((adminTempPassword || "").length < 8)
      return alert("Temp password min 8 chars");

    setBusy(true);
    try {
      const fn = httpsCallable(functions, "createGymAdmin"); // Cloud Function
      await fn({
        name: adminName.trim(),
        phoneE164: adminPhoneE164.trim(),
        email: adminEmail.trim().toLowerCase(),
        tempPassword: adminTempPassword.trim(),
      });

      setAdminName("");
      setAdminPhoneE164("");
      setAdminEmail("");
      setAdminTempPassword("");

      await loadAdmins();
      alert("Gym admin created");
    } catch (err) {
      console.error(err);
      alert(err?.message || "Failed to create gym admin");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2>Settings</h2>

      <div style={{ opacity: 0.8, marginBottom: 12 }}>
        GymId: <b>{gymId || "-"}</b>
      </div>

      <p style={{ opacity: 0.8 }}>
        For now these templates are local placeholders. Next step is saving them
        to <code>gyms/{`{gymId}`}</code> and using them in the Twilio function.
      </p>

      <div style={{ display: "grid", gap: 10, maxWidth: 820 }}>
        <label>
          Expiring 7 days
          <textarea
            rows={2}
            value={expiring7}
            onChange={(e) => setExpiring7(e.target.value)}
            style={{ width: "100%" }}
          />
        </label>
        <label>
          Expiring 1 day
          <textarea
            rows={2}
            value={expiring1}
            onChange={(e) => setExpiring1(e.target.value)}
            style={{ width: "100%" }}
          />
        </label>
        <label>
          Expired
          <textarea
            rows={2}
            value={expired}
            onChange={(e) => setExpired(e.target.value)}
            style={{ width: "100%" }}
          />
        </label>
      </div>

      <hr style={{ margin: "20px 0" }} />

      <h3>Gym Admins</h3>

      <form
        onSubmit={addGymAdmin}
        style={{ display: "grid", gap: 8, maxWidth: 520, marginBottom: 16 }}
      >
        <input
          placeholder="Full name"
          value={adminName}
          onChange={(e) => setAdminName(e.target.value)}
        />
        <input
          placeholder="Phone (E.164) e.g. +2547..."
          value={adminPhoneE164}
          onChange={(e) => setAdminPhoneE164(e.target.value)}
        />
        <input
          placeholder="Email"
          value={adminEmail}
          onChange={(e) => setAdminEmail(e.target.value)}
        />
        <input
          placeholder="Temp password (min 8 chars)"
          value={adminTempPassword}
          onChange={(e) => setAdminTempPassword(e.target.value)}
        />
        <button disabled={busy}>{busy ? "Saving…" : "Add gym admin"}</button>
      </form>

      {busy ? <div>Loading…</div> : null}

      <table
        width="100%"
        cellPadding="8"
        style={{ borderCollapse: "collapse" }}
      >
        <thead>
          <tr style={{ borderBottom: "1px solid #eee" }}>
            <th align="left">Name</th>
            <th align="left">Phone</th>
            <th align="left">Email</th>
            <th align="left">Status</th>
          </tr>
        </thead>
        <tbody>
          {admins.map((a) => (
            <tr key={a.id} style={{ borderBottom: "1px solid #f3f3f3" }}>
              <td>{a.name}</td>
              <td>{a.phoneE164}</td>
              <td>{a.email || "-"}</td>
              <td>{a.status || "active"}</td>
            </tr>
          ))}
          {!admins.length ? (
            <tr>
              <td colSpan="4" style={{ opacity: 0.7 }}>
                No gym admins yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
