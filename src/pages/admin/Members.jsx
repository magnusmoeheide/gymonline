// src/pages/admin/Members.jsx
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db } from "../../firebase/db";
import { useAuth } from "../../context/AuthContext";
import { functions } from "../../firebase/functionsClient";
import { getCache, setCache } from "../../app/utils/dataCache";
import PageInfo from "../../components/PageInfo";
import Loading from "../../components/Loading";

const CACHE_TTL_MS = 5 * 60 * 1000;

const normalizeEmail = (v) =>
  String(v || "")
    .trim()
    .toLowerCase();
const normalizePhone = (v) => String(v || "").trim();
const normalizeName = (v) => String(v || "").trim();

function toDate(ts) {
  if (!ts) return null;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtDate(ts) {
  if (!ts) return "-";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return Number.isNaN(d.getTime())
    ? "-"
    : d.toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
}

function norm(s) {
  return String(s || "")
    .trim()
    .toLowerCase();
}

function statusPill(value) {
  const v = String(value || "").toLowerCase();
  if (v === "active") return { text: "Active", color: "#166534", bg: "#dcfce7" };
  if (v === "inactive") return { text: "Inactive", color: "#991b1b", bg: "#fee2e2" };
  return { text: value || "-", color: "#374151", bg: "#e5e7eb" };
}

function paymentPill(value) {
  const v = String(value || "").toLowerCase();
  if (v === "paid") return { text: "Paid", color: "#166534", bg: "#dcfce7" };
  if (v === "comped")
    return { text: "Comped", color: "#0f766e", bg: "#ccfbf1" };
  if (v === "awaiting_payment")
    return { text: "Awaiting payment", color: "#9a3412", bg: "#ffedd5" };
  return { text: value || "-", color: "#374151", bg: "#e5e7eb" };
}

export default function Members() {
  const { userDoc } = useAuth();
  const gymId = userDoc?.gymId;

  const [members, setMembers] = useState([]);
  const [subs, setSubs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [memberQuery, setMemberQuery] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [showLookup, setShowLookup] = useState(false);

  // create
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [countryCode, setCountryCode] = useState("+254");
  const [countryCodeCustom, setCountryCodeCustom] = useState("");
  const isCustomCountryCode = countryCode === "CUSTOM";
  const [phoneLocal, setPhoneLocal] = useState("");
  const [email, setEmail] = useState("");
  const [comments, setComments] = useState("");
  const [sendWelcomeSms, setSendWelcomeSms] = useState(true);

  // edit
  const [editingId, setEditingId] = useState("");
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editStatus, setEditStatus] = useState("active");
  const [editComments, setEditComments] = useState("");

  const memberById = useMemo(() => {
    const m = new Map();
    members.forEach((x) => m.set(x.id, x));
    return m;
  }, [members]);

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

  const activeSubByUserId = useMemo(() => {
    const now = new Date();
    const map = new Map();
    for (const s of subs) {
      const uid = s.userId;
      if (!uid) continue;
      const end = s.endDate?.toDate ? s.endDate.toDate() : null;
      const start = s.startDate?.toDate ? s.startDate.toDate() : null;
      const isActive =
        s.status === "active" &&
        (!start || start <= now) &&
        (!end || end >= now);
      if (!isActive) continue;
      const prev = map.get(uid) || null;
      if (!prev) {
        map.set(uid, s);
        continue;
      }
      const prevEnd = prev.endDate?.toDate ? prev.endDate.toDate() : new Date(0);
      const nextEnd = end || new Date(0);
      if (nextEnd > prevEnd) map.set(uid, s);
    }
    return map;
  }, [subs]);

  async function load({ force = false } = {}) {
    if (!gymId) return;
    const cacheKey = `adminMembers:${gymId}`;
    if (!force) {
      const cached = getCache(cacheKey, CACHE_TTL_MS);
      if (cached) {
        setMembers(cached.members || []);
        setSubs(cached.subs || []);
        setBusy(false);
        return;
      }
    }
    setBusy(true);
    try {
      const membersQ = query(
        collection(db, "users"),
        where("gymId", "==", gymId),
        where("role", "==", "MEMBER")
      );
      const subsQ = query(collection(db, "subscriptions"), where("gymId", "==", gymId));
      const [mSnap, sSnap] = await Promise.all([
        getDocs(membersQ),
        getDocs(subsQ),
      ]);
      const nextMembers = mSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const nextSubs = sSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMembers(nextMembers);
      setSubs(nextSubs);
      setCache(cacheKey, { members: nextMembers, subs: nextSubs });
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gymId]);

  async function addMember(e) {
    e.preventDefault();

    const n = normalizeName(name);
    const em = normalizeEmail(email);
    const rawPhone = normalizePhone(phoneLocal);
    const phoneDigits = rawPhone.replace(/\D/g, "");
      const countryCodeValue = isCustomCountryCode
        ? countryCodeCustom.trim()
        : countryCode;
      const phoneOk =
        !phoneDigits ||
        (countryCodeValue === "+254"
          ? phoneDigits.length === 9 && ["7", "1"].includes(phoneDigits[0])
          : phoneDigits.length >= 6);
      const phoneE164 = phoneDigits ? `${countryCodeValue}${phoneDigits}` : "";
      if (isCustomCountryCode && phoneDigits && !countryCodeValue.startsWith("+")) {
        return alert("Custom country code must start with +");
      }

    if (!n) return alert("Name required");
    if (!em && !phoneDigits) return alert("Email or phone required");
    if (phoneDigits && !phoneOk)
      return alert(
        "Phone format invalid. For Kenya use 9 digits, starting with 7 or 1.",
      );

    setBusy(true);
    try {
      const createMember = httpsCallable(functions, "createMember");
      await createMember({
        name: n,
        phoneE164: phoneE164 || null,
        email: em || null,
        sendWelcomeSms: !!sendWelcomeSms,
        gymId: userDoc?.gymId || null,
        gymSlug: userDoc?.gymSlug || null,
        comments: String(comments || "").trim() || null,
      });

      setName("");
      setPhoneLocal("");
      setEmail("");
      setComments("");
      setSendWelcomeSms(true);
      setCountryCode("+254");
      setCountryCodeCustom("");
      setShowAdd(false);
      await load({ force: true });
    } catch (err) {
      console.error(err);
      alert(err?.message || "Failed to create member");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(id) {
    const m = memberById.get(id);
    if (!m) return;

    setEditingId(id);
    setEditName(m.name || "");
    setEditPhone(m.phoneE164 || "");
    setEditEmail(m.email || "");
    setEditComments(m.comments || "");
    setEditStatus(m.status || "active");
    setShowEdit(true);
  }

  function cancelEdit() {
    setEditingId("");
    setEditName("");
    setEditPhone("");
    setEditEmail("");
    setEditComments("");
    setEditStatus("active");
    setShowEdit(false);
  }

  async function saveEdit() {
    if (!editingId) return;

    const n = normalizeName(editName);
    const p = normalizePhone(editPhone);
    const nextEmail = normalizeEmail(editEmail);
    const st = String(editStatus || "active").trim();
    const c = String(editComments || "").trim() || null;
    const currentEmail = normalizeEmail(memberById.get(editingId)?.email || "");

    if (!n) return alert("Name required");
    if (!p.startsWith("+")) return alert("Phone must be E.164 (+...)");
    if (nextEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      return alert("Email is invalid");
    }
    if (currentEmail && !nextEmail) {
      return alert("Email cannot be empty");
    }

    setBusy(true);
    try {
      if (nextEmail && nextEmail !== currentEmail) {
        const fn = httpsCallable(functions, "updateMemberEmail");
        await fn({ uid: editingId, email: nextEmail });
      }

      const ref = doc(db, "users", editingId);

      // only patch allowed fields
      await updateDoc(ref, {
        name: n,
        phoneE164: p,
        comments: c,
        status: st,
        updatedAt: new Date(),
      });

      await load({ force: true });
      cancelEdit();
    } catch (err) {
      console.error(err);
      alert(err?.message || "Failed to update member");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h2 style={{ margin: 0 }}>Members</h2>
        <button type="button" onClick={() => setShowAdd(true)} disabled={busy}>
          Add member
        </button>
      </div>
      <PageInfo>
        Manage your member list, update profiles, and view subscription details.
      </PageInfo>

      <div style={{ display: "flex", gap: 8, alignItems: "center", maxWidth: 620 }}>
        <div style={{ position: "relative", flex: 1 }}>
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
                    setShowLookup(true);
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
        <button
          type="button"
          onClick={() => {
            setMemberQuery("");
            setSelectedMemberId("");
            setShowMemberDropdown(false);
          }}
          disabled={busy}
        >
          Clear
        </button>
      </div>

      {showLookup ? (
        <div
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowLookup(false);
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
              maxWidth: 860,
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
              <div style={{ fontWeight: 800 }}>Member lookup</div>
              <button type="button" onClick={() => setShowLookup(false)}>
                Close
              </button>
            </div>

            {selectedMember ? (
              <div style={{ display: "grid", gap: 12 }}>
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
                      {busy ? (
                        <Loading
                          compact
                          size={16}
                          fullScreen={false}
                          showLabel={false}
                          fullWidth={false}
                        />
                      ) : (
                        "No subscriptions found."
                      )}
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
              <div style={{ opacity: 0.7 }}>
                Search a member to see subscription details.
              </div>
            )}
          </div>
        </div>
      ) : null}

      <div className="table-scroll">
        <table
          className="table-fixed table-truncate"
          width="100%"
          cellPadding="8"
          style={{ borderCollapse: "collapse" }}
        >
          <colgroup>
            <col />
            <col />
            <col style={{ width: "220px" }} />
            <col style={{ width: "90px" }} />
            <col />
            <col />
            <col />
          </colgroup>
          <thead>
            <tr style={{ borderBottom: "1px solid #eee" }}>
              <th align="left">Name</th>
              <th align="left">Phone</th>
              <th align="left">Email</th>
              <th align="left">Status</th>
              <th align="left">Subscription</th>
              <th align="left">Comments</th>
              <th align="left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {busy ? (
              <tr>
                <td colSpan="7">
                  <div style={{ display: "flex", justifyContent: "flex-start" }}>
                    <Loading
                      compact
                      size={28}
                      fullScreen={false}
                      showLabel={false}
                      fullWidth={false}
                    />
                  </div>
                </td>
              </tr>
            ) : null}
            {members.map((m) => {
            return (
              <tr key={m.id} style={{ borderBottom: "1px solid #f3f3f3" }}>
                <td>
                  {m.name}
                </td>
                <td>
                  {m.phoneE164}
                </td>
                <td>
                  {m.email}
                </td>
                <td>
                  {(() => {
                    const pill = statusPill(m.status || "active");
                    return (
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 700,
                          color: pill.color,
                          background: pill.bg,
                        }}
                      >
                        {pill.text}
                      </span>
                    );
                  })()}
                </td>
                <td>
                  {(() => {
                    const s = activeSubByUserId.get(m.id);
                    if (!s) {
                      return (
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 700,
                            color: "#991b1b",
                            background: "#fee2e2",
                          }}
                        >
                          No active subscription
                        </span>
                      );
                    }
                    const pill = paymentPill(s.paymentStatus || "awaiting_payment");
                    return (
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 700,
                          color: pill.color,
                          background: pill.bg,
                        }}
                      >
                        {pill.text}
                      </span>
                    );
                  })()}
                </td>
                <td>
                  {m.comments || "—"}
                </td>
                <td>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => startEdit(m.id)}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            );
          })}
            {!busy && !members.length ? (
              <tr>
                <td colSpan="7" style={{ opacity: 0.7 }}>
                  No members yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {showEdit && editingId ? (
        <div
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) cancelEdit();
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
              padding: 16,
              display: "grid",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontWeight: 800 }}>Edit member</div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 10,
              }}
            >
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.7 }}>Full name</span>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Name"
                />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.7 }}>Phone (E.164)</span>
                <input
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="+2547..."
                />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.7 }}>Email</span>
                <input
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="name@email.com"
                />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.7 }}>Status</span>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                >
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                  <option value="blocked">blocked</option>
                </select>
              </label>
            </div>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, opacity: 0.7 }}>Comments</span>
              <textarea
                rows={3}
                value={editComments}
                onChange={(e) => setEditComments(e.target.value)}
                placeholder="Comments"
              />
            </label>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button disabled={busy} type="button" onClick={saveEdit}>
                {busy ? "Saving…" : "Save"}
              </button>
              <button disabled={busy} type="button" onClick={cancelEdit}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showAdd ? (
        <div
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowAdd(false);
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
              padding: 16,
              display: "grid",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontWeight: 800 }}>Add member</div>
            </div>

            <form
              onSubmit={addMember}
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 10,
              }}
            >
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.7 }}>Full name</span>
                <input
                  placeholder="Full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.7 }}>Email</span>
                <input
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.7 }}>Country code</span>
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                >
                  <option value="+254">Kenya (+254)</option>
                  <option value="+255">Tanzania (+255)</option>
                  <option value="+256">Uganda (+256)</option>
                  <option value="+250">Rwanda (+250)</option>
                  <option value="+257">Burundi (+257)</option>
                  <option value="+251">Ethiopia (+251)</option>
                  <option disabled>──────────</option>
                  <option value="CUSTOM">Other (enter code)</option>
                </select>
                {isCustomCountryCode ? (
                  <input
                    placeholder="e.g. +1"
                    value={countryCodeCustom}
                    onChange={(e) => setCountryCodeCustom(e.target.value)}
                  />
                ) : null}
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.7 }}>Phone</span>
                <input
                  placeholder="Phone (e.g. 712345678)"
                  value={phoneLocal}
                  onChange={(e) => setPhoneLocal(e.target.value)}
                />
              </label>
              <label
                style={{
                  display: "grid",
                  gap: 6,
                  gridColumn: "1 / -1",
                }}
              >
                <span style={{ fontSize: 12, opacity: 0.7 }}>Comments</span>
                <textarea
                  rows={2}
                  placeholder="Comments"
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                />
              </label>
              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                  userSelect: "none",
                }}
              >
                <span
                  role="checkbox"
                  aria-checked={sendWelcomeSms}
                  tabIndex={0}
                  onClick={() => setSendWelcomeSms((v) => !v)}
                  onKeyDown={(e) => {
                    if (e.key === " " || e.key === "Enter") {
                      e.preventDefault();
                      setSendWelcomeSms((v) => !v);
                    }
                  }}
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 4,
                    border: "1px solid rgba(28,24,19,.4)",
                    background: "#fff",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flex: "0 0 18px",
                  }}
                >
                  {sendWelcomeSms ? (
                    <span
                      aria-hidden="true"
                      style={{
                        color: "#111",
                        fontSize: 12,
                        lineHeight: 1,
                        fontWeight: 900,
                      }}
                    >
                      ✓
                    </span>
                  ) : null}
                </span>
                <span style={{ fontSize: 12, opacity: 0.8 }}>
                  Send welcome SMS
                </span>
              </label>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  justifyContent: "flex-end",
                  gridColumn: "1 / -1",
                }}
              >
                <button disabled={busy} type="submit">
                  {busy ? "Saving…" : "Add member"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  disabled={busy}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.65 }}>
        Note: Email is read-only here (changing email needs updating Firebase
        Auth user too).
      </div>
    </div>
  );
}
