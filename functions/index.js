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
const AFRICASTALKING_USERNAME = defineSecret("AFRICASTALKING_USERNAME");
const AFRICASTALKING_API_KEY = defineSecret("AFRICASTALKING_API_KEY");
// const AFRICASTALKING_SENDER_ID = defineSecret("AFRICASTALKING_SENDER_ID");


// Helpers
async function getUserDoc(uid) {
  const snap = await db.doc(`users/${uid}`).get();
  return snap.exists ? snap.data() : null;
}

async function twilioClient() {
  const twilio = require("twilio");
  return twilio(TWILIO_ACCOUNT_SID.value(), TWILIO_AUTH_TOKEN.value());
}

async function africasTalkingSendSms({ to, message, from }) {
  const username = AFRICASTALKING_USERNAME.value();
  const apiKey = AFRICASTALKING_API_KEY.value();
  const baseUrl =
    username === "sandbox"
      ? "https://api.sandbox.africastalking.com/version1/messaging"
      : "https://api.africastalking.com/version1/messaging";

  const params = new URLSearchParams();
  params.set("username", username);
  params.set("to", Array.isArray(to) ? to.join(",") : String(to || ""));
  params.set("message", message);
  if (from) params.set("from", from);

  const res = await fetch(baseUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Apikey: apiKey,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = data?.SMSMessageData?.Message || res.statusText || "Unknown error";
    throw new HttpsError("internal", `Africa's Talking SMS failed: ${msg}`);
  }

  return data || {};
}

async function africasTalkingGetAppData() {
  const username = AFRICASTALKING_USERNAME.value();
  const apiKey = AFRICASTALKING_API_KEY.value();
  const baseUrl =
    username === "sandbox"
      ? "https://api.sandbox.africastalking.com/version1/user"
      : "https://api.africastalking.com/version1/user";
  const url = `${baseUrl}?username=${encodeURIComponent(username)}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Apikey: apiKey,
    },
  });

  const rawText = await res.text();
  let balance = null;
  let parsed = null;
  try {
    parsed = JSON.parse(rawText);
    const b =
      parsed?.UserData?.balance ||
      parsed?.balance ||
      parsed?.data?.balance ||
      null;
    if (b) balance = String(b);
  } catch {
    const m = rawText.match(/<balance>([^<]+)<\/balance>/i);
    if (m) balance = m[1];
  }

  if (!res.ok) {
    throw new HttpsError(
      "internal",
      `Africa's Talking app data failed: ${res.status} ${res.statusText}`
    );
  }

  return { raw: rawText, balance, parsed };
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

function parseCostValue(cost) {
  if (!cost) return 0;
  const s = String(cost).replace(/,/g, " ");
  const m = s.match(/([0-9]+(?:\.[0-9]+)?)/);
  return m ? Number(m[1]) : 0;
}

