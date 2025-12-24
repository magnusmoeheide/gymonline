// src/app/utils/getGymSlug.js
export function getGymSlug() {
  const host = window.location.hostname.toLowerCase(); // e.g. gymonline-e07ca.web.app

  // localhost / ip -> no slug
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(host)
  ) {
    return null;
  }

  // firebase hosting default domains:
  //  - <site>.web.app
  //  - <site>.firebaseapp.com
  // for these, use the site id as slug
  if (host.endsWith(".web.app") || host.endsWith(".firebaseapp.com")) {
    const site = host.split(".")[0]; // gymonline-e07ca
    // alias the site-id to your canonical gym slug
    if (site === "gymonline-e07ca") return "gymonline";
    return site;
  }

  // custom domains / real subdomains:
  // gym1.example.com -> "gym1"
  const parts = host.split(".");
  if (parts.length >= 3) return parts[0];

  // apex domain (example.com) -> no slug (or pick a default)
  return null;
}
