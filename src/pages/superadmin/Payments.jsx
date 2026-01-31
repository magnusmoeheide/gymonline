// src/pages/superadmin/Payments.jsx
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../firebase/db";
import { useAuth } from "../../context/AuthContext";

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
  const [paymentDrafts, setPaymentDrafts] = useState({});

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
      const rawCompedAmount = Number(pay.compedAmount) || 0;
      const rawAmountPaid =
        Number(pay.amountPaid) ||
        (pay.paid ? Number(pay.amountDue || due) : 0);
      const rawBalance =
        Number(pay.balance) ||
        Math.max(due - rawAmountPaid - rawCompedAmount, 0);
      const status =
        pay.status ||
        (rawCompedAmount > 0
          ? "comped"
          : pay.paid
          ? "paid"
          : rawAmountPaid > 0 || rawBalance > 0
          ? "partial"
          : "unpaid");
      const isComped = status === "comped";
      const compedAmount = isComped
        ? Number(pay.compedAmount) || Number(pay.amountDue) || due
        : rawCompedAmount;
      const amountPaid = isComped ? 0 : rawAmountPaid;
      const balance = isComped ? 0 : rawBalance;
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
        amountPaid,
        balance,
        compedAmount,
        status,
      };
    });

    // only gyms with at least one active user in the month
    return list.filter((r) => r.userCount > 0);
  }, [gyms, subs, payments, month, range]);

  function getDraft(r) {
    const draft = paymentDrafts[r.payDocId] || {};
    return {
      status: draft.status || r.status || "unpaid",
      amountPaid:
        draft.amountPaid !== undefined ? Number(draft.amountPaid) || 0 : r.amountPaid,
      balance:
        draft.balance !== undefined ? Number(draft.balance) || 0 : r.balance,
      compedAmount:
        draft.compedAmount !== undefined ? Number(draft.compedAmount) || 0 : r.compedAmount,
    };
  }

  async function savePayment(r) {
    const draft = getDraft(r);
    const comment = String(commentDrafts[r.payDocId] || "").trim() || null;
    const paid = draft.status === "paid";
    const due = Number(r.due) || 0;
    let amountPaid = 0;
    let balance = due;
    let compedAmount = 0;

    if (draft.status === "paid") {
      amountPaid = due;
      balance = 0;
    } else if (draft.status === "partial") {
      amountPaid = Math.max(draft.amountPaid, 0);
      balance = Math.max(draft.balance, 0);
    } else if (draft.status === "comped") {
      compedAmount = Math.max(draft.compedAmount || due, 0);
      balance = Math.max(due - compedAmount, 0);
    }

    const normalized = {
      status: draft.status,
      amountPaid,
      balance,
      compedAmount,
    };
    await setDoc(
      doc(db, "gymPayments", `${r.gym.id}_${normalizeMonth(month)}`),
      {
        gymId: r.gym.id,
        month: normalizeMonth(month),
        paid,
        paidAt: paid ? serverTimestamp() : null,
        amountDue: r.due,
        userCount: r.userCount,
        comments: comment,
        status: normalized.status,
        amountPaid: normalized.amountPaid,
        balance: normalized.balance,
        compedAmount: normalized.compedAmount,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    setPayments((prev) => {
      const n = new Map(prev);
      n.set(r.payDocId, {
        ...(n.get(r.payDocId) || {}),
        gymId: r.gym.id,
        month: normalizeMonth(month),
        paid,
        paidAt: paid ? new Date() : null,
        amountDue: r.due,
        userCount: r.userCount,
        comments: comment,
        status: normalized.status,
        amountPaid: normalized.amountPaid,
        balance: normalized.balance,
        compedAmount: normalized.compedAmount,
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

  const revenue = useMemo(() => {
    const totals = rows.reduce(
      (acc, r) => {
        const isComped = r.status === "comped";
        const effectiveDue = isComped ? 0 : r.due;
        const effectivePaid = isComped ? 0 : r.amountPaid || 0;
        const effectiveBalance = isComped ? 0 : r.balance || 0;
        acc.due += effectiveDue;
        acc.paid += effectivePaid;
        acc.balance += effectiveBalance;
        acc.comped += r.compedAmount || 0;
        return acc;
      },
      { due: 0, paid: 0, balance: 0, comped: 0 }
    );
    return totals;
  }, [rows]);

  const overviewReady = !busy && rows.length > 0;

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

      {overviewReady ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
            background: "#fafafa",
            border: "1px solid #eee",
            padding: 12,
            borderRadius: 8,
          }}
        >
          <div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Due</div>
            <div style={{ fontWeight: 700 }}>{revenue.due}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Paid</div>
            <div style={{ fontWeight: 700 }}>{revenue.paid}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Outstanding</div>
            <div style={{ fontWeight: 700 }}>{revenue.balance}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Comped</div>
            <div style={{ fontWeight: 700 }}>{revenue.comped}</div>
          </div>
        </div>
      ) : null}

      <div className="table-scroll">
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
              <th align="left">Paid</th>
              <th align="left">Payment</th>
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
                  </td>
                  <td>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "120px 120px auto",
                        gap: 6,
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
                          padding: "7px 10px",
                          fontSize: 13,
                          minWidth: 100,
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
                  <td>
                    {r.status === "comped" ? "0/0" : `${r.amountPaid}/${r.due}`}
                  </td>
                  <td>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto",
                        gap: 6,
                        alignItems: "center",
                      }}
                    >
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "nowrap" }}>
                        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "nowrap" }}>
                          <select
                            value={getDraft(r).status}
                            onChange={(e) =>
                              setPaymentDrafts((prev) => ({
                                ...prev,
                                [r.payDocId]: {
                                  ...getDraft(r),
                                  status: e.target.value,
                                },
                              }))
                            }
                            style={{ minWidth: 130 }}
                          >
                            <option value="unpaid">Unpaid</option>
                            <option value="paid">Paid in full</option>
                            <option value="partial">Partial</option>
                            <option value="comped">Comped</option>
                          </select>

                          {getDraft(r).status === "partial" ? (
                            <>
                              <input
                                placeholder="Amount paid"
                                value={getDraft(r).amountPaid}
                                onChange={(e) =>
                                  setPaymentDrafts((prev) => ({
                                    ...prev,
                                    [r.payDocId]: {
                                      ...getDraft(r),
                                      amountPaid: e.target.value,
                                    },
                                  }))
                                }
                                style={{ width: 120 }}
                              />
                              <input
                                placeholder="Outstanding"
                                value={getDraft(r).balance}
                                onChange={(e) =>
                                  setPaymentDrafts((prev) => ({
                                    ...prev,
                                    [r.payDocId]: {
                                      ...getDraft(r),
                                      balance: e.target.value,
                                    },
                                  }))
                                }
                                style={{ width: 120 }}
                              />
                            </>
                          ) : null}

                          {getDraft(r).status === "comped" ? (
                            <input
                              placeholder="Comped amount"
                              value={getDraft(r).compedAmount}
                              onChange={(e) =>
                                setPaymentDrafts((prev) => ({
                                  ...prev,
                                  [r.payDocId]: {
                                    ...getDraft(r),
                                    compedAmount: e.target.value,
                                  },
                                }))
                              }
                              style={{ width: 130 }}
                            />
                          ) : null}
                        </div>

                        <input
                          placeholder="Comments"
                          value={commentDrafts[r.payDocId] ?? r.comments ?? ""}
                          onChange={(e) =>
                            setCommentDrafts((prev) => ({
                              ...prev,
                              [r.payDocId]: e.target.value,
                            }))
                          }
                          style={{ minWidth: 160 }}
                        />
                      </div>
                      <button onClick={() => savePayment(r)}>Save</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
