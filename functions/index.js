const { onCall } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");

setGlobalOptions({ maxInstances: 10 });

// Initialize Admin SDK
admin.initializeApp();

/* =========================
   HELPERS
========================= */

function pad(num, size = 3) {
  return String(num).padStart(size, "0");
}

async function generateEmployeeId(role, associateType) {
  const db = admin.firestore();

  let counterKey = null;
  let prefix = null;

  // Employee (includes Admin)
  if (role === "employee") {
    counterKey = "employee";
    prefix = "EMP";
  }

  // Associate
  if (role === "associate") {
    const map = {
      freelancer: "FRL",
      consultant: "CON",
      "self-employed": "SEL"
    };

    if (!map[associateType]) {
      throw new Error("Invalid associate type");
    }

    counterKey = `associate_${associateType}`;
    prefix = `ASC-${map[associateType]}`;
  }

  // Partner
  if (role === "partner") {
    counterKey = "partner";
    prefix = "PRT";
  }

  if (!counterKey) return null;

  const ref = db.doc(`counters/${counterKey}`);

  return await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists ? snap.data().seq || 0 : 0;
    const next = current + 1;

    tx.set(ref, { seq: next }, { merge: true });

    return `${prefix}-${pad(next)}`;
  });
}

/* =========================
   CLOUD FUNCTION
========================= */

exports.createTeamUser = onCall(async (request) => {
  const { auth, data } = request;

  // 1️⃣ Must be authenticated
  if (!auth) {
    throw new Error("Unauthenticated");
  }

  // 2️⃣ Admin privilege check (Admin = Employee + isAdmin)
  const adminSnap = await admin
    .firestore()
    .doc(`users/${auth.uid}`)
    .get();

  if (!adminSnap.exists || adminSnap.data().isAdmin !== true) {
    throw new Error("Permission denied");
  }

  let {
    email,
    name,
    role,
    mobile = "",
    associateType,
    isAdmin = false
  } = data;

  if (!email || !name || !role) {
    throw new Error("Missing required fields");
  }

  /* =========================
     ROLE NORMALIZATION
  ========================= */

  // Legacy support
  if (role === "team") role = "employee";
  if (role === "admin") {
    role = "employee";
    isAdmin = true;
  }

  const allowedRoles = ["employee", "associate", "partner"];
  if (!allowedRoles.includes(role)) {
    throw new Error("Invalid role");
  }

  /* =========================
     CREATE AUTH USER
  ========================= */

  const userRecord = await admin.auth().createUser({
    email,
    displayName: name
  });

  const uid = userRecord.uid;

  /* =========================
     EMPLOYEE ID GENERATION
  ========================= */

  const employeeId = await generateEmployeeId(
    role,
    associateType
  );

  /* =========================
     FIRESTORE USER DOC
  ========================= */

  const payload = {
    uid,
    email,
    name,
    mobile,
    role,
    isAdmin: role === "employee" ? isAdmin === true : false,
    employeeId,
    active: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  if (role === "associate") {
    payload.associateType = associateType;
  }

  await admin.firestore().doc(`users/${uid}`).set(payload);

  /* =========================
     RESPONSE
  ========================= */

  return {
    uid,
    employeeId,
    role,
    isAdmin: payload.isAdmin
  };
});
