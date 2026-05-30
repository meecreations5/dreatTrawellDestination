const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");

setGlobalOptions({ maxInstances: 10 });

admin.initializeApp();

function pad(num, size = 3) {
  return String(num).padStart(size, "0");
}

async function assertActiveAdmin(auth) {
  if (!auth) {
    throw new HttpsError("unauthenticated", "Login required");
  }

  const snap = await admin
    .firestore()
    .collection("users")
    .where("uid", "==", auth.uid)
    .limit(1)
    .get();

  if (snap.empty) {
    throw new HttpsError("permission-denied", "Admin profile not found");
  }

  const adminUser = snap.docs[0].data();

  if (adminUser.isAdmin !== true || adminUser.active !== true) {
    throw new HttpsError(
      "permission-denied",
      "Only active admins can perform this action"
    );
  }
}

async function generateEmployeeId(role, associateType) {
  const db = admin.firestore();

  let counterKey = null;
  let prefix = null;

  if (role === "employee") {
    counterKey = "employee";
    prefix = "DT-EMP";
  }

  if (role === "associate") {
    const map = {
      freelancer: "FRL",
      consultant: "CON",
      "self-employed": "SEL",
    };

    if (!map[associateType]) {
      throw new HttpsError("invalid-argument", "Invalid associate type");
    }

    counterKey = `associate_${associateType}`;
    prefix = `ASC-${map[associateType]}`;
  }

  if (role === "partner") {
    counterKey = "partner";
    prefix = "PRT";
  }

  if (!counterKey) {
    throw new HttpsError("invalid-argument", "Invalid role");
  }

  const ref = db.doc(`counters/${counterKey}`);

  return await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists ? snap.data().seq || 0 : 0;
    const next = current + 1;

    tx.set(ref, { seq: next }, { merge: true });

    return `${prefix}-${pad(next)}`;
  });
}

exports.createTeamUser = onCall(async (request) => {
  const { auth, data } = request;

  await assertActiveAdmin(auth);

  let {
    email,
    name,
    role,
    mobile = "",
    associateType,
    isAdmin = false,
    active = true,
    authProvider = "google",
  } = data;

  email = email?.trim().toLowerCase();
  name = name?.trim();
  mobile = mobile?.trim();

  if (!email || !name || !role) {
    throw new HttpsError("invalid-argument", "Missing required fields");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpsError("invalid-argument", "Invalid email address");
  }

  if (role === "team") role = "employee";

  if (role === "admin") {
    role = "employee";
    isAdmin = true;
  }

  const allowedRoles = ["employee", "associate", "partner"];
  const allowedProviders = ["google", "microsoft"];

  if (!allowedRoles.includes(role)) {
    throw new HttpsError("invalid-argument", "Invalid role");
  }

  if (!allowedProviders.includes(authProvider)) {
    throw new HttpsError("invalid-argument", "Invalid auth provider");
  }

  if (role !== "associate") {
    associateType = "";
  }

  const existingSnap = await admin
    .firestore()
    .collection("users")
    .where("email", "==", email)
    .limit(1)
    .get();

  if (!existingSnap.empty) {
    throw new HttpsError("already-exists", "User already exists");
  }

  const userRef = admin.firestore().collection("users").doc();
  const employeeId = await generateEmployeeId(role, associateType);

  const payload = {
    uid: null,
    email,
    name,
    mobile,
    role,
    isAdmin: role === "employee" ? isAdmin === true : false,
    employeeId,
    active: active === true,
    authProvider,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (role === "associate") {
    payload.associateType = associateType;
  }

  await userRef.set(payload);

  return {
    id: userRef.id,
    ...payload,
  };
});

exports.deleteUser = onCall(async (request) => {
  const { auth, data } = request;
  const { id } = data;

  await assertActiveAdmin(auth);

  if (!id) {
    throw new HttpsError("invalid-argument", "User document ID is required");
  }

  const userRef = admin.firestore().collection("users").doc(id);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    throw new HttpsError("not-found", "User not found");
  }

  await userRef.delete();

  return { status: "deleted" };
});