async function logBalanceTransaction({
  gymId,
  amount,
  type,
  reason,
  balanceBefore,
  balanceAfter,
  createdBy,
  meta,
}) {
  if (!gymId || !amount) return;
  await db.collection("balanceTransactions").add({
    gymId,
    amount,
    type,
    reason: reason || null,
    balanceBefore,
    balanceAfter,
    createdBy: createdBy || null,
    meta: meta || null,
    createdAt: FieldValue.serverTimestamp(),
  });
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

async function resolveCallerGym(caller, requestData = {}) {
  if (!caller?.gymId) {
    throw new HttpsError("failed-precondition", "Caller missing gymId");
  }
  let gymId = String(caller.gymId || "").trim();
  let gymSlug = String(caller.gymSlug || "").trim() || null;

  if (gymId === "global" || gymId === "__global__") {
    if (caller?.role === "SUPER_ADMIN") {
      const reqGymId = String(requestData?.gymId || "").trim();
      const reqGymSlug = normalizeSlug(requestData?.gymSlug || requestData?.slug);
      if (reqGymId) {
        gymId = reqGymId;
        gymSlug = reqGymSlug || gymSlug;
      } else if (reqGymSlug) {
        gymSlug = reqGymSlug;
        const slugSnap = await db.doc(`slugs/${gymSlug}`).get();
        if (!slugSnap.exists) {
          throw new HttpsError("not-found", "Gym slug not found");
        }
        gymId = String(slugSnap.data()?.gymId || "").trim();
      } else {
        throw new HttpsError(
          "failed-precondition",
          "Super admin must pass gymId or gymSlug"
        );
      }
    } else {
      throw new HttpsError(
        "failed-precondition",
        'Caller gymId is "global". Fix your admin users/{uid}.gymId to the real gymId.'
      );
    }
  }

  // If caller.gymId is actually a slug, resolve it
  if (!gymSlug) {
    const slugSnap = await db.doc(`slugs/${gymId}`).get();
    if (slugSnap.exists) {
      const gid = slugSnap.data()?.gymId || null;
      if (gid) {
        gymSlug = gymId;
        gymId = gid;
      }
    }
  }

  if (!gymSlug) {
    const gymSnap = await db.doc(`gyms/${gymId}`).get();
    if (gymSnap.exists) {
      gymSlug = gymSnap.data()?.slug || null;
    }
  }

  return { gymId, gymSlug };
}

function requireRole(caller, allowed) {
  if (!caller)
    throw new HttpsError("permission-denied", "Missing user profile");
  if (!allowed.includes(caller.role))
    throw new HttpsError("permission-denied", "Not allowed");
}

async function setUserClaims(uid, data) {
  if (!uid || !data) return;
  const claims = {
    gymId: data.gymId || null,
    role: data.role || null,
  };
  await admin.auth().setCustomUserClaims(uid, claims);
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
  { document: "gyms/{gymId}", region: "us-central1", database: DB_ID },
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
        loginLogoUrl: data.loginLogoUrl || "",
        loginText: data.loginText || "",
        websiteText: data.websiteText || "",
        location: data.location || "",
        openingHours: data.openingHours || "",
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

  // Resolve caller gym slug if missing
  let resolvedGymSlug = caller?.gymSlug || null;
  let resolvedGymId = caller?.gymId || null;
  const reqGymId = String(request.data?.gymId || "").trim();
  const reqGymSlug = normalizeSlug(request.data?.gymSlug || request.data?.slug);
  if (!resolvedGymId) {
    throw new HttpsError("failed-precondition", "Caller missing gymId");
  }

  // SUPER_ADMIN/global can pass target gym explicitly
  if (resolvedGymId === "__global__") {
    if (reqGymId) resolvedGymId = reqGymId;
    if (reqGymSlug) resolvedGymSlug = reqGymSlug;
  }

  // If caller.gymId is actually a slug, resolve it
  if (!resolvedGymSlug) {
    const slugSnap = await db.doc(`slugs/${resolvedGymId}`).get();
    if (slugSnap.exists) {
      const gid = slugSnap.data()?.gymId || null;
      if (gid) {
        resolvedGymSlug = resolvedGymId;
        resolvedGymId = gid;
      }
    }
  }

  if (!resolvedGymSlug) {
    const gymSnap = await db.doc(`gyms/${resolvedGymId}`).get();
    if (gymSnap.exists) {
      resolvedGymSlug = gymSnap.data()?.slug || null;
    }
  }

  if (!resolvedGymSlug) {
    throw new HttpsError(
      "failed-precondition",
      "Caller gymSlug missing and could not be resolved",
    );
  }

  const name = String(request.data?.name || "").trim();
  const phoneE164 = String(request.data?.phoneE164 || "").trim();
  const email = String(request.data?.email || "").trim().toLowerCase();
  const sendWelcomeSms = !!request.data?.sendWelcomeSms;

  if (!name) throw new HttpsError("invalid-argument", "name required");
  if (!email && !phoneE164)
    throw new HttpsError("invalid-argument", "email or phoneE164 required");
  if (phoneE164 && !phoneE164.startsWith("+"))
    throw new HttpsError("invalid-argument", "phoneE164 must be E.164");

  let authUser;
  try {
    if (email) {
      // 🔐 generate strong random password (user never sees it)
      const randomPassword =
        Math.random().toString(36).slice(-10) +
        Math.random().toString(36).slice(-10);
      authUser = await admin.auth().createUser({
        email,
        password: randomPassword,
        displayName: name,
      });
    } else {
      authUser = await admin.auth().createUser({
        phoneNumber: phoneE164,
        displayName: name,
      });
    }
  } catch (e) {
    if (String(e?.code).includes("email-already-exists")) {
      throw new HttpsError("already-exists", "Email already exists");
    }
    if (String(e?.code).includes("phone-number-already-exists")) {
      throw new HttpsError("already-exists", "Phone already exists");
    }
    throw new HttpsError("internal", e?.message || "Failed to create auth user");
  }

  try {
    await db.doc(`users/${authUser.uid}`).set({
      gymId: resolvedGymId,
      gymSlug: resolvedGymSlug,
      role: "MEMBER",
      name,
      phoneE164: phoneE164 || null,
      email: email || null,
      comments: String(request.data?.comments || "").trim() || null,
      status: "active",
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (e) {
    // Roll back Auth user if Firestore write fails
    try {
      await admin.auth().deleteUser(authUser.uid);
    } catch {}
    throw new HttpsError(
      "internal",
      e?.message || "Failed to create user profile",
    );
  }

  // 📧 force password reset email (email-based accounts)
  let resetLink = null;
  if (email) {
    try {
      resetLink = await admin.auth().generatePasswordResetLink(email);
    } catch (e) {
      logger.warn("Password reset link failed", { message: e?.message });
    }
  }

  if (sendWelcomeSms && phoneE164) {
    try {
      const client = await twilioClient();
      await client.messages.create({
        to: phoneE164,
        from: TWILIO_DEFAULT_FROM.value(),
        body: resetLink
          ? `Welcome to ${caller.gymSlug}. Set your password here: ${resetLink}`
          : `Welcome to ${caller.gymSlug}. Your account is ready.`,
      });
    } catch (e) {
      logger.warn("Welcome SMS failed", { message: e?.message });
    }
  }

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
  if (adminPassword.length < 6)
    throw new HttpsError("invalid-argument", "adminPassword min 6 chars");

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

  await setUserClaims(authUser.uid, {
    gymId,
    role: "GYM_ADMIN",
  });

  return { ok: true, gymId, slug, adminUid: authUser.uid };
});

exports.updateGymDetails = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth)
      throw new HttpsError("unauthenticated", "Sign in required");

    const caller = await getUserDoc(request.auth.uid);
    requireRole(caller, ["GYM_ADMIN", "SUPER_ADMIN"]);

    let gymId = String(caller.gymId || "").trim();
    let gymSlug = String(caller.gymSlug || "").trim();

    // Resolve gymId if caller has a reserved/global id (e.g. simulated user)
    if (!gymId || gymId === "__global__") {
      const reqGymId = String(request.data?.gymId || "").trim();
      const slug = normalizeSlug(gymSlug || request.data?.slug || "");
      if (reqGymId) {
        gymId = reqGymId;
        gymSlug = slug || gymSlug;
      }
      if (!slug)
        throw new HttpsError(
          "failed-precondition",
          "Caller missing gymId/slug"
        );
      if (!gymId) {
        const slugSnap = await db.doc(`slugs/${slug}`).get();
        if (!slugSnap.exists)
          throw new HttpsError("not-found", "Gym slug not found");
        gymId = String(slugSnap.data()?.gymId || "").trim();
      }
      gymSlug = slug || gymSlug;
    }

    if (!gymId) throw new HttpsError("invalid-argument", "gymId required");

    const nextName = String(request.data?.name || "").trim();
    const nextSlugRaw = String(request.data?.slug || "").trim();
    if (!nextName) throw new HttpsError("invalid-argument", "name required");
    if (!nextSlugRaw) throw new HttpsError("invalid-argument", "slug required");

    const nextSlug = normalizeSlug(nextSlugRaw);
    if (!nextSlug) throw new HttpsError("invalid-argument", "slug required");

    const gymRef = db.doc(`gyms/${gymId}`);
    let gymSnap = await gymRef.get();
    if (!gymSnap.exists && gymSlug) {
      const slugSnap = await db.doc(`slugs/${normalizeSlug(gymSlug)}`).get();
      if (slugSnap.exists) {
        const resolved = String(slugSnap.data()?.gymId || "").trim();
        if (resolved) {
          gymId = resolved;
          gymSnap = await db.doc(`gyms/${gymId}`).get();
        }
      }
    }
    if (!gymSnap.exists) throw new HttpsError("not-found", "Gym not found");

    const prevSlug = String(gymSnap.data()?.slug || "").trim();

    if (nextSlug !== prevSlug) {
      const slugRef = db.doc(`slugs/${nextSlug}`);
      const slugSnap = await slugRef.get();
      if (slugSnap.exists && slugSnap.data()?.gymId !== gymId) {
        throw new HttpsError("already-exists", "Slug already taken");
      }

      const batch = db.batch();
      batch.set(slugRef, { gymId, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

      if (prevSlug) {
        const prevRef = db.doc(`slugs/${prevSlug}`);
        const prevSnap = await prevRef.get();
        if (prevSnap.exists && prevSnap.data()?.gymId === gymId) {
          batch.delete(prevRef);
        }
      }

      batch.update(gymRef, {
        name: nextName,
        slug: nextSlug,
        updatedAt: FieldValue.serverTimestamp(),
      });

      batch.set(
        db.doc(`gymsPublic/${gymId}`),
        {
          name: nextName,
          slug: nextSlug,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      await batch.commit();

      // Update users' gymSlug in batches
      const usersSnap = await db
        .collection("users")
        .where("gymId", "==", gymId)
        .get();
      const docs = usersSnap.docs;
      const chunkSize = 450;
      for (let i = 0; i < docs.length; i += chunkSize) {
        const batch2 = db.batch();
        docs.slice(i, i + chunkSize).forEach((d) => {
          batch2.update(d.ref, {
            gymSlug: nextSlug,
            updatedAt: FieldValue.serverTimestamp(),
          });
        });
        await batch2.commit();
      }
    } else {
      await gymRef.update({
        name: nextName,
        updatedAt: FieldValue.serverTimestamp(),
      });
      await db.doc(`gymsPublic/${gymId}`).set(
        {
          name: nextName,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    return { ok: true, gymId, slug: nextSlug };
  }
);

exports.updateWebsiteContent = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth)
      throw new HttpsError("unauthenticated", "Sign in required");

    const caller = await getUserDoc(request.auth.uid);
    requireRole(caller, ["GYM_ADMIN", "SUPER_ADMIN"]);

    let gymId = String(caller.gymId || "").trim();
    let gymSlug = String(caller.gymSlug || "").trim();

    if (!gymId || gymId === "__global__") {
      const slug = normalizeSlug(gymSlug || request.data?.slug || "");
      if (!slug)
        throw new HttpsError(
          "failed-precondition",
          "Caller missing gymId/slug"
        );
      const slugSnap = await db.doc(`slugs/${slug}`).get();
      if (!slugSnap.exists)
        throw new HttpsError("not-found", "Gym slug not found");
      gymId = String(slugSnap.data()?.gymId || "").trim();
      gymSlug = slug;
    }

    if (!gymId) throw new HttpsError("invalid-argument", "gymId required");

    const loginLogoUrl = String(request.data?.loginLogoUrl || "").trim();
    const loginText = String(request.data?.loginText || "").trim();
    const websiteText = String(request.data?.websiteText || "").trim();
    const location = String(request.data?.location || "").trim();
    const openingHours = String(request.data?.openingHours || "").trim();

    const gymRef = db.doc(`gyms/${gymId}`);
    const gymSnap = await gymRef.get();
    if (!gymSnap.exists)
      throw new HttpsError("not-found", "Gym not found");

    const patch = {
      loginLogoUrl: loginLogoUrl || null,
      loginText: loginText || null,
      websiteText: websiteText || null,
      location: location || null,
      openingHours: openingHours || null,
      updatedAt: FieldValue.serverTimestamp(),
    };

    await gymRef.update(patch);

    await db.doc(`gymsPublic/${gymId}`).set(
      {
        loginLogoUrl: loginLogoUrl || null,
        loginText: loginText || null,
        websiteText: websiteText || null,
        location: location || null,
        openingHours: openingHours || null,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return { ok: true };
  }
);

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
  if (tempPassword.length < 6)
    throw new HttpsError("invalid-argument", "tempPassword min 6 chars");

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

  await setUserClaims(authUser.uid, {
    gymId: callerGymId,
    role: "GYM_ADMIN",
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

exports.createGymAdminForGym = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth)
      throw new HttpsError("unauthenticated", "Sign in required");

    const caller = await getUserDoc(request.auth.uid);
    requireRole(caller, ["SUPER_ADMIN"]);

    const inputGymId = String(request.data?.gymId || "").trim();
    const inputGymSlug = normalizeSlug(request.data?.gymSlug || request.data?.slug);

    if (!inputGymId && !inputGymSlug)
      throw new HttpsError("invalid-argument", "gymId or gymSlug required");

    let gymId = inputGymId;
    let gymSlug = inputGymSlug || null;

    if (!gymId && gymSlug) {
      const slugSnap = await db.doc(`slugs/${gymSlug}`).get();
      if (!slugSnap.exists)
        throw new HttpsError("not-found", "Gym slug not found");
      gymId = slugSnap.data()?.gymId || "";
    }

    if (!gymId)
      throw new HttpsError("failed-precondition", "gymId not resolved");

    if (!gymSlug) {
      const gymSnap = await db.doc(`gyms/${gymId}`).get();
      if (!gymSnap.exists)
        throw new HttpsError("not-found", "Gym not found");
      gymSlug = gymSnap.data()?.slug || null;
    }

    const name = String(request.data?.name || "").trim();
    const phoneE164 = String(request.data?.phoneE164 || "").trim();
    const email = String(request.data?.email || "").trim().toLowerCase();
    const tempPassword = String(request.data?.tempPassword || "").trim();

    if (!name) throw new HttpsError("invalid-argument", "name required");
    if (!phoneE164.startsWith("+"))
      throw new HttpsError("invalid-argument", "phoneE164 must be E.164 (+...)");
    if (!email) throw new HttpsError("invalid-argument", "email required");
    if (tempPassword.length < 6)
      throw new HttpsError("invalid-argument", "tempPassword min 6 chars");

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
      gymId,
      gymSlug: gymSlug || null,
      role: "GYM_ADMIN",
      name,
      phoneE164,
      email,
      status: "active",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await setUserClaims(authUser.uid, {
      gymId,
      role: "GYM_ADMIN",
    });

    // optional SMS
    try {
      const client = await twilioClient();
      await client.messages.create({
        to: phoneE164,
        from: TWILIO_DEFAULT_FROM.value(),
        body: `You were added as a Gym Admin for ${
          gymSlug || "your gym"
        }. Login: ${email}. Temp password: ${tempPassword}.`,
      });
    } catch (smsErr) {
      logger.warn("Twilio SMS failed (admin still created)", {
        message: smsErr?.message,
      });
    }

    return { ok: true, uid: authUser.uid, gymId, gymSlug };
  }
);

exports.updateGymAdminEmail = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth)
      throw new HttpsError("unauthenticated", "Sign in required");

    const caller = await getUserDoc(request.auth.uid);
    requireRole(caller, ["SUPER_ADMIN"]);

    const uid = String(request.data?.uid || "").trim();
    const email = String(request.data?.email || "").trim().toLowerCase();
    if (!uid) throw new HttpsError("invalid-argument", "uid required");
    if (!email) throw new HttpsError("invalid-argument", "email required");

    const userRef = db.doc(`users/${uid}`);
    const userSnap = await userRef.get();
    if (!userSnap.exists)
      throw new HttpsError("not-found", "User not found");
    const data = userSnap.data() || {};
    if (data.role !== "GYM_ADMIN") {
      throw new HttpsError("failed-precondition", "User is not a GYM_ADMIN");
    }

    try {
      await admin.auth().updateUser(uid, { email });
    } catch (e) {
      if (String(e?.code || "").includes("email-already-exists")) {
        throw new HttpsError("already-exists", "Email already exists");
      }
      throw new HttpsError("internal", e?.message || "Failed to update auth");
    }

    await userRef.update({
      email,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { ok: true };
  }
);

exports.updateGymAdminPhone = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth)
      throw new HttpsError("unauthenticated", "Sign in required");

    const caller = await getUserDoc(request.auth.uid);
    requireRole(caller, ["SUPER_ADMIN"]);

    const uid = String(request.data?.uid || "").trim();
    const phoneE164 = String(request.data?.phoneE164 || "").trim();
    if (!uid) throw new HttpsError("invalid-argument", "uid required");
    if (!phoneE164.startsWith("+"))
      throw new HttpsError("invalid-argument", "phoneE164 must be E.164 (+...)");

    const userRef = db.doc(`users/${uid}`);
    const userSnap = await userRef.get();
    if (!userSnap.exists)
      throw new HttpsError("not-found", "User not found");
    const data = userSnap.data() || {};
    if (data.role !== "GYM_ADMIN") {
      throw new HttpsError("failed-precondition", "User is not a GYM_ADMIN");
    }

    try {
      await admin.auth().updateUser(uid, { phoneNumber: phoneE164 });
    } catch (e) {
      if (String(e?.code || "").includes("phone-number-already-exists")) {
        throw new HttpsError("already-exists", "Phone already exists");
      }
      throw new HttpsError("internal", e?.message || "Failed to update auth");
    }

    await userRef.update({
      phoneE164,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { ok: true };
  }
);

exports.resetGymAdminPassword = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth)
      throw new HttpsError("unauthenticated", "Sign in required");

    const caller = await getUserDoc(request.auth.uid);
    requireRole(caller, ["SUPER_ADMIN"]);

    const uid = String(request.data?.uid || "").trim();
    if (!uid) throw new HttpsError("invalid-argument", "uid required");

    const userRef = db.doc(`users/${uid}`);
    const snap = await userRef.get();
    if (!snap.exists) throw new HttpsError("not-found", "User not found");
    const data = snap.data() || {};
    if (data.role !== "GYM_ADMIN") {
      throw new HttpsError("failed-precondition", "User is not a GYM_ADMIN");
    }
    const email = String(data.email || "").trim().toLowerCase();
    if (!email) throw new HttpsError("failed-precondition", "Email not set");

    let resetLink = null;
    try {
      resetLink = await admin.auth().generatePasswordResetLink(email);
    } catch (e) {
      throw new HttpsError("internal", e?.message || "Failed to reset password");
    }

    return { ok: true, resetLink };
  }
);

