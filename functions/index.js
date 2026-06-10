const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");

setGlobalOptions({ maxInstances: 10 });

admin.initializeApp();

function pad(num, size = 3) {
  return String(num).padStart(size, "0");
}

const MODULE_PERMISSIONS = {
  dashboard: false,
  destinationManagement: false,
  travelAgentManagement: false,
  communicationManagement: false,
  documentManagement: false,
  leadManagement: false,
  attendanceManagement: false,
  userManagement: false,
  roleManagement: false,
  settingsManagement: false
};

function getPermissionsByRole(role) {
  if (role === "super_admin") {
    return {
      dashboard: true,
      destinationManagement: true,
      travelAgentManagement: true,
      communicationManagement: true,
      documentManagement: true,
      leadManagement: true,
      attendanceManagement: true,
      userManagement: true,
      roleManagement: true,
      settingsManagement: true
    };
  }

  if (role === "admin") {
    return {
      ...MODULE_PERMISSIONS,

      dashboard: false,

      destinationManagement: true,
      travelAgentManagement: true,
      communicationManagement: true,
      documentManagement: true,

      leadManagement: false,
      attendanceManagement: false,
      userManagement: false,
      roleManagement: false,
      settingsManagement: false
    };
  }

  return {
    ...MODULE_PERMISSIONS
  };
}

function normalizeRole(data = {}) {
  if (data.role === "super_admin" || data.isSuperAdmin === true) {
    return "super_admin";
  }

  if (data.role === "admin") {
    return "admin";
  }

  if (data.isAdmin === true) {
    return "admin";
  }

  if (data.role === "associate") {
    return "associate";
  }

  if (data.role === "partner") {
    return "partner";
  }

  return "employee";
}

async function getLoggedInUser(auth) {
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

  const doc = snap.docs[0];
  const data = doc.data();
  const role = normalizeRole(data);

  return {
    id: doc.id,
    ref: doc.ref,
    ...data,
    role,
    isSuperAdmin: role === "super_admin",
    isAdmin: role === "super_admin" || role === "admin",
    permissions: getPermissionsByRole(role)
  };
}

async function assertUserManagementAccess(auth) {
  const currentUser = await getLoggedInUser(auth);

  if (currentUser.active !== true) {
    throw new HttpsError(
      "permission-denied",
      "Only active users can perform this action"
    );
  }

  const hasAccess =
    currentUser.isSuperAdmin === true ||
    currentUser.permissions?.userManagement === true ||
    currentUser.permissions?.roleManagement === true;

  if (!hasAccess) {
    throw new HttpsError(
      "permission-denied",
      "Only Super Admin can manage users and roles"
    );
  }

  return currentUser;
}

async function generateEmployeeId(role, associateType) {
  const db = admin.firestore();

  let counterKey = null;
  let prefix = null;

  if (role === "super_admin") {
    counterKey = "super_admin";
    prefix = "DT-SA";
  }

  if (role === "admin") {
    counterKey = "admin";
    prefix = "DT-ADM";
  }

  if (role === "employee") {
    counterKey = "employee";
    prefix = "DT-EMP";
  }

  if (role === "associate") {
    const map = {
      freelancer: "FRL",
      consultant: "CON",
      "self-employed": "SEL"
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

  await assertUserManagementAccess(auth);

  let {
    email,
    name,
    role = "employee",
    mobile = "",
    associateType = "",
    active = true,
    authProvider = "google"
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

  if (role === "team") {
    role = "employee";
  }

  const allowedRoles = [
    "super_admin",
    "admin",
    "employee",
    "associate",
    "partner"
  ];

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

  const isSuperAdmin = role === "super_admin";
  const isAdmin = role === "super_admin" || role === "admin";
  const permissions = getPermissionsByRole(role);

  const userRef = admin.firestore().collection("users").doc();
  const employeeId = await generateEmployeeId(role, associateType);

  const payload = {
    uid: null,
    email,
    name,
    mobile,
    role,
    employeeId,

    isAdmin,
    isSuperAdmin,
    permissions,

    active: active === true,
    authProvider,

    associateType: role === "associate" ? associateType : "",

    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  await userRef.set(payload);

  return {
    id: userRef.id,
    uid: null,
    email,
    name,
    mobile,
    role,
    employeeId,
    isAdmin,
    isSuperAdmin,
    permissions,
    associateType: payload.associateType,
    active: payload.active,
    authProvider
  };
});

exports.deleteUser = onCall(async (request) => {
  const { auth, data } = request;
  const { id } = data;

  const currentUser = await assertUserManagementAccess(auth);

  if (!id) {
    throw new HttpsError("invalid-argument", "User document ID is required");
  }

  if (currentUser.id === id) {
    throw new HttpsError(
      "failed-precondition",
      "You cannot delete your own account"
    );
  }

  const userRef = admin.firestore().collection("users").doc(id);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    throw new HttpsError("not-found", "User not found");
  }

  const userData = userSnap.data();

  if (userData.role === "super_admin" || userData.isSuperAdmin === true) {
    throw new HttpsError(
      "permission-denied",
      "Super Admin users cannot be deleted from this action"
    );
  }

  await userRef.delete();

  return {
    status: "deleted",
    id
  };
});