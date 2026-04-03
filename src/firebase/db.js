import { getFirestore } from "firebase/firestore";
import { app } from "./firebase";

const DB_ID = "gymonline-db";

export const db = app ? getFirestore(app, DB_ID) : null;
