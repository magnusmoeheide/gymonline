// src/pages/admin/Communication.jsx
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db } from "../../firebase/db";
import { functions } from "../../firebase/functionsClient";
import { useAuth } from "../../context/AuthContext";

export default function Communication() {
  const { userDoc } = useAuth();
  const gymId = userDoc?.gymId;

  const [members, setMembers] = useState([]);
  const [subs, setSubs] = useState([]);
  const [gym, setGym] = useState(null);
  const [busy, setBusy] = useState(false);
  const [sendBusy, setSendBusy] = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const [logs, setLogs] = useState([]);
  const [logsBusy, setLogsBusy] = useState(false);

  const [showComposer, setShowComposer] = useState(false);
  const [audience, setAudience] = useState("activeSubscriptions");
  const [message, setMessage] = useState("");
  const [memberQuery, setMemberQuery] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState([]);

  useEffect(() => {
    if (!gymId) return;
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
    const gymQ = query(collection(db, "gyms"), where("__name__", "==", gymId));
    Promise.all([getDocs(membersQ), getDocs(subsQ), getDocs(gymQ)])
      .then(([mSnap, sSnap, gSnap]) => {
        setMembers(mSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setSubs(sSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setGym(gSnap.docs[0]?.data() || null);
      })
      .finally(() => setBusy(false));
  }, [gymId]);

  async function loadLogs() {
    if (!gymId) return;
    setLogsBusy(true);
    try {
      const logsQ = query(
        collection(db, "smsLogs"),
        where("gymId", "==", gymId),
        orderBy("sentAt", "desc"),
        limit(50)
      );
      const snap = await getDocs(logsQ);
      setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } finally {
      setLogsBusy(false);
    }
  }

  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gymId]);

  const activeSubUserIds = useMemo(() => {
    const now = new Date();
    const ids = new Set();
    for (const s of subs) {
      if (s.status !== "active") continue;
      const start = s.startDate?.toDate ? s.startDate.toDate() : null;
      const end = s.endDate?.toDate ? s.endDate.toDate() : null;
      if (start && start > now) continue;
      if (end && end < now) continue;
      if (s.userId) ids.add(String(s.userId));
    }
    return ids;
  }, [subs]);

  const membersWithPhone = useMemo(
    () => members.filter((m) => !!m.phoneE164),
    [members]
  );

  const activeMembers = useMemo(
    () =>
      membersWithPhone.filter((m) => (m.status || "active") === "active"),
    [membersWithPhone]
  );

  const membersById = useMemo(() => {
    const map = new Map();
    for (const m of membersWithPhone) map.set(m.id, m);
    return map;
  }, [membersWithPhone]);

  const filteredMembers = useMemo(() => {
    const q = String(memberQuery || "").trim().toLowerCase();
    if (!q) return membersWithPhone;
    return membersWithPhone.filter((m) => {
      const name = String(m.name || "").toLowerCase();
      const phone = String(m.phoneE164 || "").toLowerCase();
      const email = String(m.email || "").toLowerCase();
      return (
        name.includes(q) ||
        phone.includes(q) ||
        email.includes(q)
      );
    });
  }, [membersWithPhone, memberQuery]);

  const activeSubsWithPhoneCount = useMemo(() => {
    let count = 0;
    for (const m of membersWithPhone) {
      if (activeSubUserIds.has(String(m.id))) count += 1;
    }
    return count;
  }, [activeSubUserIds, membersWithPhone]);

  const recipientCount = useMemo(() => {
    if (audience === "custom")
      return selectedUserIds.filter((id) => membersById.has(id)).length;
    if (audience === "activeMembers") return activeMembers.length;
    if (audience === "activeSubscriptions") return activeSubsWithPhoneCount;
    return membersWithPhone.length;
  }, [
    audience,
    activeMembers.length,
    activeSubsWithPhoneCount,
    membersById,
    membersWithPhone.length,
    selectedUserIds,
  ]);

  function toggleUser(id) {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function sendSms() {
    const msg = String(message || "").trim();
    if (!msg) return alert("Enter a message");
    if (recipientCount < 1) return alert("No recipients selected");
    if (!confirm(`Send this SMS to ${recipientCount} member(s)?`)) return;
    setSendBusy(true);
    setSendResult(null);
    try {
      const fn = httpsCallable(functions, "sendBroadcastSms");
      const res = await fn({
        gymId,
        audience,
        message: msg,
        selectedUserIds: audience === "custom" ? selectedUserIds : [],
      });
      setSendResult(res.data || { ok: true });
      setMessage("");
      setSelectedUserIds([]);
      setShowComposer(false);
      await loadLogs();
    } catch (e) {
      alert(e?.message || "Failed to send SMS");
    } finally {
      setSendBusy(false);
    }
  }

  async function deleteLog(logId) {
    if (!confirm("Delete this SMS record?")) return;
    try {
      const fn = httpsCallable(functions, "deleteSmsLog");
      await fn({ logId, gymId });
      setLogs((prev) => prev.filter((l) => l.id !== logId));
    } catch (e) {
      alert(e?.message || "Failed to delete log");
    }
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <h2>Communication</h2>

      <div
        className="card"
        style={{ padding: 16, display: "grid", gap: 12, maxWidth: 880 }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ fontWeight: 700 }}>Bulk SMS</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>
            {busy ? "Loading members..." : `${members.length} members loaded`}
          </div>
          <div style={{ marginLeft: "auto", fontSize: 12, opacity: 0.8 }}>
            Balance:{" "}
            <b>{busy ? "—" : Number(gym?.cashBalance || 0).toLocaleString()}</b>
          </div>
        </div>
        <button onClick={() => setShowComposer((s) => !s)}>
          {showComposer ? "Close composer" : "Create new SMS"}
        </button>

        {sendResult?.ok ? (
          <div style={{ color: "#166534", fontSize: 13 }}>
            Sent. {sendResult.sentCount || 0} succeeded,{" "}
            {sendResult.failedCount || 0} failed.
          </div>
        ) : null}

        {showComposer ? (
          <div style={{ display: "grid", gap: 12 }}>
            <label style={{ display: "grid", gap: 6 }}>
              Audience
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
              >
                <option value="activeSubscriptions">
                  Active subscriptions
                </option>
                <option value="allMembers">All registered members</option>
                <option value="activeMembers">Active members only</option>
                <option value="custom">Select members</option>
              </select>
            </label>

            {audience === "custom" ? (
              <div style={{ display: "grid", gap: 8 }}>
                <input
                  placeholder="Search members by name, phone, or email"
                  value={memberQuery}
                  onChange={(e) => setMemberQuery(e.target.value)}
                />
                <div
                  style={{
                    border: "1px solid #eee",
                    borderRadius: 8,
                    padding: 8,
                    maxHeight: 240,
                    overflow: "auto",
                    display: "grid",
                    gap: 6,
                    background: "#fff",
                  }}
                >
                  {filteredMembers.map((m) => (
                    <label
                      key={m.id}
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedUserIds.includes(m.id)}
                        onChange={() => toggleUser(m.id)}
                      />
                      <span>
                        {m.name || "Member"}{" "}
                        <span style={{ opacity: 0.6 }}>
                          {m.phoneE164 || m.email || ""}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            <label style={{ display: "grid", gap: 6 }}>
              Message
              <textarea
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your SMS message..."
                style={{ width: "100%" }}
              />
            </label>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: 12,
                opacity: 0.7,
              }}
            >
              <div>Recipients: {recipientCount}</div>
              <div>{message.trim().length} characters</div>
            </div>

            <button disabled={sendBusy} onClick={sendSms}>
              {sendBusy ? "Sending..." : "Send SMS"}
            </button>
          </div>
        ) : null}
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ fontWeight: 700 }}>Sent SMS</div>
          <button onClick={loadLogs} disabled={logsBusy}>
            {logsBusy ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div style={{ marginTop: 12, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "8px" }}>To</th>
                <th style={{ textAlign: "left", padding: "8px" }}>Message</th>
                <th style={{ textAlign: "left", padding: "8px" }}>Status</th>
                <th style={{ textAlign: "left", padding: "8px" }}>Error</th>
                <th style={{ textAlign: "left", padding: "8px" }}>Cost</th>
                <th style={{ textAlign: "left", padding: "8px" }}>Sent</th>
                <th style={{ textAlign: "left", padding: "8px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} style={{ borderTop: "1px solid #eee" }}>
                  <td style={{ padding: "8px", whiteSpace: "nowrap" }}>
                    {l.to || "-"}
                  </td>
                  <td style={{ padding: "8px", maxWidth: 360 }}>
                    <div
                      title={l.message || ""}
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {l.message || "-"}
                    </div>
                  </td>
                  <td style={{ padding: "8px" }}>
                    {(() => {
                      const rawStatus =
                        l.status || (l.statusCode ? `Code ${l.statusCode}` : "-");
                      const statusText =
                        rawStatus === "UserInBlacklist"
                          ? "User in blacklist / DND"
                          : rawStatus;
                      const statusCodeNum = Number(l.statusCode);
                      const isSuccess =
                        (Number.isFinite(statusCodeNum) &&
                          statusCodeNum >= 100 &&
                          statusCodeNum < 200) ||
                        String(l.status || "")
                          .toLowerCase()
                          .includes("success");
                      const color = isSuccess ? "#166534" : "#991b1b";
                      const bg = isSuccess ? "#dcfce7" : "#fee2e2";
                      return (
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 700,
                            color,
                            background: bg,
                          }}
                        >
                          {statusText}
                        </span>
                      );
                    })()}
                  </td>
                  <td style={{ padding: "8px", maxWidth: 240 }}>
                    <div
                      title={l.error || ""}
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        color: l.error ? "#991b1b" : "inherit",
                      }}
                    >
                      {l.error || "-"}
                    </div>
                  </td>
                  <td style={{ padding: "8px" }}>{l.cost || "-"}</td>
                  <td style={{ padding: "8px" }}>
                    {l.sentAt?.toDate
                      ? l.sentAt.toDate().toISOString().slice(0, 19)
                      : "-"}
                  </td>
                  <td style={{ padding: "8px" }}>
                    <button onClick={() => deleteLog(l.id)}>Delete</button>
                  </td>
                </tr>
              ))}
              {!logs.length ? (
                <tr>
                  <td colSpan={7} style={{ padding: "12px", opacity: 0.6 }}>
                    {logsBusy ? "Loading..." : "No SMS records yet."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
