// Members.jsx
import { useEffect, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db } from "../../firebase/db";
import { useAuth } from "../../context/AuthContext";
import { functions } from "../../firebase/functionsClient";

export default function Members() {
  const { userDoc } = useAuth();
  const gymId = userDoc?.gymId;

  const [members, setMembers] = useState([]);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [phoneE164, setPhoneE164] = useState("");
  const [email, setEmail] = useState("");

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
  }, [gymId]);

  async function addMember(e) {
    e.preventDefault();

    if (!name.trim()) return alert("Name required");
    if (!phoneE164.startsWith("+")) return alert("Phone must be E.164 (+...)");
    if (!email.trim()) return alert("Email required");

    setBusy(true);
    try {
      const createMember = httpsCallable(functions, "createMember");
      await createMember({
        name: name.trim(),
        phoneE164: phoneE164.trim(),
        email: email.trim().toLowerCase(),
      });

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

  return (
    <div>
      <h2>Members</h2>

      <form
        onSubmit={addMember}
        style={{ display: "grid", gap: 8, maxWidth: 520, marginBottom: 16 }}
      >
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

      <table width="100%" cellPadding="8">
        <thead>
          <tr>
            <th>Name</th>
            <th>Phone</th>
            <th>Email</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.id}>
              <td>{m.name}</td>
              <td>{m.phoneE164}</td>
              <td>{m.email}</td>
              <td>{m.status || "active"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
