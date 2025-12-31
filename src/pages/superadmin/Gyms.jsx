// src/pages/superadmin/Gyms.jsx
import { useEffect, useState, useCallback } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../firebase/db";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Gyms() {
  const { realUserDoc, startSimulation, stopSimulation, isSimulated } =
    useAuth();
  const nav = useNavigate();

  const [gyms, setGyms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (realUserDoc?.role !== "SUPER_ADMIN") return;

    const fetchData = async () => {
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
    };

    fetchData();
  }, [realUserDoc]);

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
    <div style={{ padding: 24 }}>
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
                  {gym.admins
                    ?.map((a) => a.name)
                    .filter(Boolean)
                    .join(", ") || "None"}
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
