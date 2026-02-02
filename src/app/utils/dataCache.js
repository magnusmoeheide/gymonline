// Simple in-memory cache for page data between route switches.
const store = new Map();

export function getCache(key, maxAgeMs) {
  const entry = store.get(key);
  if (!entry) return null;
  if (maxAgeMs && Date.now() - entry.ts > maxAgeMs) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

export function setCache(key, value) {
  store.set(key, { ts: Date.now(), value });
}
