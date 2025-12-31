// src/hooks/useGymSlug.js
import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/db";
import { getGymSlug } from "../app/utils/getGymSlug";

export default function useGymSlug() {
  const slug = useMemo(() => getGymSlug(), []);

  const [gymId, setGymId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exists, setExists] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;

    async function run() {
      setLoading(true);
      setError(null);

      // no slug => allow app to load, but mark "no gym selected"
      if (!slug) {
        if (!alive) return;
        setGymId(null);
        setExists(true); // don't block login page with "not registered"
        setLoading(false);
        return;
      }

      try {
        const snap = await getDoc(doc(db, "slugs", slug));
        if (!alive) return;

        if (!snap.exists()) {
          setGymId(null);
          setExists(false);
          setLoading(false);
          return;
        }

        setGymId(snap.data()?.gymId || null);
        setExists(true);
        setLoading(false);
      } catch (e) {
        if (!alive) return;
        setError(e);
        setGymId(null);
        setExists(false);
        setLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [slug]);

  return { slug, gymId, exists, loading, error };
}
