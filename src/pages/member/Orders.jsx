import { useEffect, useState } from "react";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "../../firebase/db";
import { useAuth } from "../../context/AuthContext";

export default function Orders() {
  const { user, userDoc } = useAuth();
  const gymId = userDoc?.gymId;

  const [orders, setOrders] = useState([]);

  useEffect(() => {
    async function load() {
      if (!user || !gymId) return;
      try {
        const q = query(
          collection(db, "orders"),
          where("gymId", "==", gymId),
          where("userId", "==", user.uid),
          orderBy("createdAt", "desc")
        );
        const snap = await getDocs(q);
        setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error(e);
        setOrders([]);
      }
    }
    load();
  }, [user, gymId]);

  return (
    <div>
      <h2>My Orders</h2>

      {orders.map((o) => (
        <div
          key={o.id}
          style={{
            padding: 10,
            border: "1px solid #eee",
            borderRadius: 8,
            marginBottom: 8,
          }}
        >
          <div>
            Total: <b>{o.total}</b>
          </div>
          <div>
            Status: <b>{o.paymentStatus || "pending"}</b>
          </div>
          <div>
            Date:{" "}
            <b>
              {o.createdAt?.toDate
                ? o.createdAt.toDate().toISOString().slice(0, 10)
                : "-"}
            </b>
          </div>
          <div style={{ marginTop: 6, opacity: 0.8 }}>
            Items:{" "}
            {(o.items || []).map((it) => `${it.name} x${it.qty}`).join(", ") ||
              "-"}
          </div>
        </div>
      ))}

      {!orders.length ? (
        <div style={{ opacity: 0.7 }}>No orders yet.</div>
      ) : null}
    </div>
  );
}
