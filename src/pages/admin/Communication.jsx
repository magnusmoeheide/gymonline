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
import PageInfo from "../../components/PageInfo";
import { getCache, setCache } from "../../app/utils/dataCache";

const CACHE_TTL_MS = 5 * 60 * 1000;
const EMAIL_DISABLED = true;

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

  const [emailSendBusy, setEmailSendBusy] = useState(false);
  const [emailSendResult, setEmailSendResult] = useState(null);
  const [emailLogs, setEmailLogs] = useState([]);
  const [emailLogsBusy, setEmailLogsBusy] = useState(false);

  const [showComposer, setShowComposer] = useState(false);
  const [audience, setAudience] = useState("activeSubscriptions");
  const [message, setMessage] = useState("");
  const [memberQuery, setMemberQuery] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [showSmsRecipients, setShowSmsRecipients] = useState(false);

  const [showEmailComposer, setShowEmailComposer] = useState(false);
  const [emailAudience, setEmailAudience] = useState("activeSubscriptions");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [emailMemberQuery, setEmailMemberQuery] = useState("");
  const [emailSelectedUserIds, setEmailSelectedUserIds] = useState([]);
  const [showEmailRecipients, setShowEmailRecipients] = useState(false);

  useEffect(() => {
    if (!gymId) return;
    const cacheKey = `adminCommunication:${gymId}`;
    const cached = getCache(cacheKey, CACHE_TTL_MS);
    if (cached) {
      setMembers(cached.members || []);
      setSubs(cached.subs || []);
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
    const gymQ = query(collection(db, "gyms"), where("__name__", "==", gymId));
    Promise.all([getDocs(membersQ), getDocs(subsQ), getDocs(gymQ)])
      .then(([mSnap, sSnap, gSnap]) => {
        const nextMembers = mSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const nextSubs = sSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const nextGym = gSnap.docs[0]?.data() || null;
        setMembers(nextMembers);
        setSubs(nextSubs);
        setGym(nextGym);
        setCache(cacheKey, { members: nextMembers, subs: nextSubs, gym: nextGym });
      })
      .finally(() => setBusy(false));
  }, [gymId]);

  async function loadLogs({ force = false } = {}) {
    if (!gymId) return;
    const cacheKey = `adminCommunicationSmsLogs:${gymId}`;
    if (!force) {
      const cached = getCache(cacheKey, CACHE_TTL_MS);
      if (cached) {
        setLogs(cached.logs || []);
        setLogsBusy(false);
        return;
      }
    }
    setLogsBusy(true);
    try {
      const logsQ = query(
        collection(db, "smsLogs"),
        where("gymId", "==", gymId),
        orderBy("sentAt", "desc"),
        limit(50)
      );
      const snap = await getDocs(logsQ);
      const nextLogs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setLogs(nextLogs);
      setCache(cacheKey, { logs: nextLogs });
    } finally {
      setLogsBusy(false);
    }
  }

  async function loadEmailLogs({ force = false } = {}) {
    if (!gymId) return;
    const cacheKey = `adminCommunicationEmailLogs:${gymId}`;
    if (!force) {
      const cached = getCache(cacheKey, CACHE_TTL_MS);
      if (cached) {
        setEmailLogs(cached.logs || []);
        setEmailLogsBusy(false);
        return;
      }
    }
    setEmailLogsBusy(true);
    try {
      const logsQ = query(
        collection(db, "emailLogs"),
        where("gymId", "==", gymId),
        orderBy("sentAt", "desc"),
        limit(50)
      );
      const snap = await getDocs(logsQ);
      const nextLogs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setEmailLogs(nextLogs);
      setCache(cacheKey, { logs: nextLogs });
    } finally {
      setEmailLogsBusy(false);
    }
  }

  useEffect(() => {
    loadLogs();
    loadEmailLogs();
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

  const membersWithEmail = useMemo(
    () => members.filter((m) => !!m.email),
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

  const membersByIdEmail = useMemo(() => {
    const map = new Map();
    for (const m of membersWithEmail) map.set(m.id, m);
    return map;
  }, [membersWithEmail]);

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

  const filteredMembersEmail = useMemo(() => {
    const q = String(emailMemberQuery || "").trim().toLowerCase();
    if (!q) return membersWithEmail;
    return membersWithEmail.filter((m) => {
      const name = String(m.name || "").toLowerCase();
      const phone = String(m.phoneE164 || "").toLowerCase();
      const email = String(m.email || "").toLowerCase();
      return name.includes(q) || phone.includes(q) || email.includes(q);
    });
  }, [membersWithEmail, emailMemberQuery]);

  const activeSubsWithPhoneCount = useMemo(() => {
    let count = 0;
    for (const m of membersWithPhone) {
      if (activeSubUserIds.has(String(m.id))) count += 1;
    }
    return count;
  }, [activeSubUserIds, membersWithPhone]);

  const noActiveSubMembersPhone = useMemo(
    () => membersWithPhone.filter((m) => !activeSubUserIds.has(String(m.id))),
    [activeSubUserIds, membersWithPhone]
  );

  const noActiveSubMembersEmail = useMemo(
    () => membersWithEmail.filter((m) => !activeSubUserIds.has(String(m.id))),
    [activeSubUserIds, membersWithEmail]
  );

  const recipientCount = useMemo(() => {
    if (audience === "custom")
      return selectedUserIds.filter((id) => membersById.has(id)).length;
    if (audience === "activeMembers") return activeMembers.length;
    if (audience === "activeSubscriptions") return activeSubsWithPhoneCount;
    if (audience === "noActiveSubscription") return noActiveSubMembersPhone.length;
    return membersWithPhone.length;
  }, [
    audience,
    activeMembers.length,
    activeSubsWithPhoneCount,
    membersById,
    membersWithPhone.length,
    noActiveSubMembersPhone.length,
    selectedUserIds,
  ]);

  const smsRecipients = useMemo(() => {
    if (audience === "custom") {
      return membersWithPhone.filter((m) => selectedUserIds.includes(m.id));
    }
    if (audience === "activeMembers") return activeMembers;
    if (audience === "activeSubscriptions") {
      return membersWithPhone.filter((m) =>
        activeSubUserIds.has(String(m.id))
      );
    }
    if (audience === "noActiveSubscription") return noActiveSubMembersPhone;
    return membersWithPhone;
  }, [
    audience,
    activeMembers,
    activeSubUserIds,
    membersWithPhone,
    noActiveSubMembersPhone,
    selectedUserIds,
  ]);

  const emailRecipientCount = useMemo(() => {
    if (emailAudience === "custom")
      return emailSelectedUserIds.filter((id) => membersByIdEmail.has(id))
        .length;
    if (emailAudience === "activeMembers")
      return membersWithEmail.filter((m) => (m.status || "active") === "active")
        .length;
    if (emailAudience === "activeSubscriptions")
      return membersWithEmail.filter((m) =>
        activeSubUserIds.has(String(m.id))
      ).length;
    if (emailAudience === "noActiveSubscription")
      return noActiveSubMembersEmail.length;
    return membersWithEmail.length;
  }, [
    activeSubUserIds,
    emailAudience,
    emailSelectedUserIds,
    membersByIdEmail,
    membersWithEmail,
    noActiveSubMembersEmail.length,
  ]);

  const smsRate = Number(gym?.smsRate || 0);
  const emailRate = Number(gym?.emailRate || 0);
  const smsSegments = useMemo(() => {
    const len = String(message || "").trim().length;
    return Math.max(1, Math.ceil(Math.max(1, len) / 160));
  }, [message]);

  const smsTotalCost = useMemo(
    () => Math.max(0, recipientCount) * smsRate * smsSegments,
    [recipientCount, smsRate, smsSegments]
  );
  const emailTotalCost = useMemo(
    () => Math.max(0, emailRecipientCount) * emailRate,
    [emailRecipientCount, emailRate]
  );

  function formatSentDate(ts) {
    if (!ts) return "-";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    if (Number.isNaN(d.getTime())) return "-";
    const datePart = d.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const timePart = d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${datePart} ${timePart}`;
  }

  const combinedLogs = useMemo(() => {
    const sms = logs.map((l) => ({ ...l, __type: "sms" }));
    const email = emailLogs.map((l) => ({ ...l, __type: "email" }));
    const all = [...sms, ...email];
    all.sort((a, b) => {
      const at = a.sentAt?.toMillis ? a.sentAt.toMillis() : 0;
      const bt = b.sentAt?.toMillis ? b.sentAt.toMillis() : 0;
      return bt - at;
    });
    return all;
  }, [logs, emailLogs]);

  const emailRecipients = useMemo(() => {
    if (emailAudience === "custom") {
      return membersWithEmail.filter((m) => emailSelectedUserIds.includes(m.id));
    }
    if (emailAudience === "activeMembers") {
      return membersWithEmail.filter((m) => (m.status || "active") === "active");
    }
    if (emailAudience === "activeSubscriptions") {
      return membersWithEmail.filter((m) =>
        activeSubUserIds.has(String(m.id))
      );
    }
    if (emailAudience === "noActiveSubscription") return noActiveSubMembersEmail;
    return membersWithEmail;
  }, [
    activeSubUserIds,
    emailAudience,
    emailSelectedUserIds,
    membersWithEmail,
    noActiveSubMembersEmail,
  ]);
  function toggleUser(id) {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleEmailUser(id) {
    setEmailSelectedUserIds((prev) =>
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
      await loadLogs({ force: true });
    } catch (e) {
      alert(e?.message || "Failed to send SMS");
    } finally {
      setSendBusy(false);
    }
  }

  async function sendEmail() {
    if (EMAIL_DISABLED) {
      alert("Email sending is temporarily disabled.");
      return;
    }
    const gymName = String(gym?.name || "Gym");
    const prefix = `[${gymName}]: `;
    const subjRaw = String(emailSubject || "").trim();
    const subj = `${prefix}${subjRaw}`;
    const msg = String(emailMessage || "").trim();
    if (!subjRaw) return alert("Enter a subject");
    if (!msg) return alert("Enter a message");
    if (emailRecipientCount < 1) return alert("No recipients selected");
    if (!confirm(`Send this email to ${emailRecipientCount} member(s)?`)) return;
    setEmailSendBusy(true);
    setEmailSendResult(null);
    try {
      const fn = httpsCallable(functions, "sendBroadcastEmail");
      const res = await fn({
        gymId,
        audience: emailAudience,
        subject: subj,
        message: msg,
        selectedUserIds:
          emailAudience === "custom" ? emailSelectedUserIds : [],
      });
      setEmailSendResult(res.data || { ok: true });
      setEmailSubject("");
      setEmailMessage("");
      setEmailSelectedUserIds([]);
      setShowEmailComposer(false);
      await loadEmailLogs({ force: true });
    } catch (e) {
      alert(e?.message || "Failed to send email");
    } finally {
      setEmailSendBusy(false);
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

  async function deleteEmailLog(logId) {
    if (!confirm("Delete this email record?")) return;
    try {
      const fn = httpsCallable(functions, "deleteEmailLog");
      await fn({ logId, gymId });
      setEmailLogs((prev) => prev.filter((l) => l.id !== logId));
    } catch (e) {
      alert(e?.message || "Failed to delete log");
    }
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <h2 style={{ margin: 0 }}>Communication</h2>
        <div
          style={{
            fontSize: 12,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 10px",
            borderRadius: 999,
            border: "1px solid rgba(15,23,42,.18)",
            background: "#fff",
            color: "var(--text)",
            fontWeight: 600,
          }}
        >
          <i className="fa-solid fa-wallet" aria-hidden="true" />
          Balance:{" "}
          <b>{busy ? "—" : Number(gym?.cashBalance || 0).toLocaleString()}</b>
        </div>
      </div>
      <PageInfo>
        Send bulk SMS or email updates to members and review delivery logs.
      </PageInfo>

      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          width: "100%",
        }}
      >
        <div
          className="card"
          style={{ padding: 16, display: "grid", gap: 12, minWidth: 0 }}
        >
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
            rowGap: 6,
            minWidth: 0,
          }}
        >
          <div style={{ fontWeight: 700 }}>
            <i
              className="fa-solid fa-comment-sms"
              aria-hidden="true"
              style={{ marginRight: 8 }}
            />
            Bulk SMS
          </div>
        </div>
          <button
            onClick={() => setShowComposer((s) => !s)}
            className="btn-compact"
          >
            {showComposer ? "Close composer" : "Create new SMS"}
          </button>

        {sendResult?.ok ? (
          <div style={{ color: "#166534", fontSize: 13 }}>
            Sent. {sendResult.sentCount || 0} succeeded,{" "}
            {sendResult.failedCount || 0} failed.
          </div>
        ) : null}

        {showComposer ? (
          <div
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setShowComposer(false);
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
              className="card"
              style={{
                width: "100%",
                maxWidth: 760,
                maxHeight: "80vh",
                overflow: "auto",
                display: "grid",
                gap: 12,
                padding: 16,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div style={{ fontWeight: 800 }}>Create new SMS</div>
                <button type="button" onClick={() => setShowComposer(false)}>
                  Close
                </button>
              </div>
                <div style={{ display: "grid", gap: 12 }}>
                  <label style={{ display: "grid", gap: 6 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span>Audience</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowSmsRecipients(true);
                        }}
                        style={{
                          padding: 0,
                          border: "none",
                          background: "transparent",
                          color: "#0f766e",
                          textDecoration: "underline",
                          cursor: "pointer",
                          fontSize: 12,
                        }}
                      >
                        Show all recipients
                      </button>
                    </div>
                    <select
                      value={audience}
                      onChange={(e) => setAudience(e.target.value)}
                    >
                      <option value="activeSubscriptions">
                        Active subscriptions ({activeSubsWithPhoneCount})
                      </option>
                      <option value="noActiveSubscription">
                        No active subscription ({noActiveSubMembersPhone.length})
                      </option>
                      <option value="allMembers">
                        All registered members ({membersWithPhone.length})
                      </option>
                      <option value="activeMembers">
                        Active members only ({activeMembers.length})
                      </option>
                      <option value="custom">
                        Select members
                        {selectedUserIds.length ? ` (${selectedUserIds.length})` : ""}
                      </option>
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
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleUser(m.id)}
                      aria-pressed={selectedUserIds.includes(m.id)}
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                        textAlign: "left",
                        width: "100%",
                        padding: "4px 6px",
                        background: "transparent",
                        border: "1px solid transparent",
                        borderRadius: 8,
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 4,
                          border: "1px solid #d1d5db",
                          background: selectedUserIds.includes(m.id)
                            ? "#0f766e"
                            : "#fff",
                          boxShadow: selectedUserIds.includes(m.id)
                            ? "inset 0 0 0 2px #fff"
                            : "none",
                          flex: "0 0 auto",
                        }}
                      />
                      <span
                        style={{
                          display: "grid",
                          gridTemplateColumns: "180px 1fr",
                          gap: 8,
                          alignItems: "center",
                        }}
                      >
                        <span>{m.name || "Member"}</span>
                        <span style={{ opacity: 0.6 }}>
                          {m.phoneE164 || m.email || ""}
                        </span>
                      </span>
                    </button>
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
                gap: 12,
                alignItems: "center",
                fontSize: 12,
                opacity: 0.7,
                flexWrap: "wrap",
              }}
            >
              <div>
                {message.trim().length} characters · {smsSegments} SMS
              </div>
              <div>Recipients: {recipientCount}</div>
              <div style={{ opacity: 0.9 }}>
                Total cost: KES {smsTotalCost.toLocaleString()}
              </div>
            </div>

            <button disabled={sendBusy} onClick={sendSms}>
              {sendBusy ? "Sending..." : "Send SMS"}
            </button>
              </div>
            </div>
          </div>
        ) : null}
        </div>

        <div
          className="card"
          style={{ padding: 16, display: "grid", gap: 12, minWidth: 0 }}
        >
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
            rowGap: 6,
            minWidth: 0,
          }}
        >
          <div style={{ fontWeight: 700 }}>
            <i
              className="fa-solid fa-envelope"
              aria-hidden="true"
              style={{ marginRight: 8 }}
            />
            Bulk Email
          </div>
          <div style={{ marginLeft: "auto", fontSize: 12, opacity: 0.8 }}>
            From: <b>noreply@onlinegym.co</b>
          </div>
        </div>
          <button
            onClick={() => setShowEmailComposer((s) => !s)}
            className="btn-compact"
          >
            {showEmailComposer ? "Close composer" : "Create new Email"}
          </button>

        {emailSendResult?.ok ? (
          <div style={{ color: "#166534", fontSize: 13 }}>
            Sent. {emailSendResult.sentCount || 0} succeeded,{" "}
            {emailSendResult.failedCount || 0} failed.
          </div>
        ) : null}

        {showEmailComposer ? (
          <div
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setShowEmailComposer(false);
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
              className="card"
              style={{
                width: "100%",
                maxWidth: 820,
                maxHeight: "80vh",
                overflow: "auto",
                display: "grid",
                gap: 12,
                padding: 16,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div style={{ fontWeight: 800 }}>Create new Email</div>
                <button type="button" onClick={() => setShowEmailComposer(false)}>
                  Close
                </button>
              </div>
                <div style={{ display: "grid", gap: 12 }}>
                  <label style={{ display: "grid", gap: 6 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span>Audience</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowEmailRecipients(true);
                        }}
                        style={{
                          padding: 0,
                          border: "none",
                          background: "transparent",
                          color: "#0f766e",
                          textDecoration: "underline",
                          cursor: "pointer",
                          fontSize: 12,
                        }}
                      >
                        Show all recipients
                      </button>
                    </div>
                    <select
                      value={emailAudience}
                      onChange={(e) => setEmailAudience(e.target.value)}
                    >
                      <option value="activeSubscriptions">
                        Active subscriptions (
                        {membersWithEmail.filter((m) =>
                          activeSubUserIds.has(String(m.id))
                        ).length}
                        )
                      </option>
                      <option value="noActiveSubscription">
                        No active subscription ({noActiveSubMembersEmail.length})
                      </option>
                      <option value="allMembers">
                        All registered members ({membersWithEmail.length})
                      </option>
                      <option value="activeMembers">
                        Active members only (
                        {
                          membersWithEmail.filter(
                            (m) => (m.status || "active") === "active"
                          ).length
                        }
                        )
                      </option>
                      <option value="custom">
                        Select members
                        {emailSelectedUserIds.length
                          ? ` (${emailSelectedUserIds.length})`
                          : ""}
                      </option>
                    </select>
                  </label>

            {emailAudience === "custom" ? (
              <div style={{ display: "grid", gap: 8 }}>
                <input
                  placeholder="Search members by name, phone, or email"
                  value={emailMemberQuery}
                  onChange={(e) => setEmailMemberQuery(e.target.value)}
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
                  {filteredMembersEmail.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleEmailUser(m.id)}
                      aria-pressed={emailSelectedUserIds.includes(m.id)}
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                        textAlign: "left",
                        width: "100%",
                        padding: "4px 6px",
                        background: "transparent",
                        border: "1px solid transparent",
                        borderRadius: 8,
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 4,
                          border: "1px solid #d1d5db",
                          background: emailSelectedUserIds.includes(m.id)
                            ? "#0f766e"
                            : "#fff",
                          boxShadow: emailSelectedUserIds.includes(m.id)
                            ? "inset 0 0 0 2px #fff"
                            : "none",
                          flex: "0 0 auto",
                        }}
                      />
                      <span
                        style={{
                          display: "grid",
                          gridTemplateColumns: "180px 1fr",
                          gap: 8,
                          alignItems: "center",
                        }}
                      >
                        <span>{m.name || "Member"}</span>
                        <span style={{ opacity: 0.6 }}>
                          {m.email || m.phoneE164 || ""}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <label style={{ display: "grid", gap: 6 }}>
              Subject
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    padding: "10px 10px",
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    background: "#f8fafc",
                    color: "var(--muted)",
                    fontSize: 13,
                    whiteSpace: "nowrap",
                  }}
                >
                  [{gym?.name || "Gym"}]:
                </div>
                <input
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="Subject line..."
                />
              </div>
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              Message
              <textarea
                rows={6}
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
                placeholder="Type your email message..."
                style={{ width: "100%" }}
              />
            </label>

            <div
              style={{
                display: "flex",
                gap: 12,
                alignItems: "center",
                fontSize: 12,
                opacity: 0.7,
                flexWrap: "wrap",
              }}
            >
              <div>{emailMessage.trim().length} characters</div>
              <div>Recipients: {emailRecipientCount}</div>
              <div style={{ opacity: 0.9 }}>
                Total cost: KES {emailTotalCost.toLocaleString()}
              </div>
            </div>

            {EMAIL_DISABLED ? (
              <div style={{ fontSize: 12, color: "#b91c1c" }}>
                Email sending is temporarily disabled.
              </div>
            ) : null}
            <button disabled={emailSendBusy || EMAIL_DISABLED} onClick={sendEmail}>
              {emailSendBusy ? "Sending..." : "Send Email"}
            </button>
              </div>
            </div>
          </div>
        ) : null}
        </div>
      </div>

      {showSmsRecipients ? (
        <div
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowSmsRecipients(false);
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
            className="card"
            style={{
              width: "100%",
              maxWidth: 720,
              padding: 16,
              display: "grid",
              gap: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div style={{ fontWeight: 800 }}>
                SMS recipients ({smsRecipients.length})
              </div>
              <button type="button" onClick={() => setShowSmsRecipients(false)}>
                Close
              </button>
            </div>
            <div
              style={{
                border: "1px solid #eee",
                borderRadius: 8,
                padding: 8,
                maxHeight: 360,
                overflow: "auto",
                display: "grid",
                gap: 6,
                background: "#fff",
              }}
            >
              {smsRecipients.map((m) => (
                <div key={m.id}>
                  {m.name || "Member"}{" "}
                  <span style={{ opacity: 0.6 }}>
                    {m.phoneE164 || m.email || ""}
                  </span>
                </div>
              ))}
              {!smsRecipients.length ? (
                <div style={{ opacity: 0.7 }}>No recipients.</div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {showEmailRecipients ? (
        <div
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowEmailRecipients(false);
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
            className="card"
            style={{
              width: "100%",
              maxWidth: 720,
              padding: 16,
              display: "grid",
              gap: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div style={{ fontWeight: 800 }}>
                Email recipients ({emailRecipients.length})
              </div>
              <button type="button" onClick={() => setShowEmailRecipients(false)}>
                Close
              </button>
            </div>
            <div
              style={{
                border: "1px solid #eee",
                borderRadius: 8,
                padding: 8,
                maxHeight: 360,
                overflow: "auto",
                display: "grid",
                gap: 6,
                background: "#fff",
              }}
            >
              {emailRecipients.map((m) => (
                <div key={m.id}>
                  {m.name || "Member"}{" "}
                  <span style={{ opacity: 0.6 }}>
                    {m.email || m.phoneE164 || ""}
                  </span>
                </div>
              ))}
              {!emailRecipients.length ? (
                <div style={{ opacity: 0.7 }}>No recipients.</div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="card" style={{ padding: 16 }}>
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ fontWeight: 700 }}>Sent Messages</div>
          <button
            onClick={async () => {
              await Promise.all([
                loadLogs({ force: true }),
                loadEmailLogs({ force: true }),
              ]);
            }}
            disabled={logsBusy || emailLogsBusy}
          >
            {logsBusy || emailLogsBusy ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div style={{ marginTop: 12 }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              tableLayout: "fixed",
            }}
          >
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "8px", width: 70 }}>Type</th>
                <th style={{ textAlign: "left", padding: "8px" }}>To</th>
                <th style={{ textAlign: "left", padding: "8px" }}>Message</th>
                <th style={{ textAlign: "left", padding: "8px" }}>Status</th>
                <th style={{ textAlign: "left", padding: "8px", width: 80 }}>Cost</th>
                <th style={{ textAlign: "left", padding: "8px" }}>Sent</th>
                <th style={{ textAlign: "left", padding: "8px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {combinedLogs.map((l) => {
                const isSms = l.__type === "sms";
                const rawStatus = isSms
                  ? l.status || (l.statusCode ? `Code ${l.statusCode}` : "-")
                  : l.status || "-";
                const statusText =
                  rawStatus === "UserInBlacklist"
                    ? "User in blacklist / DND"
                    : rawStatus;
                const statusCodeNum = Number(l.statusCode);
                const isSuccess = isSms
                  ? (Number.isFinite(statusCodeNum) &&
                      statusCodeNum >= 100 &&
                      statusCodeNum < 200) ||
                    String(l.status || "")
                      .toLowerCase()
                      .includes("success")
                  : String(rawStatus).toLowerCase() === "queued" ||
                    String(rawStatus).toLowerCase() === "sent";
                const color = isSuccess ? "#166534" : "#991b1b";
                const bg = isSuccess ? "#dcfce7" : "#fee2e2";
                const messageText = isSms
                  ? l.message || "-"
                  : l.subject || l.message || "-";
                return (
                  <tr key={`${l.__type}_${l.id}`} style={{ borderTop: "1px solid #eee" }}>
                    <td style={{ padding: "8px", whiteSpace: "nowrap", width: 70 }}>
                      {isSms ? "SMS" : "Email"}
                    </td>
                    <td style={{ padding: "8px", whiteSpace: "nowrap" }}>
                      {l.to || "-"}
                    </td>
                    <td style={{ padding: "8px", maxWidth: 520 }}>
                      <div
                        title={messageText || ""}
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {messageText}
                      </div>
                    </td>
                    <td style={{ padding: "8px", whiteSpace: "nowrap" }}>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 700,
                          color,
                          background: bg,
                          display: "inline-block",
                          verticalAlign: "middle",
                        }}
                      >
                        {statusText}
                      </span>
                      {l.error ? (
                        <button
                          type="button"
                          onClick={() => alert(l.error)}
                          style={{
                            padding: 0,
                            marginLeft: 6,
                            border: "none",
                            background: "transparent",
                            color: "#991b1b",
                            textDecoration: "underline",
                            cursor: "pointer",
                            fontSize: 12,
                            fontWeight: 600,
                            display: "inline-block",
                            verticalAlign: "middle",
                          }}
                        >
                          View error
                        </button>
                      ) : null}
                    </td>
                    <td style={{ padding: "8px" }}>{isSms ? l.cost || "-" : "-"}</td>
                    <td style={{ padding: "8px" }}>{formatSentDate(l.sentAt)}</td>
                    <td style={{ padding: "8px" }}>
                      {isSms ? (
                        <button onClick={() => deleteLog(l.id)}>Delete</button>
                      ) : (
                        <button onClick={() => deleteEmailLog(l.id)}>
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!combinedLogs.length ? (
                <tr>
                  <td colSpan={7} style={{ padding: "12px", opacity: 0.6 }}>
                    {logsBusy || emailLogsBusy
                      ? "Loading..."
                      : "No records yet."}
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
