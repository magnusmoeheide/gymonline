import { initializeFirestore, enableNetwork } from "firebase/firestore";
import { app } from "./firebase";

export const db = initializeFirestore(
  app,
  {
    experimentalForceLongPolling: true,
    useFetchStreams: false,
  },
  "gymonline-db"
);

enableNetwork(db).catch(() => {});
