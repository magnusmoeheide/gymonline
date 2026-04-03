import { getStorage } from "firebase/storage";
import { app } from "./firebase";

export const storage = app ? getStorage(app) : null;
