// src/pages/admin/Revenue.jsx
import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../firebase/db";
import { useAuth } from "../../context/AuthContext";

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
function startOfMonth(y, m1) {
  return new Date(y, m1 - 1, 1);
}
function endOfMonthExclusive(y, m1) {
  return new Date(y, m1, 1);
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

const FILTER_KEY = "admin_revenue_filter_v1";
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function Revenue() {
  const { userDoc } = useAuth();
  const gymId = userDoc?.gymId;

  const [subs, setSubs] = useState([]);
  const [orders, setOrders] = useState([]);
  const [busy, setBusy] = useState(false);

  const now = useMemo(() => new Date(), []);
  const defaultYear = now.getFullYear();
  const defaultMonth = now.getMonth() + 1;

  const [filterMode, setFilterMode] = useState("month"); // "month" | "year"
  const [filterYear, setFilterYear] = useState(defaultYear);
  const [filterMonth, setFilterMonth] = useState(defaultMonth);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FILTER_KEY);
      if (!raw) return;
      const v = JSON.parse(raw);
      if (v?.mode === "year" || v?.mode === "month") setFilterMode(v.mode);
      if (Number.isFinite(v?.year)) setFilterYear(v.year);
      if (Number.isFinite(v?.month)) setFilterMonth(v.month);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        FILTER_KEY,
        JSON.stringify({
          mode: filterMode,
          year: filterYear,
          month: filterMonth,
        })
      );
    } catch {}
  }, [filterMode, filterYear, filterMonth]);

  async function load() {
    if (!gymId) return;
    setBusy(true);
    try {
      const subsQ = query(
        collection(db, "subscriptions"),
        where("gymId", "==", gymId)
      );
      const ordersQ = query(
        collection(db, "orders"),
        where("gymId", "==", gymId)
      );
      const [subsSnap, ordersSnap] = await Promise.all([
        getDocs(subsQ),
        getDocs(ordersQ),
      ]);
      setSubs(subsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setOrders(ordersSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
  }, [gymId]);

  const period = useMemo(() => {
    const y = Number(filterYear) || defaultYear;
    const m1 = Number(filterMonth) || defaultMonth;
    const start =
      filterMode === "year" ? startOfYear(y) : startOfMonth(y, m1);
    const endExcl =
      filterMode === "year"
        ? endOfYearExclusive(y)
        : endOfMonthExclusive(y, m1);
    return { start, endExcl };
  }, [filterMode, filterYear, filterMonth, defaultYear, defaultMonth]);

  const subscriptionRevenue = useMemo(() => {
    let total = 0;
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

      const overlap = overlapMs(
        subStart,
        subEndExcl,
        period.start,
        period.endExcl
      );
      if (overlap <= 0) continue;

      const overlapDays = overlap / 86400000;
      total += (price * overlapDays) / subDays;
    }
    return total;
  }, [subs, period]);

  const ordersRevenue = useMemo(() => {
    let total = 0;
    for (const o of orders) {
      const created = toDate(o.createdAt);
      if (!created) continue;
      const ts = created.getTime();
      if (ts < period.start.getTime() || ts >= period.endExcl.getTime()) continue;
      total += Number(o.total) || 0;
    }
    return total;
  }, [orders, period]);

  const totalRevenue = subscriptionRevenue + ordersRevenue;

  const yearOptions = useMemo(() => {
    const cur = new Date().getFullYear();
    const list = [];
    for (let y = cur - 3; y <= cur + 1; y++) list.push(y);
    return list;
  }, []);

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <h2>Revenue</h2>

      <div
        style={{
          display: "grid",
          gap: 10,
          padding: "12px 14px",
          border: "1px solid #eee",
          borderRadius: 10,
          marginBottom: 6,
          background: "#fff",
        }}
      >
        <div style={{ fontWeight: 800 }}>
          {filterMode === "month"
            ? `Revenue for ${MONTH_NAMES[Math.max(0, Math.min(11, filterMonth - 1))]} ${filterYear}`
            : `Revenue for the year of ${filterYear}`}{" "}
          is:{" "}
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "2px 8px",
              borderRadius: 999,
              border: "1px solid rgba(15,118,110,.35)",
              background: "rgba(15,118,110,.08)",
              color: "#0f766e",
              fontWeight: 900,
            }}
          >
            {busy ? "..." : `${money(totalRevenue)} ${userDoc?.currency || ""}`}
          </span>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 13, opacity: 0.8 }}>Mode</span>
            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value)}
            >
              <option value="month">Month</option>
              <option value="year">Year</option>
            </select>
          </label>

          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 13, opacity: 0.8 }}>Year</span>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(Number(e.target.value))}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>

          {filterMode === "month" ? (
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 13, opacity: 0.8 }}>Month</span>
              <select
                value={filterMonth}
                onChange={(e) => setFilterMonth(Number(e.target.value))}
              >
                {MONTH_NAMES.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      </div>

      <div className="table-scroll">
        <table width="100%" cellPadding="8" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #eee" }}>
              <th align="left">Source</th>
              <th align="left">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: "1px solid #f3f3f3" }}>
              <td>Subscriptions</td>
              <td>{busy ? "..." : `${money(subscriptionRevenue)} ${userDoc?.currency || ""}`}</td>
            </tr>
            <tr style={{ borderBottom: "1px solid #f3f3f3" }}>
              <td>Orders</td>
              <td>{busy ? "..." : `${money(ordersRevenue)} ${userDoc?.currency || ""}`}</td>
            </tr>
            <tr style={{ borderTop: "2px solid #eee" }}>
              <td style={{ fontWeight: 800 }}>Total</td>
              <td style={{ fontWeight: 800 }}>
                {busy ? "..." : `${money(totalRevenue)} ${userDoc?.currency || ""}`}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
