// src/pages/admin/Settings.jsx
import { useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { collection, doc, getDoc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { db } from "../../firebase/db";
import { functions } from "../../firebase/functionsClient";
import { useAuth } from "../../context/AuthContext";
import { storage } from "../../firebase/storage";

export default function Settings() {
  const { userDoc } = useAuth();
  const gymId = userDoc?.gymId;
  const gymSlug = userDoc?.gymSlug || "";

  // templates (keep your placeholders)
  const [expiring7, setExpiring7] = useState(
    "Hi {{name}}, your membership expires on {{date}}. Renew to stay active."
  );
  const [expiring1, setExpiring1] = useState(
    "Reminder: membership expires tomorrow ({{date}})."
  );
  const [expired, setExpired] = useState(
    "Your membership expired on {{date}}. Renew anytime."
  );

  // admins table
  const [admins, setAdmins] = useState([]);
  const [busy, setBusy] = useState(false);

  // add admin form
  const [adminName, setAdminName] = useState("");
  const [adminPhoneE164, setAdminPhoneE164] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminTempPassword, setAdminTempPassword] = useState("");

  // login branding
  const [loginLogoUrl, setLoginLogoUrl] = useState("");
  const [loginText, setLoginText] = useState("");
  const [brandingBusy, setBrandingBusy] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState("");

  const [selfEmail, setSelfEmail] = useState("");
  const [selfName, setSelfName] = useState("");
  const [selfPhoneE164, setSelfPhoneE164] = useState("");
  const [selfBusy, setSelfBusy] = useState(false);

  async function loadAdmins() {
    if (!gymId) return;
    setBusy(true);
    try {
      const qAdmins = query(
        collection(db, "users"),
        where("gymId", "==", gymId),
        where("role", "==", "GYM_ADMIN")
      );
      const snap = await getDocs(qAdmins);
      setAdmins(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    loadAdmins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gymId]);

  useEffect(() => {
    if (!gymId) return;
    let alive = true;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "gyms", gymId));
        if (!alive) return;
        const data = snap?.exists?.() ? snap.data() : {};
        setLoginLogoUrl(data?.loginLogoUrl || "");
        setLoginText(data?.loginText || "");
      } catch (e) {
        console.error("Failed to load gym branding", e);
      }
    })();
    return () => {
      alive = false;
    };
  }, [gymId]);

  useEffect(() => {
    setSelfEmail(userDoc?.email || "");
    setSelfName(userDoc?.name || "");
    setSelfPhoneE164(userDoc?.phoneE164 || "");
  }, [userDoc?.email]);

  useEffect(() => {
    if (!logoFile) {
      setLogoPreview("");
      return;
    }
    const url = URL.createObjectURL(logoFile);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  async function addGymAdmin(e) {
    e.preventDefault();
    if (!gymId) return;

    if (!adminName.trim()) return alert("Admin name required");
    if (!adminPhoneE164.trim().startsWith("+"))
      return alert("Phone must be E.164 (+...)");
    if (!adminEmail.trim()) return alert("Email required");
    if ((adminTempPassword || "").length < 6)
      return alert("Temp password min 6 chars");

    setBusy(true);
    try {
      const fn = httpsCallable(functions, "createGymAdmin"); // Cloud Function
      await fn({
        name: adminName.trim(),
        phoneE164: adminPhoneE164.trim(),
        email: adminEmail.trim().toLowerCase(),
        tempPassword: adminTempPassword.trim(),
      });

      setAdminName("");
      setAdminPhoneE164("");
      setAdminEmail("");
      setAdminTempPassword("");

      await loadAdmins();
      alert("Gym admin created");
    } catch (err) {
      console.error(err);
      alert(err?.message || "Failed to create gym admin");
    } finally {
      setBusy(false);
    }
  }

  async function saveBranding(e) {
    e.preventDefault();
    if (!gymId) return;
    setBrandingBusy(true);
    try {
      let nextLogoUrl = loginLogoUrl.trim();

      if (logoFile) {
        const ext = logoFile.name.includes(".")
          ? logoFile.name.split(".").pop()
          : "png";
        const fileRef = storageRef(
          storage,
          `gyms/${gymId}/branding/login-logo.${ext}`
        );
        await uploadBytes(fileRef, logoFile, {
          contentType: logoFile.type || "image/png",
        });
        nextLogoUrl = await getDownloadURL(fileRef);
      }

      await updateDoc(doc(db, "gyms", gymId), {
        loginLogoUrl: nextLogoUrl,
        loginText: loginText.trim(),
      });

      setLoginLogoUrl(nextLogoUrl);
      setLogoFile(null);
      alert("Login branding saved");
    } catch (err) {
      console.error(err);
      alert(err?.message || "Failed to save branding");
    } finally {
      setBrandingBusy(false);
    }
  }

  async function updateOwnEmail(e) {
    e.preventDefault();
    const next = String(selfEmail || "").trim().toLowerCase();
    if (!next) return alert("Email required");
    if (selfPhoneE164 && !selfPhoneE164.trim().startsWith("+"))
      return alert("Phone must be E.164 (+...)");
    setSelfBusy(true);
    try {
      const fn = httpsCallable(functions, "updateOwnProfile");
      await fn({
        email: next,
        name: String(selfName || "").trim(),
        phoneE164: String(selfPhoneE164 || "").trim(),
      });
      alert("Profile updated");
    } catch (err) {
      console.error(err);
      alert(err?.message || "Failed to update profile");
    } finally {
      setSelfBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <h2>Settings</h2>

      <div style={{ opacity: 0.8, marginBottom: 12 }}>
        Any questions? Contact us on <b>mail@gymonline.co</b> or{" "}
        <b>+254 721 499 429</b>
      </div>

      <p style={{ opacity: 0.8 }}>
        For now these templates are local placeholders. Next step is saving them
        to <code>gyms/{`{gymId}`}</code> and using them in the Twilio function.
      </p>

      <div className="card" style={{ padding: 16, maxWidth: 520 }}>
        <h3 style={{ marginTop: 0 }}>My account</h3>
        <form onSubmit={updateOwnEmail} style={{ display: "grid", gap: 8 }}>
          <input
            placeholder="Your name"
            value={selfName}
            onChange={(e) => setSelfName(e.target.value)}
          />
          <input
            placeholder="Your phone (E.164 +...)"
            value={selfPhoneE164}
            onChange={(e) => setSelfPhoneE164(e.target.value)}
          />
          <input
            placeholder="Your email"
            value={selfEmail}
            onChange={(e) => setSelfEmail(e.target.value)}
          />
          <button className="btn-primary" disabled={selfBusy}>
            {selfBusy ? "Saving…" : "Update email"}
          </button>
        </form>
      </div>

      <div style={{ display: "grid", gap: 10, maxWidth: 820 }}>
        <label>
          Expiring 7 days
          <textarea
            rows={2}
            value={expiring7}
            onChange={(e) => setExpiring7(e.target.value)}
            style={{ width: "100%" }}
          />
        </label>
        <label>
          Expiring 1 day
          <textarea
            rows={2}
            value={expiring1}
            onChange={(e) => setExpiring1(e.target.value)}
            style={{ width: "100%" }}
          />
        </label>
        <label>
          Expired
          <textarea
            rows={2}
            value={expired}
            onChange={(e) => setExpired(e.target.value)}
            style={{ width: "100%" }}
          />
        </label>
      </div>

      <hr style={{ margin: "20px 0" }} />

      <h3>Login branding</h3>
      <div style={{ fontSize: 13, opacity: 0.75 }}>
        Login link:{" "}
        {gymSlug ? (
          <a
            href={`https://onlinegym.co/${gymSlug}/login`}
            target="_blank"
            rel="noreferrer"
            style={{ fontWeight: 700 }}
          >
            {`https://onlinegym.co/${gymSlug}/login`}
          </a>
        ) : (
          <b>—</b>
        )}
      </div>

      <form
        onSubmit={saveBranding}
        style={{ display: "grid", gap: 8, maxWidth: 600 }}
      >
        {loginLogoUrl ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: 10,
              border: "1px solid #eee",
              borderRadius: 10,
              background: "#fafafa",
            }}
          >
            <img
              src={loginLogoUrl}
              alt="Current logo"
              style={{ height: 38, objectFit: "contain" }}
            />
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              Current logo
            </div>
          </div>
        ) : null}

        {logoPreview ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: 10,
              border: "1px solid #eee",
              borderRadius: 10,
              background: "#fff",
            }}
          >
            <img
              src={logoPreview}
              alt="New logo preview"
              style={{ height: 38, objectFit: "contain" }}
            />
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              New logo preview
            </div>
          </div>
        ) : null}

        <input
          type="file"
          accept="image/*"
          onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
        />
        <textarea
          rows={3}
          placeholder="Login page text (optional)"
          value={loginText}
          onChange={(e) => setLoginText(e.target.value)}
        />
        <button className="btn-primary" disabled={brandingBusy}>
          {brandingBusy ? "Saving…" : "Save branding"}
        </button>
      </form>

      <hr style={{ margin: "20px 0" }} />

      <h3>Gym Admins</h3>

      <form
        onSubmit={addGymAdmin}
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 8,
          marginBottom: 16,
          alignItems: "center",
        }}
      >
        <input
          placeholder="Full name"
          value={adminName}
          onChange={(e) => setAdminName(e.target.value)}
        />
        <input
          placeholder="Phone (E.164) e.g. +2547..."
          value={adminPhoneE164}
          onChange={(e) => setAdminPhoneE164(e.target.value)}
        />
        <input
          placeholder="Email"
          value={adminEmail}
          onChange={(e) => setAdminEmail(e.target.value)}
          name="gymadmin-create-email"
          autoComplete="off"
        />
        <input
          placeholder="Temp password (min 6 chars)"
          value={adminTempPassword}
          onChange={(e) => setAdminTempPassword(e.target.value)}
          autoComplete="new-password"
        />
        <button disabled={busy}>{busy ? "Saving…" : "Add gym admin"}</button>
      </form>


      <table
        width="100%"
        cellPadding="8"
        style={{ borderCollapse: "collapse" }}
      >
        <thead>
          <tr style={{ borderBottom: "1px solid #eee" }}>
            <th align="left">Name</th>
            <th align="left">Phone</th>
            <th align="left">Email</th>
            <th align="left">Status</th>
          </tr>
        </thead>
        <tbody>
          {admins.map((a) => (
            <tr key={a.id} style={{ borderBottom: "1px solid #f3f3f3" }}>
              <td>{a.name}</td>
              <td>{a.phoneE164}</td>
              <td>{a.email || "-"}</td>
              <td>{a.status || "active"}</td>
            </tr>
          ))}
          {!admins.length ? (
            <tr>
              <td colSpan="4" style={{ opacity: 0.7 }}>
                {busy ? "Loading…" : "No gym admins yet."}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
