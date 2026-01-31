// src/app/utils/getGymSlug.js
export function getGymSlug() {
  const host = window.location.hostname.toLowerCase();
  const path = window.location.pathname || "/";

  // ✅ Treat firebase hosting root as root (no slug)
  // e.g. https://gymonline-e07ca.web.app/
  if (host === "gymonline-e07ca.web.app" || host.endsWith(".web.app") || host.endsWith(".firebaseapp.com")) {
    // still allow /:slug/... on web.app
  }

  // ✅ Treat your custom domain roots as root (no slug)
  if (host === "onlinegym.co" || host === "www.onlinegym.co") {
    // allow /:slug/... on custom domain
  }

  // ✅ Path-based tenant: /:slug/...
  const parts = path.split("/").filter(Boolean); // ["powergym","admin"]
  if (!parts.length) return null;
  const reserved = new Set([
    "login",
    "join",
    "create",
    "superadmin",
    "admin",
    "app",
    "g",
  ]);
  if (reserved.has(parts[0])) return null;
  return parts[0];

  return null;
}

// handy for links
export function getTenantBasePath() {
  const slug = getGymSlug();
  return slug ? `/${slug}` : "";
}
