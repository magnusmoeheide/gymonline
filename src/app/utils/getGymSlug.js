// src/app/utils/getGymSlug.js
// Desired behavior:
// - localhost / 127.*                   => null
// - gymonline-e07ca.web.app             => null   (treat like root)
// - powergym.gymonline-e07ca.web.app    => "powergym"
// - gymonline.com                       => null   (root)
// - powergym.gymonline.com              => "powergym"
export function getGymSlug() {
  const host = window.location.hostname.toLowerCase();

  const isLocal =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(host);

  if (isLocal) return null;

  const isFirebaseDefault =
    host.endsWith(".web.app") || host.endsWith(".firebaseapp.com");

  if (isFirebaseDefault) {
    const labels = host.split("."); // ["powergym","gymonline-e07ca","web","app"] or ["gymonline-e07ca","web","app"]

    // root: <site>.web.app  => no slug
    if (labels.length === 3) return null;

    // subdomain: <slug>.<site>.web.app => slug is labels[0]
    if (labels.length >= 4) return labels[0] || null;

    return null;
  }

  // custom domain:
  // root: gymonline.com => no slug
  // subdomain: powergym.gymonline.com => slug is first label
  const parts = host.split(".");
  if (parts.length >= 3) return parts[0] || null;

  return null;
}
