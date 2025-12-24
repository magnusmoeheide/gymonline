// src/pages/admin/Overview.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../firebase/db";
import { useAuth, SIM_KEY } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Overview() {
  const nav = useNavigate();
  const { userDoc, startSimulation, stopSimulation, isSimulated } = useAuth();
  const gymId = userDoc?.gymId;

  const [members, setMembers] = useState([]);
  const [busy, setBusy] = useState(false);

  const simUserId = useMemo(
    () => localStorage.getItem(SIM_KEY) || "",
    [isSimulated]
  );

  useEffect(() => {
    if (!gymId) return;

    let cancelled = false;
    setBusy(true);

    const q = query(
      collection(db, "users"),
      where("gymId", "==", gymId),
      where("role", "==", "MEMBER")
    );

    getDocs(q)
      .then((snap) => {
        if (cancelled) return;
        setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      })
      .finally(() => {
        if (cancelled) return;
        setBusy(false);
      });

    return () => {
      cancelled = true;
    };
  }, [gymId]);

  const activeSimUser = useMemo(
    () => members.find((m) => m.id === simUserId),
    [members, simUserId]
  );

  const onStart = useCallback(
    (uid) => {
      if (!uid) return;
      startSimulation(uid);
      nav("/app", { replace: true });
    },
    [startSimulation, nav]
  );

  const onStop = useCallback(() => {
    stopSimulation();
    nav("/admin", { replace: true });
  }, [stopSimulation, nav]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h2>Admin Overview</h2>

      <div style={{ opacity: 0.8 }}>
        GymId: <b>{gymId || "-"}</b>
      </div>

      <p>
        Start with: <b>Plans</b> → <b>Members</b> → <b>Subscriptions</b>
      </p>

      <hr />

      <div>
        <h3>Simulate member</h3>

        {isSimulated ? (
          <div
            style={{
              padding: 12,
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              background: "#fafafa",
              display: "grid",
              gap: 8,
              maxWidth: 520,
            }}
          >
            <div>
              Simulating as: <b>{activeSimUser?.name || simUserId}</b>
            </div>
            <button onClick={onStop}>Exit simulation</button>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8, maxWidth: 520 }}>
            <select
              defaultValue=""
              onChange={(e) => onStart(e.target.value)}
              disabled={busy}
            >
              <option value="">Select member to simulate</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.phoneE164})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
