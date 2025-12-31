// src/pages/admin/Members.jsx
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db } from "../../firebase/db";
import { useAuth } from "../../context/AuthContext";
import { functions } from "../../firebase/functionsClient";

const normalizeEmail = (v) =>
  String(v || "")
    .trim()
    .toLowerCase();
const normalizePhone = (v) => String(v || "").trim();
const normalizeName = (v) => String(v || "").trim();

export default function Members() {
  const { userDoc } = useAuth();
  const gymId = userDoc?.gymId;

  const [members, setMembers] = useState([]);
  const [busy, setBusy] = useState(false);

  // create
  const [name, setName] = useState("");
  const [phoneE164, setPhoneE164] = useState("");
  const [email, setEmail] = useState("");

  // edit
  const [editingId, setEditingId] = useState("");
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState(""); // display only; not editable by default
  const [editStatus, setEditStatus] = useState("active");

  const memberById = useMemo(() => {
    const m = new Map();
    members.forEach((x) => m.set(x.id, x));
    return m;
  }, [members]);

  async function load() {
    if (!gymId) return;
    setBusy(true);
    try {
      const q = query(
        collection(db, "users"),
        where("gymId", "==", gymId),
        where("role", "==", "MEMBER")
      );
      const snap = await getDocs(q);
      setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gymId]);

  async function addMember(e) {
    e.preventDefault();

    const n = normalizeName(name);
    const p = normalizePhone(phoneE164);
    const em = normalizeEmail(email);

    if (!n) return alert("Name required");
    if (!p.startsWith("+")) return alert("Phone must be E.164 (+...)");
    if (!em) return alert("Email required");

    setBusy(true);
    try {
      const createMember = httpsCallable(functions, "createMember");
      await createMember({ name: n, phoneE164: p, email: em });

      setName("");
      setPhoneE164("");
      setEmail("");
      await load();
    } catch (err) {
      console.error(err);
      alert(err?.message || "Failed to create member");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(id) {
    const m = memberById.get(id);
    if (!m) return;

    setEditingId(id);
    setEditName(m.name || "");
    setEditPhone(m.phoneE164 || "");
    setEditEmail(m.email || "");
    setEditStatus(m.status || "active");
  }

  function cancelEdit() {
    setEditingId("");
    setEditName("");
    setEditPhone("");
    setEditEmail("");
    setEditStatus("active");
  }

  async function saveEdit() {
    if (!editingId) return;

    const n = normalizeName(editName);
    const p = normalizePhone(editPhone);
    const st = String(editStatus || "active").trim();

    if (!n) return alert("Name required");
    if (!p.startsWith("+")) return alert("Phone must be E.164 (+...)");

    // NOTE: editing email would require updating Firebase Auth user too.
    // For now, we keep email read-only in the UI.
    setBusy(true);
    try {
      const ref = doc(db, "users", editingId);

      // only patch allowed fields
      await updateDoc(ref, {
        name: n,
        phoneE164: p,
        status: st,
        updatedAt: new Date(),
      });

      await load();
      cancelEdit();
    } catch (err) {
      console.error(err);
      alert(err?.message || "Failed to update member");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2>Members</h2>

      <form
        onSubmit={addMember}
        style={{
          display: "grid",
          gap: 8,
          maxWidth: 520,
          marginBottom: 16,
          padding: 12,
          border: "1px solid #eee",
          borderRadius: 10,
          background: "#fff",
        }}
      >
        <div style={{ fontWeight: 700 }}>Add member</div>
        <input
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          placeholder="Phone (E.164) e.g. +2547..."
          value={phoneE164}
          onChange={(e) => setPhoneE164(e.target.value)}
        />
        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button disabled={busy}>
          {busy ? "Saving…" : "Add member & send reset email"}
        </button>
      </form>

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
            <th align="left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => {
            const isEditing = editingId === m.id;

            return (
              <tr key={m.id} style={{ borderBottom: "1px solid #f3f3f3" }}>
                <td>
                  {isEditing ? (
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Name"
                    />
                  ) : (
                    m.name
                  )}
                </td>
                <td>
                  {isEditing ? (
                    <input
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      placeholder="+2547..."
                    />
                  ) : (
                    m.phoneE164
                  )}
                </td>
                <td>
                  {isEditing ? (
                    <input
                      value={editEmail}
                      disabled
                      title="Email is read-only"
                    />
                  ) : (
                    m.email
                  )}
                </td>
                <td>
                  {isEditing ? (
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                    >
                      <option value="active">active</option>
                      <option value="inactive">inactive</option>
                      <option value="blocked">blocked</option>
                    </select>
                  ) : (
                    m.status || "active"
                  )}
                </td>
                <td>
                  {isEditing ? (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button disabled={busy} type="button" onClick={saveEdit}>
                        {busy ? "Saving…" : "Save"}
                      </button>
                      <button
                        disabled={busy}
                        type="button"
                        onClick={cancelEdit}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => startEdit(m.id)}
                    >
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
          {!members.length ? (
            <tr>
              <td colSpan="5" style={{ opacity: 0.7 }}>
                No members yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.65 }}>
        Note: Email is read-only here (changing email needs updating Firebase
        Auth user too).
      </div>
    </div>
  );
}
