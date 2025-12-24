// src/app/utils/getGymSlug.js
// Supports:
//  - powergym.gymonline-e07ca.web.app  -> "powergym"
//  - powergym.yourdomain.com           -> "powergym"
//  - gymonline-e07ca.web.app           -> null (no gym selected)
//  - localhost                         -> null
export function getGymSlug() {
  const host = window.location.hostname.toLowerCase();

  // localhost / ip
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(host)
  ) {
    return null;
  }

  const isFirebaseDefault =
    host.endsWith(".web.app") || host.endsWith(".firebaseapp.com");

  // -------- Firebase default domain handling --------
  // <site>.web.app -> no gym slug (just the "root" app)
  if (isFirebaseDefault) {
    const labels = host.split("."); // ["powergym","gymonline-e07ca","web","app"]

    // must be: <slug>.<site>.web.app  (at least 4 labels)
    if (labels.length >= 4) {
      // slug is the label right before the firebase site id
      // powergym.gymonline-e07ca.web.app -> labels[0]
      return labels[0] || null;
    }

    // gymonline-e07ca.web.app -> no subdomain slug
    return null;
  }

  // -------- Custom domain handling --------
  // powergym.gymonline.com -> "powergym"
  const parts = host.split(".");
  if (parts.length >= 3) return parts[0];

  // apex domain (gymonline.com) -> no gym slug
  return null;
}
