// firebase/functionsClient.js  (make sure this matches your region)
import { getFunctions } from "firebase/functions";
import { app } from "./firebase";
export const functions = getFunctions(app, "us-central1");
