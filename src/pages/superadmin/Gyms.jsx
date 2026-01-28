// src/pages/superadmin/Gyms.jsx
import { useEffect, useState, useCallback } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../firebase/db";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../firebase/functionsClient";

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
  const [emailSaving, setEmailSaving] = useState({});

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
      nav(`/g/${gym.slug}/admin`);
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
        !phoneDigits ||
        (adminCountryCode === "+254"
          ? phoneDigits.length === 9 && ["7", "1"].includes(phoneDigits[0])
          : phoneDigits.length >= 6);
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
        setAdminName("");
        setAdminEmail("");
        setAdminPhoneLocal("");
        setAdminPassword("");
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

  const startAssign = useCallback((gymId) => {
    setAssignGymId(gymId);
    setAssignName("");
    setAssignEmail("");
    setAssignPhone("");
    setAssignPassword("");
  }, []);

  const cancelAssign = useCallback(() => {
    setAssignGymId("");
    setAssignName("");
    setAssignEmail("");
    setAssignPhone("");
    setAssignPassword("");
  }, []);

  const handleAssignAdmin = useCallback(
    async (e) => {
      e.preventDefault();
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

  const handleEmailChange = useCallback((uid, value) => {
    setEmailEdits((prev) => ({ ...prev, [uid]: value }));
  }, []);

  const updateAdminEmail = useCallback(
    async (admin) => {
      if (!admin?.id) return;
      const nextEmail = String(emailEdits[admin.id] ?? admin.email ?? "")
        .trim()
        .toLowerCase();
      if (!nextEmail) return alert("Email required");

      setEmailSaving((prev) => ({ ...prev, [admin.id]: true }));
      try {
        const fn = httpsCallable(functions, "updateGymAdminEmail");
        await fn({ uid: admin.id, email: nextEmail });
        setGyms((prev) =>
          prev.map((g) => ({
            ...g,
            admins: (g.admins || []).map((a) =>
              a.id === admin.id ? { ...a, email: nextEmail } : a
            ),
          }))
        );
      } catch (err) {
        console.error(err);
        alert(err?.message || "Failed to update email");
      } finally {
        setEmailSaving((prev) => ({ ...prev, [admin.id]: false }));
      }
    },
    [emailEdits]
  );

  if (realUserDoc?.role !== "SUPER_ADMIN") {
    return (
      <div style={{ padding: 24 }}>
        <h2>Unauthorized</h2>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Gyms</h2>
        <p>Loading...</p>
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
      <div className="card" style={{ padding: 16, marginBottom: 18 }}>
        <h3 style={{ marginTop: 0 }}>Create gym + admin</h3>
        <form
          onSubmit={handleCreateGym}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 10,
            maxWidth: 640,
          }}
        >
          <input
            placeholder="Gym name"
            value={gymName}
            onChange={(e) => setGymName(e.target.value)}
          />
          <input
            placeholder="Gym slug (e.g. powergym)"
            value={gymSlug}
            onChange={(e) => setGymSlug(e.target.value)}
          />
          <input
            placeholder="Admin full name"
            value={adminName}
            onChange={(e) => setAdminName(e.target.value)}
          />
          <input
            placeholder="Admin email"
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            name="superadmin-create-email"
            autoComplete="off"
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "0.9fr 1.4fr",
              gap: 8,
              gridColumn: "1 / -1",
            }}
          >
            <select
              value={adminCountryCode}
              onChange={(e) => setAdminCountryCode(e.target.value)}
            >
              <option value="+254">Kenya (+254)</option>
              <option value="+255">Tanzania (+255)</option>
              <option value="+256">Uganda (+256)</option>
              <option value="+250">Rwanda (+250)</option>
              <option value="+257">Burundi (+257)</option>
              <option value="+251">Ethiopia (+251)</option>
            </select>
            <input
              placeholder="Admin phone (e.g. 712345678)"
              value={adminPhoneLocal}
              onChange={(e) => setAdminPhoneLocal(e.target.value)}
            />
          </div>
          <input
            placeholder="Admin temp password (min 6 chars)"
            type="password"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            autoComplete="new-password"
          />
          <button disabled={saving} style={{ gridColumn: "1 / -1" }}>
            {saving ? "Creating…" : "Create gym"}
          </button>
        </form>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <h2 style={{ margin: 0 }}>All Gyms</h2>

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

      {gyms.length === 0 ? (
        <p>No gyms found.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #ddd" }}>
              <th style={{ textAlign: "left", padding: "8px" }}>Gym Name</th>
              <th style={{ textAlign: "left", padding: "8px" }}>Slug</th>
              <th style={{ textAlign: "left", padding: "8px" }}>Currency</th>
              <th style={{ textAlign: "left", padding: "8px" }}>Admins</th>
              <th style={{ textAlign: "left", padding: "8px" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {gyms.map((gym) => (
              <tr key={gym.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "8px" }}>{gym.name}</td>
                <td style={{ padding: "8px" }}>{gym.slug}</td>
                <td style={{ padding: "8px" }}>{gym.currency}</td>
                <td style={{ padding: "8px" }}>
                  {gym.admins?.length ? (
                    <div style={{ display: "grid", gap: 8 }}>
                      {gym.admins.map((a) => (
                        <div
                          key={a.id}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1.2fr auto",
                            gap: 8,
                            alignItems: "center",
                          }}
                        >
                          <div style={{ fontWeight: 600 }}>{a.name}</div>
                          <input
                            value={emailEdits[a.id] ?? a.email ?? ""}
                            onChange={(e) =>
                              handleEmailChange(a.id, e.target.value)
                            }
                            placeholder="Admin email"
                          />
                          <button
                            type="button"
                            onClick={() => updateAdminEmail(a)}
                            disabled={!!emailSaving[a.id]}
                          >
                            {emailSaving[a.id] ? "Saving…" : "Update"}
                          </button>
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
                      background: "#f0f0f0",
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
                    Add admin
                  </button>
                </td>
              </tr>
            ))}
            {assignGymId ? (
              <tr style={{ borderBottom: "1px solid #eee" }}>
                <td colSpan={5} style={{ padding: "8px" }}>
                  <form
                    onSubmit={handleAssignAdmin}
                    style={{
                      display: "grid",
                      gap: 8,
                      gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
                    }}
                  >
                    <input
                      placeholder="Admin name"
                      value={assignName}
                      onChange={(e) => setAssignName(e.target.value)}
                    />
                    <input
                      placeholder="Admin email"
                      value={assignEmail}
                      onChange={(e) => setAssignEmail(e.target.value)}
                      name="superadmin-assign-email"
                      autoComplete="off"
                    />
                    <input
                      placeholder="Admin phone (+...)"
                      value={assignPhone}
                      onChange={(e) => setAssignPhone(e.target.value)}
                    />
                    <input
                      placeholder="Temp password"
                      type="password"
                      value={assignPassword}
                      onChange={(e) => setAssignPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button disabled={saving} type="submit">
                        {saving ? "Saving…" : "Save admin"}
                      </button>
                      <button type="button" onClick={cancelAssign}>
                        Cancel
                      </button>
                    </div>
                  </form>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      )}
    </div>
  );
}
