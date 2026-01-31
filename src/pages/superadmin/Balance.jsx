// src/pages/superadmin/Balance.jsx
import { useEffect, useState, useCallback } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase/db";
import { useAuth } from "../../context/AuthContext";

export default function Balance() {
  const { realUserDoc } = useAuth();
  const [gyms, setGyms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [balanceEdits, setBalanceEdits] = useState({});
  const [saving, setSaving] = useState({});

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
      setSaving((prev) => ({ ...prev, [gym.id]: true }));
      try {
        await updateDoc(doc(db, "gyms", gym.id), { cashBalance: clamped });
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

  if (realUserDoc?.role !== "SUPER_ADMIN") {
    return (
      <div style={{ padding: 24 }}>
        <h2>Unauthorized</h2>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Balance</h2>
        <p>Loading...</p>
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

      {!gyms.length ? (
        <p>No gyms found.</p>
      ) : (
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
              {gyms.map((gym) => (
                <tr key={gym.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "8px", fontWeight: 600 }}>{gym.name}</td>
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
