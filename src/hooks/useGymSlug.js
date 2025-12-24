// src/hooks/useGymSlug.js
import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/db";
import { getGymSlug } from "../app/utils/getGymSlug";

export default function useGymSlug() {
  // compute once per hook instance
  const slug = useMemo(() => getGymSlug(), []);

  const [gymId, setGymId] = useState(null);
  const [loading, setLoading] = useState(Boolean(slug));
  const [exists, setExists] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;

    async function run() {
      // if no slug (localhost), treat as "ok" and don't fetch
      if (!slug) {
        if (!alive) return;
        setGymId(null);
        setExists(true); // important: avoid login/guards redirect loops
        setLoading(false);
        setError(null);
        return;
      }

      // prevent re-setting loading on every strict-mode double mount
      setLoading((v) => (v ? v : true));
      setError(null);

      try {
        const snap = await getDoc(doc(db, "slugs", slug));
        if (!alive) return;

        if (!snap.exists()) {
          setGymId(null);
          setExists(false);
          setLoading(false);
          return;
        }

        const id = snap.data()?.gymId || null;
        setGymId(id);
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