exports.deleteGymAdmin = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth)
      throw new HttpsError("unauthenticated", "Sign in required");

    const caller = await getUserDoc(request.auth.uid);
    requireRole(caller, ["SUPER_ADMIN"]);

    const uid = String(request.data?.uid || "").trim();
    if (!uid) throw new HttpsError("invalid-argument", "uid required");

    const userRef = db.doc(`users/${uid}`);
    const snap = await userRef.get();
    if (!snap.exists) throw new HttpsError("not-found", "User not found");
    const data = snap.data() || {};
    if (data.role !== "GYM_ADMIN") {
      throw new HttpsError("failed-precondition", "User is not a GYM_ADMIN");
    }

    try {
      await admin.auth().deleteUser(uid);
    } catch (e) {
      throw new HttpsError("internal", e?.message || "Failed to delete auth");
    }

    await userRef.delete().catch(() => {});
    return { ok: true };
  }
);

exports.createSuperAdmin = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth)
      throw new HttpsError("unauthenticated", "Sign in required");

    const caller = await getUserDoc(request.auth.uid);
    requireRole(caller, ["SUPER_ADMIN"]);

    const name = String(request.data?.name || "").trim();
    const email = String(request.data?.email || "").trim().toLowerCase();
    const phoneE164 = String(request.data?.phoneE164 || "").trim();
    const password = String(request.data?.password || "").trim();

    if (!name) throw new HttpsError("invalid-argument", "name required");
    if (!email) throw new HttpsError("invalid-argument", "email required");
    if (password.length < 6)
      throw new HttpsError("invalid-argument", "password min 6 chars");
    if (phoneE164 && !phoneE164.startsWith("+"))
      throw new HttpsError("invalid-argument", "phoneE164 must be E.164 (+...)");

    let authUser;
    try {
      authUser = await admin.auth().createUser({
        email,
        password,
        displayName: name,
      });
    } catch (e) {
      if (String(e?.code || "").includes("email-already-exists")) {
        throw new HttpsError("already-exists", "Email already exists");
      }
      throw new HttpsError("internal", e?.message || "Failed to create user");
    }

    await db.doc(`users/${authUser.uid}`).set({
      gymId: "__global__",
      role: "SUPER_ADMIN",
      name,
      phoneE164: phoneE164 || null,
      email,
      status: "active",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await setUserClaims(authUser.uid, {
      gymId: "__global__",
      role: "SUPER_ADMIN",
    });

    return { ok: true, uid: authUser.uid };
  }
);

