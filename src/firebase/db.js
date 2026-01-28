// src/firebase/db.js
import { getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const app = getApp();
const DB_ID = "gymonline-db";

// Primary DB used by the web app. Keep in sync with Firebase console DB.
export const db = getFirestore(app, DB_ID);
