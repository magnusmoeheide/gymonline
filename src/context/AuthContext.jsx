// src/context/AuthContext.jsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";
import { auth } from "../firebase/auth";
import { db } from "../firebase/db";

const AuthContext = createContext(null);

export const SIM_KEY = "SIMULATED_USER_ID";

export function AuthProvider({ children }) {
  const [authUser, setAuthUser] = useState(undefined);
  const [authReady, setAuthReady] = useState(false);

  const [realUserDoc, setRealUserDoc] = useState(null);
  const [userDoc, setUserDoc] = useState(null);

  const [gymName, setGymName] = useState(null);

  const [simUid, setSimUid] = useState(
    () => localStorage.getItem(SIM_KEY) || "",
  );
  const [loading, setLoading] = useState(true);
  // Keep doc reads simple; timeouts here can hide successful reads.

  // 1) Auth only
  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setAuthUser(u || null);
      setAuthReady(true);
    });
  }, []);

  // Safety: don't hang forever if auth init stalls
  useEffect(() => {
    if (authReady) return;
    const t = setTimeout(() => {
      console.warn("AuthContext: auth init timeout, assuming signed out");
      setAuthUser(null);
      setAuthReady(true);
    }, 2000);
    return () => clearTimeout(t);
  }, [authReady]);

  // 2) Load docs whenever authUser or simUid changes
  useEffect(() => {
    let alive = true;

    // Wait for Firebase to report initial auth state
    if (!authReady) {
      setLoading(true);
      return () => {
        alive = false;
      };
    }

    async function safeSignOut(reason) {
      console.error("AuthContext: signing out:", reason);
      try {
        await signOut(auth);
      } catch (e) {
        console.error("AuthContext: signOut failed:", e);
      }
    }

    async function run() {
      // signed out
      if (!authUser) {
        if (!alive) return;
        setRealUserDoc(null);
        setUserDoc(null);
        setGymName(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        // Guard reserved auth UIDs
        if (typeof authUser.uid === "string" && authUser.uid.startsWith("__")) {
          await safeSignOut(`reserved auth uid: ${authUser.uid}`);
          if (!alive) return;
          setRealUserDoc(null);
          setUserDoc(null);
          setGymName(null);
          setLoading(false);
          return;
        }

        // Real signed-in user doc
        let realSnap = await getDoc(doc(db, "users", authUser.uid));
        let real = realSnap?.exists?.() ? realSnap.data() : null;

        // Fallback: if user doc ID doesn't match auth uid, try by email
        if (!real && authUser?.email) {
          try {
            const q = query(
              collection(db, "users"),
              where("email", "==", authUser.email.toLowerCase()),
              limit(1),
            );
            const snap = await getDocs(q);
            if (!alive) return;
            if (!snap.empty) {
              realSnap = snap.docs[0];
              real = realSnap.data() || null;
            }
          } catch (e) {
            console.warn("AuthContext email lookup failed:", e);
          }
        }
        if (!alive) return;

        setRealUserDoc(real);

        // If no user profile, you can decide to sign out or keep null
        if (!real) {
          setUserDoc(null);
          setGymName(null);
          setLoading(false);
          return;
        }

        // Guard reserved gymId values
        if (
          typeof real.gymId === "string" &&
          real.gymId.startsWith("__") &&
          real.gymId !== "__global__"
        ) {
          await safeSignOut(`reserved gymId: ${real.gymId}`);
          if (!alive) return;
          setRealUserDoc(null);
          setUserDoc(null);
          setGymName(null);
          setLoading(false);
          return;
        }

        // Can simulate:
        // - SUPER_ADMIN can simulate anyone
        // - GYM_ADMIN can simulate (if you want to keep that) -> same as your old behavior
        const canSimulate =
          (real.role === "SUPER_ADMIN" || real.role === "GYM_ADMIN") &&
          !!simUid;

        // If simUid is set but user can't simulate, clear it
        if (!!simUid && !canSimulate) {
          localStorage.removeItem(SIM_KEY);
          setSimUid("");
        }

        // Resolve effective doc (real or simulated)
        let effective = real;
        let effectiveGymId = real.gymId || null;

        if (canSimulate) {
          const simSnap = await getDoc(doc(db, "users", simUid));
          if (!alive) return;

          if (simSnap?.exists?.()) {
            const sim = simSnap.data() || {};

            // Enforce same-gym simulation for GYM_ADMIN (optional)
            if (
              real.role === "GYM_ADMIN" &&
              sim.gymId &&
              sim.gymId !== real.gymId
            ) {
              localStorage.removeItem(SIM_KEY);
              setSimUid("");
            } else {
              effective = {
                ...sim,
                __simulated: true,
                __realUid: authUser.uid,
                __realRole: real.role,
              };
              effectiveGymId = sim.gymId || null;
            }
          } else {
            // broken sim uid
            localStorage.removeItem(SIM_KEY);
            setSimUid("");
          }
        }

        // Gym name should match the effective user (simulated gym when simulating)
        let gn = null;

        // superadmin/global can have no gym
        if (effectiveGymId && effectiveGymId !== "__global__") {
          const gymSnap = await getDoc(doc(db, "gyms", effectiveGymId));
          if (gymSnap?.exists?.()) gn = gymSnap.data()?.name || null;
        }

        if (!alive) return;

        setUserDoc(effective);
        setGymName(gn);
      } catch (e) {
        console.error("AuthContext load failed:", e);
        if (!alive) return;
        setRealUserDoc(null);
        setUserDoc(null);
        setGymName(null);
      } finally {
        if (alive) setLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [authUser, simUid, authReady]);

  const startSimulation = useCallback((uid) => {
    const v = String(uid || "").trim();
    if (!v) return;
    localStorage.setItem(SIM_KEY, v);
    setSimUid(v);
  }, []);

  const stopSimulation = useCallback(() => {
    localStorage.removeItem(SIM_KEY);
    setSimUid("");
  }, []);

  const value = useMemo(
    () => ({
      user: authUser,
      authUser,
      realUserDoc,
      userDoc,
      gymName,
      loading,
      authReady,
      startSimulation,
      stopSimulation,
      isSimulated: !!userDoc?.__simulated,
    }),
    [
      authUser,
      realUserDoc,
      userDoc,
      gymName,
      loading,
      authReady,
      startSimulation,
      stopSimulation,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