exports.syncAuthClaims = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth)
      throw new HttpsError("unauthenticated", "Sign in required");

    const caller = await getUserDoc(request.auth.uid);
    if (!caller?.role || !caller?.gymId)
      throw new HttpsError("failed-precondition", "Missing user profile");

    await setUserClaims(request.auth.uid, {
      gymId: caller.gymId,
      role: caller.role,
    });

    return { ok: true };
  }
);

exports.deleteSuperAdmin = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth)
      throw new HttpsError("unauthenticated", "Sign in required");

    const caller = await getUserDoc(request.auth.uid);
    requireRole(caller, ["SUPER_ADMIN"]);

    const uid = String(request.data?.uid || "").trim();
    if (!uid) throw new HttpsError("invalid-argument", "uid required");
    if (uid === request.auth.uid)
      throw new HttpsError("failed-precondition", "Cannot delete yourself");

    const userRef = db.doc(`users/${uid}`);
    const snap = await userRef.get();
    if (!snap.exists)
      throw new HttpsError("not-found", "User not found");
    const data = snap.data() || {};
    if (data.role !== "SUPER_ADMIN") {
      throw new HttpsError("failed-precondition", "User is not a SUPER_ADMIN");
    }

    try {
      await admin.auth().deleteUser(uid);
    } catch (e) {
      throw new HttpsError("internal", e?.message || "Failed to delete auth");
    }

    await userRef.delete().catch(() => {});
    return { ok: true };
  }
);

