// src/pages/superadmin/Payments.jsx
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  setDoc,
} from "firebase/firestore";
import { db } from "../../firebase/db";
import { useAuth } from "../../context/AuthContext";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../firebase/functionsClient";

function fmtMonth(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function normalizeMonth(ym) {
  const [y, m] = String(ym || "").split("-").map((x) => Number(x));
  if (!y || !m) return fmtMonth(new Date());
  return `${y}-${String(m).padStart(2, "0")}`;
}

function monthRange(ym) {
  const [y, m] = String(ym || "").split("-").map((x) => Number(x));
  if (!y || !m) return null;
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1); // exclusive
  return { start, end };
}

function toDate(ts) {
  if (!ts) return null;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d;
}

function overlapsMonth(sub, range) {
  if (!range) return false;
  const s = toDate(sub.startDate);
  const e = toDate(sub.endDate);
  if (!s || !e) return false;
  return s < range.end && e >= range.start;
}

export default function Payments() {
  const { realUserDoc } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [gyms, setGyms] = useState([]);
  const [subs, setSubs] = useState([]);
  const [payments, setPayments] = useState(new Map());
  const [month, setMonth] = useState(() => fmtMonth(new Date()));
  const [commentDrafts, setCommentDrafts] = useState({});

  useEffect(() => {
    if (realUserDoc?.role !== "SUPER_ADMIN") return;
    let cancelled = false;
    setBusy(true);

    (async () => {
      try {
        setError("");
        const gSnap = await getDocs(collection(db, "gyms"));
        if (cancelled) return;
        setGyms(gSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

        const sSnap = await getDocs(collection(db, "subscriptions"));
        if (cancelled) return;
        setSubs(sSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

        const pSnap = await getDocs(collection(db, "gymPayments"));
        if (cancelled) return;
        const map = new Map();
        pSnap.docs.forEach((d) => map.set(d.id, d.data()));
        setPayments(map);
      } catch (e) {
        console.error("[Payments] load failed", e);
        if (!cancelled) setError(e?.message || String(e));
      } finally {
        if (cancelled) return;
        setBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [realUserDoc]);

  const range = useMemo(() => monthRange(month), [month]);

  const rows = useMemo(() => {
    if (!range) return [];
    const list = gyms.map((g) => {
      const model = g.billingModel || "per_user";
      const perUserRate = Number(g.perUserRate) || 0;
      const fixedAmount = Number(g.fixedAmount) || 0;
      const gymSubs = subs.filter((s) => s.gymId === g.id);
      const activeUsers = new Set(
        gymSubs.filter((s) => overlapsMonth(s, range)).map((s) => s.userId)
      );
      const userCount = activeUsers.size;
      const due =
        model === "fixed"
          ? fixedAmount
          : Math.round(userCount * perUserRate);
      const payDocId = `${g.id}_${normalizeMonth(month)}`;
      const pay = payments.get(payDocId) || {};
      return {
        gym: g,
        model,
        perUserRate,
        fixedAmount,
        userCount,
        due,
        payDocId,
        paid: !!pay.paid,
        comments: pay.comments || "",
      };
    });

    // only gyms with at least one active user in the month
    return list.filter((r) => r.userCount > 0);
  }, [gyms, subs, payments, month, range]);

  async function togglePaid(r) {
    const next = !r.paid;
    const comment = String(commentDrafts[r.payDocId] || "").trim() || null;
    const fn = httpsCallable(functions, "setGymPaymentStatus");
    await fn({
      gymId: r.gym.id,
      month: normalizeMonth(month),
      paid: next,
      amountDue: r.due,
      userCount: r.userCount,
      comments: comment,
    });
    setPayments((prev) => {
      const n = new Map(prev);
      n.set(r.payDocId, {
        ...(n.get(r.payDocId) || {}),
        gymId: r.gym.id,
        month: normalizeMonth(month),
        paid: next,
        paidAt: next ? new Date() : null,
        amountDue: r.due,
        userCount: r.userCount,
        comments: comment,
      });
      return n;
    });
  }

  async function saveBilling(gymId, patch) {
    await updateDoc(doc(db, "gyms", gymId), patch);
    setGyms((prev) =>
      prev.map((g) => (g.id === gymId ? { ...g, ...patch } : g))
    );
  }

  if (realUserDoc?.role !== "SUPER_ADMIN") {
    return (
      <div style={{ padding: 24 }}>
        <h2>Unauthorized</h2>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <h2>Payments</h2>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ fontWeight: 700 }}>Month</div>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          style={{ maxWidth: 200 }}
        />
      </div>

      <table
        className="payments-table"
        width="100%"
        cellPadding="8"
        style={{ borderCollapse: "collapse" }}
      >
        <thead>
          <tr style={{ borderBottom: "1px solid #eee" }}>
            <th align="left">Gym</th>
            <th align="left">Billing</th>
            <th align="left">Members</th>
            <th align="left">Due</th>
            <th align="left">Paid</th>
          </tr>
        </thead>
        <tbody>
          {!rows.length ? (
            <tr>
              <td colSpan="5" style={{ opacity: 0.7 }}>
                {busy
                  ? "Loading…"
                  : error
                  ? `Error: ${error}`
                  : "No gyms found."}
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.gym.id} style={{ borderBottom: "1px solid #f3f3f3" }}>
                <td>
                  <div style={{ fontWeight: 700 }}>{r.gym.name}</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>{r.gym.slug}</div>
                </td>
                <td>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "130px 130px 130px",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <select
                      value={r.model}
                      onChange={(e) =>
                        saveBilling(r.gym.id, { billingModel: e.target.value })
                      }
                    >
                      <option value="per_user">Per user</option>
                      <option value="fixed">Fixed</option>
                    </select>
                    {r.model === "fixed" ? (
                      <input
                        placeholder="Fixed amount"
                        value={r.fixedAmount}
                        onChange={(e) =>
                          setGyms((prev) =>
                            prev.map((g) =>
                              g.id === r.gym.id
                                ? { ...g, fixedAmount: e.target.value }
                                : g
                            )
                          )
                        }
                        style={{ maxWidth: 140 }}
                      />
                    ) : (
                      <input
                        placeholder="Per user rate"
                        value={r.perUserRate}
                        onChange={(e) =>
                          setGyms((prev) =>
                            prev.map((g) =>
                              g.id === r.gym.id
                                ? { ...g, perUserRate: e.target.value }
                                : g
                            )
                          )
                        }
                        style={{ maxWidth: 130 }}
                      />
                    )}
                    <button
                      type="button"
                      style={{
                        padding: "8px 10px",
                        fontSize: 13,
                        minWidth: 130,
                      }}
                      onClick={() =>
                        saveBilling(r.gym.id, {
                          billingModel: r.model,
                          perUserRate: Number(r.perUserRate) || 0,
                          fixedAmount: Number(r.fixedAmount) || 0,
                        })
                      }
                    >
                      Update
                    </button>
                  </div>
                </td>
                <td>{r.userCount}</td>
                <td>{r.due}</td>
                <td>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <input
                      placeholder="Comments"
                      value={commentDrafts[r.payDocId] ?? r.comments ?? ""}
                      onChange={(e) =>
                        setCommentDrafts((prev) => ({
                          ...prev,
                          [r.payDocId]: e.target.value,
                        }))
                      }
                    />
                    <button onClick={() => togglePaid(r)}>
                      {r.paid ? "Paid" : "Mark paid"}
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
