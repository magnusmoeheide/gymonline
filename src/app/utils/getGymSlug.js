// src/app/utils/getGymSlug.js
export function getGymSlug() {
  const host = window.location.hostname.toLowerCase();
  const path = window.location.pathname || "/";

  // ✅ Treat firebase hosting root as root (no slug)
  // e.g. https://gymonline-e07ca.web.app/
  if (host === "gymonline-e07ca.web.app" || host.endsWith(".web.app") || host.endsWith(".firebaseapp.com")) {
    // still allow /g/:slug/... on web.app
  }

  // ✅ Treat your custom domain roots as root (no slug)
  if (host === "onlinegym.co" || host === "www.onlinegym.co") {
    // allow /g/:slug/... on custom domain
  }

  // ✅ Path-based tenant: /g/:slug/...
  const parts = path.split("/").filter(Boolean); // ["g","powergym","admin"]
  if (parts[0] === "g" && parts[1]) return parts[1];

  return null;
}

// handy for links
export function getTenantBasePath() {
  const slug = getGymSlug();
  return slug ? `/g/${slug}` : "";
}
