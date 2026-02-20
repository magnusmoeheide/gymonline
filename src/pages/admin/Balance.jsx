// src/pages/admin/Balance.jsx
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db } from "../../firebase/db";
import { useAuth } from "../../context/AuthContext";
import { functions } from "../../firebase/functionsClient";
import { getCache, setCache } from "../../app/utils/dataCache";
import PageInfo from "../../components/PageInfo";
import Loading from "../../components/Loading";

const CACHE_TTL_MS = 5 * 60 * 1000;

export default function Balance() {
  const { userDoc } = useAuth();
  const gymId = userDoc?.gymId;
  const [resolvedGymId, setResolvedGymId] = useState(null);
  const [gym, setGym] = useState(null);
  const [loading, setLoading] = useState(false);
  const [txns, setTxns] = useState([]);
  const [txnsLoading, setTxnsLoading] = useState(false);
  const [txnsError, setTxnsError] = useState("");
  const [topUpPhone, setTopUpPhone] = useState("");
  const [topUpAmount, setTopUpAmount] = useState("");
  const [topUpLoading, setTopUpLoading] = useState(false);
  const [topUpError, setTopUpError] = useState("");
  const [topUpSuccess, setTopUpSuccess] = useState("");

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

  function normalizePhoneNumber(raw) {
    const digits = String(raw || "").replace(/\D/g, "");
    if (/^2547\d{8}$/.test(digits)) return digits;
    if (/^07\d{8}$/.test(digits)) return `254${digits.slice(1)}`;
    if (/^7\d{8}$/.test(digits)) return `254${digits}`;
    return digits;
  }

  async function handleTopUp() {
    setTopUpError("");
    setTopUpSuccess("");

    const amount = Number(topUpAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setTopUpError("Enter a valid amount.");
      return;
    }

    const phoneNumber = normalizePhoneNumber(`254${topUpPhone}`);
    if (!/^2547\d{8}$/.test(phoneNumber)) {
      setTopUpError("Use a valid M-Pesa phone number (+2547XXXXXXXX).");
      return;
    }

    setTopUpLoading(true);
    try {
      const fn = httpsCallable(functions, "stkPush");
      const res = await fn({ phoneNumber, amount });
      const message =
        res.data?.CustomerMessage ||
        "STK Push sent. Complete payment on your phone.";
      setTopUpSuccess(message);
    } catch (err) {
      setTopUpError(err?.message || "Failed to start top up.");
    } finally {
      setTopUpLoading(false);
    }
  }

  useEffect(() => {
    if (!gymId) return;
    setResolvedGymId(gymId);
    const cacheKey = `adminBalanceSlug:${gymId}`;
    const cached = getCache(cacheKey, CACHE_TTL_MS);
    if (cached?.resolvedGymId) {
      setResolvedGymId(cached.resolvedGymId);
      return;
    }
    getDoc(doc(db, "slugs", gymId))
      .then((snap) => {
        if (snap.exists()) {
          const gid = snap.data()?.gymId;
          if (gid) {
            setResolvedGymId(gid);
            setCache(cacheKey, { resolvedGymId: gid });
          }
        }
      })
      .catch(() => {});
  }, [gymId]);

  useEffect(() => {
    if (!resolvedGymId) return;
    const cacheKey = `adminBalanceGym:${resolvedGymId}`;
    const cached = getCache(cacheKey, CACHE_TTL_MS);
    if (cached?.gym) {
      setGym(cached.gym);
      setLoading(false);
      return;
    }
    setLoading(true);
    getDoc(doc(db, "gyms", resolvedGymId))
      .then((snap) => {
        const nextGym = snap.exists() ? { id: snap.id, ...snap.data() } : null;
        setGym(nextGym);
        setCache(cacheKey, { gym: nextGym });
      })
      .finally(() => setLoading(false));
  }, [resolvedGymId]);

  useEffect(() => {
    if (!resolvedGymId) return;
    const cacheKey = `adminBalanceTxns:${resolvedGymId}`;
    const cached = getCache(cacheKey, CACHE_TTL_MS);
    if (cached?.txns) {
      setTxns(cached.txns);
      setTxnsLoading(false);
      return;
    }
    setTxnsLoading(true);
    setTxnsError("");
    const fn = httpsCallable(functions, "listBalanceTransactions");
    fn({ gymId })
      .then((res) => {
        const items = Array.isArray(res.data?.items) ? res.data.items : [];
        setTxns(items);
        setCache(cacheKey, { txns: items });
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
    <PageInfo>
      Review your SMS credit balance and transaction history.
    </PageInfo>

    <div className="card" style={{ padding: 16, maxWidth: 520 }}>
      <div style={{ fontSize: 12, opacity: 0.7 }}>Current balance</div>
      <div style={{ fontSize: 24, fontWeight: 800 }}>
        {loading ? "—" : balance.toLocaleString()}
      </div>
    </div>

    <div className="card" style={{ padding: 16, maxWidth: 520 }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Top Up</div>
      <div style={{ opacity: 0.7, fontSize: 13, marginBottom: 10 }}>
        Add credit to your gym balance via M-Pesa.
      </div>
      <div style={{ display: "grid", gap: 8, marginBottom: 10 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            border: "1px solid #ddd",
            borderRadius: 6,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "8px 10px",
              background: "#f9fafb",
              borderRight: "1px solid #ddd",
              fontWeight: 600,
            }}
          >
            +254
          </div>
          <input
            type="tel"
            inputMode="numeric"
            maxLength={9}
            placeholder="7XXXXXXXX"
            value={topUpPhone}
            onChange={(e) =>
              setTopUpPhone(e.target.value.replace(/\D/g, "").slice(0, 9))
            }
            style={{ padding: "8px 10px", border: "none", outline: "none", width: "100%" }}
          />
        </div>
        <input
          type="number"
          min="1"
          placeholder="Amount"
          value={topUpAmount}
          onChange={(e) => setTopUpAmount(e.target.value)}
          style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #ddd" }}
        />
      </div>
      <button
        type="button"
        disabled={topUpLoading}
        style={{
          padding: "8px 16px",
          fontWeight: 600,
          backgroundColor: "#166534",
          color: "white",
          borderRadius: 6,
          opacity: topUpLoading ? 0.7 : 1,
          cursor: topUpLoading ? "not-allowed" : "pointer",
        }}
        onClick={handleTopUp}
      >
        {topUpLoading ? "Sending..." : "Add balance"}
      </button>
      {!!topUpError && (
        <div style={{ marginTop: 10, color: "#991b1b", fontSize: 13 }}>
          {topUpError}
        </div>
      )}
      {!!topUpSuccess && (
        <div style={{ marginTop: 10, color: "#166534", fontSize: 13 }}>
          {topUpSuccess}
        </div>
      )}
    </div>

      <div className="card" style={{ padding: 16 }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Transactions</div>
        {txnsLoading ? (
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
  );
}
