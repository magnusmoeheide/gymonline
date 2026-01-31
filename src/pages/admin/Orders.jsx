import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "../../firebase/db";
import { useAuth } from "../../context/AuthContext";

export default function Orders() {
  const { userDoc } = useAuth();
  const gymId = userDoc?.gymId;

  const [orders, setOrders] = useState([]);
  const [members, setMembers] = useState([]);
  const [products, setProducts] = useState([]);
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);

  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [qty, setQty] = useState(1);
  const [paymentStatus, setPaymentStatus] = useState("pending");

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId),
    [products, selectedProductId]
  );
  const total = useMemo(() => {
    const price = Number(selectedProduct?.price) || 0;
    const q = Math.max(1, Number(qty) || 1);
    return price * q;
  }, [selectedProduct, qty]);

  async function load() {
    if (!gymId) return;
    setBusy(true);
    try {
      const membersQ = query(
        collection(db, "users"),
        where("gymId", "==", gymId),
        where("role", "==", "MEMBER")
      );
      const productsQ = query(
        collection(db, "products"),
        where("gymId", "==", gymId)
      );
      const [membersSnap, productsSnap] = await Promise.all([
        getDocs(membersQ),
        getDocs(productsQ),
      ]);
      setMembers(membersSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setProducts(productsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
      setMembers([]);
      setProducts([]);
    }

    try {
      const ordersQ = query(
        collection(db, "orders"),
        where("gymId", "==", gymId),
        orderBy("createdAt", "desc")
      );
      const ordersSnap = await getDocs(ordersQ);
      setOrders(ordersSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
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

  async function createOrder(e) {
    e.preventDefault();
    if (!gymId) return;
    if (!selectedMemberId) return alert("Select a member");
    if (!selectedProductId) return alert("Select a product");
    const price = Number(selectedProduct?.price) || 0;
    const q = Math.max(1, Number(qty) || 1);
    if (!price) return alert("Product price is missing");

    setSaving(true);
    try {
      await addDoc(collection(db, "orders"), {
        gymId,
        userId: selectedMemberId,
        items: [
          {
            productId: selectedProductId,
            name: selectedProduct?.name || "",
            qty: q,
            price,
          },
        ],
        total: price * q,
        paymentStatus,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setSelectedMemberId("");
      setSelectedProductId("");
      setQty(1);
      setPaymentStatus("pending");
      setShowAdd(false);
      await load();
    } catch (e) {
      console.error(e);
      alert(e?.message || "Failed to create order");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h2 style={{ margin: 0 }}>Orders</h2>
        <button type="button" onClick={() => setShowAdd(true)} disabled={busy}>
          Add order
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
                  {busy ? "Loading…" : "No orders yet."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

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
              <div style={{ fontWeight: 800 }}>Create order</div>
            </div>

            <form
              onSubmit={createOrder}
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 10,
              }}
            >
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.7 }}>Member</span>
                <select
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                >
                  <option value="">Select member</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name || m.email || m.phoneE164 || m.id}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.7 }}>Product</span>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                >
                  <option value="">Select product</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.price})
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.7 }}>Quantity</span>
                <input
                  type="number"
                  min="1"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.7 }}>Payment status</span>
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value)}
                >
                  <option value="pending">pending</option>
                  <option value="paid">paid</option>
                  <option value="comped">comped</option>
                </select>
              </label>
              <div style={{ gridColumn: "1 / -1", fontWeight: 700 }}>
                Total: {total}
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  justifyContent: "flex-end",
                  gridColumn: "1 / -1",
                }}
              >
                <button disabled={saving} type="submit">
                  {saving ? "Saving…" : "Create order"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  disabled={saving}
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