exports.updateOwnProfile = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth)
      throw new HttpsError("unauthenticated", "Sign in required");

    const caller = await getUserDoc(request.auth.uid);
    if (!caller)
      throw new HttpsError("permission-denied", "Missing user profile");
    if (!["GYM_ADMIN", "STAFF"].includes(caller.role)) {
      throw new HttpsError("permission-denied", "Not allowed");
    }

    const email = String(request.data?.email || "").trim().toLowerCase();
    const name = String(request.data?.name || "").trim();
    const phoneE164 = String(request.data?.phoneE164 || "").trim();

    if (!email) throw new HttpsError("invalid-argument", "email required");
    if (phoneE164 && !phoneE164.startsWith("+"))
      throw new HttpsError("invalid-argument", "phoneE164 must be E.164 (+...)");

    try {
      await admin.auth().updateUser(request.auth.uid, {
        email,
        displayName: name || undefined,
      });
    } catch (e) {
      if (String(e?.code || "").includes("email-already-exists")) {
        throw new HttpsError("already-exists", "Email already exists");
      }
      throw new HttpsError("internal", e?.message || "Failed to update auth");
    }

    await db.doc(`users/${request.auth.uid}`).update({
      email,
      name: name || null,
      phoneE164: phoneE164 || null,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { ok: true };
  }
);

