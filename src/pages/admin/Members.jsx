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
  const [subs, setSubs] = useState([]);
  const [busy, setBusy] = useState(false);

  // create
  const [name, setName] = useState("");
  const [countryCode, setCountryCode] = useState("+254");
  const [phoneLocal, setPhoneLocal] = useState("");
  const [email, setEmail] = useState("");
  const [comments, setComments] = useState("");
  const [sendWelcomeSms, setSendWelcomeSms] = useState(true);

  // edit
  const [editingId, setEditingId] = useState("");
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState(""); // display only; not editable by default
  const [editStatus, setEditStatus] = useState("active");
  const [editComments, setEditComments] = useState("");

  const memberById = useMemo(() => {
    const m = new Map();
    members.forEach((x) => m.set(x.id, x));
    return m;
  }, [members]);

  const memberSubStatus = useMemo(() => {
    const now = new Date();
    const map = new Map();
    for (const s of subs) {
      const uid = s.userId;
      if (!uid) continue;
      const end = s.endDate?.toDate ? s.endDate.toDate() : null;
      const start = s.startDate?.toDate ? s.startDate.toDate() : null;
      const isActive =
        s.status === "active" &&
        (!start || start <= now) &&
        (!end || end >= now);
      const prev = map.get(uid) || { hasAny: false, isActive: false };
      map.set(uid, {
        hasAny: true,
        isActive: prev.isActive || isActive,
      });
    }
    return map;
  }, [subs]);

  async function load() {
    if (!gymId) return;
    setBusy(true);
    try {
      const membersQ = query(
        collection(db, "users"),
        where("gymId", "==", gymId),
        where("role", "==", "MEMBER")
      );
      const subsQ = query(collection(db, "subscriptions"), where("gymId", "==", gymId));
      const [mSnap, sSnap] = await Promise.all([
        getDocs(membersQ),
        getDocs(subsQ),
      ]);
      setMembers(mSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setSubs(sSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
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
    const em = normalizeEmail(email);
    const rawPhone = normalizePhone(phoneLocal);
    const phoneDigits = rawPhone.replace(/\D/g, "");
    const phoneOk =
      !phoneDigits ||
      (countryCode === "+254"
        ? phoneDigits.length === 9 && ["7", "1"].includes(phoneDigits[0])
        : phoneDigits.length >= 6);
    const phoneE164 = phoneDigits ? `${countryCode}${phoneDigits}` : "";

    if (!n) return alert("Name required");
    if (!em && !phoneDigits) return alert("Email or phone required");
    if (phoneDigits && !phoneOk)
      return alert(
        "Phone format invalid. For Kenya use 9 digits, starting with 7 or 1.",
      );

    setBusy(true);
    try {
      const createMember = httpsCallable(functions, "createMember");
      await createMember({
        name: n,
        phoneE164: phoneE164 || null,
        email: em || null,
        sendWelcomeSms: !!sendWelcomeSms,
        gymId: userDoc?.gymId || null,
        gymSlug: userDoc?.gymSlug || null,
        comments: String(comments || "").trim() || null,
      });

      setName("");
      setPhoneLocal("");
      setEmail("");
      setComments("");
      setSendWelcomeSms(true);
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
    setEditComments(m.comments || "");
    setEditStatus(m.status || "active");
  }

  function cancelEdit() {
    setEditingId("");
    setEditName("");
    setEditPhone("");
    setEditEmail("");
    setEditComments("");
    setEditStatus("active");
  }

  async function saveEdit() {
    if (!editingId) return;

    const n = normalizeName(editName);
    const p = normalizePhone(editPhone);
    const st = String(editStatus || "active").trim();
    const c = String(editComments || "").trim() || null;

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
        comments: c,
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
    <div style={{ display: "grid", gap: 20 }}>
      <h2>Members</h2>

      <form
        onSubmit={addMember}
        style={{
          display: "grid",
          gridTemplateColumns: "1.1fr 0.6fr 1fr 1.1fr 1.2fr 0.9fr 0.8fr",
          gap: 8,
          marginBottom: 16,
          padding: 12,
          border: "1px solid #eee",
          borderRadius: 10,
          background: "#fff",
          alignItems: "center",
        }}
      >
        <input
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <select
          value={countryCode}
          onChange={(e) => setCountryCode(e.target.value)}
        >
          <option value="+254">Kenya (+254)</option>
          <option value="+255">Tanzania (+255)</option>
          <option value="+256">Uganda (+256)</option>
          <option value="+250">Rwanda (+250)</option>
          <option value="+257">Burundi (+257)</option>
          <option value="+251">Ethiopia (+251)</option>
        </select>
        <input
          placeholder="Phone (e.g. 712345678)"
          value={phoneLocal}
          onChange={(e) => setPhoneLocal(e.target.value)}
        />
        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <textarea
          rows={1}
          placeholder="Comments"
          value={comments}
          onChange={(e) => setComments(e.target.value)}
        />
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={sendWelcomeSms}
            onChange={(e) => setSendWelcomeSms(e.target.checked)}
          />
          <span style={{ fontSize: 12, opacity: 0.8 }}>
            Send welcome SMS
          </span>
        </label>
        <button disabled={busy}>
          {busy ? "Saving…" : "Add member"}
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
            <th align="left">Subscription</th>
            <th align="left">Comments</th>
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
                  {(() => {
                    const s = memberSubStatus.get(m.id);
                    if (!s) return "—";
                    return s.isActive ? "Active" : "Expired";
                  })()}
                </td>
                <td>
                  {isEditing ? (
                    <textarea
                      rows={1}
                      value={editComments}
                      onChange={(e) => setEditComments(e.target.value)}
                      placeholder="Comments"
                    />
                  ) : (
                    m.comments || "—"
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
              <td colSpan="7" style={{ opacity: 0.7 }}>
                {busy ? "Loading…" : "No members yet."}
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
