import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase/db";
import { useAuth } from "../../context/AuthContext";
import { orderBy } from "firebase/firestore";
import { getCache, setCache } from "../../app/utils/dataCache";
import PageInfo from "../../components/PageInfo";

const CACHE_TTL_MS = 5 * 60 * 1000;

export default function Plans() {
  const { userDoc } = useAuth();
  const gymId = userDoc?.gymId;

  const [plans, setPlans] = useState([]);
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const [name, setName] = useState("");
  const [type, setType] = useState("time_based");
  const [price, setPrice] = useState("");
  const [durationDays, setDurationDays] = useState("30");
  const [sessionsTotal, setSessionsTotal] = useState("10");

  async function load({ force = false } = {}) {
    if (!gymId) return;
    const cacheKey = `adminPlans:${gymId}`;
    if (!force) {
      const cached = getCache(cacheKey, CACHE_TTL_MS);
      if (cached) {
        setPlans(cached.plans || []);
        setBusy(false);
        return;
      }
    }
    setBusy(true);
    try {
      const q = query(collection(db, "plans"), where("gymId", "==", gymId));
      const snap = await getDocs(q);
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      rows.sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() ?? 0;
        const tb = b.createdAt?.toMillis?.() ?? 0;
        return tb - ta;
      });

      setPlans(rows);
      setCache(cacheKey, { plans: rows });
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
  }, [gymId]);

  async function createPlan(e) {
    e.preventDefault();
    if (!gymId) return;

    if (!name.trim()) return alert("Plan name required");
    const p = Number(price);
    if (Number.isNaN(p) || p <= 0) return alert("Price must be > 0");

    const now = serverTimestamp();
    const data = {
      gymId,
      name: name.trim(),
      type,
      price: p,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    if (type === "time_based") data.durationDays = Number(durationDays) || 30;
    if (type === "session_pack")
      data.sessionsTotal = Number(sessionsTotal) || 10;

    setBusy(true);
    try {
      await addDoc(collection(db, "plans"), data);
      setName("");
      setPrice("");
      setShowAdd(false);
      await load({ force: true });
    } catch (e2) {
      console.error(e2);
      alert("Failed to create plan (check rules)");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(plan) {
    setBusy(true);
    try {
      await updateDoc(doc(db, "plans", plan.id), {
        isActive: !plan.isActive,
        updatedAt: serverTimestamp(),
      });
      await load({ force: true });
    } finally {
      setBusy(false);
    }
  }

  async function remove(plan) {
    if (!confirm(`Delete plan "${plan.name}"?`)) return;
    setBusy(true);
    try {
      await deleteDoc(doc(db, "plans", plan.id));
      await load({ force: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h2 style={{ margin: 0 }}>Plans (Bundles)</h2>
        <button type="button" onClick={() => setShowAdd(true)} disabled={busy}>
          Create plan
        </button>
      </div>
      <PageInfo>
        Create the subscription plans your members can subscribe to.
      </PageInfo>
      <div style={{ padding: 12, maxWidth: 820, opacity: 0.8 }}>
        Here you create the subscription plans that your gym members can
        subscribe to.
      </div>

      <div className="table-scroll">
        <table
          width="100%"
          cellPadding="8"
          style={{ borderCollapse: "collapse" }}
        >
          <thead>
            <tr style={{ borderBottom: "1px solid #eee" }}>
              <th align="left">Name</th>
              <th align="left">Type</th>
              <th align="left">Price</th>
              <th align="left">Active</th>
              <th align="left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.id} style={{ borderBottom: "1px solid #f3f3f3" }}>
                <td>{p.name}</td>
                <td>{p.type}</td>
                <td>{p.price}</td>
                <td>{String(!!p.isActive)}</td>
                <td>
                  <button onClick={() => toggleActive(p)} disabled={busy}>
                    {p.isActive ? "Disable" : "Enable"}
                  </button>{" "}
                  <button onClick={() => remove(p)} disabled={busy}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {!plans.length ? (
              <tr>
                <td colSpan="5" style={{ opacity: 0.7 }}>
                  {busy ? "Loading…" : "No plans yet."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
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
            <div style={{ fontWeight: 800 }}>Create plan</div>
            <form
              onSubmit={createPlan}
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 10,
              }}
            >
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.7 }}>Plan name</span>
                <input
                  placeholder="Plan name (e.g., Monthly)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.7 }}>Type</span>
                <select value={type} onChange={(e) => setType(e.target.value)}>
                  <option value="time_based">Time-based</option>
                  <option value="session_pack">Session pack</option>
                </select>
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.7 }}>Price</span>
                <input
                  placeholder="Price"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </label>

              {type === "time_based" ? (
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, opacity: 0.7 }}>
                    Duration (days)
                  </span>
                  <input
                    placeholder="Duration days (e.g., 30)"
                    value={durationDays}
                    onChange={(e) => setDurationDays(e.target.value)}
                  />
                </label>
              ) : (
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, opacity: 0.7 }}>
                    Total sessions
                  </span>
                  <input
                    placeholder="Total sessions (e.g., 10)"
                    value={sessionsTotal}
                    onChange={(e) => setSessionsTotal(e.target.value)}
                  />
                </label>
              )}

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  justifyContent: "flex-end",
                  gridColumn: "1 / -1",
                }}
              >
                <button disabled={busy} type="submit">
                  {busy ? "Saving…" : "Create plan"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  disabled={busy}
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
