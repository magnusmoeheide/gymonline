// src/pages/admin/Website.jsx
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { db } from "../../firebase/db";
import { functions } from "../../firebase/functionsClient";
import { storage } from "../../firebase/storage";
import { useAuth } from "../../context/AuthContext";
import { auth } from "../../firebase/auth";

export default function Website() {
  const { userDoc } = useAuth();
  const gymId = userDoc?.gymId;
  const gymSlug = userDoc?.gymSlug || "";

  const [loginLogoUrl, setLoginLogoUrl] = useState("");
  const [websiteText, setWebsiteText] = useState("");
  const [location, setLocation] = useState("");
  const [openingHours, setOpeningHours] = useState("");
  const [brandingBusy, setBrandingBusy] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState("");

  useEffect(() => {
    if (!gymId) return;
    let alive = true;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "gyms", gymId));
        if (!alive) return;
        const data = snap?.exists?.() ? snap.data() : {};
        setLoginLogoUrl(data?.loginLogoUrl || "");
        setWebsiteText(data?.websiteText || "");
        setLocation(data?.location || "");
        setOpeningHours(data?.openingHours || "");
      } catch (e) {
        console.error("Failed to load gym branding", e);
      }
    })();
    return () => {
      alive = false;
    };
  }, [gymId]);

  useEffect(() => {
    if (!logoFile) {
      setLogoPreview("");
      return;
    }
    const url = URL.createObjectURL(logoFile);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  async function saveBranding(e) {
    e.preventDefault();
    if (!gymId) return;
    setBrandingBusy(true);
    try {
      const syncClaims = httpsCallable(functions, "syncAuthClaims");
      await syncClaims();
      const tokenResult = await auth.currentUser?.getIdTokenResult(true);
      console.log("[Website] token claims", tokenResult?.claims);

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

      const fn = httpsCallable(functions, "updateWebsiteContent");
      await fn({
        gymId,
        slug: gymSlug,
        loginLogoUrl: nextLogoUrl,
        websiteText: websiteText.trim(),
        location: location.trim(),
        openingHours: openingHours.trim(),
      });

      setLoginLogoUrl(nextLogoUrl);
      setLogoFile(null);
      alert("Website settings saved");
    } catch (err) {
      console.error(err);
      alert(err?.message || "Failed to save settings");
    } finally {
      setBrandingBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <h2>Website</h2>

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
      <div style={{ fontSize: 13, opacity: 0.75 }}>
        Website link:{" "}
        {gymSlug ? (
          <a
            href={`https://onlinegym.co/${gymSlug}`}
            target="_blank"
            rel="noreferrer"
            style={{ fontWeight: 700 }}
          >
            {`https://onlinegym.co/${gymSlug}`}
          </a>
        ) : (
          <b>—</b>
        )}
      </div>

      <form
        onSubmit={saveBranding}
        style={{ display: "grid", gap: 10, maxWidth: 680 }}
      >
        <h3 style={{ marginTop: 0 }}>Login branding</h3>
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
            <div style={{ fontSize: 12, opacity: 0.7 }}>Current logo</div>
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
            <div style={{ fontSize: 12, opacity: 0.7 }}>New logo preview</div>
          </div>
        ) : null}

        <input
          type="file"
          accept="image/*"
          onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
        />

        <h3>Website content</h3>
        <textarea
          rows={5}
          placeholder="Website text (shown on https://onlinegym.co/{gymSlug})"
          value={websiteText}
          onChange={(e) => setWebsiteText(e.target.value)}
        />
        <input
          placeholder="Location (e.g. Westlands, Nairobi)"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
        <input
          placeholder="Opening hours (e.g. Mon–Fri 6am–9pm, Sat 8am–6pm)"
          value={openingHours}
          onChange={(e) => setOpeningHours(e.target.value)}
        />

        <button className="btn-primary" disabled={brandingBusy}>
          {brandingBusy ? "Saving…" : "Save website settings"}
        </button>
      </form>
    </div>
  );
}
