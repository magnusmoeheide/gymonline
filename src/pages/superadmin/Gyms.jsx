// src/pages/superadmin/Gyms.jsx
import { useEffect, useState, useCallback } from "react";
import { collection, getDocs, query, where, updateDoc, doc } from "firebase/firestore";
import { db } from "../../firebase/db";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../firebase/functionsClient";
import PageInfo from "../../components/PageInfo";
import Loading from "../../components/Loading";

const DEFAULT_BLOCK_MESSAGE =
  "Access has been blocked. Please contact us.";

export default function Gyms() {
  const { realUserDoc, startSimulation, stopSimulation, isSimulated } =
    useAuth();
  const nav = useNavigate();

  const [gyms, setGyms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const [gymName, setGymName] = useState("");
  const [gymSlug, setGymSlug] = useState("");
  const [gymSlugDirty, setGymSlugDirty] = useState(false);
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminCountryCode, setAdminCountryCode] = useState("+254");
  const [adminPhoneLocal, setAdminPhoneLocal] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  const [assignGymId, setAssignGymId] = useState("");
  const [assignName, setAssignName] = useState("");
  const [assignEmail, setAssignEmail] = useState("");
  const [assignPhone, setAssignPhone] = useState("");
  const [assignPassword, setAssignPassword] = useState("");
  const [emailEdits, setEmailEdits] = useState({});
  const [phoneEdits, setPhoneEdits] = useState({});
  const [adminSaving, setAdminSaving] = useState({});
  const [resetSaving, setResetSaving] = useState({});
  const [showCreate, setShowCreate] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [showEditGym, setShowEditGym] = useState(false);
  const [editGymId, setEditGymId] = useState("");
  const [editGymName, setEditGymName] = useState("");
  const [editGymSlug, setEditGymSlug] = useState("");
  const [editGymBlocked, setEditGymBlocked] = useState(false);
  const [editGymBlockedMessage, setEditGymBlockedMessage] = useState("");


  const fetchData = useCallback(async () => {
    if (realUserDoc?.role !== "SUPER_ADMIN") return;

    try {
      setLoading(true);
      setError(null);

      const gymsSnap = await getDocs(collection(db, "gyms"));
      const gymsData = gymsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const gymsWithAdmins = await Promise.all(
        gymsData.map(async (gym) => {
          const adminsQuery = query(
            collection(db, "users"),
            where("role", "==", "GYM_ADMIN"),
            where("gymId", "==", gym.id)
          );
          const adminsSnap = await getDocs(adminsQuery);
          const admins = adminsSnap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }));
          return { ...gym, admins };
        })
      );

      setGyms(gymsWithAdmins);
    } catch (err) {
      console.error("Error fetching gyms:", err);
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }, [realUserDoc]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAccessGym = useCallback(
    (gym) => {
      const admin = gym.admins?.[0];
      if (!admin?.id) {
        alert("No admin found for this gym.");
        return;
      }

      // 1️⃣ start simulation
      startSimulation(admin.id);

      // 2️⃣ go to tenant-aware admin route
      nav(`/${gym.slug}/admin`);
    },
    [startSimulation, nav]
  );

  const handleExitSimulation = useCallback(() => {
    stopSimulation();
    nav("/superadmin");
  }, [stopSimulation, nav]);

  const handleCreateGym = useCallback(
    async (e) => {
      e.preventDefault();
      if (!gymName.trim()) return alert("Gym name required");
      if (!gymSlug.trim()) return alert("Slug required");
      if (!adminName.trim()) return alert("Admin name required");
      if (!adminEmail.trim()) return alert("Admin email required");
      const phoneDigits = String(adminPhoneLocal || "").replace(/\D/g, "");
      const phoneOk =
        phoneDigits.length === 9 && ["7", "1"].includes(phoneDigits[0]);
      if (!phoneDigits) return alert("Admin phone required");
      if (!phoneOk)
        return alert(
          "Phone format invalid. For Kenya use 9 digits, starting with 7 or 1."
        );
      if ((adminPassword || "").length < 6)
        return alert("Password min 6 chars");

      setSaving(true);
      try {
        const createGym = httpsCallable(functions, "createGymAndAdmin");
        await createGym({
          gymName: gymName.trim(),
          slug: gymSlug.trim(),
          adminName: adminName.trim(),
          adminEmail: adminEmail.trim().toLowerCase(),
          adminPhoneE164: `${adminCountryCode}${phoneDigits}`,
          adminPassword: adminPassword.trim(),
        });

        setGymName("");
        setGymSlug("");
        setGymSlugDirty(false);
        setAdminName("");
        setAdminEmail("");
        setAdminPhoneLocal("");
        setAdminPassword("");
        setShowCreate(false);
        await fetchData();
      } catch (err) {
        console.error(err);
        alert(err?.message || "Failed to create gym");
      } finally {
        setSaving(false);
      }
    },
    [
      gymName,
      gymSlug,
      adminName,
      adminEmail,
      adminCountryCode,
      adminPhoneLocal,
      adminPassword,
      fetchData,
    ]
  );

  useEffect(() => {
    if (gymSlugDirty) return;
    const next = String(gymName || "")
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9-]/g, "");
    setGymSlug(next);
  }, [gymName, gymSlugDirty]);

  const startAssign = useCallback((gymId) => {
    setAssignGymId(gymId);
    setAssignName("");
    setAssignEmail("");
    setAssignPhone("");
    setAssignPassword("");
    setShowAssign(true);
  }, []);

  const cancelAssign = useCallback(() => {
    setAssignGymId("");
    setAssignName("");
    setAssignEmail("");
    setAssignPhone("");
    setAssignPassword("");
    setShowAssign(false);
  }, []);

  const handleAssignAdmin = useCallback(
    async (e) => {
      if (e?.preventDefault) e.preventDefault();
      if (!assignGymId) return;
      if (!assignName.trim()) return alert("Admin name required");
      if (!assignEmail.trim()) return alert("Admin email required");
      if (!assignPhone.trim().startsWith("+"))
        return alert("Phone must be E.164 (+...)");
      if ((assignPassword || "").length < 6)
        return alert("Temp password min 6 chars");

      setSaving(true);
      try {
        const fn = httpsCallable(functions, "createGymAdminForGym");
        await fn({
          gymId: assignGymId,
          name: assignName.trim(),
          email: assignEmail.trim().toLowerCase(),
          phoneE164: assignPhone.trim(),
          tempPassword: assignPassword.trim(),
        });

        cancelAssign();
        await fetchData();
      } catch (err) {
        console.error(err);
        alert(err?.message || "Failed to assign admin");
      } finally {
        setSaving(false);
      }
    },
    [
      assignGymId,
      assignName,
      assignEmail,
      assignPhone,
      assignPassword,
      fetchData,
      cancelAssign,
    ]
  );

  const handleAdminEmailChange = useCallback((uid, value) => {
    setEmailEdits((prev) => ({ ...prev, [uid]: value }));
  }, []);

  const handleAdminPhoneChange = useCallback((uid, value) => {
    setPhoneEdits((prev) => ({ ...prev, [uid]: value }));
  }, []);

  const saveAdminEdits = useCallback(
    async (admin) => {
      if (!admin?.id) return;
      const nextEmail = String(emailEdits[admin.id] ?? admin.email ?? "")
        .trim()
        .toLowerCase();
      const nextPhone = String(phoneEdits[admin.id] ?? admin.phoneE164 ?? "").trim();

      if (!nextEmail) return alert("Email required");
      if (!nextPhone.startsWith("+"))
        return alert("Phone must be E.164 (+...)");

      setAdminSaving((prev) => ({ ...prev, [admin.id]: true }));
      try {
        if (nextEmail !== (admin.email || "")) {
          const fnEmail = httpsCallable(functions, "updateGymAdminEmail");
          await fnEmail({ uid: admin.id, email: nextEmail });
        }
        if (nextPhone !== (admin.phoneE164 || "")) {
          const fnPhone = httpsCallable(functions, "updateGymAdminPhone");
          await fnPhone({ uid: admin.id, phoneE164: nextPhone });
        }

        setGyms((prev) =>
          prev.map((g) => ({
            ...g,
            admins: (g.admins || []).map((a) =>
              a.id === admin.id
                ? { ...a, email: nextEmail, phoneE164: nextPhone }
                : a
            ),
          }))
        );
      } catch (err) {
        console.error(err);
        alert(err?.message || "Failed to update admin");
      } finally {
        setAdminSaving((prev) => ({ ...prev, [admin.id]: false }));
      }
    },
    [emailEdits, phoneEdits]
  );

  const resetAdminPassword = useCallback(async (admin) => {
    if (!admin?.id) return;
    setResetSaving((prev) => ({ ...prev, [admin.id]: true }));
    try {
      const fn = httpsCallable(functions, "resetGymAdminPassword");
      const res = await fn({ uid: admin.id });
      const link = res?.data?.resetLink || "";
      if (!link) {
        alert("Reset link not available.");
        return;
      }
      window.prompt("Password reset link (copy + share):", link);
    } catch (err) {
      console.error(err);
      alert(err?.message || "Failed to reset password");
    } finally {
      setResetSaving((prev) => ({ ...prev, [admin.id]: false }));
    }
  }, []);

  const startEditGym = useCallback((gym) => {
    if (!gym?.id) return;
    setEditGymId(gym.id);
    setEditGymName(gym.name || "");
    setEditGymSlug(gym.slug || "");
    setEditGymBlocked(!!gym.accessBlocked);
    setEditGymBlockedMessage(
      String(gym.accessBlockedMessage || DEFAULT_BLOCK_MESSAGE)
    );
    setShowEditGym(true);
  }, []);

  const cancelEditGym = useCallback(() => {
    setShowEditGym(false);
    setEditGymId("");
    setEditGymName("");
    setEditGymSlug("");
    setEditGymBlocked(false);
    setEditGymBlockedMessage("");
  }, []);

  const saveEditGym = useCallback(
    async (e) => {
      e.preventDefault();
      if (!editGymId) return;
      if (!editGymName.trim()) return alert("Gym name required");
      if (!editGymSlug.trim()) return alert("Gym slug required");
      setSaving(true);
      try {
        const fn = httpsCallable(functions, "updateGymDetails");
        await fn({
          gymId: editGymId,
          name: editGymName.trim(),
          slug: editGymSlug.trim(),
        });
        await updateDoc(doc(db, "gyms", editGymId), {
          accessBlocked: !!editGymBlocked,
          accessBlockedMessage: editGymBlocked
            ? String(editGymBlockedMessage || DEFAULT_BLOCK_MESSAGE).trim()
            : "",
          updatedAt: new Date(),
        });
        setGyms((prev) =>
          prev.map((g) =>
            g.id === editGymId
              ? {
                  ...g,
                  name: editGymName.trim(),
                  slug: editGymSlug.trim(),
                  accessBlocked: !!editGymBlocked,
                  accessBlockedMessage: editGymBlocked
                    ? String(editGymBlockedMessage || DEFAULT_BLOCK_MESSAGE).trim()
                    : "",
                }
              : g
          )
        );
        cancelEditGym();
      } catch (err) {
        console.error(err);
        alert(err?.message || "Failed to update gym");
      } finally {
        setSaving(false);
      }
    },
    [
      editGymId,
      editGymName,
      editGymSlug,
      editGymBlocked,
      editGymBlockedMessage,
      cancelEditGym,
    ]
  );


  if (realUserDoc?.role !== "SUPER_ADMIN") {
    return (
      <div style={{ padding: 24 }}>
        <h2>Unauthorized</h2>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Gyms</h2>
        <p style={{ color: "red" }}>Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="superadmin-page" style={{ padding: 24 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <h2 style={{ margin: 0 }}>All Gyms</h2>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          style={{
            padding: "6px 12px",
            borderRadius: 6,
            border: "1px solid #ddd",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          Create gym
        </button>

        {isSimulated ? (
          <button
            onClick={handleExitSimulation}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: "1px solid #ddd",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            Exit simulation
          </button>
        ) : null}
      </div>
      <PageInfo>
        Create gyms, manage admins, and control gym access.
      </PageInfo>

      <div className="table-scroll">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #ddd" }}>
              <th style={{ textAlign: "left", padding: "8px" }}>Gym Name</th>
              <th style={{ textAlign: "left", padding: "8px" }}>Slug</th>
              <th style={{ textAlign: "left", padding: "8px" }}>Admins</th>
              <th style={{ textAlign: "left", padding: "8px" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="4">
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
            {gyms.map((gym) => (
              <tr key={gym.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "8px" }}>
                  <div>{gym.name}</div>
                  {gym.accessBlocked ? (
                    <div style={{ fontSize: 12, color: "#991b1b" }}>
                      Login disabled
                    </div>
                  ) : null}
                </td>
                <td style={{ padding: "8px" }}>{gym.slug}</td>
                <td style={{ padding: "8px" }}>
                  {gym.admins?.length ? (
                    <div style={{ display: "grid", gap: 4 }}>
                      {gym.admins.map((a) => (
                        <div key={a.id}>
                          {a.name || a.email}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span style={{ opacity: 0.6 }}>No admins</span>
                  )}
                </td>
                <td style={{ padding: "8px" }}>
                  <button
                    onClick={() => handleAccessGym(gym)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 4,
                      border: "1px solid #ccc",
                      background: "#fff",
                      cursor: "pointer",
                    }}
                  >
                    Access Gym
                  </button>
                  <button
                    onClick={() => startAssign(gym.id)}
                    style={{
                      marginLeft: 8,
                      padding: "6px 12px",
                      borderRadius: 4,
                      border: "1px solid #ccc",
                      background: "#fff",
                      cursor: "pointer",
                    }}
                  >
                    Manage admins
                  </button>
                  <button
                    onClick={() => startEditGym(gym)}
                    style={{
                      marginLeft: 8,
                      padding: "6px 12px",
                      borderRadius: 4,
                      border: "1px solid #ccc",
                      background: "#fff",
                      cursor: "pointer",
                    }}
                  >
                    Edit gym
                  </button>
                </td>
              </tr>
            ))}
            {!loading && gyms.length === 0 ? (
              <tr>
                <td colSpan="4" style={{ opacity: 0.7 }}>
                  No gyms found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {showCreate ? (
        <div
          onClick={() => setShowCreate(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "grid",
            placeItems: "center",
            zIndex: 50,
            padding: 16,
          }}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{ width: "min(920px, 100%)", padding: 16 }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <h3 style={{ margin: 0 }}>Create gym + admin</h3>
              <button type="button" onClick={() => setShowCreate(false)}>
                Close
              </button>
            </div>
            <form
              onSubmit={handleCreateGym}
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
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
                  placeholder="e.g. powergym"
                  value={gymSlug}
                  onChange={(e) => {
                    setGymSlug(e.target.value);
                    setGymSlugDirty(true);
                  }}
                  onBlur={() => {
                    setGymSlug((prev) =>
                      String(prev || "")
                        .trim()
                        .toLowerCase()
                        .replace(/\s+/g, "")
                        .replace(/[^a-z0-9-]/g, "")
                    );
                  }}
                />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.7 }}>Admin full name</span>
                <input
                  placeholder="Admin full name"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.7 }}>Admin email</span>
                <input
                  placeholder="admin@email.com"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  name="superadmin-create-email"
                  autoComplete="off"
                />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.7 }}>Country code</span>
                <input value="+254" disabled />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.7 }}>Admin phone</span>
                <input
                  placeholder="e.g. 712345678"
                  value={adminPhoneLocal}
                  onChange={(e) => setAdminPhoneLocal(e.target.value)}
                />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.7 }}>
                  Admin temp password
                </span>
                <input
                  placeholder="Min 6 chars"
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </label>
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <button disabled={saving} style={{ width: "100%" }}>
                  {saving ? "Creating…" : "Create gym"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showAssign ? (
        <div
          onClick={cancelAssign}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "grid",
            placeItems: "center",
            zIndex: 50,
            padding: 16,
          }}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{ width: "min(860px, 100%)", padding: 16 }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <h3 style={{ margin: 0 }}>Add admin</h3>
              <button type="button" onClick={cancelAssign}>
                Close
              </button>
            </div>
            <div style={{ marginBottom: 8, fontWeight: 700 }}>Admins</div>
            {(() => {
              const gym = gyms.find((g) => g.id === assignGymId);
              const admins = gym?.admins || [];
              return (
                <div className="table-scroll">
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <colgroup>
                      <col style={{ width: "22%" }} />
                      <col style={{ width: "24%" }} />
                      <col style={{ width: "24%" }} />
                      <col style={{ width: "30%" }} />
                    </colgroup>
                    <thead>
                        <tr style={{ borderBottom: "1px solid #eee" }}>
                          <th style={{ textAlign: "left", padding: "6px 2px" }}>Name</th>
                          <th style={{ textAlign: "left", padding: "6px 2px" }}>Email</th>
                          <th style={{ textAlign: "left", padding: "6px 2px" }}>Phone</th>
                          <th style={{ textAlign: "left", padding: "6px 2px" }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                      {!admins.length ? (
                        <tr>
                          <td colSpan={4} style={{ padding: "8px 2px", opacity: 0.6 }}>
                            No admins
                          </td>
                        </tr>
                      ) : (
                        admins.map((a) => (
                          <tr key={a.id} style={{ borderBottom: "1px solid #f3f3f3" }}>
                            <td style={{ padding: "6px 2px", fontWeight: 600 }}>
                              {a.name || "Admin"}
                            </td>
                            <td style={{ padding: "6px 2px" }}>
                              <input
                                value={emailEdits[a.id] ?? a.email ?? ""}
                                onChange={(e) =>
                                  handleAdminEmailChange(a.id, e.target.value)
                                }
                                placeholder="Email"
                                style={{ width: "100%" }}
                              />
                            </td>
                            <td style={{ padding: "6px 2px" }}>
                              <input
                                value={phoneEdits[a.id] ?? a.phoneE164 ?? ""}
                                onChange={(e) =>
                                  handleAdminPhoneChange(a.id, e.target.value)
                                }
                                placeholder="+254..."
                                style={{ width: "100%" }}
                              />
                            </td>
                            <td style={{ padding: "6px 2px" }}>
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "1fr 1fr",
                                  gap: 4,
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() => saveAdminEdits(a)}
                                  disabled={!!adminSaving[a.id]}
                                >
                                  {adminSaving[a.id] ? "Saving…" : "Save"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => resetAdminPassword(a)}
                                  disabled={!!resetSaving[a.id]}
                                >
                                  {resetSaving[a.id] ? "Resetting…" : "Reset pwd"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                      <tr>
                        <td style={{ padding: "6px 2px" }}>
                          <input
                            placeholder="Admin name"
                            value={assignName}
                            onChange={(e) => setAssignName(e.target.value)}
                            style={{ width: "100%" }}
                          />
                        </td>
                        <td style={{ padding: "6px 2px" }}>
                          <input
                            placeholder="Admin email"
                            value={assignEmail}
                            onChange={(e) => setAssignEmail(e.target.value)}
                            name="superadmin-assign-email"
                            autoComplete="off"
                            style={{ width: "100%" }}
                          />
                        </td>
                        <td style={{ padding: "6px 2px" }}>
                          <input
                            placeholder="Admin phone (+...)"
                            value={assignPhone}
                            onChange={(e) => setAssignPhone(e.target.value)}
                            style={{ width: "100%" }}
                          />
                        </td>
                        <td style={{ padding: "6px 2px" }}>
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr 1fr",
                              gap: 4,
                            }}
                          >
                            <input
                              placeholder="Temp password"
                              type="password"
                              value={assignPassword}
                              onChange={(e) => setAssignPassword(e.target.value)}
                              autoComplete="new-password"
                            />
                            <button
                              disabled={saving}
                              type="button"
                              onClick={() => handleAssignAdmin()}
                            >
                              {saving ? "Saving…" : "Add admin"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        </div>
      ) : null}

      {showEditGym ? (
        <div
          onClick={cancelEditGym}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "grid",
            placeItems: "center",
            zIndex: 50,
            padding: 16,
          }}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{ width: "min(920px, 100%)", padding: 16 }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <h3 style={{ margin: 0 }}>Edit gym</h3>
              <button type="button" onClick={cancelEditGym}>
                Close
              </button>
            </div>
            <form
              onSubmit={saveEditGym}
              style={{
                display: "grid",
                gap: 10,
                gridTemplateColumns: "1fr 1fr auto",
                alignItems: "end",
              }}
            >
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.7 }}>Gym name</span>
                <input
                  value={editGymName}
                  onChange={(e) => setEditGymName(e.target.value)}
                />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.7 }}>Gym slug</span>
                <input
                  value={editGymSlug}
                  onChange={(e) => setEditGymSlug(e.target.value)}
                />
              </label>
            </form>

            <div
              style={{
                display: "grid",
                gap: 10,
                borderTop: "1px solid #eee",
                paddingTop: 12,
              }}
            >
              <div style={{ fontWeight: 700 }}>Login access</div>
              <button
                type="button"
                onClick={() => setEditGymBlocked((v) => !v)}
                aria-pressed={editGymBlocked}
                style={{
                  display: "inline-flex",
                  gap: 8,
                  alignItems: "center",
                  textAlign: "left",
                  width: "fit-content",
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
                    background: editGymBlocked ? "#0f766e" : "#fff",
                    boxShadow: editGymBlocked
                      ? "inset 0 0 0 2px #fff"
                      : "none",
                    flex: "0 0 auto",
                  }}
                />
                <span>Disable logins for this gym</span>
              </button>
              {editGymBlocked ? (
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, opacity: 0.7 }}>
                    Block message
                  </span>
                  <textarea
                    rows={3}
                    value={editGymBlockedMessage}
                    onChange={(e) => setEditGymBlockedMessage(e.target.value)}
                    placeholder={DEFAULT_BLOCK_MESSAGE}
                  />
                </label>
              ) : null}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
              <button disabled={saving} type="button" onClick={saveEditGym} style={{ height: 48 }}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>

          </div>
        </div>
      ) : null}
    </div>
  );
}
