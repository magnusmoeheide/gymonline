// src/pages/superadmin/Balance.jsx
import { useEffect, useState, useCallback } from "react";
import { collection, getDocs } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db } from "../../firebase/db";
import { useAuth } from "../../context/AuthContext";
import { functions } from "../../firebase/functionsClient";
import PageInfo from "../../components/PageInfo";
import Loading from "../../components/Loading";

export default function Balance() {
  const { realUserDoc } = useAuth();
  const [gyms, setGyms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [balanceEdits, setBalanceEdits] = useState({});
  const [saving, setSaving] = useState({});
  const [showTxns, setShowTxns] = useState(false);
  const [txnsGym, setTxnsGym] = useState(null);
  const [txns, setTxns] = useState([]);
  const [txnsBusy, setTxnsBusy] = useState(false);

  const fetchGyms = useCallback(async () => {
    if (realUserDoc?.role !== "SUPER_ADMIN") return;
    try {
      setLoading(true);
      setError("");
      const snap = await getDocs(collection(db, "gyms"));
      setGyms(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error(err);
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }, [realUserDoc]);

  useEffect(() => {
    fetchGyms();
  }, [fetchGyms]);

  const handleBalanceChange = useCallback((gymId, value) => {
    setBalanceEdits((prev) => ({ ...prev, [gymId]: value }));
  }, []);

  const updateBalance = useCallback(
    async (gym) => {
      if (!gym?.id) return;
      const raw = balanceEdits[gym.id];
      const next = Number(raw ?? gym.cashBalance ?? 0);
      if (!Number.isFinite(next)) {
        alert("Balance must be a number");
        return;
      }
      const clamped = Math.max(0, next);
      const current = Number(gym.cashBalance) || 0;
      const delta = clamped - current;
      if (delta === 0) return;
      setSaving((prev) => ({ ...prev, [gym.id]: true }));
      try {
        const fn = httpsCallable(functions, "adjustGymBalance");
        await fn({ gymId: gym.id, amount: delta, reason: "admin_adjust" });
        setGyms((prev) =>
          prev.map((g) => (g.id === gym.id ? { ...g, cashBalance: clamped } : g))
        );
      } catch (err) {
        console.error(err);
        alert(err?.message || "Failed to update balance");
      } finally {
        setSaving((prev) => ({ ...prev, [gym.id]: false }));
      }
    },
    [balanceEdits]
  );

  const openTransactions = useCallback(async (gym) => {
    if (!gym?.id) return;
    setTxnsGym(gym);
    setShowTxns(true);
    setTxnsBusy(true);
    try {
      const fn = httpsCallable(functions, "listBalanceTransactions");
      const res = await fn({ gymId: gym.id });
      const items = Array.isArray(res.data?.items) ? res.data.items : [];
      setTxns(items);
    } catch (err) {
      console.error(err);
      alert(err?.message || "Failed to load transactions");
      setTxns([]);
    } finally {
      setTxnsBusy(false);
    }
  }, []);

  function formatTxnDate(ms) {
    if (!ms) return "-";
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return "-";
    const datePart = d.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const timePart = d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${datePart} ${timePart}`;
  }

  if (realUserDoc?.role !== "SUPER_ADMIN") {
    return (
      <div style={{ padding: 24 }}>
        <h2>Unauthorized</h2>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Balance</h2>
        <p style={{ color: "red" }}>Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="superadmin-page" style={{ padding: 24 }}>
      <h2 style={{ marginTop: 0 }}>Balance</h2>
      <PageInfo>
        Adjust SMS balances for gyms and review their current credits.
      </PageInfo>

      <div className="table-scroll">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #ddd" }}>
              <th style={{ textAlign: "left", padding: "8px" }}>Gym</th>
              <th style={{ textAlign: "left", padding: "8px" }}>Slug</th>
              <th style={{ textAlign: "left", padding: "8px" }}>Currency</th>
              <th style={{ textAlign: "left", padding: "8px" }}>Cash balance</th>
              <th style={{ textAlign: "left", padding: "8px" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5">
                  <div style={{ display: "flex", justifyContent: "flex-start" }}>
                    <Loading
                      compact
                      size={28}
                      fullScreen={false}
                      showLabel={false}
                      fullWidth={false}
                    />
                  </div>
                </td>
              </tr>
            ) : null}
            {gyms.map((gym) => (
              <tr key={gym.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "8px" }}>{gym.name}</td>
                <td style={{ padding: "8px" }}>{gym.slug}</td>
                <td style={{ padding: "8px" }}>{gym.currency}</td>
                <td style={{ padding: "8px" }}>
                  <input
                    value={balanceEdits[gym.id] ?? gym.cashBalance ?? 0}
                    onChange={(e) => handleBalanceChange(gym.id, e.target.value)}
                    inputMode="decimal"
                    style={{ maxWidth: 160 }}
                  />
                </td>
                <td style={{ padding: "8px" }}>
                  <button
                    type="button"
                    onClick={() => updateBalance(gym)}
                    disabled={!!saving[gym.id]}
                  >
                    {saving[gym.id] ? "Saving…" : "Update"}
                  </button>
                  <button
                    type="button"
                    onClick={() => openTransactions(gym)}
                    style={{ marginLeft: 8 }}
                  >
                    Latest transactions
                  </button>
                </td>
              </tr>
            ))}
            {!loading && !gyms.length ? (
              <tr>
                <td colSpan="5" style={{ opacity: 0.7 }}>
                  No gyms found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {showTxns ? (
        <div
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowTxns(false);
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
            className="card"
            style={{
              width: "100%",
              maxWidth: 820,
              padding: 16,
              display: "grid",
              gap: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div style={{ fontWeight: 800 }}>
                Latest transactions — {txnsGym?.name || "Gym"}
              </div>
              <button type="button" onClick={() => setShowTxns(false)}>
                Close
              </button>
            </div>
            {txnsBusy ? (
              <div className="table-scroll">
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #eee" }}>
                      <th style={{ textAlign: "left", padding: "8px" }}>Date</th>
                      <th style={{ textAlign: "left", padding: "8px" }}>Type</th>
                      <th style={{ textAlign: "left", padding: "8px" }}>Amount</th>
                      <th style={{ textAlign: "left", padding: "8px" }}>Reason</th>
                      <th style={{ textAlign: "left", padding: "8px" }}>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td colSpan="5">
                        <div style={{ display: "flex", justifyContent: "flex-start" }}>
                          <Loading
                            compact
                            size={28}
                            fullScreen={false}
                            showLabel={false}
                            fullWidth={false}
                          />
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : !txns.length ? (
              <div style={{ opacity: 0.7 }}>No transactions yet.</div>
            ) : (
              <div className="table-scroll">
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #eee" }}>
                      <th style={{ textAlign: "left", padding: "8px" }}>Date</th>
                      <th style={{ textAlign: "left", padding: "8px" }}>Type</th>
                      <th style={{ textAlign: "left", padding: "8px" }}>Amount</th>
                      <th style={{ textAlign: "left", padding: "8px" }}>Reason</th>
                      <th style={{ textAlign: "left", padding: "8px" }}>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txns.map((t) => {
                      const amount = Number(t.amount) || 0;
                      const isCredit = amount > 0;
                      return (
                        <tr key={t.id} style={{ borderTop: "1px solid #f2f2f2" }}>
                          <td style={{ padding: "8px" }}>
                            {formatTxnDate(t.createdAtMs)}
                          </td>
                          <td style={{ padding: "8px" }}>
                            <span
                              style={{
                                padding: "2px 8px",
                                borderRadius: 999,
                                fontSize: 12,
                                fontWeight: 700,
                                color: isCredit ? "#166534" : "#991b1b",
                                background: isCredit ? "#dcfce7" : "#fee2e2",
                              }}
                            >
                              {isCredit ? "Money in" : "Money out"}
                            </span>
                          </td>
                          <td style={{ padding: "8px" }}>
                            {amount.toLocaleString()}
                          </td>
                          <td style={{ padding: "8px" }}>{t.reason || "-"}</td>
                          <td style={{ padding: "8px" }}>
                            {(Number(t.balanceAfter) || 0).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
