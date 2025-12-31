// functions/index.js
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");
const { defineSecret } = require("firebase-functions/params");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");

const admin = require("firebase-admin");
const {
  getFirestore,
  FieldValue,
  Timestamp,
} = require("firebase-admin/firestore");

admin.initializeApp();

// ✅ IMPORTANT: use the SAME named Firestore DB as your client
const DB_ID = "gymonline-db";
const db = getFirestore(admin.app(), DB_ID);

// Secrets
const TWILIO_ACCOUNT_SID = defineSecret("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = defineSecret("TWILIO_AUTH_TOKEN");
const TWILIO_DEFAULT_FROM = defineSecret("TWILIO_DEFAULT_FROM");


// Helpers
async function getUserDoc(uid) {
  const snap = await db.doc(`users/${uid}`).get();
  return snap.exists ? snap.data() : null;
}

async function twilioClient() {
  const twilio = require("twilio");
  return twilio(TWILIO_ACCOUNT_SID.value(), TWILIO_AUTH_TOKEN.value());
}

function renderTemplate(tpl, vars) {
  let s = tpl || "";
  for (const [k, v] of Object.entries(vars || {})) {
    s = s.replaceAll(`{{${k}}}`, String(v ?? ""));
  }
  return s;
}

function isoDate(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toISOString().slice(0, 10);
}

function assertCallerGym(caller) {
  if (!caller?.gymId) {
    throw new HttpsError("failed-precondition", "Caller missing gymId");
  }
  if (!caller?.gymSlug) {
    throw new HttpsError("failed-precondition", "Caller missing gymSlug");
  }
  if (caller.gymId === "global") {
    throw new HttpsError(
      "failed-precondition",
      'Caller gymId is "global". Fix your admin users/{uid}.gymId to the real gymId.'
    );
  }
}

function requireRole(caller, allowed) {
  if (!caller)
    throw new HttpsError("permission-denied", "Missing user profile");
  if (!allowed.includes(caller.role))
    throw new HttpsError("permission-denied", "Not allowed");
}

/**
 * ✅ Sync gyms/{gymId} -> gymsPublic/{gymId}
 * - gymsPublic is readable without auth (for login gym picker)
 * - this keeps sensitive gym config private in gyms/*
 *
 * Firestore rules should include:
 * match /gymsPublic/{id} { allow read: if true; allow write: if false; }
 */
exports.syncGymToPublic = onDocumentWritten(
  { document: "gyms/{gymId}", region: "us-central1" },
  async (event) => {
    const gymId = event.params.gymId;

    if (!event.data?.after?.exists) {
      await db.doc(`gymsPublic/${gymId}`).delete().catch(() => {});
      return;
    }

    const data = event.data.after.data() || {};

    await db.doc(`gymsPublic/${gymId}`).set(
      {
        name: data.name || data.gymName || "",
        slug: data.slug || data.subdomain || "",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }
);


exports.createMember = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required");

  const caller = await getUserDoc(request.auth.uid);
  if (!["GYM_ADMIN", "SUPER_ADMIN"].includes(caller?.role))
    throw new HttpsError("permission-denied", "Not allowed");

  const name = String(request.data?.name || "").trim();
  const phoneE164 = String(request.data?.phoneE164 || "").trim();
  const email = String(request.data?.email || "").trim().toLowerCase();

  if (!name) throw new HttpsError("invalid-argument", "name required");
  if (!phoneE164.startsWith("+"))
    throw new HttpsError("invalid-argument", "phoneE164 must be E.164");
  if (!email) throw new HttpsError("invalid-argument", "email required");

  // 🔐 generate strong random password (user never sees it)
  const randomPassword =
    Math.random().toString(36).slice(-10) +
    Math.random().toString(36).slice(-10);

  let authUser;
  try {
    authUser = await admin.auth().createUser({
      email,
      password: randomPassword,
      displayName: name,
    });
  } catch (e) {
    if (String(e?.code).includes("email-already-exists")) {
      throw new HttpsError("already-exists", "Email already exists");
    }
    throw e;
  }

  await db.doc(`users/${authUser.uid}`).set({
    gymId: caller.gymId,
    gymSlug: caller.gymSlug,
    role: "MEMBER",
    name,
    phoneE164,
    email,
    status: "active",
    createdAt: FieldValue.serverTimestamp(),
  });

  // 📧 force password reset email
  const resetLink = await admin.auth().generatePasswordResetLink(email);

  // Optional: send SMS instead of email
  try {
    const client = await twilioClient();
    await client.messages.create({
      to: phoneE164,
      from: TWILIO_DEFAULT_FROM.value(),
      body: `Welcome to ${caller.gymSlug}. Set your password here: ${resetLink}`,
    });
  } catch {}

  return { ok: true };
});

exports.repairGlobalMembers = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth)
      throw new HttpsError("unauthenticated", "Sign in required");
    const caller = await getUserDoc(request.auth.uid);
    requireRole(caller, ["GYM_ADMIN", "SUPER_ADMIN"]);
    assertCallerGym(caller);

    const dryRun = !!request.data?.dryRun;

    // Find MEMBER users with gymId == "global"
    const snap = await db
      .collection("users")
      .where("role", "==", "MEMBER")
      .where("gymId", "==", "global")
      .get();

    if (snap.empty) return { ok: true, matched: 0, updated: 0, dryRun };

    if (dryRun) {
      return {
        ok: true,
        matched: snap.size,
        updated: 0,
        dryRun,
        sampleUids: snap.docs.slice(0, 10).map((d) => d.id),
      };
    }

    // batch in chunks of 450
    let updated = 0;
    let batch = db.batch();
    let n = 0;

    for (const d of snap.docs) {
      batch.update(d.ref, {
        gymId: caller.gymId,
        gymSlug: caller.gymSlug || null,
        updatedAt: FieldValue.serverTimestamp(),
      });
      updated++;
      n++;
      if (n >= 450) {
        await batch.commit();
        batch = db.batch();
        n = 0;
      }
    }
    if (n > 0) await batch.commit();

    return { ok: true, matched: snap.size, updated, dryRun: false };
  }
);