exports.adjustGymBalance = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth)
      throw new HttpsError("unauthenticated", "Sign in required");

    const caller = await getUserDoc(request.auth.uid);
    requireRole(caller, ["SUPER_ADMIN"]);

    const gymId = String(request.data?.gymId || "").trim();
    const amount = Number(request.data?.amount);
    const reason = String(request.data?.reason || "").trim() || "admin_adjust";

    if (!gymId) throw new HttpsError("invalid-argument", "gymId required");
    if (!Number.isFinite(amount))
      throw new HttpsError("invalid-argument", "amount must be a number");

    const ref = db.doc(`gyms/${gymId}`);
    let before = 0;
    let after = 0;

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new HttpsError("not-found", "Gym not found");
      before = Number(snap.data()?.cashBalance) || 0;
      after = Math.max(0, before + amount);
      tx.update(ref, {
        cashBalance: after,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    if (amount !== 0) {
      await logBalanceTransaction({
        gymId,
        amount,
        type: amount > 0 ? "credit" : "debit",
        reason,
        balanceBefore: before,
        balanceAfter: after,
        createdBy: request.auth.uid,
      });
    }

    return { ok: true, gymId, balanceBefore: before, balanceAfter: after };
  }
);

exports.setGymPaymentStatus = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth)
      throw new HttpsError("unauthenticated", "Sign in required");

    const caller = await getUserDoc(request.auth.uid);
    requireRole(caller, ["SUPER_ADMIN"]);

    const gymId = String(request.data?.gymId || "").trim();
    let month = String(request.data?.month || "").trim(); // YYYY-MM
    const paid = !!request.data?.paid;
    const amountDue = Number(request.data?.amountDue) || 0;
    const userCount = Number(request.data?.userCount) || 0;
    const comments = String(request.data?.comments || "").trim() || null;
    const status = String(request.data?.status || "").trim() || null;
    const amountPaid = Number(request.data?.amountPaid) || 0;
    const balance = Number(request.data?.balance) || 0;
    const compedAmount = Number(request.data?.compedAmount) || 0;

    if (!gymId) throw new HttpsError("invalid-argument", "gymId required");
    if (!month) throw new HttpsError("invalid-argument", "month required");
    // normalize month to YYYY-MM
    if (/^\d{4}-\d{1,2}$/.test(month)) {
      const [y, m] = month.split("-");
      month = `${y}-${String(Number(m)).padStart(2, "0")}`;
    }

    await db.doc(`gymPayments/${gymId}_${month}`).set(
      {
        gymId,
        month,
        paid,
        paidAt: paid ? FieldValue.serverTimestamp() : null,
        amountDue,
        userCount,
        comments,
        status,
        amountPaid,
        balance,
        compedAmount,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return { ok: true };
  }
);

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

