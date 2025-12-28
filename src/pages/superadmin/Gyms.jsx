import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../firebase/db";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Gyms() {
  const { userDoc, realUserDoc, startSimulation } = useAuth();
  const nav = useNavigate();
  const [gyms, setGyms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (realUserDoc?.role !== "SUPER_ADMIN") return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const gymsSnap = await getDocs(collection(db, "gyms"));
        const gymsData = gymsSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        const gymsWithAdmins = await Promise.all(
          gymsData.map(async (gym) => {
            const adminsQuery = query(
              collection(db, "users"),
              where("role", "==", "GYM_ADMIN"),
              where("gymId", "==", gym.id)
            );
            const adminsSnap = await getDocs(adminsQuery);
            const admins = adminsSnap.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }));
            return { ...gym, admins };
          })
        );

        setGyms(gymsWithAdmins);
      } catch (err) {
        console.error("Error fetching gyms:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userDoc]);

  const handleAccessGym = (gym) => {
    const admin = gym.admins[0];
    if (admin) {
      startSimulation(admin.id);
      nav("/admin");
    } else {
      alert("No admin found for this gym.");
    }
  };

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
      <h2>All Gyms</h2>
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
                  {gym.admins.map((admin) => admin.name).join(", ") || "None"}
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
