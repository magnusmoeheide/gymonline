// src/app/utils/getGymSlug.js
// Path-based tenants:
//
// ✅ Root (no tenant):        https://onlinegym.co
// ✅ Tenant root:             https://onlinegym.co/g/<slug>
// ✅ Tenant any route:        https://onlinegym.co/g/<slug>/admin
//
// Notes:
// - We use "/g/<slug>" so it never conflicts with "/admin", "/app", "/superadmin", etc.
// - No more subdomain logic.

function normalizeSlug(slug) {
  return String(slug || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function getGymSlug() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  // /g/<slug>/...
  if (parts[0] === "g" && parts[1]) return normalizeSlug(parts[1]);
  return null;
}

export function getGymBasePath() {
  const slug = getGymSlug();
  return slug ? `/g/${slug}` : "";
}
