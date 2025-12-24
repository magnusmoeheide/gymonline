// src/pages/admin/Subscriptions.jsx
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  Timestamp,
  limit,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "../../firebase/db";
import { useAuth } from "../../context/AuthContext";

function toDateInputValue(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function fmtDate(ts) {
  if (!ts) return "-";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return Number.isNaN(d.getTime()) ? "-" : d.toISOString().slice(0, 10);
}

export default function Subscriptions() {
  const { userDoc } = useAuth();
  const gymId = userDoc?.gymId;

  const [members, setMembers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [subs, setSubs] = useState([]);
  const [busy, setBusy] = useState(false);

  const [userId, setUserId] = useState("");
  const [planId, setPlanId] = useState("");
  const [endDate, setEndDate] = useState(
    toDateInputValue(new Date(Date.now() + 30 * 86400000))
  );

  async function load() {
    if (!gymId) return;
    setBusy(true);
    try {
      // 🔒 NO orderBy anywhere → NO composite index needed
      const membersQ = query(
        collection(db, "users"),
        where("gymId", "==", gymId),
        where("role", "==", "MEMBER")
      );

      const plansQ = query(
        collection(db, "plans"),
        where("gymId", "==", gymId),
        where("isActive", "==", true)
      );

      const subsQ = query(
        collection(db, "subscriptions"),
        where("gymId", "==", gymId)
      );

      const [mSnap, pSnap, sSnap] = await Promise.all([
        getDocs(membersQ),
        getDocs(plansQ),
        getDocs(subsQ),
      ]);

      setMembers(mSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setPlans(pSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setSubs(sSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gymId]);

  const memberMap = useMemo(() => {
    const m = new Map();
    members.forEach((x) => m.set(x.id, x));
    return m;
  }, [members]);

  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === planId) || null,
    [plans, planId]
  );

  // Auto-calc end date for time-based plans
  useEffect(() => {
    if (!selectedPlan) return;
    if (selectedPlan.type !== "time_based") return;

    const days = Number(selectedPlan.durationDays) || 30;
    const d = new Date();
    d.setDate(d.getDate() + days);
    setEndDate(toDateInputValue(d));
  }, [selectedPlan]);

  async function assign(e) {
    e.preventDefault();
    if (!gymId) return;

    if (!userId) return alert("Pick member");
    if (!planId) return alert("Pick plan");

    const plan = selectedPlan;
    if (!plan) return alert("Plan not found");

    let end;
    if (plan.type === "time_based") {
      end = new Date(endDate + "T00:00:00");
      if (Number.isNaN(end.getTime())) return alert("Invalid end date");
    } else {
      end = new Date();
      end.setFullYear(end.getFullYear() + 10); // session packs don't expire
    }

    setBusy(true);
    try {
      // prevent multiple active subs
      const activeQ = query(
        collection(db, "subscriptions"),
        where("gymId", "==", gymId),
        where("userId", "==", userId),
        where("status", "==", "active"),
        limit(1)
      );
      const activeSnap = await getDocs(activeQ);
      if (!activeSnap.empty) {
        alert("Member already has an active subscription");
        return;
      }

      const now = serverTimestamp();

      await addDoc(collection(db, "subscriptions"), {
        gymId,
        userId,
        planId,

        // snapshot fields (important)
        planName: plan.name,
        planType: plan.type,
        planPrice: plan.price ?? null,
        durationDays:
          plan.type === "time_based" ? plan.durationDays ?? 30 : null,
        sessionsTotal:
          plan.type === "session_pack" ? plan.sessionsTotal ?? 10 : null,
        sessionsRemaining:
          plan.type === "session_pack" ? plan.sessionsTotal ?? 10 : null,

        status: "active",
        startDate: Timestamp.fromDate(new Date()),
        endDate: Timestamp.fromDate(end),

        reminderFlags: { d7: false, d1: false, expired: false },
        createdAt: now,
        updatedAt: now,
      });

      setUserId("");
      setPlanId("");
      await load();
    } catch (err) {
      console.error(err);
      alert(err?.message || "Failed to assign subscription");
    } finally {
      setBusy(false);
    }
  }

  async function endSubscription(sub) {
    if (!confirm("End this subscription now?")) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, "subscriptions", sub.id), {
        status: "ended",
        updatedAt: serverTimestamp(),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2>Subscriptions</h2>

      <form
        onSubmit={assign}
        style={{ display: "grid", gap: 8, maxWidth: 680, marginBottom: 16 }}
      >
        <span>
          Select Member:{" "}
          <select value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">No Member Selected</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.phoneE164})
              </option>
            ))}
          </select>
        </span>
        <span>
          Select plan:{" "}
          <select value={planId} onChange={(e) => setPlanId(e.target.value)}>
            <option value="">No Plan Selected</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.price},-)
              </option>
            ))}
          </select>
        </span>

        {selectedPlan?.type === "time_based" ? (
          <span>
            Plan start:{" "}
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </span>
        ) : (
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Session pack — no expiry date
          </div>
        )}
        <button disabled={busy}>
          {busy ? "Saving…" : "Assign subscription"}
        </button>
      </form>

      <table
        width="100%"
        cellPadding="8"
        style={{ borderCollapse: "collapse" }}
      >
        <thead>
          <tr style={{ borderBottom: "1px solid #eee" }}>
            <th align="left">Member</th>
            <th align="left">Plan</th>
            <th align="left">Type</th>
            <th align="left">Status</th>
            <th align="left">Start</th>
            <th align="left">End</th>
            <th align="left">Sessions</th>
            <th align="left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {subs.map((s) => {
            const member = memberMap.get(s.userId);
            return (
              <tr key={s.id} style={{ borderBottom: "1px solid #f3f3f3" }}>
                <td>{member?.name || s.userId}</td>
                <td>{s.planName || s.planId}</td>
                <td>{s.planType}</td>
                <td>{s.status}</td>
                <td>{fmtDate(s.startDate)}</td>
                <td>
                  {s.planType === "session_pack" ? "-" : fmtDate(s.endDate)}
                </td>
                <td>
                  {s.planType === "session_pack"
                    ? `${s.sessionsRemaining ?? "-"} / ${
                        s.sessionsTotal ?? "-"
                      }`
                    : "-"}
                </td>
                <td>
                  {s.status === "active" ? (
                    <button disabled={busy} onClick={() => endSubscription(s)}>
                      End
                    </button>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            );
          })}
          {!subs.length ? (
            <tr>
              <td colSpan="8" style={{ opacity: 0.7 }}>
                No subscriptions yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
