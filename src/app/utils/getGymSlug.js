// src/app/utils/getGymSlug.js
export function getGymSlug() {
  const host = window.location.hostname; // powergym.localhost OR powergym.gymonline.app OR localhost
  const parts = host.split(".");

  // Local dev: powergym.localhost => slug=powergym
  if (parts.length === 2 && parts[1] === "localhost") return parts[0];

  // Prod: powergym.gymonline.app => slug=powergym
  if (parts.length >= 3) return parts[0];

  return null;
}
