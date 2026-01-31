Purpose
This file gives AI coding agents the essential, repository-specific knowledge to be productive quickly.

Quick overview

- Frontend: React (Vite) single-page app — entry at `src/main.jsx`, routes in `src/app/routes/*`.
- Backend: Firebase (Firestore + Auth) with Cloud Functions in `functions/` (region: us-central1).
- Important: client Firestore DB id and functions Firestore DB id must match (`onlinegym-db`). See [src/firebase/db.js](src/firebase/db.js) and [functions/index.js](functions/index.js).

Key files to inspect

- App entry & routes: [src/main.jsx](src/main.jsx), [src/app/routes/PublicRoutes.jsx](src/app/routes/PublicRoutes.jsx)
- Auth & user loading pattern: [src/context/AuthContext.jsx](src/context/AuthContext.jsx) — subscribe to `auth` first, then load Firestore docs.
- Firebase client config: [src/firebase/firebase.js](src/firebase/firebase.js), [src/firebase/db.js](src/firebase/db.js), [src/firebase/functionsClient.js](src/firebase/functionsClient.js)
- Server logic: [functions/index.js](functions/index.js) — many onCall handlers (createMember, createGymAndAdmin, createGymAdmin, repairGlobalMembers, scheduled reminders).
- Project config & hosting: [firebase.json](firebase.json), [package.json](package.json), [functions/package.json](functions/package.json)

Architecture & data-flow notes

- Auth-first client pattern: `AuthContext` subscribes to Firebase Auth (no Firestore listeners there), then fetches `users/{uid}` and optional `gyms/{gymId}` docs. Preserve this separation when changing auth logic.
- Simulation: Admins can simulate another user by storing `SIMULATED_USER_ID` in localStorage (see `SIM_KEY` in `AuthContext`). Tests or UI changes that touch simulation should read/write that key.
- Gym identity: the app uses both `gymId` (real firestore doc id) and `gymSlug` (human slug). There is an explicit `slugs/{slug}` mapping; functions handle both forms. When updating membership or slug logic, search `functions/index.js` for `slug`/`slugs` usage.
- Firestore DB id: both client and functions initialize Firestore with the literal id `onlinegym-db`. If you change the DB identifier, update both [src/firebase/db.js](src/firebase/db.js) and [functions/index.js](functions/index.js).
- Functions region: client calls functions using `us-central1` (see [src/firebase/functionsClient.js](src/firebase/functionsClient.js)). Keep region consistent when deploying.

Developer workflows & commands

- Run frontend dev server: `npm run dev` (root). Use Vite HMR for local changes.
- Build static site: `npm run build` (root) — outputs `dist` used by Firebase Hosting.
- Lint: `npm run lint` (root) and `cd functions && npm run lint` for functions.
- Emulate functions locally: `cd functions && npm run serve` (requires Firebase CLI & emulators). Or from root: `npm --prefix functions run serve`.
- Deploy functions: `cd functions && npm run deploy` or `npm --prefix functions run deploy` (functions package.json runs `firebase deploy --only functions`). Hosting deploys use `firebase deploy --only hosting` (not scripted here).

Conventions & patterns to follow

- Minimal data fetching in contexts: follow `AuthContext`'s two-step approach (auth subscribe then Firestore fetch) to avoid repeated subscriptions.
- Error handling in functions: functions commonly throw `HttpsError` with codes like `permission-denied` / `invalid-argument` — client code expects these patterns.
- SMS/email flows: Twilio is optional and guarded with try/catch in functions; do not assume SMS always succeeds.
- Batch writes: Server code batches Firestore updates in chunks (see `repairGlobalMembers`) — follow identical chunk sizes (≈450) for large bulk updates.

Environment & secrets

- Client env names: VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_STORAGE_BUCKET, VITE_FIREBASE_MESSAGING_SENDER_ID, VITE_FIREBASE_APP_ID (see [src/firebase/firebase.js](src/firebase/firebase.js)).
- Functions secrets: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_DEFAULT_FROM are defined in `functions/index.js` using `defineSecret` — deploy them via Firebase Secret Manager.

What to watch for when editing

- Keep the AuthContext load sequence intact to avoid race conditions.
- Ensure `onlinegym-db` ID consistency between client and functions.
- Keep functions region and `getFunctions(app, "us-central1")` aligned.
- When touching user roles or permissions, update both client-side role checks and server `requireRole`/`assertCallerGym` guards in [functions/index.js](functions/index.js).

If unsure, inspect these examples first

- `AuthContext` user loading: [src/context/AuthContext.jsx](src/context/AuthContext.jsx)
- Function with role checks + twilio: [functions/index.js](functions/index.js)
- Firestore client initialization: [src/firebase/db.js](src/firebase/db.js)

If this file is missing context or you want deeper guidance, tell me which area (auth, functions, deploy) to expand.
