// src/pages/public/Login.jsx
// Fix: basePath is undefined because useGymSlug likely hasn't finished (or doesn't compute it).
// Route using slug directly as fallback AND log why routing didn't happen yet.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  RecaptchaVerifier,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
} from "firebase/auth";
import { auth, authPersistenceReady } from "../../firebase/auth";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import useGymSlug from "../../hooks/useGymSlug";
import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "../../firebase/db";

export default function Login() {
  const nav = useNavigate();
  const { userDoc, realUserDoc, loading: authLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [usePhone, setUsePhone] = useState(false);
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

  const tenantBasePath = basePath || (slug ? `/g/${slug}` : undefined);

  const dbRef = useMemo(() => db, []);

  const [gymsLoading, setGymsLoading] = useState(false);
  const [gyms, setGyms] = useState([]);
  const [selectedGymId, setSelectedGymId] = useState("");
  const [gymPublic, setGymPublic] = useState(null);

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

  useEffect(() => {
    console.log("[Login] routing effect fired", {
      hasUserDoc: !!userDoc,
      hasRealUserDoc: !!realUserDoc,
      slug,
      basePath,
      tenantBasePath,
      slugGymId,
      exists,
      slugLoading,
      authLoading,
    });

    // Most common reason you're stuck: userDoc/realUserDoc never become truthy.
    // This logs it explicitly.
    if (!userDoc || !realUserDoc) {
      console.warn("[Login] routing blocked: waiting for auth context docs", {
        userDoc: !!userDoc,
        realUserDoc: !!realUserDoc,
        authLoading,
      });
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
        const base = `/g/${autoSlug}`;
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
    const base = slug ? `/g/${slug}` : docSlug ? `/g/${docSlug}` : "";

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

  function enterSelectedGym() {
    const gym = gyms.find((g) => g.id === selectedGymId);
    console.log("[Login] enterSelectedGym", { selectedGymId, gym });
    if (!gym?.slug) return;
    window.location.assign(`/g/${gym.slug}/login`);
  }

  const joinHref = tenantBasePath ? `${tenantBasePath}/join` : "/join";

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <div
        className="card"
        style={{ width: "100%", maxWidth: 440, padding: 22 }}
      >
        <div style={{ display: "grid", gap: 6, marginBottom: 12 }}>
          {gymPublic?.loginLogoUrl ? (
            <img
              src={gymPublic.loginLogoUrl}
              alt="Gym logo"
              style={{ height: 42, objectFit: "contain" }}
            />
          ) : null}
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em" }}>
            {gymPublic?.name || "GymOnline"}
          </div>
          <div style={{ fontSize: 13, opacity: 0.75 }}>
            {gymPublic?.loginText ||
              "Sign in to manage your membership and bundles."}
          </div>
        </div>

        {slug ? (
          <div style={{ opacity: 0.75, marginBottom: 14, fontSize: 13 }}>
            Gym: <b>{slug}</b>
            {slugLoading ? (
              <span style={{ marginLeft: 8, opacity: 0.6 }}>Loading…</span>
            ) : null}
          </div>
        ) : null}

        {slug && !slugLoading && !exists ? (
          <div style={{ marginBottom: 12, fontSize: 13, opacity: 0.85 }}>
            Gym <b>{slug}</b> is not registered. Create{" "}
            <span className="kbd">{`slugs/${slug}`}</span> →{" "}
            <span className="kbd">{`{ gymId }`}</span>.
          </div>
        ) : null}

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              type="button"
              onClick={() => setUsePhone(false)}
              style={{
                background: !usePhone ? "#fff7ed" : "#fff",
                borderColor: !usePhone ? "rgba(28,24,19,.25)" : undefined,
              }}
            >
              Email
            </button>
            <button
              type="button"
              onClick={() => setUsePhone(true)}
              style={{
                background: usePhone ? "#fff7ed" : "#fff",
                borderColor: usePhone ? "rgba(28,24,19,.25)" : undefined,
              }}
            >
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
              <input
                placeholder="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
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
              : busy
              ? "Signing in…"
              : "Sign in"}
          </button>
        </form>

        {err ? (
          <div
            style={{
              marginTop: 10,
              padding: 10,
              borderRadius: 12,
              border: "1px solid rgba(220, 38, 38, .35)",
              background: "rgba(220, 38, 38, .10)",
              color: "rgba(255,255,255,.92)",
              fontSize: 13,
            }}
          >
            {err}
          </div>
        ) : null}

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
            Create / Join gym
          </a>
        </div>
        <div id="recaptcha-container" />
      </div>
    </div>
  );
}
