// src/pages/superadmin/Rates.jsx
import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, updateDoc, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../firebase/db";
import { useAuth } from "../../context/AuthContext";

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function Rates() {
  const { realUserDoc } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [gyms, setGyms] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [defaults, setDefaults] = useState({
    smsRate: "0",
    emailRate: "0",
    perUserRate: "0",
  });

  useEffect(() => {
    if (realUserDoc?.role !== "SUPER_ADMIN") return;
    let cancelled = false;
    setBusy(true);

    (async () => {
      try {
        setError("");
        const gSnap = await getDocs(collection(db, "gyms"));
        if (cancelled) return;
        const rows = gSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setGyms(rows);
        try {
          const ratesSnap = await getDoc(doc(db, "config", "rates"));
          if (ratesSnap.exists()) {
            const data = ratesSnap.data() || {};
            setDefaults({
              smsRate: String(data.smsRate ?? "0"),
              emailRate: String(data.emailRate ?? "0"),
              perUserRate: String(data.perUserRate ?? "0"),
            });
          }
        } catch (e) {
          console.warn("[Rates] defaults load failed", e);
        }
      } catch (e) {
        console.error("[Rates] load failed", e);
        if (!cancelled) setError(e?.message || String(e));
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [realUserDoc]);

  const rows = useMemo(
    () =>
      gyms.map((g) => ({
        id: g.id,
        name: g.name || g.id,
        smsRate: toNumber(g.smsRate),
        emailRate: toNumber(g.emailRate),
        perUserRate: toNumber(g.perUserRate),
      })),
    [gyms]
  );

  function getDraft(id) {
    const d = drafts[id] || {};
    const base = rows.find((r) => r.id === id);
    return {
      smsRate:
        d.smsRate !== undefined ? d.smsRate : String(base?.smsRate ?? 0),
      emailRate:
        d.emailRate !== undefined ? d.emailRate : String(base?.emailRate ?? 0),
      perUserRate:
        d.perUserRate !== undefined ? d.perUserRate : String(base?.perUserRate ?? 0),
    };
  }

  async function saveDefaults() {
    try {
      const next = {
        smsRate: toNumber(defaults.smsRate),
        emailRate: toNumber(defaults.emailRate),
        perUserRate: toNumber(defaults.perUserRate),
        updatedAt: new Date(),
      };
      await setDoc(doc(db, "config", "rates"), next, { merge: true });
      setDefaults({
        smsRate: String(next.smsRate),
        emailRate: String(next.emailRate),
        perUserRate: String(next.perUserRate),
      });
      alert("Default rates updated");
    } catch (e) {
      console.error("[Rates] save defaults failed", e);
      alert(e?.message || "Failed to update default rates");
    }
  }

  async function saveRates(id) {
    try {
      const d = getDraft(id);
      const patch = {
        smsRate: toNumber(d.smsRate),
        emailRate: toNumber(d.emailRate),
        perUserRate: toNumber(d.perUserRate),
      };
      await updateDoc(doc(db, "gyms", id), patch);
      setGyms((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
      alert("Rates updated");
    } catch (e) {
      console.error("[Rates] save rates failed", e);
      alert(e?.message || "Failed to update rates");
    }
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
      <h2>Rates</h2>
      <div className="card" style={{ padding: 12, maxWidth: 820 }}>
        Set per‑gym rates for SMS, email, and monthly billing per subscribing
        user.
      </div>
      <div className="card" style={{ padding: 12, maxWidth: 820 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>
          Default rates for new gyms
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr)) auto",
            gap: 10,
            alignItems: "end",
          }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, opacity: 0.7 }}>SMS rate</span>
            <input
              value={defaults.smsRate}
              onChange={(e) =>
                setDefaults((prev) => ({ ...prev, smsRate: e.target.value }))
              }
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, opacity: 0.7 }}>Email rate</span>
            <input
              value={defaults.emailRate}
              onChange={(e) =>
                setDefaults((prev) => ({ ...prev, emailRate: e.target.value }))
              }
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, opacity: 0.7 }}>Per user rate</span>
            <input
              value={defaults.perUserRate}
              onChange={(e) =>
                setDefaults((prev) => ({ ...prev, perUserRate: e.target.value }))
              }
            />
          </label>
          <button onClick={saveDefaults}>Save defaults</button>
        </div>
      </div>

      <div className="table-scroll">
        <table
          width="100%"
          cellPadding="8"
          style={{ borderCollapse: "collapse" }}
        >
          <thead>
            <tr style={{ borderBottom: "1px solid #eee" }}>
              <th align="left">Gym</th>
              <th align="left">SMS rate</th>
              <th align="left">Email rate</th>
              <th align="left">Per user rate</th>
              <th align="left">Actions</th>
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
              rows.map((r) => {
                const d = getDraft(r.id);
                return (
                  <tr key={r.id} style={{ borderBottom: "1px solid #f3f3f3" }}>
                    <td style={{ fontWeight: 700 }}>{r.name}</td>
                    <td>
                      <input
                        value={d.smsRate}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [r.id]: { ...getDraft(r.id), smsRate: e.target.value },
                          }))
                        }
                        style={{ maxWidth: 140 }}
                      />
                    </td>
                    <td>
                      <input
                        value={d.emailRate}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [r.id]: { ...getDraft(r.id), emailRate: e.target.value },
                          }))
                        }
                        style={{ maxWidth: 140 }}
                      />
                    </td>
                    <td>
                      <input
                        value={d.perUserRate}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [r.id]: { ...getDraft(r.id), perUserRate: e.target.value },
                          }))
                        }
                        style={{ maxWidth: 160 }}
                      />
                    </td>
                    <td>
                      <button onClick={() => saveRates(r.id)}>Save</button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
