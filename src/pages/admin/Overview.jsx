// src/pages/admin/Overview.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { collection, query, where, getDocs, getDoc, doc } from "firebase/firestore";
import { db } from "../../firebase/db";
import { useAuth, SIM_KEY } from "../../context/AuthContext";
import { useNavigate, useParams } from "react-router-dom";
import { getCache, setCache } from "../../app/utils/dataCache";

const CACHE_TTL_MS = 5 * 60 * 1000;

export default function Overview() {
  const nav = useNavigate();
  const params = useParams();
  const slug = params?.slug ? String(params.slug) : "";
  const { userDoc, realUserDoc, startSimulation, stopSimulation, isSimulated } = useAuth();
  const gymId = userDoc?.gymId;
  const isSuperAdmin = realUserDoc?.role === "SUPER_ADMIN";

  const [members, setMembers] = useState([]);
  const [subs, setSubs] = useState([]);
  const [orders, setOrders] = useState([]);
  const [gym, setGym] = useState(null);
  const [busy, setBusy] = useState(false);
  function toDate(ts) {
    if (!ts) return null;
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  function endOfDayExclusive(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  }
  function startOfYear(y) {
    return new Date(y, 0, 1);
  }
  function endOfYearExclusive(y) {
    return new Date(y + 1, 0, 1);
  }
  function startOfMonth(y, m) {
    return new Date(y, m, 1);
  }
  function endOfMonthExclusive(y, m) {
    return new Date(y, m + 1, 1);
  }
  function overlapMs(aStart, aEndExcl, bStart, bEndExcl) {
    const s = Math.max(aStart.getTime(), bStart.getTime());
    const e = Math.min(aEndExcl.getTime(), bEndExcl.getTime());
    return Math.max(0, e - s);
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
    const cacheKey = `adminOverview:${gymId}`;
    const cached = getCache(cacheKey, CACHE_TTL_MS);
    if (cached) {
      setMembers(cached.members || []);
      setSubs(cached.subs || []);
      setOrders(cached.orders || []);
      setGym(cached.gym || null);
      setBusy(false);
    }
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
    const ordersQ = query(
      collection(db, "orders"),
      where("gymId", "==", gymId)
    );
    const gymRef = doc(db, "gyms", gymId);

    Promise.all([getDocs(membersQ), getDocs(subsQ), getDocs(ordersQ), getDoc(gymRef)])
      .then(([mSnap, sSnap, oSnap, gSnap]) => {
        if (cancelled) return;
        const nextMembers = mSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const nextSubs = sSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const nextOrders = oSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const nextGym = gSnap?.exists?.() ? { id: gSnap.id, ...gSnap.data() } : null;
        setMembers(nextMembers);
        setSubs(nextSubs);
        setOrders(nextOrders);
        setGym(nextGym);
        setCache(cacheKey, {
          members: nextMembers,
          subs: nextSubs,
          orders: nextOrders,
          gym: nextGym,
        });
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
    const monthStart = startOfMonth(year, month);
    const monthEndExcl = endOfMonthExclusive(year, month);
    const yearStart = startOfYear(year);
    const yearEndExcl = endOfYearExclusive(year);

    let monthTotal = 0;
    let yearTotal = 0;

    for (const s of subs) {
      const price = Number(s.planPrice) || 0;
      if (!price) continue;

      const start = toDate(s.startDate);
      const end = toDate(s.endDate);
      if (!start || !end) continue;

      const subStart = startOfDay(start);
      const subEndExcl = endOfDayExclusive(end);
      const subMs = Math.max(1, subEndExcl.getTime() - subStart.getTime());
      const subDays = Math.max(1, Math.round(subMs / 86400000));

      const monthOverlap = overlapMs(
        subStart,
        subEndExcl,
        monthStart,
        monthEndExcl
      );
      if (monthOverlap > 0) {
        monthTotal += (price * (monthOverlap / 86400000)) / subDays;
      }

      const yearOverlap = overlapMs(
        subStart,
        subEndExcl,
        yearStart,
        yearEndExcl
      );
      if (yearOverlap > 0) {
        yearTotal += (price * (yearOverlap / 86400000)) / subDays;
      }
    }

    for (const o of orders) {
      const created = toDate(o.createdAt);
      if (!created) continue;
      const ts = created.getTime();
      const amount = Number(o.total) || 0;
      if (ts >= monthStart.getTime() && ts < monthEndExcl.getTime()) {
        monthTotal += amount;
      }
      if (ts >= yearStart.getTime() && ts < yearEndExcl.getTime()) {
        yearTotal += amount;
      }
    }

    return { yearTotal, monthTotal };
  }, [subs, orders]);

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
            <div style={{ fontSize: 12, opacity: 0.7 }}>Revenue this month</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>
              {busy
                ? "—"
                : `${money(revenueStats.monthTotal)} ${userDoc?.currency || ""}`}
            </div>
          </div>
          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Revenue this year</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>
              {busy
                ? "—"
                : `${money(revenueStats.yearTotal)} ${userDoc?.currency || ""}`}
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
