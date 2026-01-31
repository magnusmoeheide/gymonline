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
  const [showAdd, setShowAdd] = useState(false);

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
      setShowAdd(false);
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
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h2 style={{ margin: 0 }}>Products</h2>
        <button type="button" onClick={() => setShowAdd(true)} disabled={busy}>
          Create product
        </button>
      </div>
      <p style={{ margin: 0, opacity: 0.75 }}>
        Use this section to sell supplements, training sessions, or any other
        add-ons to your members.
      </p>

      <div className="table-scroll">
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
              maxWidth: 640,
              background: "#fff",
              borderRadius: 12,
              border: "1px solid #eee",
              boxShadow: "0 12px 40px rgba(0,0,0,0.15)",
              padding: 16,
              display: "grid",
              gap: 12,
            }}
          >
            <div style={{ fontWeight: 800 }}>Create product</div>
            <form
              onSubmit={create}
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 10,
              }}
            >
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.7 }}>Product name</span>
                <input
                  placeholder="Product name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.7 }}>Price</span>
                <input
                  placeholder="Price"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
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
                  {busy ? "Saving…" : "Create product"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  disabled={busy}
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
