// src/pages/admin/Overview.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
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
  const [busy, setBusy] = useState(false);
  const [memberQuery, setMemberQuery] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);

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

  function norm(s) {
    return String(s || "")
      .trim()
      .toLowerCase();
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

    Promise.all([getDocs(membersQ), getDocs(subsQ)])
      .then(([mSnap, sSnap]) => {
        if (cancelled) return;
        setMembers(mSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setSubs(sSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
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

  const selectedMember = useMemo(
    () => members.find((m) => m.id === selectedMemberId) || null,
    [members, selectedMemberId]
  );

  const selectedSubs = useMemo(() => {
    if (!selectedMemberId) return [];
    const list = subs.filter((s) => s.userId === selectedMemberId);
    list.sort((a, b) => {
      const ad = a.startDate?.toDate ? a.startDate.toDate() : new Date(0);
      const bd = b.startDate?.toDate ? b.startDate.toDate() : new Date(0);
      return bd.getTime() - ad.getTime();
    });
    return list;
  }, [subs, selectedMemberId]);

  const activeSub = useMemo(() => {
    const now = new Date();
    return (
      selectedSubs.find((s) => {
        if (s.status !== "active") return false;
        const start = toDate(s.startDate);
        const end = toDate(s.endDate);
        if (start && start > now) return false;
        return end ? end >= now : true;
      }) || null
    );
  }, [selectedSubs]);

  const memberStatusBorder = useMemo(() => {
    if (!selectedMember) return "1px solid #eee";
    if (!activeSub) return "2px solid #ef4444";
    if (activeSub.paymentStatus === "awaiting_payment")
      return "2px solid #f59e0b";
    return "2px solid #16a34a";
  }, [selectedMember, activeSub]);

  const memberStatusBadge = useMemo(() => {
    if (!selectedMember) return null;
    if (!activeSub) {
      return { text: "Inactive", bg: "#fee2e2", color: "#991b1b" };
    }
    if (activeSub.paymentStatus === "awaiting_payment") {
      return { text: "Awaiting payment", bg: "#ffedd5", color: "#9a3412" };
    }
    if (activeSub.paymentStatus === "comped") {
      return { text: "Comped", bg: "#e0f2fe", color: "#075985" };
    }
    return { text: "Paid", bg: "#dcfce7", color: "#166534" };
  }, [selectedMember, activeSub]);

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
        <h3>Member lookup</h3>

        <div style={{ position: "relative", maxWidth: 520 }}>
          <input
            placeholder="Search member name / phone / email…"
            value={memberQuery}
            onChange={(e) => {
              setMemberQuery(e.target.value);
              setShowMemberDropdown(true);
            }}
            onFocus={() => setShowMemberDropdown(true)}
            onBlur={() => setTimeout(() => setShowMemberDropdown(false), 120)}
          />

          {showMemberDropdown && memberMatches.length ? (
            <div
              style={{
                position: "absolute",
                zIndex: 10,
                left: 0,
                right: 0,
                marginTop: 6,
                background: "#fff",
                border: "1px solid #eee",
                borderRadius: 10,
                boxShadow: "0 12px 30px rgba(0,0,0,.08)",
                overflow: "hidden",
              }}
            >
              {memberMatches.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setSelectedMemberId(m.id);
                    setMemberQuery(m.name || "");
                    setShowMemberDropdown(false);
                  }}
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

        {selectedMember ? (
          <div style={{ marginTop: 14, maxWidth: 720, display: "grid", gap: 12 }}>
            <div
              style={{
                padding: 12,
                border: memberStatusBorder,
                borderRadius: 12,
                background: "#fff",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <div style={{ fontWeight: 700 }}>
                  {selectedMember.name || "Member"} •{" "}
                  {selectedMember.phoneE164 || "—"}
                </div>
                {memberStatusBadge ? (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "4px 8px",
                      borderRadius: 999,
                      background: memberStatusBadge.bg,
                      color: memberStatusBadge.color,
                    }}
                  >
                    {memberStatusBadge.text}
                  </span>
                ) : null}
              </div>

              {activeSub ? (
                <div style={{ marginBottom: 4 }}>
                  Active subscription — {activeSub.planName || activeSub.planId}{" "}
                  until {fmtDate(activeSub.endDate)}
                </div>
              ) : (
                <div style={{ opacity: 0.75 }}>No active subscription</div>
              )}
            </div>

            <div className="card" style={{ padding: 12, background: "#f7f7f7" }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>
                Subscription history
              </div>

              {!selectedSubs.length ? (
                <div style={{ opacity: 0.7 }}>
                  {busy ? "Loading…" : "No subscriptions found."}
                </div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {selectedSubs.map((s) => (
                    <div
                      key={s.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1.2fr 1fr 1fr 1fr",
                        gap: 8,
                        padding: 10,
                        borderRadius: 10,
                        border: "1px solid #f1f1f1",
                        background: "#fafafa",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 12, opacity: 0.7 }}>Plan</div>
                        <div style={{ fontWeight: 600 }}>
                          {s.planName || s.planId}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, opacity: 0.7 }}>Status</div>
                        <div>{s.status}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, opacity: 0.7 }}>Start</div>
                        <div>{fmtDate(s.startDate)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, opacity: 0.7 }}>End</div>
                        <div>{fmtDate(s.endDate)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 10, opacity: 0.7 }}>
            Search a member to see subscription details.
          </div>
        )}
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
