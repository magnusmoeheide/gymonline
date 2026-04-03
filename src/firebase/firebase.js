import { initializeApp } from "firebase/app";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const REQUIRED_KEYS = [
  "apiKey",
  "authDomain",
  "projectId",
  "appId",
];

export const missingFirebaseConfigKeys = REQUIRED_KEYS.filter(
  (key) => !String(firebaseConfig[key] || "").trim(),
);

let app = null;
let firebaseAppError = null;

if (missingFirebaseConfigKeys.length) {
  firebaseAppError = new Error(
    `Missing Firebase config: ${missingFirebaseConfigKeys.join(", ")}`,
  );
  console.warn(firebaseAppError.message);
} else {
  try {
    app = initializeApp(firebaseConfig);
  } catch (error) {
    firebaseAppError = error;
    console.error("Firebase app initialization failed:", error);
  }
}

export { app, firebaseConfig };
export const firebaseAppAvailable = !!app;
export { firebaseAppError };

export function describeFirebaseIssue(
  error,
  fallback = "This feature is temporarily unavailable on this deployment.",
) {
  const code = String(error?.code || "");

  if (code === "auth/invalid-api-key") {
    return "Sign-in is temporarily unavailable because Firebase auth is misconfigured on this deployment.";
  }

  if (typeof error?.message === "string" && error.message.trim()) {
    return error.message.trim();
  }

  return fallback;
}
