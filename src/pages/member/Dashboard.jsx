// src/pages/app/Dashboard.jsx (replace styling only; logic unchanged)
import { useEffect, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../firebase/db";
import { useAuth } from "../../context/AuthContext";
import PageInfo from "../../components/PageInfo";

export default function Dashboard() {
  const { user, userDoc } = useAuth();
  const gymId = userDoc?.gymId;
  const displayName =
    userDoc?.name || userDoc?.fullName || userDoc?.displayName || user?.email;

  const [activeSubs, setActiveSubs] = useState([]);

  useEffect(() => {
    async function load() {
      if (!user || !gymId) return;
      const q = query(
        collection(db, "subscriptions"),
        where("gymId", "==", gymId),
        where("userId", "==", user.uid),
        where("status", "==", "active"),
      );
      const snap = await getDocs(q);
      setActiveSubs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }
    load();
  }, [user, gymId]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gap: 6 }}>
        <div
          style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}
        >
          Member Dashboard
        </div>
        <div style={{ opacity: 0.8 }}>
          Welcome, <b>{displayName || user?.email}</b>
        </div>
      </div>
      <PageInfo>
        View your active bundles and key membership details at a glance.
      </PageInfo>

      <div className="card" style={{ padding: 16 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 10,
          }}
        >
          <h3 style={{ margin: 0 }}>Active bundles</h3>
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            {activeSubs.length} active
          </div>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {activeSubs.map((s) => (
            <div
              key={s.id}
              style={{
                padding: 12,
                borderRadius: 14,
                border: "1px solid var(--border)",
                background: "rgba(255,255,255,.04)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div style={{ display: "grid", gap: 4 }}>
                <div style={{ fontSize: 13, opacity: 0.75 }}>Status</div>
                <div style={{ fontWeight: 700 }}>{s.status}</div>
              </div>

              <div style={{ display: "grid", gap: 4, textAlign: "right" }}>
                <div style={{ fontSize: 13, opacity: 0.75 }}>Ends</div>
                <div style={{ fontWeight: 700 }}>
                  {s.endDate?.toDate
                    ? s.endDate.toDate().toISOString().slice(0, 10)
                    : "-"}
                </div>
              </div>
            </div>
          ))}

          {!activeSubs.length ? (
            <div style={{ opacity: 0.75 }}>No active bundles yet.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
