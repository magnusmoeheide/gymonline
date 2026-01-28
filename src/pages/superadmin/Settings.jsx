// src/pages/superadmin/Settings.jsx
import { useCallback, useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db } from "../../firebase/db";
import { functions } from "../../firebase/functionsClient";

export default function SuperAdminSettings() {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneE164, setPhoneE164] = useState("");
  const [password, setPassword] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, "users"),
        where("role", "==", "SUPER_ADMIN")
      );
      const snap = await getDocs(q);
      setAdmins(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addSuperAdmin = useCallback(
    async (e) => {
      e.preventDefault();
      if (!name.trim()) return alert("Name required");
      if (!email.trim()) return alert("Email required");
      if ((password || "").length < 6)
        return alert("Password min 6 chars");
      if (phoneE164 && !phoneE164.trim().startsWith("+"))
        return alert("Phone must be E.164 (+...)");

      setSaving(true);
      try {
        const fn = httpsCallable(functions, "createSuperAdmin");
        await fn({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phoneE164: phoneE164.trim(),
          password: password.trim(),
        });
        setName("");
        setEmail("");
        setPhoneE164("");
        setPassword("");
        await load();
      } catch (err) {
        console.error(err);
        alert(err?.message || "Failed to create superadmin");
      } finally {
        setSaving(false);
      }
    },
    [name, email, phoneE164, password, load]
  );

  const deleteSuperAdmin = useCallback(
    async (uid) => {
      if (!uid) return;
      if (!confirm("Delete this superadmin?")) return;
      setSaving(true);
      try {
        const fn = httpsCallable(functions, "deleteSuperAdmin");
        await fn({ uid });
        await load();
      } catch (err) {
        console.error(err);
        alert(err?.message || "Failed to delete superadmin");
      } finally {
        setSaving(false);
      }
    },
    [load]
  );

  return (
    <div style={{ padding: 24, display: "grid", gap: 16 }}>
      <h2>Superadmin Settings</h2>

      <div className="card" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>Add superadmin</h3>
        <form
          onSubmit={addSuperAdmin}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 8,
            alignItems: "center",
          }}
        >
          <input
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            name="superadmin-create-email"
            autoComplete="off"
          />
          <input
            placeholder="Phone (E.164 +...)"
            value={phoneE164}
            onChange={(e) => setPhoneE164(e.target.value)}
          />
          <input
            placeholder="Temp password (min 6 chars)"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          <button
            className="btn-primary"
            disabled={saving}
            style={{ gridColumn: "1 / -1" }}
          >
            {saving ? "Saving…" : "Add superadmin"}
          </button>
        </form>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>All superadmins</h3>
        <table width="100%" cellPadding="8" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #eee" }}>
              <th align="left">Name</th>
              <th align="left">Email</th>
              <th align="left">Phone</th>
              <th align="left">Status</th>
              <th align="left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.id} style={{ borderBottom: "1px solid #f3f3f3" }}>
                <td>{a.name || "-"}</td>
                <td>{a.email || "-"}</td>
                <td>{a.phoneE164 || "-"}</td>
                <td>{a.status || "active"}</td>
                <td>
                  <button
                    onClick={() => deleteSuperAdmin(a.id)}
                    disabled={saving}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {!admins.length ? (
              <tr>
                <td colSpan="5" style={{ opacity: 0.7 }}>
                  {loading ? "Loading…" : "No superadmins found."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
