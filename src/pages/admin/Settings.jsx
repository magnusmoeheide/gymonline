// src/pages/admin/Settings.jsx
import { useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../../firebase/db";
import { functions } from "../../firebase/functionsClient";
import { useAuth } from "../../context/AuthContext";
import { getCache, setCache } from "../../app/utils/dataCache";
import PageInfo from "../../components/PageInfo";

const CACHE_TTL_MS = 5 * 60 * 1000;

export default function Settings() {
  const { userDoc } = useAuth();
  const gymId = userDoc?.gymId;
  const [gymName, setGymName] = useState("");
  const [gymSlug, setGymSlug] = useState("");
  const [gymSavedName, setGymSavedName] = useState("");
  const [gymSavedSlug, setGymSavedSlug] = useState("");
  const [gymBusy, setGymBusy] = useState(false);
  // admins table
  const [admins, setAdmins] = useState([]);
  const [busy, setBusy] = useState(false);

  // add admin form
  const [adminName, setAdminName] = useState("");
  const [adminPhoneE164, setAdminPhoneE164] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminTempPassword, setAdminTempPassword] = useState("");

  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [showEditAdmin, setShowEditAdmin] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [editAdminId, setEditAdminId] = useState("");
  const [editAdminName, setEditAdminName] = useState("");
  const [editAdminPhoneE164, setEditAdminPhoneE164] = useState("");
  const [editAdminEmail, setEditAdminEmail] = useState("");
  const [editAdminStatus, setEditAdminStatus] = useState("active");

  async function loadAdmins({ force = false } = {}) {
    if (!gymId) return;
    const cacheKey = `adminSettingsAdmins:${gymId}`;
    if (!force) {
      const cached = getCache(cacheKey, CACHE_TTL_MS);
      if (cached?.admins) {
        setAdmins(cached.admins);
        setBusy(false);
        return;
      }
    }
    setBusy(true);
    try {
      const qAdmins = query(
        collection(db, "users"),
        where("gymId", "==", gymId),
        where("role", "==", "GYM_ADMIN"),
      );
      const snap = await getDocs(qAdmins);
      const nextAdmins = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAdmins(nextAdmins);
      setCache(cacheKey, { admins: nextAdmins });
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    loadAdmins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gymId]);

  useEffect(() => {
    if (!gymId) return;
    let alive = true;
    (async () => {
      try {
        const cacheKey = `adminSettingsGym:${gymId}`;
        const cached = getCache(cacheKey, CACHE_TTL_MS);
        if (cached?.gym) {
          const data = cached.gym;
          const name = String(data?.name || "");
          const slug = String(data?.slug || "");
          setGymName(name);
          setGymSlug(slug);
          setGymSavedName(name);
          setGymSavedSlug(slug);
          return;
        }
        const snap = await getDoc(doc(db, "gyms", gymId));
        if (!alive) return;
        const data = snap?.exists?.() ? snap.data() : {};
        const name = String(data?.name || "");
        const slug = String(data?.slug || "");
        setGymName(name);
        setGymSlug(slug);
        setGymSavedName(name);
        setGymSavedSlug(slug);
        setCache(cacheKey, { gym: data });
      } catch (e) {
        console.error("Failed to load gym details", e);
      }
    })();
    return () => {
      alive = false;
    };
  }, [gymId]);

  async function addGymAdmin(e) {
    e.preventDefault();
    if (!gymId) return;

    if (!adminName.trim()) return alert("Admin name required");
    if (!adminPhoneE164.trim().startsWith("+"))
      return alert("Phone must be E.164 (+...)");
    if (!adminEmail.trim()) return alert("Email required");
    if ((adminTempPassword || "").length < 6)
      return alert("Temp password min 6 chars");

    setBusy(true);
    try {
      const fn = httpsCallable(functions, "createGymAdmin"); // Cloud Function
      await fn({
        name: adminName.trim(),
        phoneE164: adminPhoneE164.trim(),
        email: adminEmail.trim().toLowerCase(),
        tempPassword: adminTempPassword.trim(),
      });

      setAdminName("");
      setAdminPhoneE164("");
      setAdminEmail("");
      setAdminTempPassword("");

      await loadAdmins({ force: true });
      alert("Gym admin created");
    } catch (err) {
      console.error(err);
      alert(err?.message || "Failed to create gym admin");
    } finally {
      setBusy(false);
    }
  }

  function startEditAdmin(a) {
    if (!a?.id) return;
    setEditAdminId(a.id);
    setEditAdminName(a.name || "");
    setEditAdminPhoneE164(a.phoneE164 || "");
    setEditAdminEmail(a.email || "");
    setEditAdminStatus(a.status || "active");
    setShowEditAdmin(true);
  }

  function cancelEditAdmin() {
    setShowEditAdmin(false);
    setEditAdminId("");
    setEditAdminName("");
    setEditAdminPhoneE164("");
    setEditAdminEmail("");
    setEditAdminStatus("active");
  }

  async function saveAdminEdit(e) {
    e.preventDefault();
    if (!editAdminId) return;
    if (!editAdminName.trim()) return alert("Name required");
    if (!editAdminPhoneE164.trim().startsWith("+"))
      return alert("Phone must be E.164 (+...)");

    setEditBusy(true);
    try {
      await updateDoc(doc(db, "users", editAdminId), {
        name: editAdminName.trim(),
        phoneE164: editAdminPhoneE164.trim(),
        status: editAdminStatus,
        updatedAt: new Date(),
      });
      await loadAdmins({ force: true });
      cancelEditAdmin();
    } catch (err) {
      console.error(err);
      alert(err?.message || "Failed to update admin");
    } finally {
      setEditBusy(false);
    }
  }

  async function saveGymDetails(e) {
    e.preventDefault();
    if (!gymId) return;
    if (!gymName.trim()) return alert("Gym name required");
    if (!gymSlug.trim()) return alert("Gym slug required");

    setGymBusy(true);
    try {
      const fn = httpsCallable(functions, "updateGymDetails");
      const res = await fn({
        name: gymName.trim(),
        slug: gymSlug.trim(),
      });
      const nextSlug = res?.data?.slug || gymSlug.trim();
      setGymSavedName(gymName.trim());
      setGymSavedSlug(nextSlug);
      setGymSlug(nextSlug);
      setCache(`adminSettingsGym:${gymId}`, {
        gym: { name: gymName.trim(), slug: nextSlug },
      });
      alert("Gym details updated");
    } catch (err) {
      console.error(err);
      alert(err?.message || "Failed to update gym details");
    } finally {
      setGymBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <h2>Settings</h2>
      <PageInfo>
        Manage gym details, admins, and access settings.
      </PageInfo>

      <div style={{ opacity: 0.8, marginBottom: 12 }}>
        Any questions? Contact us on{" "}
        <b>
          <a href="mailto: mail@onlinegym.co">
            <u>mail@onlinegym.co</u>
          </a>
        </b>{" "}
        or <b>+254 721 499 429</b>
      </div>

      <div className="card" style={{ padding: 16, maxWidth: 720 }}>
        <h3 style={{ marginTop: 0 }}>Gym details</h3>
        <form
          onSubmit={saveGymDetails}
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) auto",
            gap: 10,
          }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, opacity: 0.7 }}>Gym name</span>
            <input
              placeholder="Gym name"
              value={gymName}
              onChange={(e) => setGymName(e.target.value)}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, opacity: 0.7 }}>Gym slug</span>
            <input
              placeholder="gym-slug"
              value={gymSlug}
              onChange={(e) => setGymSlug(e.target.value)}
            />
          </label>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "flex-end",
              paddingBottom: 2,
            }}
          >
            <button className="btn-primary" disabled={gymBusy} type="submit">
              {gymBusy ? "Saving…" : "Save gym details"}
            </button>
          </div>
          {gymSlug.trim() && gymSlug.trim() !== gymSavedSlug.trim() ? (
            <div
              style={{
                gridColumn: "1 / -1",
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid #fde68a",
                background: "#fffbeb",
                fontSize: 12,
              }}
            >
              Changing the slug will change your login/admin links. Update any
              saved links and bookmarks after saving.
            </div>
          ) : null}
        </form>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h3 style={{ margin: 0 }}>Gym Admins</h3>
        <button
          type="button"
          onClick={() => setShowAddAdmin(true)}
          disabled={busy}
        >
          Add gym admin
        </button>
      </div>

      <div className="table-scroll">
        <table
          width="100%"
          cellPadding="8"
          style={{ borderCollapse: "collapse" }}
        >
          <thead>
            <tr style={{ borderBottom: "1px solid #eee" }}>
              <th align="left">Name</th>
              <th align="left">Phone</th>
              <th align="left">Email</th>
              <th align="left">Status</th>
              <th align="left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.id} style={{ borderBottom: "1px solid #f3f3f3" }}>
                <td>{a.name}</td>
                <td>{a.phoneE164}</td>
                <td>{a.email || "-"}</td>
                <td>{a.status || "active"}</td>
                <td>
                  <button type="button" onClick={() => startEditAdmin(a)}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
            {!admins.length ? (
              <tr>
                <td colSpan="5" style={{ opacity: 0.7 }}>
                  {busy ? "Loading…" : "No gym admins yet."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {showAddAdmin ? (
        <div
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowAddAdmin(false);
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
            <div style={{ fontWeight: 800 }}>Add gym admin</div>
            <form
              onSubmit={addGymAdmin}
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
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.7 }}>
                  Phone (E.164)
                </span>
                <input
                  placeholder="Phone (E.164) e.g. +2547..."
                  value={adminPhoneE164}
                  onChange={(e) => setAdminPhoneE164(e.target.value)}
                />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.7 }}>Email</span>
                <input
                  placeholder="Email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  name="gymadmin-create-email"
                  autoComplete="off"
                />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.7 }}>
                  Temp password
                </span>
                <input
                  placeholder="Temp password (min 6 chars)"
                  value={adminTempPassword}
                  onChange={(e) => setAdminTempPassword(e.target.value)}
                  autoComplete="new-password"
                />
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
                  {busy ? "Saving…" : "Add gym admin"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddAdmin(false)}
                  disabled={busy}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showEditAdmin ? (
        <div
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) cancelEditAdmin();
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
            <div style={{ fontWeight: 800 }}>Edit gym admin</div>
            <form
              onSubmit={saveAdminEdit}
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
                  value={editAdminName}
                  onChange={(e) => setEditAdminName(e.target.value)}
                />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.7 }}>
                  Phone (E.164)
                </span>
                <input
                  placeholder="Phone (E.164) e.g. +2547..."
                  value={editAdminPhoneE164}
                  onChange={(e) => setEditAdminPhoneE164(e.target.value)}
                />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.7 }}>Email</span>
                <input value={editAdminEmail} disabled />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.7 }}>Status</span>
                <select
                  value={editAdminStatus}
                  onChange={(e) => setEditAdminStatus(e.target.value)}
                >
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                  <option value="blocked">blocked</option>
                </select>
              </label>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  justifyContent: "flex-end",
                  gridColumn: "1 / -1",
                }}
              >
                <button disabled={editBusy} type="submit">
                  {editBusy ? "Saving…" : "Save changes"}
                </button>
                <button
                  type="button"
                  onClick={cancelEditAdmin}
                  disabled={editBusy}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
