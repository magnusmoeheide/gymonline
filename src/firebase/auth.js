import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
} from "firebase/auth";
import { app } from "./firebase";

export const auth = getAuth(app);
export const authPersistenceReady = setPersistence(
  auth,
  browserLocalPersistence,
).catch((err) => {
  console.warn("Auth persistence setup failed:", err);
});