exports.sendBroadcastSms = onCall(
  {
    region: "us-central1",
    secrets: [
      AFRICASTALKING_USERNAME,
      AFRICASTALKING_API_KEY,
      // AFRICASTALKING_SENDER_ID,
    ],
  },
  async (request) => {
    if (!request.auth)
      throw new HttpsError("unauthenticated", "Sign in required");

    const caller = await getUserDoc(request.auth.uid);
    requireRole(caller, ["GYM_ADMIN", "SUPER_ADMIN"]);
    const { gymId } = await resolveCallerGym(caller, request.data);
    const gymSnap = await db.doc(`gyms/${gymId}`).get();
    if (!gymSnap.exists)
      throw new HttpsError("failed-precondition", "Gym not found");
    const gym = gymSnap.data() || {};
    const startingCashBalance = Number(gym.cashBalance) || 0;
    if (startingCashBalance <= 0) {
      throw new HttpsError("failed-precondition", "Insufficient SMS balance");
    }

    let preflight = null;
    try {
      const appData = await africasTalkingGetAppData();
      preflight = {
        ok: true,
        balance: appData.balance,
        raw: appData.raw,
        fetchedAt: FieldValue.serverTimestamp(),
      };
    } catch (e) {
      preflight = {
        ok: false,
        error: e?.message || "Failed to fetch app data",
        fetchedAt: FieldValue.serverTimestamp(),
      };
      throw e;
    }

    const audience = String(request.data?.audience || "activeSubscriptions");
    const message = String(request.data?.message || "").trim();
    const selectedUserIds = Array.isArray(request.data?.selectedUserIds)
      ? request.data.selectedUserIds.map((x) => String(x))
      : [];

    if (!message) throw new HttpsError("invalid-argument", "message required");
    if (message.length > 1000)
      throw new HttpsError("invalid-argument", "message too long");

    const membersSnap = await db
      .collection("users")
      .where("gymId", "==", gymId)
      .where("role", "==", "MEMBER")
      .get();
    const members = membersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    let allowedIds = null;
    if (audience === "custom") {
      if (!selectedUserIds.length)
        throw new HttpsError("invalid-argument", "No members selected");
      allowedIds = new Set(selectedUserIds);
    } else if (audience === "activeSubscriptions") {
      const now = new Date();
      const subsSnap = await db
        .collection("subscriptions")
        .where("gymId", "==", gymId)
        .where("status", "==", "active")
        .get();
      allowedIds = new Set();
      for (const sDoc of subsSnap.docs) {
        const s = sDoc.data();
        const start = s.startDate?.toDate ? s.startDate.toDate() : null;
        const end = s.endDate?.toDate ? s.endDate.toDate() : null;
        if (start && start > now) continue;
        if (end && end < now) continue;
        if (s.userId) allowedIds.add(String(s.userId));
      }
    } else if (audience === "activeMembers") {
      allowedIds = new Set(
        members.filter((m) => (m.status || "active") === "active").map((m) => m.id)
      );
    }

    const recipients = members
      .filter((m) => {
        if (!m.phoneE164) return false;
        if (allowedIds && !allowedIds.has(m.id)) return false;
        return true;
      })
      .map((m) => ({
        userId: m.id,
        phoneE164: String(m.phoneE164).trim(),
        name: m.name || "",
      }));

    if (!recipients.length)
      throw new HttpsError("failed-precondition", "No recipients found");

    const broadcastRef = db.collection("smsBroadcasts").doc();
    const broadcastId = broadcastRef.id;
    await broadcastRef.set({
      gymId,
      createdBy: request.auth.uid,
      message,
      audience,
      totalRecipients: recipients.length,
      sentCount: 0,
      failedCount: 0,
      status: "sending",
      providerPreflight: preflight,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Africa's Talking can use a default sender when "from" is omitted.
    const from = gym.smsFrom || undefined;

    const BATCH_SIZE = 100;
    const LOG_BATCH_SIZE = 400;
    let sentCount = 0;
    let failedCount = 0;
    let totalCost = 0;
    let logBuffer = [];

    async function flushLogs() {
      if (!logBuffer.length) return;
      let batch = db.batch();
      let count = 0;
      for (const { ref, data } of logBuffer) {
        batch.set(ref, data);
        count += 1;
        if (count >= LOG_BATCH_SIZE) {
          await batch.commit();
          batch = db.batch();
          count = 0;
        }
      }
      if (count) await batch.commit();
      logBuffer = [];
    }

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const chunk = recipients.slice(i, i + BATCH_SIZE);
      const numbers = chunk.map((r) => r.phoneE164);
      let response = null;
      let error = null;

      try {
        response = await africasTalkingSendSms({
          to: numbers,
          message,
          from,
        });
      } catch (e) {
        error = e;
      }

      const respList = response?.SMSMessageData?.Recipients || [];
      const respByNumber = new Map();
      for (const r of respList) {
        const num = String(r.number || r.phoneNumber || "").trim();
        if (num) respByNumber.set(num, r);
      }
      const responseSnapshot = response || (error ? { error: error.message } : null);

      for (const r of chunk) {
        const resp = respByNumber.get(r.phoneE164);
        const status = resp?.status || (error ? "Failed" : "Sent");
        const statusCode = resp?.statusCode || null;
        const messageId = resp?.messageId || null;
        const cost = resp?.cost || null;
        const costValue = parseCostValue(cost);
        const statusCodeNum = Number(statusCode);
        const success =
          (Number.isFinite(statusCodeNum) &&
            statusCodeNum >= 100 &&
            statusCodeNum < 200) ||
          String(status).toLowerCase() === "success";

        if (success) sentCount += 1;
        else failedCount += 1;
        totalCost += costValue;

        logBuffer.push({
          ref: db.doc(`smsLogs/${broadcastId}_${r.userId}`),
          data: {
            gymId,
            broadcastId,
            userId: r.userId,
            to: r.phoneE164,
            message,
            provider: "africastalking",
            status,
            statusCode,
            messageId,
            cost,
            error: error?.message || null,
            response: responseSnapshot,
            sentAt: FieldValue.serverTimestamp(),
          },
        });
      }

      if (logBuffer.length >= LOG_BATCH_SIZE) {
        await flushLogs();
      }
    }

    await flushLogs();

    await broadcastRef.set(
      {
        sentCount,
        failedCount,
        totalCost,
        status: "sent",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    if (totalCost > 0) {
      let before = 0;
      let after = 0;
      await db.runTransaction(async (tx) => {
        const ref = db.doc(`gyms/${gymId}`);
        const snap = await tx.get(ref);
        if (!snap.exists) return;
        before = Number(snap.data()?.cashBalance) || 0;
        after = Math.max(0, before - totalCost);
        tx.update(ref, {
          cashBalance: after,
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
      await logBalanceTransaction({
        gymId,
        amount: -totalCost,
        type: "debit",
        reason: "sms",
        balanceBefore: before,
        balanceAfter: after,
        createdBy: request.auth.uid,
        meta: { broadcastId },
      });
    }

    return {
      ok: true,
      broadcastId,
      totalRecipients: recipients.length,
      sentCount,
      failedCount,
    };
  }
);

exports.deleteSmsLog = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth)
    throw new HttpsError("unauthenticated", "Sign in required");

  const caller = await getUserDoc(request.auth.uid);
  requireRole(caller, ["GYM_ADMIN", "SUPER_ADMIN"]);
  const { gymId } = await resolveCallerGym(caller, request.data);

  const logId = String(request.data?.logId || "").trim();
  if (!logId) throw new HttpsError("invalid-argument", "logId required");

  const logRef = db.doc(`smsLogs/${logId}`);
  const logSnap = await logRef.get();
  if (!logSnap.exists) throw new HttpsError("not-found", "Log not found");

  const data = logSnap.data() || {};
  if (data.gymId !== gymId)
    throw new HttpsError("permission-denied", "Not allowed");

  await logRef.delete();

  const broadcastId = String(data.broadcastId || "").trim();
  if (broadcastId) {
    const othersSnap = await db
      .collection("smsLogs")
      .where("broadcastId", "==", broadcastId)
      .where("gymId", "==", gymId)
      .limit(1)
      .get();
    if (othersSnap.empty) {
      await db.doc(`smsBroadcasts/${broadcastId}`).delete().catch(() => {});
    }
  }
  return { ok: true };
});

exports.listBalanceTransactions = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth)
      throw new HttpsError("unauthenticated", "Sign in required");

    const caller = await getUserDoc(request.auth.uid);
    requireRole(caller, ["GYM_ADMIN", "SUPER_ADMIN", "STAFF"]);
    const { gymId } = await resolveCallerGym(caller, request.data);

    const snap = await db
      .collection("balanceTransactions")
      .where("gymId", "==", gymId)
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();

    const items = snap.docs.map((d) => {
      const data = d.data() || {};
      const createdAt = data.createdAt;
      return {
        id: d.id,
        gymId: data.gymId || null,
        amount: data.amount || 0,
        type: data.type || null,
        reason: data.reason || null,
        balanceBefore: data.balanceBefore || null,
        balanceAfter: data.balanceAfter || null,
        createdAtMs: createdAt?.toMillis ? createdAt.toMillis() : null,
      };
    });

    return { ok: true, items };
  }
);
