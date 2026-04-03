import { getFunctions } from "firebase/functions";
import { app } from "./firebase";

export const functions = app ? getFunctions(app, "us-central1") : null;
