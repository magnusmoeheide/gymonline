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
  const [showAdd, setShowAdd] = useState(false);

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
        setShowAdd(false);
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
      <div style={{ display: "grid", gap: 10 }}>
        <h2 style={{ margin: 0 }}>Superadmin Settings</h2>
        <div>
          <button
            type="button"
            className="btn-primary"
            onClick={() => setShowAdd(true)}
            disabled={saving}
          >
            Add superadmin
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>All superadmins</h3>
        <div className="table-scroll">
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

      {showAdd ? (
        <div
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowAdd(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 14,
            zIndex: 9999,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 720,
              background: "#fff",
              borderRadius: 12,
              border: "1px solid #eee",
              boxShadow: "0 12px 40px rgba(0,0,0,0.15)",
              padding: 16,
              display: "grid",
              gap: 12,
            }}
          >
            <div style={{ fontWeight: 800 }}>Add superadmin</div>
            <form
              onSubmit={addSuperAdmin}
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 10,
              }}
            >
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.7 }}>Full name</span>
                <input
                  placeholder="Full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.7 }}>Email</span>
                <input
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  name="superadmin-create-email"
                  autoComplete="off"
                />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.7 }}>Phone (E.164)</span>
                <input
                  placeholder="Phone (E.164 +...)"
                  value={phoneE164}
                  onChange={(e) => setPhoneE164(e.target.value)}
                />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.7 }}>
                  Temp password
                </span>
                <input
                  placeholder="Temp password (min 6 chars)"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </label>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  justifyContent: "flex-end",
                  gridColumn: "1 / -1",
                }}
              >
                <button className="btn-primary" disabled={saving} type="submit">
                  {saving ? "Saving…" : "Add superadmin"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
