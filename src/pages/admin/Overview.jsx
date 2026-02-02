// src/pages/admin/Overview.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { collection, query, where, getDocs, getDoc, doc } from "firebase/firestore";
import { db } from "../../firebase/db";
import { useAuth, SIM_KEY } from "../../context/AuthContext";
import { useNavigate, useParams } from "react-router-dom";

export default function Overview() {
  const nav = useNavigate();
  const params = useParams();
  const slug = params?.slug ? String(params.slug) : "";
  const { userDoc, realUserDoc, startSimulation, stopSimulation, isSimulated } = useAuth();
  const gymId = userDoc?.gymId;
  const isSuperAdmin = realUserDoc?.role === "SUPER_ADMIN";

  const [members, setMembers] = useState([]);
  const [subs, setSubs] = useState([]);
  const [gym, setGym] = useState(null);
  const [busy, setBusy] = useState(false);
  function toDate(ts) {
    if (!ts) return null;
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function money(n) {
    const x = Number(n) || 0;
    return x.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }

  const simUserId = useMemo(
    () => localStorage.getItem(SIM_KEY) || "",
    [isSimulated]
  );

  useEffect(() => {
    if (!gymId) return;

    let cancelled = false;
    setBusy(true);

    const membersQ = query(
      collection(db, "users"),
      where("gymId", "==", gymId),
      where("role", "==", "MEMBER")
    );
    const subsQ = query(
      collection(db, "subscriptions"),
      where("gymId", "==", gymId)
    );
    const gymRef = doc(db, "gyms", gymId);

    Promise.all([getDocs(membersQ), getDocs(subsQ), getDoc(gymRef)])
      .then(([mSnap, sSnap, gSnap]) => {
        if (cancelled) return;
        setMembers(mSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setSubs(sSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setGym(gSnap?.exists?.() ? { id: gSnap.id, ...gSnap.data() } : null);
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
      const base = slug ? `/${slug}` : userDoc?.gymSlug ? `/${userDoc.gymSlug}` : "";
      nav(base ? `${base}/app` : "/app", { replace: true });
    },
    [startSimulation, nav, slug, userDoc]
  );

  const onStop = useCallback(() => {
    stopSimulation();
    const base = slug ? `/${slug}` : userDoc?.gymSlug ? `/${userDoc.gymSlug}` : "";
    nav(base ? `${base}/admin` : "/admin", { replace: true });
  }, [stopSimulation, nav, slug, userDoc]);

  const activeSubs = useMemo(() => {
    const now = new Date();
    return subs.filter((s) => {
      if (s.status !== "active") return false;
      const start = toDate(s.startDate);
      const end = toDate(s.endDate);
      if (start && start > now) return false;
      return end ? end >= now : true;
    });
  }, [subs]);

  const activeMemberCount = useMemo(() => {
    const set = new Set(activeSubs.map((s) => s.userId));
    return set.size;
  }, [activeSubs]);

  const revenueStats = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    let yearTotal = 0;
    let monthTotal = 0;

    for (const s of subs) {
      if (s.paymentStatus !== "paid") continue;
      const amount = Number(s.planPrice) || 0;
      if (!amount) continue;
      const d = toDate(s.startDate) || toDate(s.createdAt);
      if (!d) continue;
      if (d.getFullYear() === year) {
        yearTotal += amount;
        if (d.getMonth() === month) monthTotal += amount;
      }
    }

    return { yearTotal, monthTotal };
  }, [subs]);

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <h2>Admin Overview</h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 12,
        }}
      >
          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              Current active subscriptions
            </div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>
              {busy ? "—" : activeSubs.length}
            </div>
          </div>
          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              Active members / total
            </div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>
              {busy ? "—" : `${activeMemberCount} / ${members.length}`}
            </div>
          </div>
          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Revenue this year</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>
              {busy ? "—" : money(revenueStats.yearTotal)}
            </div>
          </div>
          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Revenue this month</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>
              {busy ? "—" : money(revenueStats.monthTotal)}
            </div>
          </div>
      </div>

      <div>
        <h3>Simulate member</h3>

        {isSuperAdmin ? (
          <div
            className="card"
            style={{
              padding: 12,
              display: "grid",
              gap: 8,
              maxWidth: 520,
            }}
          >
            {isSimulated ? (
              <div>
                Simulating as:{" "}
                <b>{userDoc?.email || userDoc?.name || simUserId}</b>
              </div>
            ) : (
              <div style={{ opacity: 0.7 }}>
                Not simulating anyone.
              </div>
            )}
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
            {isSimulated ? <button onClick={onStop}>Exit simulation</button> : null}
          </div>
        ) : isSimulated ? (
          <div
            className="card"
            style={{
              padding: 12,
              display: "grid",
              gap: 8,
              maxWidth: 520,
            }}
          >
            <div>
              Simulating as:{" "}
              <b>{activeSimUser?.email || activeSimUser?.name || simUserId}</b>
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
