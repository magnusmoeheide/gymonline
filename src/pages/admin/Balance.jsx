// src/pages/admin/Balance.jsx
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db } from "../../firebase/db";
import { useAuth } from "../../context/AuthContext";
import { functions } from "../../firebase/functionsClient";

export default function Balance() {
  const { userDoc } = useAuth();
  const gymId = userDoc?.gymId;
  const [resolvedGymId, setResolvedGymId] = useState(null);
  const [gym, setGym] = useState(null);
  const [loading, setLoading] = useState(false);
  const [txns, setTxns] = useState([]);
  const [txnsLoading, setTxnsLoading] = useState(false);
  const [txnsError, setTxnsError] = useState("");

  useEffect(() => {
    if (!gymId) return;
    setResolvedGymId(gymId);
    getDoc(doc(db, "slugs", gymId))
      .then((snap) => {
        if (snap.exists()) {
          const gid = snap.data()?.gymId;
          if (gid) setResolvedGymId(gid);
        }
      })
      .catch(() => {});
  }, [gymId]);

  useEffect(() => {
    if (!resolvedGymId) return;
    setLoading(true);
    getDoc(doc(db, "gyms", resolvedGymId))
      .then((snap) => {
        setGym(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      })
      .finally(() => setLoading(false));
  }, [resolvedGymId]);

  useEffect(() => {
    if (!resolvedGymId) return;
    setTxnsLoading(true);
    setTxnsError("");
    const fn = httpsCallable(functions, "listBalanceTransactions");
    fn({ gymId })
      .then((res) => {
        const items = Array.isArray(res.data?.items) ? res.data.items : [];
        setTxns(items);
      })
      .catch((err) => {
        setTxnsError(err?.message || "Failed to load transactions");
      })
      .finally(() => setTxnsLoading(false));
  }, [resolvedGymId, gymId]);

  const balance = Number(gym?.cashBalance || 0);

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <h2>Balance</h2>

      <div className="card" style={{ padding: 16, maxWidth: 520 }}>
        <div style={{ fontSize: 12, opacity: 0.7 }}>Current balance</div>
        <div style={{ fontSize: 24, fontWeight: 800 }}>
          {loading ? "—" : balance.toLocaleString()}
        </div>
      </div>

      <div className="card" style={{ padding: 16, maxWidth: 720 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Top up</div>
        <div style={{ opacity: 0.7, fontSize: 13, marginBottom: 10 }}>
          Top ups are coming soon. You will be able to add credit to your gym
          balance here.
        </div>
        <button type="button" disabled>
          Add balance (coming soon)
        </button>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Transactions</div>
        {txnsLoading ? (
          <div style={{ opacity: 0.7 }}>Loading...</div>
        ) : txnsError ? (
          <div style={{ opacity: 0.7, color: "#991b1b" }}>{txnsError}</div>
        ) : !txns.length ? (
          <div style={{ opacity: 0.7 }}>No transactions yet.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
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
                        {t.createdAtMs
                          ? new Date(t.createdAtMs).toISOString().slice(0, 19)
                          : "-"}
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
                          {isCredit ? "Credit" : "Debit"}
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
  );
}
