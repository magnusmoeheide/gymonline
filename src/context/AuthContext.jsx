// src/context/AuthContext.jsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth } from "../firebase/auth";
import { db } from "../firebase/db";

const AuthContext = createContext(null);

export const SIM_KEY = "SIMULATED_USER_ID";

export function AuthProvider({ children }) {
  const [authUser, setAuthUser] = useState(null);

  const [realUserDoc, setRealUserDoc] = useState(null);
  const [userDoc, setUserDoc] = useState(null);

  const [gymName, setGymName] = useState(null);

  const [simUid, setSimUid] = useState(
    () => localStorage.getItem(SIM_KEY) || ""
  );
  const [loading, setLoading] = useState(true);

  // 1) Subscribe ONLY to auth changes (no Firestore here)
  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setAuthUser(u || null);
    });
  }, []);

  // 2) Load Firestore docs when authUser OR simUid changes
  useEffect(() => {
    let alive = true;

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
        // real signed-in user
        // Guard against reserved / invalid auth UIDs (e.g. "__global__") which
        // cause Firestore to throw `Resource id "__..." is invalid because it is reserved`.
        // If we detect a reserved UID, sign the user out and avoid querying Firestore.
        if (
          typeof authUser?.uid === "string" &&
          authUser.uid.startsWith("__")
        ) {
          console.error(
            "AuthContext: reserved auth uid, signing out:",
            authUser.uid
          );
          try {
            await auth.signOut();
          } catch (signErr) {
            console.error("AuthContext: signOut failed:", signErr);
          }
          if (!alive) return;
          setRealUserDoc(null);
          setUserDoc(null);
          setGymName(null);
          setLoading(false);
          return;
        }

        const realSnap = await getDoc(doc(db, "users", authUser.uid));
        const real = realSnap.exists() ? realSnap.data() : null;
        if (!alive) return;

        setRealUserDoc(real);

        // Guard against reserved gymId values in the user doc (e.g. "__global__").
        // Fetching a doc with such an id causes Firestore to throw a reserved id error.
        // Allow "__global__" as a special case for super admins (skip gym fetch, set gymName to null).
        if (
          typeof real?.gymId === "string" &&
          real.gymId.startsWith("__") &&
          real.gymId !== "__global__"
        ) {
          console.error(
            "AuthContext: reserved gymId in user doc, signing out:",
            real.gymId
          );
          try {
            await auth.signOut();
          } catch (signErr) {
            console.error("AuthContext: signOut failed:", signErr);
          }
          if (!alive) return;
          setRealUserDoc(null);
          setUserDoc(null);
          setGymName(null);
          setLoading(false);
          return;
        }

        // gym name from real user's gym
        let gn = null;
        if (real?.gymId && real.gymId !== "__global__") {
          const gymSnap = await getDoc(doc(db, "gyms", real.gymId));
          if (gymSnap.exists()) gn = gymSnap.data()?.name || null;
        }
        if (!alive) return;
        setGymName(gn);

        // simulation
        const canSimulate = real?.role === "GYM_ADMIN" && !!simUid;

        if (canSimulate) {
          const simSnap = await getDoc(doc(db, "users", simUid));
          if (!alive) return;

          if (simSnap.exists()) {
            setUserDoc({
              ...simSnap.data(),
              __simulated: true,
              __realAdminUid: authUser.uid,
            });
            setLoading(false);
            return;
          }

          // broken sim uid
          localStorage.removeItem(SIM_KEY);
          setSimUid("");
        }

        setUserDoc(real);
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
  }, [authUser, simUid]);

  const startSimulation = useCallback((uid) => {
    const v = String(uid || "").trim();
    if (!v) return;
    localStorage.setItem(SIM_KEY, v);
    setSimUid(v); // <- triggers reload immediately
  }, []);

  const stopSimulation = useCallback(() => {
    localStorage.removeItem(SIM_KEY);
    setSimUid(""); // <- triggers reload immediately
  }, []);

  const value = useMemo(
    () => ({
      authUser,
      realUserDoc,
      userDoc,
      gymName,
      loading,
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
      startSimulation,
      stopSimulation,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
