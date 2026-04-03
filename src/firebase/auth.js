import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
} from "firebase/auth";
import {
  app,
  describeFirebaseIssue,
  firebaseAppAvailable,
  firebaseAppError,
} from "./firebase";

let auth = null;
let firebaseAuthError = firebaseAppAvailable ? null : firebaseAppError;

if (app) {
  try {
    auth = getAuth(app);
  } catch (error) {
    firebaseAuthError = error;
    console.error("Firebase auth initialization failed:", error);
  }
}

export { auth };
export const firebaseAuthAvailable = !!auth;
export { firebaseAuthError };
export const firebaseAuthUnavailableReason = firebaseAuthError
  ? describeFirebaseIssue(firebaseAuthError)
  : "";

export const authPersistenceReady = auth
  ? setPersistence(auth, browserLocalPersistence).catch((err) => {
      console.warn("Auth persistence setup failed:", err);
    })
  : Promise.resolve();
