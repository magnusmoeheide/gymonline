import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase/db";
import { useAuth } from "../../context/AuthContext";

export default function Products() {
  const { userDoc } = useAuth();
  const gymId = userDoc?.gymId;

  const [busy, setBusy] = useState(false);
  const [products, setProducts] = useState([]);

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");

  async function load() {
    if (!gymId) return;
    setBusy(true);
    try {
      const q = query(collection(db, "products"), where("gymId", "==", gymId));
      const snap = await getDocs(q);
      setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
  }, [gymId]);

  async function create(e) {
    e.preventDefault();
    if (!gymId) return;
    const p = Number(price);
    if (!name.trim()) return alert("Name required");
    if (Number.isNaN(p) || p <= 0) return alert("Price must be > 0");

    setBusy(true);
    try {
      await addDoc(collection(db, "products"), {
        gymId,
        name: name.trim(),
        price: p,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setName("");
      setPrice("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function toggle(prod) {
    setBusy(true);
    try {
      await updateDoc(doc(db, "products", prod.id), {
        isActive: !prod.isActive,
        updatedAt: serverTimestamp(),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function remove(prod) {
    if (!confirm(`Delete "${prod.name}"?`)) return;
    setBusy(true);
    try {
      await deleteDoc(doc(db, "products", prod.id));
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <h2>Products (Supplements)</h2>

      <form
        onSubmit={create}
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 8,
          marginBottom: 16,
          alignItems: "center",
        }}
      >
        <input
          placeholder="Product name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          placeholder="Price"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        <button disabled={busy}>{busy ? "Saving…" : "Create product"}</button>
      </form>

      <table
        width="100%"
        cellPadding="8"
        style={{ borderCollapse: "collapse" }}
      >
        <thead>
          <tr style={{ borderBottom: "1px solid #eee" }}>
            <th align="left">Name</th>
            <th align="left">Price</th>
            <th align="left">Active</th>
            <th align="left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id} style={{ borderBottom: "1px solid #f3f3f3" }}>
              <td>{p.name}</td>
              <td>{p.price}</td>
              <td>{String(!!p.isActive)}</td>
              <td>
                <button disabled={busy} onClick={() => toggle(p)}>
                  {p.isActive ? "Disable" : "Enable"}
                </button>{" "}
                <button disabled={busy} onClick={() => remove(p)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
          {!products.length ? (
            <tr>
              <td colSpan="4" style={{ opacity: 0.7 }}>
                {busy ? "Loading…" : "No products yet."}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
