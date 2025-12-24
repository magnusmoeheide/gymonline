import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase/db";
import { useAuth } from "../../context/AuthContext";

export default function Store() {
  const { user, userDoc } = useAuth();
  const gymId = userDoc?.gymId;

  const [products, setProducts] = useState([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!gymId) return;
    const q = query(
      collection(db, "products"),
      where("gymId", "==", gymId),
      where("isActive", "==", true)
    );
    const snap = await getDocs(q);
    setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }

  useEffect(() => {
    load();
  }, [gymId]);

  async function buy(prod) {
    if (!user || !gymId) return;
    setBusy(true);
    try {
      await addDoc(collection(db, "orders"), {
        gymId,
        userId: user.uid,
        items: [
          { productId: prod.id, name: prod.name, qty: 1, price: prod.price },
        ],
        total: prod.price,
        paymentStatus: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      alert("Order created (pending). Payment integration comes next.");
    } catch (e) {
      console.error(e);
      alert("Failed to create order (check rules)");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2>Store</h2>

      {products.map((p) => (
        <div
          key={p.id}
          style={{
            padding: 10,
            border: "1px solid #eee",
            borderRadius: 8,
            marginBottom: 8,
          }}
        >
          <div>
            <b>{p.name}</b>
          </div>
          <div>Price: {p.price}</div>
          <button
            disabled={busy}
            onClick={() => buy(p)}
            style={{ marginTop: 6 }}
          >
            Buy
          </button>
        </div>
      ))}

      {!products.length ? (
        <div style={{ opacity: 0.7 }}>No products available.</div>
      ) : null}
    </div>
  );
}
