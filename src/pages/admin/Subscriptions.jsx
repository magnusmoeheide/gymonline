// src/pages/admin/Subscriptions.jsx
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  Timestamp,
  limit,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "../../firebase/db";
import { useAuth } from "../../context/AuthContext";

function toDateInputValue(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function fmtDate(ts) {
  if (!ts) return "-";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return Number.isNaN(d.getTime()) ? "-" : d.toISOString().slice(0, 10);
}

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
function fmtYmd(d) {
  if (!d) return "-";
  return d.toISOString().slice(0, 10);
}
function parseDateInput(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}
function isDateWithinSub(dateOnly, subStartTs, subEndTs) {
  const day = startOfDay(dateOnly);
  const dayEndExcl = endOfDayExclusive(dateOnly);

  const s = toDate(subStartTs);
  const e = toDate(subEndTs);
  if (!s || !e) return false;

  const subStart = startOfDay(s);
  const subEndExcl = endOfDayExclusive(e);

  return overlapMs(day, dayEndExcl, subStart, subEndExcl) > 0;
}
function norm(s) {
  return String(s || "")
    .trim()
    .toLowerCase();
}

function memberLabel(member) {
  return member?.name || "Unknown member";
}

const FILTER_KEY = "admin_subscriptions_revenue_filter_v1";
const MEMBER_FILTER_KEY = "admin_subscriptions_member_filter_v1";
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

export default function Subscriptions() {
  const { userDoc } = useAuth();
  const gymId = userDoc?.gymId;

  const [members, setMembers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [subs, setSubs] = useState([]);
  const [busy, setBusy] = useState(false);

  // assign popup
  const [showAssign, setShowAssign] = useState(false);
  const [assignErr, setAssignErr] = useState("");
  const [assignWarn, setAssignWarn] = useState("");

  const [userId, setUserId] = useState("");
  const [planId, setPlanId] = useState("");
  const [startDate, setStartDate] = useState(toDateInputValue(new Date()));

  const [paymentStatus, setPaymentStatus] = useState("awaiting_payment"); // paid | awaiting_payment | comped
  const [comments, setComments] = useState("");

  // ---- Edit popup (subscriptions) ----
  const [showEdit, setShowEdit] = useState(false);
  const [editErr, setEditErr] = useState("");
  const [editSub, setEditSub] = useState(null);

  const [editStatus, setEditStatus] = useState("active"); // active | ended | cancelled | paused
  const [editPayment, setEditPayment] = useState("awaiting_payment"); // paid | awaiting_payment | comped
  const [editComments, setEditComments] = useState("");
  const [editStartDate, setEditStartDate] = useState(
    toDateInputValue(new Date())
  );
  const [editEndDate, setEditEndDate] = useState(toDateInputValue(new Date()));

  // ---- Member filter (typeahead) ----
  const [memberQuery, setMemberQuery] = useState("");
  const [memberFilterUserId, setMemberFilterUserId] = useState("");
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(MEMBER_FILTER_KEY);
      if (!raw) return;
      const v = JSON.parse(raw);
      if (typeof v?.q === "string") setMemberQuery(v.q);
      if (typeof v?.uid === "string") setMemberFilterUserId(v.uid);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        MEMBER_FILTER_KEY,
        JSON.stringify({ q: memberQuery, uid: memberFilterUserId })
      );
    } catch {}
  }, [memberQuery, memberFilterUserId]);

  // ---- Revenue filter (saved in localStorage) ----
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
      const membersQ = query(
        collection(db, "users"),
        where("gymId", "==", gymId),
        where("role", "==", "MEMBER")
      );

      const plansQ = query(
        collection(db, "plans"),
        where("gymId", "==", gymId),
        where("isActive", "==", true)
      );

      const subsQ = query(
        collection(db, "subscriptions"),
        where("gymId", "==", gymId)
      );

      const [mSnap, pSnap, sSnap] = await Promise.all([
        getDocs(membersQ),
        getDocs(plansQ),
        getDocs(subsQ),
      ]);

      const mRows = mSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMembers(mRows);
      setPlans(pSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setSubs(sSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

      if (
        memberFilterUserId &&
        !mRows.some((m) => m.id === memberFilterUserId)
      ) {
        setMemberFilterUserId("");
      }
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gymId]);

  const memberMap = useMemo(() => {
    const m = new Map();
    members.forEach((x) => m.set(x.id, x));
    return m;
  }, [members]);

  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === planId) || null,
    [plans, planId]
  );

  const selectedMember = useMemo(
    () => (userId ? memberMap.get(userId) || null : null),
    [userId, memberMap]
  );

  const previousSubs = useMemo(() => {
    if (!userId) return [];
    const list = subs.filter((s) => s.userId === userId);
    list.sort((a, b) => {
      const ad = toDate(a.createdAt) || toDate(a.startDate) || new Date(0);
      const bd = toDate(b.createdAt) || toDate(b.startDate) || new Date(0);
      return bd.getTime() - ad.getTime();
    });
    return list;
  }, [subs, userId]);

  function openAssign() {
    setAssignErr("");
    setAssignWarn("");
    setShowAssign(true);
  }

  function closeAssign() {
    setShowAssign(false);
    setAssignErr("");
    setAssignWarn("");
    setUserId("");
    setPlanId("");
    setStartDate(toDateInputValue(new Date()));
    setPaymentStatus("awaiting_payment");
    setComments("");
  }

  // warning only when startDate falls inside existing active time_based sub
  useEffect(() => {
    setAssignWarn("");
    if (!userId) return;
    const d = parseDateInput(startDate);
    if (!d) return;

    const covering = subs
      .filter((s) => s.userId === userId)
      .filter((s) => s.status === "active")
      .filter((s) => s.planType !== "session_pack")
      .filter((s) => isDateWithinSub(d, s.startDate, s.endDate))
      .sort((a, b) => {
        const ae = toDate(a.endDate) || new Date(0);
        const be = toDate(b.endDate) || new Date(0);
        return be.getTime() - ae.getTime();
      })[0];

    if (!covering) return;

    const until = toDate(covering.endDate);
    setAssignWarn(
      `Member already has a subscription until ${until ? fmtYmd(until) : "?"}.`
    );
  }, [userId, startDate, subs]);

  async function assign(e) {
    e.preventDefault();
    if (!gymId) return;

    setAssignErr("");

    if (!userId) return setAssignErr("Pick member");
    if (!planId) return setAssignErr("Pick plan");

    const plan = selectedPlan;
    if (!plan) return setAssignErr("Plan not found");

    const startD = parseDateInput(startDate);
    if (!startD) return setAssignErr("Invalid start date");

    const covering = subs
      .filter((s) => s.userId === userId)
      .filter((s) => s.status === "active")
      .filter((s) => s.planType !== "session_pack")
      .find((s) => isDateWithinSub(startD, s.startDate, s.endDate));

    if (covering) {
      const until = toDate(covering.endDate);
      return setAssignErr(
        `Member already has a subscription until ${
          until ? fmtYmd(until) : "?"
        }.`
      );
    }

    // Remove sessions functionality: only time_based supported for now
    if (plan.type !== "time_based") {
      return setAssignErr("Only time-based plans are supported right now.");
    }

    const days = Number(plan.durationDays) || 30;
    const endD = new Date(startD);
    endD.setDate(endD.getDate() + days - 1); // inclusive

    const pay = ["paid", "awaiting_payment", "comped"].includes(paymentStatus)
      ? paymentStatus
      : "awaiting_payment";

    setBusy(true);
    try {
      const activeQ = query(
        collection(db, "subscriptions"),
        where("gymId", "==", gymId),
        where("userId", "==", userId),
        where("status", "==", "active"),
        limit(1)
      );
      const activeSnap = await getDocs(activeQ);
      if (!activeSnap.empty) {
        setAssignErr("Member already has an active subscription");
        return;
      }

      const nowTs = serverTimestamp();

      await addDoc(collection(db, "subscriptions"), {
        gymId,
        userId,
        planId,

        planName: plan.name,
        planType: plan.type,
        planPrice: plan.price ?? null,
        durationDays: days,

        status: "active",
        startDate: Timestamp.fromDate(startD),
        endDate: Timestamp.fromDate(endD),

        paymentStatus: pay,
        comments: String(comments || "").trim() || null,

        reminderFlags: { d7: false, d1: false, expired: false },
        createdAt: nowTs,
        updatedAt: nowTs,
      });

      await load();
      closeAssign();
    } catch (err) {
      console.error(err);
      setAssignErr(err?.message || "Failed to assign subscription");
    } finally {
      setBusy(false);
    }
  }

  async function endSubscription(sub) {
    if (!confirm("End this subscription now?")) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, "subscriptions", sub.id), {
        status: "ended",
        updatedAt: serverTimestamp(),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  // ---- Edit popup handlers ----
  function openEdit(sub) {
    setEditErr("");
    setEditSub(sub);

    setEditStatus(String(sub?.status || "active"));
    setEditPayment(String(sub?.paymentStatus || "awaiting_payment"));
    setEditComments(String(sub?.comments || ""));

    const s = toDate(sub?.startDate) || new Date();
    const e = toDate(sub?.endDate) || new Date();
    setEditStartDate(toDateInputValue(s));
    setEditEndDate(toDateInputValue(e));

    setShowEdit(true);
  }

  function closeEdit() {
    setShowEdit(false);
    setEditErr("");
    setEditSub(null);
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editSub?.id) return;

    const sD = parseDateInput(editStartDate);
    const eD = parseDateInput(editEndDate);
    if (!sD) return setEditErr("Invalid start date");
    if (!eD) return setEditErr("Invalid end date");
    if (eD.getTime() < sD.getTime())
      return setEditErr("End date cannot be before start date");

    const st = ["active", "ended", "cancelled", "paused"].includes(editStatus)
      ? editStatus
      : "active";
    const pay = ["paid", "awaiting_payment", "comped"].includes(editPayment)
      ? editPayment
      : "awaiting_payment";

    setBusy(true);
    try {
      await updateDoc(doc(db, "subscriptions", editSub.id), {
        status: st,
        paymentStatus: pay,
        comments: String(editComments || "").trim() || null,
        startDate: Timestamp.fromDate(sD),
        endDate: Timestamp.fromDate(eD),
        updatedAt: serverTimestamp(),
      });

      await load();
      closeEdit();
    } catch (err) {
      console.error(err);
      setEditErr(err?.message || "Failed to update subscription");
    } finally {
      setBusy(false);
    }
  }

  // ---- Revenue calc (prorated by days for time_based plans) ----
  const revenue = useMemo(() => {
    const y = Number(filterYear) || defaultYear;
    const m1 = Number(filterMonth) || defaultMonth;

    const periodStart =
      filterMode === "year" ? startOfYear(y) : startOfMonth(y, m1);
    const periodEndExcl =
      filterMode === "year"
        ? endOfYearExclusive(y)
        : endOfMonthExclusive(y, m1);

    let total = 0;

    for (const s of subs) {
      // sessions removed: only time_based revenue
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
        periodStart,
        periodEndExcl
      );
      if (overlap <= 0) continue;

      const overlapDays = overlap / 86400000;
      total += (price * overlapDays) / subDays;
    }

    return { total, periodStart, periodEndExcl };
  }, [subs, filterMode, filterYear, filterMonth, defaultYear, defaultMonth]);

  const yearOptions = useMemo(() => {
    const cur = new Date().getFullYear();
    const list = [];
    for (let y = cur - 3; y <= cur + 1; y++) list.push(y);
    return list;
  }, []);

  // ---- Member typeahead matches (max 7) ----
  const memberMatches = useMemo(() => {
    const q = norm(memberQuery);
    if (!q) return [];
    return members
      .map((m) => {
        const name = String(m.name || "");
        const phone = String(m.phoneE164 || "");
        const email = String(m.email || "");
        const hay = `${name} ${phone} ${email}`.toLowerCase();
        const idx = hay.indexOf(q);
        return { m, idx };
      })
      .filter((x) => x.idx >= 0)
      .sort(
        (a, b) =>
          a.idx - b.idx ||
          String(a.m.name || "").localeCompare(String(b.m.name || ""))
      )
      .slice(0, 7)
      .map((x) => x.m);
  }, [members, memberQuery]);

  const filteredSubs = useMemo(() => {
    if (!memberFilterUserId) return subs;
    return subs.filter((s) => s.userId === memberFilterUserId);
  }, [subs, memberFilterUserId]);

  const filterMemberLabel = useMemo(() => {
    if (!memberFilterUserId) return "";
    const m = memberMap.get(memberFilterUserId);
    if (!m) return "Unknown member";
    return `${memberLabel(m)}${m.phoneE164 ? ` (${m.phoneE164})` : ""}`;
  }, [memberFilterUserId, memberMap]);

  const filteredSubsSorted = useMemo(() => {
    const list = [...filteredSubs];
    list.sort((a, b) => {
      const ad = toDate(a.startDate) || new Date(0);
      const bd = toDate(b.startDate) || new Date(0);
      return bd.getTime() - ad.getTime();
    });
    return list;
  }, [filteredSubs]);

  function selectMemberFilter(m) {
    setMemberFilterUserId(m.id);
    setMemberQuery(m.name || "");
    setShowMemberDropdown(false);
  }

  function clearMemberFilter() {
    setMemberFilterUserId("");
    setMemberQuery("");
    setShowMemberDropdown(false);
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <h2>Subscriptions</h2>

      {/* Revenue filters */}
      <div
        style={{
          display: "grid",
          gap: 10,
          padding: "12px 14px",
          border: "1px solid #eee",
          borderRadius: 10,
          marginBottom: 14,
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
            {money(revenue.total)} {userDoc?.currency || ""}
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
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {MONTH_NAMES[m - 1]}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      </div>

      {/* Assign button */}
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <button disabled={busy} onClick={openAssign}>
          Assign subscription
        </button>
      </div>

      {/* Assign popup */}
      {showAssign ? (
        <div
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeAssign();
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 14,
            zIndex: 9999,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 760,
              background: "#fff",
              borderRadius: 12,
              border: "1px solid #eee",
              boxShadow: "0 12px 40px rgba(0,0,0,0.15)",
              padding: 14,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontWeight: 800 }}>Assign subscription</div>
              <div style={{ marginLeft: "auto" }}>
                <button disabled={busy} onClick={closeAssign}>
                  Close
                </button>
              </div>
            </div>

            <form
              onSubmit={assign}
              style={{ display: "grid", gap: 10, marginTop: 12 }}
            >
              <label style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 13, opacity: 0.8 }}>Member</div>
                <select
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                >
                  <option value="">Select a member…</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.phoneE164})
                    </option>
                  ))}
                </select>
              </label>

              {selectedMember ? (
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  Selected: <b>{selectedMember.name}</b> —{" "}
                  {selectedMember.phoneE164}
                </div>
              ) : null}

              <label style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 13, opacity: 0.8 }}>Plan</div>
                <select
                  value={planId}
                  onChange={(e) => setPlanId(e.target.value)}
                >
                  <option value="">Select a plan…</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.price},-)
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 13, opacity: 0.8 }}>Start date</div>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 13, opacity: 0.8 }}>Payment status</div>
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value)}
                >
                  <option value="awaiting_payment">Awaiting payment</option>
                  <option value="paid">Paid</option>
                  <option value="comped">Comped</option>
                </select>
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 13, opacity: 0.8 }}>Comments</div>
                <textarea
                  rows={3}
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Optional notes…"
                />
              </label>

              {assignWarn ? (
                <div
                  style={{
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid #fde68a",
                    background: "#fffbeb",
                    fontSize: 13,
                  }}
                >
                  {assignWarn}
                </div>
              ) : null}

              {assignErr ? (
                <div style={{ color: "crimson", fontSize: 13 }}>
                  {assignErr}
                </div>
              ) : null}

              <div style={{ display: "flex", gap: 10 }}>
                <button disabled={busy} type="submit">
                  {busy ? "Saving…" : "Confirm assign"}
                </button>
                <button disabled={busy} type="button" onClick={closeAssign}>
                  Cancel
                </button>
              </div>
            </form>

            {userId ? (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>
                  Previous subscriptions
                </div>
                {previousSubs.length ? (
                  <table
                    width="100%"
                    cellPadding="8"
                    style={{ borderCollapse: "collapse" }}
                  >
                    <thead>
                      <tr style={{ borderBottom: "1px solid #eee" }}>
                        <th align="left">Plan</th>
                        <th align="left">Status</th>
                        <th align="left">Payment</th>
                        <th align="left">Start</th>
                        <th align="left">End</th>
                        <th align="left">Price</th>
                        <th align="left">Comments</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previousSubs.slice(0, 10).map((s) => (
                        <tr
                          key={s.id}
                          style={{ borderBottom: "1px solid #f3f3f3" }}
                        >
                          <td>{s.planName || s.planId}</td>
                          <td>{s.status}</td>
                          <td>{s.paymentStatus || "-"}</td>
                          <td>{fmtDate(s.startDate)}</td>
                          <td>{fmtDate(s.endDate)}</td>
                          <td>{money(s.planPrice)}</td>
                          <td
                            style={{
                              maxWidth: 260,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {s.comments || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ fontSize: 13, opacity: 0.7 }}>
                    No previous subscriptions for this member.
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Edit popup */}
      {showEdit && editSub ? (
        <div
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeEdit();
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 14,
            zIndex: 9999,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 720,
              background: "#fff",
              borderRadius: 12,
              border: "1px solid #eee",
              boxShadow: "0 12px 40px rgba(0,0,0,0.15)",
              padding: 14,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontWeight: 800 }}>Edit subscription</div>
              <div style={{ marginLeft: "auto" }}>
                <button disabled={busy} onClick={closeEdit}>
                  Close
                </button>
              </div>
            </div>

            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
              {memberLabel(memberMap.get(editSub.userId))} •{" "}
              {editSub.planName || editSub.planId}
            </div>

            <form
              onSubmit={saveEdit}
              style={{ display: "grid", gap: 10, marginTop: 12 }}
            >
              <label style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 13, opacity: 0.8 }}>Status</div>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                >
                  <option value="active">Active</option>
                  <option value="ended">Ended</option>
                  <option value="paused">Paused</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 13, opacity: 0.8 }}>Payment status</div>
                <select
                  value={editPayment}
                  onChange={(e) => setEditPayment(e.target.value)}
                >
                  <option value="awaiting_payment">Awaiting payment</option>
                  <option value="paid">Paid</option>
                  <option value="comped">Comped</option>
                </select>
              </label>

              <div
                style={{
                  display: "grid",
                  gap: 10,
                  gridTemplateColumns: "1fr 1fr",
                }}
              >
                <label style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 13, opacity: 0.8 }}>Start date</div>
                  <input
                    type="date"
                    value={editStartDate}
                    onChange={(e) => setEditStartDate(e.target.value)}
                  />
                </label>

                <label style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 13, opacity: 0.8 }}>End date</div>
                  <input
                    type="date"
                    value={editEndDate}
                    onChange={(e) => setEditEndDate(e.target.value)}
                  />
                </label>
              </div>

              <label style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 13, opacity: 0.8 }}>Comments</div>
                <textarea
                  rows={4}
                  value={editComments}
                  onChange={(e) => setEditComments(e.target.value)}
                  placeholder="Optional notes…"
                />
              </label>

              {editErr ? (
                <div style={{ color: "crimson", fontSize: 13 }}>{editErr}</div>
              ) : null}

              <div style={{ display: "flex", gap: 10 }}>
                <button disabled={busy} type="submit">
                  {busy ? "Saving…" : "Save changes"}
                </button>
                <button disabled={busy} type="button" onClick={closeEdit}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* ✅ Member filter (typeahead) */}
      <div
        style={{
          marginTop: 6,
          marginBottom: 14,
          padding: "12px 14px",
          border: "1px solid rgba(28,24,19,.08)",
          borderRadius: 14,
          background: "#fff",
          boxShadow: "0 10px 24px rgba(30,30,50,0.05)",
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: 6 }}>
          Filter subscriptions by member
        </div>
        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 10 }}>
          Quickly narrow the table to a single member.
        </div>

        <div style={{ position: "relative", maxWidth: 520 }}>
          <input
            placeholder="Type member name / phone / email…"
            value={memberQuery}
            onChange={(e) => {
              setMemberQuery(e.target.value);
              setMemberFilterUserId("");
              setShowMemberDropdown(true);
            }}
            onFocus={() => setShowMemberDropdown(true)}
            onBlur={() => setTimeout(() => setShowMemberDropdown(false), 120)}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #e5e7eb",
            }}
          />

          {showMemberDropdown && memberMatches.length ? (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                left: 0,
                right: 0,
                border: "1px solid #eee",
                borderRadius: 10,
                background: "#fff",
                boxShadow: "0 12px 30px rgba(0,0,0,0.10)",
                overflow: "hidden",
                zIndex: 50,
              }}
            >
              {memberMatches.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectMemberFilter(m)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 12px",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 650 }}>{m.name || "Unnamed"}</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    {m.phoneE164 || "—"} {m.email ? `• ${m.email}` : ""}
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            marginTop: 10,
          }}
        >
          {memberFilterUserId ? (
            <>
              <div style={{ fontSize: 13 }}>
                Showing subscriptions for: <b>{filterMemberLabel}</b>
              </div>
              <button type="button" onClick={clearMemberFilter} disabled={busy}>
                Clear
              </button>
            </>
          ) : (
            <div style={{ fontSize: 13, opacity: 0.7 }}>
              No member selected — showing all subscriptions.
            </div>
          )}
        </div>
      </div>

      {/* Main table (filtered by memberFilterUserId) */}
      <table
        width="100%"
        cellPadding="8"
        style={{ borderCollapse: "collapse" }}
      >
        <thead>
          <tr style={{ borderBottom: "1px solid #eee" }}>
            <th align="left">Member</th>
            <th align="left">Plan</th>
            <th align="left">Status</th>
            <th align="left">Payment</th>
            <th align="left">Start</th>
            <th align="left">End</th>
            <th align="left">Comments</th>
            <th align="left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredSubsSorted.map((s) => {
            const member = memberMap.get(s.userId);
            return (
              <tr key={s.id} style={{ borderBottom: "1px solid #f3f3f3" }}>
                <td>{memberLabel(member)}</td>
                <td>{s.planName || s.planId}</td>
                <td>{s.status}</td>
                <td>{s.paymentStatus || "awaiting_payment"}</td>
                <td>{fmtDate(s.startDate)}</td>
                <td>{fmtDate(s.endDate)}</td>
                <td
                  style={{
                    maxWidth: 260,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {s.comments || "—"}
                </td>
                <td style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button disabled={busy} onClick={() => openEdit(s)}>
                    Edit
                  </button>
                  {s.status === "active" ? (
                    <button disabled={busy} onClick={() => endSubscription(s)}>
                      End
                    </button>
                  ) : (
                    <span style={{ opacity: 0.6 }}>—</span>
                  )}
                </td>
              </tr>
            );
          })}

          {!filteredSubsSorted.length ? (
            <tr>
              <td colSpan="8" style={{ opacity: 0.7 }}>
                {busy ? "Loading…" : "No subscriptions found."}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