function normalizeSlug(slug) {
  return String(slug || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

exports.createGymAndAdmin = onCall({ region: "us-central1" }, async (request) => {
  const gymName = String(request.data?.gymName || "").trim();
  const slug = normalizeSlug(request.data?.slug);
  const adminName = String(request.data?.adminName || "").trim();
  const adminEmail = String(request.data?.adminEmail || "")
    .trim()
    .toLowerCase();
  const adminPhoneE164 = String(request.data?.adminPhoneE164 || "").trim();
  const adminPassword = String(request.data?.adminPassword || "").trim();

  if (!gymName) throw new HttpsError("invalid-argument", "gymName required");
  if (!slug) throw new HttpsError("invalid-argument", "slug required");
  if (!adminName)
    throw new HttpsError("invalid-argument", "adminName required");
  if (!adminEmail)
    throw new HttpsError("invalid-argument", "adminEmail required");
  if (!adminPhoneE164.startsWith("+"))
    throw new HttpsError(
      "invalid-argument",
      "adminPhoneE164 must be E.164 (+...)"
    );
  if (adminPassword.length < 8)
    throw new HttpsError("invalid-argument", "adminPassword min 8 chars");

  // slug must be unique
  const slugRef = db.doc(`slugs/${slug}`);
  const slugSnap = await slugRef.get();
  if (slugSnap.exists)
    throw new HttpsError("already-exists", "Slug already taken");

  // create gym doc (real gymId)
  const gymRef = db.collection("gyms").doc();
  const gymId = gymRef.id;

  // create admin auth user
  let authUser;
  try {
    authUser = await admin.auth().createUser({
      email: adminEmail,
      password: adminPassword,
      displayName: adminName,
    });
  } catch (e) {
    if (String(e?.code || "").includes("email-already-exists")) {
      throw new HttpsError("already-exists", "Email already exists");
    }
    throw new HttpsError("internal", e?.message || "Failed to create user");
  }

  const batch = db.batch();

  batch.set(gymRef, {
    name: gymName,
    slug,
    currency: "KES",
    smsTemplates: {
      expiring7:
        "Hi {{name}}, your membership expires on {{date}}. Renew to stay active.",
      expiring1: "Reminder: your membership expires tomorrow ({{date}}).",
      expired: "Your membership expired on {{date}}. Renew anytime.",
    },
    smsFrom: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  batch.set(slugRef, {
    gymId,
    createdAt: FieldValue.serverTimestamp(),
  });

  batch.set(db.doc(`users/${authUser.uid}`), {
    gymId, // ✅ real gym doc id
    gymSlug: slug, // ✅ used for subdomain check
    role: "GYM_ADMIN",
    name: adminName,
    phoneE164: adminPhoneE164,
    email: adminEmail,
    status: "active",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  // ✅ ALSO seed public doc so login picker works immediately
  batch.set(
    db.doc(`gymsPublic/${gymId}`),
    {
      name: gymName,
      slug,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await batch.commit();

  return { ok: true, gymId, slug, adminUid: authUser.uid };
});

exports.createGymAdmin = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required");

  const caller = await getUserDoc(request.auth.uid);
  requireRole(caller, ["GYM_ADMIN", "SUPER_ADMIN"]);
  assertCallerGym(caller);

  // Resolve caller gymId + gymSlug (same logic style as createMember)
  let callerGymId = caller.gymId;
  let callerGymSlug = caller.gymSlug || null;

  const maybeSlugSnap = await db.doc(`slugs/${callerGymId}`).get();
  if (maybeSlugSnap.exists) {
    const resolved = maybeSlugSnap.data()?.gymId;
    if (!resolved)
      throw new HttpsError("failed-precondition", "Slug mapping missing gymId");
    callerGymSlug = callerGymId;
    callerGymId = resolved;
  }

  if (!callerGymSlug) {
    const gymSnap = await db.doc(`gyms/${callerGymId}`).get();
    callerGymSlug = gymSnap.exists ? gymSnap.data()?.slug || null : null;
  }

  const name = String(request.data?.name || "").trim();
  const phoneE164 = String(request.data?.phoneE164 || "").trim();
  const email = String(request.data?.email || "").trim().toLowerCase();
  const tempPassword = String(request.data?.tempPassword || "").trim();

  if (!name) throw new HttpsError("invalid-argument", "name required");
  if (!phoneE164.startsWith("+"))
    throw new HttpsError("invalid-argument", "phoneE164 must be E.164 (+...)");
  if (!email) throw new HttpsError("invalid-argument", "email required");
  if (tempPassword.length < 8)
    throw new HttpsError("invalid-argument", "tempPassword min 8 chars");

  let authUser;
  try {
    authUser = await admin.auth().createUser({
      email,
      password: tempPassword,
      displayName: name,
    });
  } catch (e) {
    if (String(e?.code || "").includes("email-already-exists")) {
      throw new HttpsError("already-exists", "Email already exists");
    }
    throw new HttpsError("internal", e?.message || "Failed to create user");
  }

  await db.doc(`users/${authUser.uid}`).set({
    gymId: callerGymId,
    gymSlug: callerGymSlug,
    role: "GYM_ADMIN",
    name,
    phoneE164,
    email,
    status: "active",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  // optional SMS
  try {
    const client = await twilioClient();
    await client.messages.create({
      to: phoneE164,
      from: TWILIO_DEFAULT_FROM.value(),
      body: `You were added as a Gym Admin for ${
        callerGymSlug || "your gym"
      }. Login: ${email}. Temp password: ${tempPassword}.`,
    });
  } catch (smsErr) {
    logger.warn("Twilio SMS failed (admin still created)", {
      message: smsErr?.message,
    });
  }

  return { ok: true, uid: authUser.uid };
});

exports.runExpiryReminders = onSchedule(
  {
    schedule: "0 9 * * *",
    timeZone: "Africa/Nairobi",
    region: "us-central1",
    secrets: [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_DEFAULT_FROM],
  },
  async () => {
    const client = await twilioClient();
    const defaultFrom = TWILIO_DEFAULT_FROM.value();

    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    const endOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1
    );

    const dayMs = 86400000;
    const d1Start = new Date(startOfToday.getTime() + 1 * dayMs);
    const d1End = new Date(endOfToday.getTime() + 1 * dayMs);

    const d7Start = new Date(startOfToday.getTime() + 7 * dayMs);
    const d7End = new Date(endOfToday.getTime() + 7 * dayMs);

    const exp7Snap = await db
      .collection("subscriptions")
      .where("status", "==", "active")
      .where("endDate", ">=", Timestamp.fromDate(d7Start))
      .where("endDate", "<", Timestamp.fromDate(d7End))
      .get();

    const exp1Snap = await db
      .collection("subscriptions")
      .where("status", "==", "active")
      .where("endDate", ">=", Timestamp.fromDate(d1Start))
      .where("endDate", "<", Timestamp.fromDate(d1End))
      .get();

    const expiredSnap = await db
      .collection("subscriptions")
      .where("status", "==", "active")
      .where("endDate", "<", Timestamp.fromDate(startOfToday))
      .get();

    async function sendKind(subDoc, kind) {
      const sub = subDoc.data();
      const flags = sub.reminderFlags || {};
      if (kind === "d7" && flags.d7) return;
      if (kind === "d1" && flags.d1) return;
      if (kind === "expired" && flags.expired) return;

      // idempotency
      const logId = `${subDoc.id}_${kind}`;
      const logRef = db.doc(`smsLogs/${logId}`);
      if ((await logRef.get()).exists) return;

      const userSnap = await db.doc(`users/${sub.userId}`).get();
      if (!userSnap.exists) return;
      const user = userSnap.data();
      if (user.status && user.status !== "active") return;
      if (!user.phoneE164) return;

      const gymSnap = await db.doc(`gyms/${sub.gymId}`).get();
      if (!gymSnap.exists) return;
      const gym = gymSnap.data();

      const tpl =
        kind === "d7"
          ? gym?.smsTemplates?.expiring7
          : kind === "d1"
          ? gym?.smsTemplates?.expiring1
          : gym?.smsTemplates?.expired;

      const msg = renderTemplate(tpl, {
        name: user.name || "member",
        date: isoDate(sub.endDate),
        gym: gym.name || "Gym",
      });

      const from = gym.smsFrom || defaultFrom;

      const tw = await client.messages.create({
        to: user.phoneE164,
        from,
        body: msg,
      });

      const batch = db.batch();

      batch.set(logRef, {
        gymId: sub.gymId,
        userId: sub.userId,
        subId: subDoc.id,
        kind,
        to: user.phoneE164,
        provider: "twilio",
        sid: tw.sid,
        status: tw.status || "sent",
        sentAt: FieldValue.serverTimestamp(),
      });

      const patch = { reminderFlags: { ...flags } };
      if (kind === "d7") patch.reminderFlags.d7 = true;
      if (kind === "d1") patch.reminderFlags.d1 = true;
      if (kind === "expired") {
        patch.reminderFlags.expired = true;
        patch.status = "expired";
      }
      patch.updatedAt = FieldValue.serverTimestamp();

      batch.update(subDoc.ref, patch);

      await batch.commit();
    }

    for (const d of exp7Snap.docs) await sendKind(d, "d7");
    for (const d of exp1Snap.docs) await sendKind(d, "d1");
    for (const d of expiredSnap.docs) await sendKind(d, "expired");
  }
);
