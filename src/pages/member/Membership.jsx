// src/pages/member/Membership.jsx
import { useEffect, useMemo, useState } from "react";
import { getAuth } from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  limit,
  orderBy,
} from "firebase/firestore";
import { db } from "../../firebase/db";
import { useAuth } from "../../context/AuthContext";

function fmtDate(ts) {
  if (!ts) return "-";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return Number.isNaN(d.getTime()) ? "-" : d.toISOString().slice(0, 10);
}

function daysLeft(endTs) {
  if (!endTs?.toDate) return null;
  const end = endTs.toDate();
  const now = new Date();
  const ms = end.getTime() - now.getTime();
  return Math.ceil(ms / 86400000);
}

export default function Membership() {
  const { userDoc } = useAuth();
  const gymId = userDoc?.gymId;

  const [busy, setBusy] = useState(false);
  const [sub, setSub] = useState(null);

  const uid = getAuth().currentUser?.uid;

  async function load() {
    if (!gymId || !uid) return;
    setBusy(true);
    try {
      // This query needs an index because of orderBy + where.
      // If you want to avoid indexes, remove orderBy and sort in JS.
      const q = query(
        collection(db, "subscriptions"),
        where("gymId", "==", gymId),
        where("userId", "==", uid),
        where("status", "==", "active"),
        orderBy("createdAt", "desc"),
        limit(1)
      );

      const snap = await getDocs(q);
      setSub(
        snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() }
      );
    } catch (e) {
      console.error(e);
      setSub(null);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gymId, uid]);

  const end = sub?.endDate?.toDate ? sub.endDate.toDate() : null;
  const remaining = useMemo(
    () => (sub?.planType === "session_pack" ? null : daysLeft(sub?.endDate)),
    [sub]
  );

  const status = useMemo(() => {
    if (!sub) return "No active membership";
    if (sub.planType === "session_pack") return "Active (session pack)";
    if (!end) return "Active";
    return remaining !== null && remaining < 0 ? "Expired" : "Active";
  }, [sub, end, remaining]);

  return (
    <div style={{ maxWidth: 720 }}>
      <h2>My Membership</h2>

      {busy ? (
        <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 8 }}>
          Loading…
        </div>
      ) : null}

      {!busy && !sub ? (
        <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 8 }}>
          <div style={{ fontWeight: 600 }}>{status}</div>
          <div style={{ opacity: 0.75, marginTop: 6 }}>
            Ask the gym staff to activate your membership.
          </div>
        </div>
      ) : null}

      {!busy && sub ? (
        <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 8 }}>
          <div style={{ fontWeight: 600 }}>{status}</div>

          <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
            <div>
              <strong>Plan:</strong> {sub.planName || "-"}
            </div>
            <div>
              <strong>Type:</strong> {sub.planType || "-"}
            </div>

            {sub.planType === "time_based" ? (
              <>
                <div>
                  <strong>End date:</strong> {fmtDate(sub.endDate)}
                </div>
                <div>
                  <strong>Days left:</strong>{" "}
                  {remaining === null ? "-" : Math.max(remaining, 0)}
                </div>
              </>
            ) : (
              <div>
                <strong>Sessions:</strong> {sub.sessionsRemaining ?? "-"} /{" "}
                {sub.sessionsTotal ?? "-"}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
