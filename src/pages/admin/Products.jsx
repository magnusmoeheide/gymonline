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
import { getCache, setCache } from "../../app/utils/dataCache";
import PageInfo from "../../components/PageInfo";

const CACHE_TTL_MS = 5 * 60 * 1000;

export default function Products() {
  const { userDoc } = useAuth();
  const gymId = userDoc?.gymId;

  const [busy, setBusy] = useState(false);
  const [products, setProducts] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editing, setEditing] = useState(null);

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");

  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editDescription, setEditDescription] = useState("");

  async function load({ force = false } = {}) {
    if (!gymId) return;
    const cacheKey = `adminProducts:${gymId}`;
    if (!force) {
      const cached = getCache(cacheKey, CACHE_TTL_MS);
      if (cached) {
        setProducts(cached.products || []);
        setBusy(false);
        return;
      }
    }
    setBusy(true);
    try {
      const q = query(collection(db, "products"), where("gymId", "==", gymId));
      const snap = await getDocs(q);
      const nextProducts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setProducts(nextProducts);
      setCache(cacheKey, { products: nextProducts });
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
        description: String(description || "").trim() || null,
        price: p,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setName("");
      setPrice("");
      setDescription("");
      setShowAdd(false);
      await load({ force: true });
    } finally {
      setBusy(false);
    }
  }

  function startEdit(prod) {
    setEditing(prod);
    setEditName(prod?.name || "");
    setEditPrice(String(prod?.price ?? ""));
    setEditDescription(String(prod?.description || ""));
    setShowEdit(true);
  }

  function cancelEdit() {
    setShowEdit(false);
    setEditing(null);
    setEditName("");
    setEditPrice("");
    setEditDescription("");
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editing?.id) return;
    const nextName = String(editName || "").trim();
    const nextPrice = Number(editPrice);
    const nextDesc = String(editDescription || "").trim() || null;
    if (!nextName) return alert("Name required");
    if (Number.isNaN(nextPrice) || nextPrice <= 0) return alert("Price must be > 0");

    setBusy(true);
    try {
      await updateDoc(doc(db, "products", editing.id), {
        name: nextName,
        price: nextPrice,
        description: nextDesc,
        updatedAt: serverTimestamp(),
      });
      await load({ force: true });
      cancelEdit();
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
      await load({ force: true });
    } finally {
      setBusy(false);
    }
  }

  async function remove(prod) {
    if (!confirm(`Delete "${prod.name}"?`)) return;
    setBusy(true);
    try {
      await deleteDoc(doc(db, "products", prod.id));
      await load({ force: true });
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
      <PageInfo>
        Manage products and pricing offered to your members.
      </PageInfo>
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
              <th align="left">Description</th>
              <th align="left">Active</th>
              <th align="left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} style={{ borderBottom: "1px solid #f3f3f3" }}>
                <td>{p.name}</td>
                <td>{p.price}</td>
                <td style={{ maxWidth: 280 }}>
                  <div
                    title={p.description || ""}
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {p.description || "-"}
                  </div>
                </td>
                <td>{String(!!p.isActive)}</td>
                <td>
                  <button disabled={busy} onClick={() => startEdit(p)}>
                    Edit
                  </button>{" "}
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
                <td colSpan="5" style={{ opacity: 0.7 }}>
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
              <label
                style={{
                  display: "grid",
                  gap: 6,
                  gridColumn: "1 / -1",
                }}
              >
                <span style={{ fontSize: 12, opacity: 0.7 }}>
                  Description
                </span>
                <textarea
                  rows={3}
                  placeholder="Short description..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
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

      {showEdit ? (
        <div
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) cancelEdit();
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
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontWeight: 800 }}>Edit product</div>
            </div>
            <form
              onSubmit={saveEdit}
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
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.7 }}>Price</span>
                <input
                  placeholder="Price"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                />
              </label>
              <label
                style={{
                  display: "grid",
                  gap: 6,
                  gridColumn: "1 / -1",
                }}
              >
                <span style={{ fontSize: 12, opacity: 0.7 }}>
                  Description
                </span>
                <textarea
                  rows={3}
                  placeholder="Short description..."
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
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
                  {busy ? "Saving…" : "Save changes"}
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
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
