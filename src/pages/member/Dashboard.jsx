import { useEffect, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../firebase/db";
import { useAuth } from "../../context/AuthContext";

export default function Dashboard() {
  const { user, userDoc } = useAuth();
  const gymId = userDoc?.gymId;

  const [activeSubs, setActiveSubs] = useState([]);

  useEffect(() => {
    async function load() {
      if (!user || !gymId) return;
      const q = query(
        collection(db, "subscriptions"),
        where("gymId", "==", gymId),
        where("userId", "==", user.uid),
        where("status", "==", "active")
      );
      const snap = await getDocs(q);
      setActiveSubs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }
    load();
  }, [user, gymId]);

  return (
    <div>
      <h2>Member Dashboard</h2>
      <div style={{ opacity: 0.8 }}>
        Welcome, <b>{userDoc?.name || user?.email}</b>
      </div>

      <h3 style={{ marginTop: 16 }}>Active bundles</h3>
      {activeSubs.map((s) => (
        <div
          key={s.id}
          style={{
            padding: 10,
            border: "1px solid #eee",
            borderRadius: 8,
            marginBottom: 8,
          }}
        >
          <div>
            Status: <b>{s.status}</b>
          </div>
          <div>
            Ends:{" "}
            <b>
              {s.endDate?.toDate
                ? s.endDate.toDate().toISOString().slice(0, 10)
                : "-"}
            </b>
          </div>
        </div>
      ))}
      {!activeSubs.length ? (
        <div style={{ opacity: 0.7 }}>No active bundles yet.</div>
      ) : null}
    </div>
  );
}
