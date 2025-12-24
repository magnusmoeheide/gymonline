import { useEffect, useState } from "react";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "../../firebase/db";
import { useAuth } from "../../context/AuthContext";

export default function Orders() {
  const { userDoc } = useAuth();
  const gymId = userDoc?.gymId;

  const [orders, setOrders] = useState([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!gymId) return;
    setBusy(true);
    try {
      const q = query(
        collection(db, "orders"),
        where("gymId", "==", gymId),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      // If you haven't created the index/orderBy yet, Firestore will tell you.
      console.error(e);
      setOrders([]);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
  }, [gymId]);

  return (
    <div>
      <h2>Orders</h2>
      {busy ? <div>Loading…</div> : null}

      <table
        width="100%"
        cellPadding="8"
        style={{ borderCollapse: "collapse" }}
      >
        <thead>
          <tr style={{ borderBottom: "1px solid #eee" }}>
            <th align="left">User</th>
            <th align="left">Total</th>
            <th align="left">Payment</th>
            <th align="left">Created</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} style={{ borderBottom: "1px solid #f3f3f3" }}>
              <td>{o.userId}</td>
              <td>{o.total}</td>
              <td>{o.paymentStatus || "pending"}</td>
              <td>
                {o.createdAt?.toDate
                  ? o.createdAt.toDate().toISOString().slice(0, 10)
                  : "-"}
              </td>
            </tr>
          ))}
          {!orders.length ? (
            <tr>
              <td colSpan="4" style={{ opacity: 0.7 }}>
                No orders yet (or missing index for orderBy).
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
