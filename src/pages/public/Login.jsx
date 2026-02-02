// src/pages/public/Login.jsx
// Fix: basePath is undefined because useGymSlug likely hasn't finished (or doesn't compute it).
// Route using slug directly as fallback AND log why routing didn't happen yet.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  RecaptchaVerifier,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  sendPasswordResetEmail,
  signOut,
} from "firebase/auth";
import { auth, authPersistenceReady } from "../../firebase/auth";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import useGymSlug from "../../hooks/useGymSlug";
import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "../../firebase/db";

export default function Login({ embedded = false }) {
  const nav = useNavigate();
  const { userDoc, realUserDoc, loading: authLoading, authUser, authReady } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [usePhone, setUsePhone] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [countryCode, setCountryCode] = useState("+254");
  const [phoneLocal, setPhoneLocal] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [smsBusy, setSmsBusy] = useState(false);
  const [smsSent, setSmsSent] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const {
    slug,
    basePath,
    gymId: slugGymId,
    exists,
    loading: slugLoading,
    error: slugError,
  } = useGymSlug();

  const tenantBasePath = basePath || (slug ? `/${slug}` : undefined);

  const dbRef = useMemo(() => db, []);

  const [gymsLoading, setGymsLoading] = useState(false);
  const [gyms, setGyms] = useState([]);
  const [selectedGymId, setSelectedGymId] = useState("");
  const [gymPublic, setGymPublic] = useState(null);
  const websiteText = gymPublic?.websiteText || "";
  const location = gymPublic?.location || "";
  const openingHours = gymPublic?.openingHours || "";
  const accessBlocked = !!gymPublic?.accessBlocked;
  const accessBlockedMessage =
    String(gymPublic?.accessBlockedMessage || "").trim() ||
    "Access has been blocked. Please contact us.";

  const mountedRef = useRef(false);
  const recaptchaRef = useRef(null);
  useEffect(() => {
    mountedRef.current = true;
    console.log("[Login] mounted");
    return () => {
      mountedRef.current = false;
      console.log("[Login] unmounted");
    };
  }, []);

  useEffect(() => {
    if (recaptchaRef.current) return;
    recaptchaRef.current = new RecaptchaVerifier(
      auth,
      "recaptcha-container",
      { size: "invisible" },
    );
  }, []);

  useEffect(() => {
    console.log("[Login] state snapshot", {
      slug,
      basePath,
      tenantBasePath,
      slugGymId,
      exists,
      slugLoading,
      slugError,
      authLoading,
      hasUserDoc: !!userDoc,
      hasRealUserDoc: !!realUserDoc,
      userDocRole: userDoc?.role,
      realUserDocRole: realUserDoc?.role,
      userDocGymId: userDoc?.gymId,
    });
  }, [
    slug,
    basePath,
    tenantBasePath,
    slugGymId,
    exists,
    slugLoading,
    slugError,
    authLoading,
    userDoc,
    realUserDoc,
  ]);

  useEffect(() => {
    if (slug) return;

    (async () => {
      console.log("[Login] loading gymsPublic...");
      setGymsLoading(true);
      setErr("");

      try {
        const gymsSnap = await getDocs(collection(dbRef, "gymsPublic"));

        const rows = gymsSnap.docs
          .map((d) => {
            const data = d.data() || {};
            return {
              id: d.id,
              name: data?.name || data?.gymName || d.id,
              slug: data?.slug || data?.subdomain || "",
              accessBlocked: !!data?.accessBlocked,
              accessBlockedMessage: data?.accessBlockedMessage || "",
            };
          })
          .filter((x) => x.slug)
          .sort((a, b) => String(a.name).localeCompare(String(b.name)));

        if (!mountedRef.current) return;

        console.log("[Login] gymsPublic loaded", { count: rows.length });
        setGyms(rows);
        setSelectedGymId((prev) =>
          prev && rows.some((g) => g.id === prev) ? prev : "",
        );
      } catch (e) {
        console.error("[Login] gymsPublic load FAILED", e);
        if (!mountedRef.current) return;
        setErr(`Failed to load gyms: ${e?.message || String(e)}`);
      } finally {
        if (mountedRef.current) setGymsLoading(false);
      }
    })();
  }, [dbRef, slug]);

  useEffect(() => {
    if (!slugGymId) {
      setGymPublic(null);
      return;
    }

    let alive = true;
    (async () => {
      try {
        const snap = await getDoc(doc(dbRef, "gymsPublic", slugGymId));
        if (!alive) return;
        setGymPublic(snap?.exists?.() ? snap.data() : null);
      } catch (e) {
        console.warn("[Login] gymsPublic branding load failed", e);
        if (!alive) return;
        setGymPublic(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, [dbRef, slugGymId]);

  const routeAttemptedRef = useRef(false);

  useEffect(() => {
    console.log("[Login] routing effect fired", {
      hasUserDoc: !!userDoc,
      hasRealUserDoc: !!realUserDoc,
      hasAuthUser: !!authUser,
      authReady,
      slug,
      basePath,
      tenantBasePath,
      slugGymId,
      exists,
      slugLoading,
      authLoading,
    });

    if (!authReady || authLoading) {
      console.log("[Login] routing paused: auth loading", {
        authReady,
        authLoading,
      });
      return;
    }

    if (!authUser) {
      console.log("[Login] routing paused: signed out");
      return;
    }

    // Most common reason you're stuck: userDoc/realUserDoc never become truthy.
    // This logs it explicitly.
    if (!userDoc || !realUserDoc) {
      console.warn("[Login] routing blocked: waiting for auth context docs", {
        userDoc: !!userDoc,
        realUserDoc: !!realUserDoc,
        authLoading,
      });
      if (!routeAttemptedRef.current) {
        routeAttemptedRef.current = true;
        console.warn("[Login] attempting fallback routing via auth user");
        routeAfterLogin(authUser);
      }
      return;
    }

    if (realUserDoc?.role === "SUPER_ADMIN") {
      console.log("[Login] SUPER_ADMIN -> nav /superadmin");
      nav("/superadmin");
      return;
    }

    if (!slug) {
      const autoSlug = userDoc?.gymSlug || realUserDoc?.gymSlug;
      if (autoSlug) {
        const base = `/${autoSlug}`;
        const target = ["GYM_ADMIN", "STAFF"].includes(userDoc.role)
          ? `${base}/admin`
          : `${base}/app`;
        console.log("[Login] no slug, auto-routing via gymSlug ->", target);
        nav(target);
      } else {
        console.warn("[Login] routing blocked: no slug");
      }
      return;
    }

    if (slugGymId && userDoc.gymId !== slugGymId) {
      console.warn("[Login] slug gym mismatch", {
        slugGymId,
        userDocGymId: userDoc.gymId,
      });
      alert("You are trying to log into the wrong gym.");
      return;
    }

    if (!exists) {
      console.warn("[Login] slug exists=false", { slug });
      return;
    }

    const target = ["GYM_ADMIN", "STAFF"].includes(userDoc.role)
      ? `${tenantBasePath}/admin`
      : `${tenantBasePath}/app`;

    console.log("[Login] navigating ->", target, { role: userDoc.role });
    nav(target);
  }, [
    userDoc,
    realUserDoc,
    authUser,
    authReady,
    nav,
    slug,
    basePath,
    tenantBasePath,
    slugGymId,
    exists,
    slugLoading,
    authLoading,
  ]);

  async function resolveUserDoc(u) {
    if (!u) return null;
    try {
      if (u.uid) {
        const snap = await getDoc(doc(dbRef, "users", u.uid));
        if (snap?.exists?.()) return snap.data();
      }
    } catch (e) {
      console.warn("[Login] uid lookup failed", e);
    }
    // fallback by email or phone
    const emailVal = String(u.email || "").toLowerCase().trim();
    const phoneVal = String(u.phoneNumber || "").trim();
    try {
      if (emailVal) {
        const q = query(
          collection(dbRef, "users"),
          where("email", "==", emailVal),
          limit(1)
        );
        const snap = await getDocs(q);
        if (!snap.empty) return snap.docs[0].data();
      }
    } catch (e) {
      console.warn("[Login] email lookup failed", e);
    }
    try {
      if (phoneVal) {
        const q = query(
          collection(dbRef, "users"),
          where("phoneE164", "==", phoneVal),
          limit(1)
        );
        const snap = await getDocs(q);
        if (!snap.empty) return snap.docs[0].data();
      }
    } catch (e) {
      console.warn("[Login] phone lookup failed", e);
    }
    return null;
  }

  async function routeAfterLogin(u) {
    const docData = await resolveUserDoc(u);
    const role = docData?.role || "";
    const docSlug = docData?.gymSlug || "";
    const base = slug ? `/${slug}` : docSlug ? `/${docSlug}` : "";
    const gymId = docData?.gymId || null;

    if (role !== "SUPER_ADMIN" && gymId) {
      try {
        const gymSnap = await getDoc(doc(dbRef, "gyms", gymId));
        const gym = gymSnap?.exists?.() ? gymSnap.data() : null;
        if (gym?.accessBlocked) {
          await signOut(auth);
          setErr(
            String(gym.accessBlockedMessage || "").trim() ||
              "Access has been blocked. Please contact us."
          );
          return;
        }
      } catch (e) {
        console.warn("[Login] gym access check failed", e);
      }
    }

    if (role === "SUPER_ADMIN") {
      nav("/superadmin");
      return;
    }

    if (role === "GYM_ADMIN" || role === "STAFF") {
      nav(base ? `${base}/admin` : "/login");
      return;
    }

    nav(base ? `${base}/app` : "/login");
  }

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    if (accessBlocked) {
      setErr(accessBlockedMessage);
      return;
    }

    if (!usePhone && resetMode) {
      const em = String(email || "").trim();
      if (!em) {
        setErr("Enter your email to reset your password.");
        return;
      }
      try {
        await sendPasswordResetEmail(auth, em);
        setErr("Password reset email sent. Check your inbox.");
      } catch (e2) {
        console.error("[Login] password reset FAILED", e2);
        setErr(e2?.message || "Failed to send reset email");
      }
      return;
    }

    console.log("[Login] submit", {
      email: email.trim(),
      hasSlug: !!slug,
      basePath,
      tenantBasePath,
      slugGymId,
      exists,
      slugLoading,
      authLoading,
    });

    if (usePhone) {
      const digits = String(phoneLocal || "").replace(/\D/g, "");
      const phoneOk =
        !digits ||
        (countryCode === "+254"
          ? digits.length === 9 && ["7", "1"].includes(digits[0])
          : digits.length >= 6);
      if (!digits) return setErr("Phone required");
      if (!phoneOk)
        return setErr("Phone format invalid. For Kenya use 9 digits (7/1...).");
      if (!smsSent) {
        setSmsBusy(true);
        try {
          await authPersistenceReady;
          const fullPhone = `${countryCode}${digits}`;
          const result = await signInWithPhoneNumber(
            auth,
            fullPhone,
            recaptchaRef.current,
          );
          if (!mountedRef.current) return;
          setConfirmation(result);
          setSmsSent(true);
        } catch (e2) {
          console.error("[Login] SMS send FAILED", e2);
          setErr(e2?.message || "Failed to send SMS");
        } finally {
          if (mountedRef.current) setSmsBusy(false);
        }
        return;
      }

      if (!smsCode.trim()) return setErr("Enter the SMS code");
      setSmsBusy(true);
      try {
        await authPersistenceReady;
        const cred = await confirmation.confirm(smsCode.trim());
        console.log("[Login] phone signIn success", {
          uid: cred?.user?.uid,
          phone: cred?.user?.phoneNumber,
        });
        await routeAfterLogin(cred?.user);
      } catch (e2) {
        console.error("[Login] SMS confirm FAILED", e2);
        setErr(e2?.message || "Invalid SMS code");
        return;
      } finally {
        if (mountedRef.current) setSmsBusy(false);
      }
    } else {
      setBusy(true);
      try {
        await authPersistenceReady;
        const cred = await signInWithEmailAndPassword(
          auth,
          email.trim(),
          password,
        );
        console.log("[Login] signIn success", {
          uid: cred?.user?.uid,
          email: cred?.user?.email,
        });
        await routeAfterLogin(cred?.user);
      } catch (e2) {
        console.error("[Login] signIn FAILED", e2);
        setErr(e2?.message || "Login failed");
      } finally {
        setBusy(false);
      }
    }
  }

  function onForgotPassword() {
    setErr("");
    setResetMode(true);
  }

  function onCancelReset() {
    setErr("");
    setResetMode(false);
  }

  function enterSelectedGym() {
    const gym = gyms.find((g) => g.id === selectedGymId);
    console.log("[Login] enterSelectedGym", { selectedGymId, gym });
    if (gym?.accessBlocked) {
      setErr(
        String(gym.accessBlockedMessage || "").trim() ||
          "Access has been blocked. Please contact us."
      );
      return;
    }
    if (!gym?.slug) return;
    window.location.assign(`/${gym.slug}/login`);
  }

  const joinHref = tenantBasePath ? `${tenantBasePath}/create` : "/create";

  const cardStyle = embedded
    ? { width: "100%", maxWidth: embedded ? 420 : 440, padding: 0, border: "none", boxShadow: "none", background: "transparent" }
    : { width: "100%", maxWidth: 440, padding: 22 };

  const showGymContent = !embedded && !!slug;

  return (
    <div
      style={{
        minHeight: embedded ? "unset" : "100vh",
        display: "grid",
        placeItems: "center",
        padding: embedded ? 0 : 24,
      }}
    >
      <div
        style={{
          display: "grid",
          gap: 16,
          alignItems: "start",
          justifyContent: "center",
          maxWidth: showGymContent ? 800 : 520,
          width: "100%",
          margin: "0 auto",
          gridTemplateColumns: showGymContent ? "1fr 1fr" : "1fr",
        }}
      >
        {showGymContent && (gymPublic?.name || websiteText || location || openingHours) ? (
          <div
            style={{
              gridColumn: "1 / -1",
              display: "grid",
              gap: 8,
              padding: 12,
              borderRadius: 12,
              background: "#fff7ed",
              border: "1px solid rgba(28,24,19,.12)",
            }}
          >
            {gymPublic?.name ? (
              <div style={{ fontSize: 16, fontWeight: 800 }}>
                {gymPublic.name}
              </div>
            ) : null}
            {location ? (
              <div style={{ fontSize: 13, opacity: 0.75 }}>
                <b>Location:</b> {location}
              </div>
            ) : null}
            {openingHours ? (
              <div style={{ fontSize: 13, opacity: 0.75 }}>
                <b>Opening hours:</b> {openingHours}
              </div>
            ) : null}
            {websiteText ? (
              <div style={{ fontSize: 14, opacity: 0.85 }}>
                {websiteText}
              </div>
            ) : null}
          </div>
        ) : null}

        {showGymContent ? (
          <div
            style={{
              display: "grid",
              gap: 12,
              alignContent: "start",
            }}
          >
            {gymPublic?.loginLogoUrl ? (
              <div
                style={{
                  height: "100%",
                  minHeight: 240,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 12,
                  border: "1px solid rgba(28,24,19,.12)",
                  borderRadius: 12,
                  background: "#fff",
                }}
              >
                <img
                  src={gymPublic.loginLogoUrl}
                  alt="Gym logo"
                  style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain" }}
                />
              </div>
            ) : (
              <div
                style={{
                  height: "100%",
                  minHeight: 240,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 12,
                  border: "1px solid rgba(28,24,19,.12)",
                  borderRadius: 12,
                  background: "#fff",
                  fontSize: 56,
                }}
              >
                <i className="fa-solid fa-dumbbell" aria-hidden="true" />
              </div>
            )}
          </div>
        ) : null}

        <div className="card" style={cardStyle}>

        {slug && !slugLoading && !exists && !authLoading ? (
          <div style={{ marginBottom: 12, fontSize: 13, opacity: 0.85 }}>
            Gym <b>{slug}</b> is not registered. Create{" "}
            <span className="kbd">{`slugs/${slug}`}</span> →{" "}
            <span className="kbd">{`{ gymId }`}</span>.
          </div>
        ) : null}

        {authLoading ? (
          <div style={{ padding: "10px 0", fontSize: 14, opacity: 0.75 }}>
            Loading…
          </div>
        ) : (
          <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              type="button"
              onClick={() => setUsePhone(false)}
              style={{
                background: !usePhone ? "#fff7ed" : "#fff",
                borderColor: !usePhone ? "rgba(28,24,19,.25)" : undefined,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <i className="fa-solid fa-envelope" aria-hidden="true" />
              Email
            </button>
            <button
              type="button"
              onClick={() => setUsePhone(true)}
              style={{
                background: usePhone ? "#fff7ed" : "#fff",
                borderColor: usePhone ? "rgba(28,24,19,.25)" : undefined,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <i className="fa-solid fa-phone" aria-hidden="true" />
              Phone
            </button>
          </div>

            {!usePhone ? (
              <>
                <input
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                />
                {!resetMode ? (
                  <input
                    placeholder="Password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                ) : null}
              </>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "0.9fr 1.4fr", gap: 8 }}>
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                  >
                    <option value="+254">Kenya (+254)</option>
                    <option value="+255">Tanzania (+255)</option>
                    <option value="+256">Uganda (+256)</option>
                    <option value="+250">Rwanda (+250)</option>
                    <option value="+257">Burundi (+257)</option>
                    <option value="+251">Ethiopia (+251)</option>
                  </select>
                  <input
                    placeholder="Phone (e.g. 712345678)"
                    value={phoneLocal}
                    onChange={(e) => setPhoneLocal(e.target.value)}
                  />
                </div>
                {smsSent ? (
                  <input
                    placeholder="SMS code"
                    value={smsCode}
                    onChange={(e) => setSmsCode(e.target.value)}
                  />
                ) : null}
              </>
            )}

            <button
              className="btn-primary"
              disabled={busy || smsBusy || authLoading || slugLoading}
            >
              {usePhone
                ? smsSent
                  ? smsBusy
                    ? "Verifying…"
                    : "Verify code"
                  : smsBusy
                  ? "Sending code…"
                  : "Send code"
                : resetMode
                ? busy
                  ? "Sending…"
                  : "Reset password"
                : busy
                ? "Signing in…"
                : "Sign in"}
            </button>
            {!usePhone ? (
              <button
                type="button"
                onClick={resetMode ? onCancelReset : onForgotPassword}
                disabled={busy || authLoading}
                style={{
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  fontSize: 12,
                  textAlign: "left",
                  color: "rgba(28,24,19,.75)",
                  textDecoration: "underline",
                  cursor: "pointer",
                }}
              >
                {resetMode ? "Back to sign in" : "Forgot password?"}
              </button>
            ) : null}
          </form>
        )}

        {err && !authLoading ? (
          <div
            style={{
              marginTop: 10,
              padding: 10,
              borderRadius: 12,
              border: "1px solid rgba(220, 38, 38, .35)",
              background: "rgba(220, 38, 38, .10)",
              color: "rgba(28,24,19,.9)",
              fontSize: 13,
            }}
          >
            {err}
          </div>
        ) : null}

        {!authLoading ? (
          <div style={{ marginTop: 16, fontSize: 13, opacity: 0.9 }}>
            New gym/member?{" "}
            <a
              href={joinHref}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid rgba(28,24,19,.15)",
                background: "#fff7ed",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
            Create gym
            </a>
          </div>
        ) : null}
        <div id="recaptcha-container" />
        </div>
      </div>
    </div>
  );
}
