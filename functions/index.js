const { HttpsError, onCall, onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const { getStorage } = require("firebase-admin/storage");
const crypto = require("crypto");

setGlobalOptions({ maxInstances: 10 });

admin.initializeApp();

const BREVO_WEBHOOK_SECRET = defineSecret("BREVO_WEBHOOK_SECRET");
const BREVO_API_KEY = defineSecret("BREVO_API_KEY");

function pad(num, size = 3) {
  return String(num).padStart(size, "0");
}

const MODULE_PERMISSIONS = {
  dashboard: false,
  destinationManagement: false,
  travelAgentManagement: false,
  vendorManagement: false,
  leadManagement: false,
  quotationManagement: false,
  communicationManagement: false,
  documentManagement: false,
  paymentManagement: false,
  reportManagement: false,
  userManagement: false,
  roleManagement: false,
  settingsManagement: false
};

const LEGACY_PERMISSION_TO_ACTION = {
  dashboard: "dashboard.view",
  destinationManagement: "destinations.view",
  travelAgentManagement: "travel_agents.view",
  vendorManagement: "vendors.view",
  leadManagement: "leads.view",
  quotationManagement: "quotations.view",
  communicationManagement: "communications.view",
  documentManagement: "documents.view",
  paymentManagement: "payments.view",
  reportManagement: "reports.view",
  userManagement: "users.view",
  roleManagement: "users.manage_role",
  settingsManagement: "settings.view"
};

const ACCESS_ACTION_KEYS = [
  "dashboard.view",
  "destinations.view", "destinations.create", "destinations.edit", "destinations.delete",
  "travel_agents.view", "travel_agents.create", "travel_agents.edit", "travel_agents.change_status", "travel_agents.change_potential", "travel_agents.assign",
  "engagements.view", "engagements.create", "engagements.edit",
  "meetings.view", "meetings.schedule", "meetings.edit", "meetings.assign_another_user", "meetings.cancel",
  "leads.view", "leads.create", "leads.edit", "leads.assign", "leads.close_won", "leads.close_lost", "leads.reopen", "leads.export",
  "quotations.view", "quotations.create", "quotations.edit", "quotations.send", "quotations.resend", "quotations.delete_draft", "quotations.create_revision",
  "vendors.view", "vendors.create", "vendors.edit",
  "payments.view", "payments.create", "payments.edit", "payments.approve", "payments.view_vendor_cost", "payments.view_revenue_gp",
  "reports.view", "reports.export",
  "communications.view", "communications.create", "communications.edit", "communications.send",
  "documents.view", "documents.upload", "documents.edit", "documents.delete",
  "users.view", "users.create", "users.edit", "users.manage_role", "users.manage_access",
  "settings.view", "settings.edit"
];

const SCOPE_ACTION_KEYS = new Set([
  "dashboard.view",
  "travel_agents.view", "travel_agents.edit", "travel_agents.change_status", "travel_agents.change_potential", "travel_agents.assign",
  "engagements.view", "engagements.create", "engagements.edit",
  "meetings.view", "meetings.schedule", "meetings.edit", "meetings.assign_another_user", "meetings.cancel",
  "leads.view", "leads.edit", "leads.assign", "leads.close_won", "leads.close_lost", "leads.reopen", "leads.export",
  "quotations.view", "quotations.create", "quotations.edit", "quotations.send", "quotations.resend", "quotations.delete_draft", "quotations.create_revision",
  "payments.view", "payments.create", "payments.edit", "payments.approve", "payments.view_vendor_cost", "payments.view_revenue_gp",
  "reports.view", "reports.export"
]);

function normalizeRole(data = {}) {
  const rawAccessRole = String(data.accessRole || data.roleProfile || "").trim();
  if (rawAccessRole) {
    const accessRole = rawAccessRole.toLowerCase().replace(/[\s-]+/g, "_");
    if (accessRole === "operation_executive") return "operation_executive";
  }

  const rawRole = String(data.role || "").trim();
  if (rawRole) {
    const role = rawRole.toLowerCase().replace(/[\s-]+/g, "_");
    if (["super_admin", "admin", "manager", "employee", "operation_executive", "associate", "partner", "finance"].includes(role)) return role;
    if (["team", "sales", "operations_executive"].includes(role)) return "employee";
    return "employee";
  }
  if (data.isSuperAdmin === true) return "super_admin";
  if (data.isAdmin === true) return "admin";
  return "employee";
}

function getStoredBaseRole(effectiveRole) {
  return effectiveRole === "operation_executive" ? "employee" : effectiveRole;
}

function createDeniedActionDefaults() {
  return Object.fromEntries(ACCESS_ACTION_KEYS.map(key => [key, { allowed: false, scope: "none" }]));
}

function allowActions(defaults, keys, scope = "all") {
  keys.forEach(key => {
    if (!Object.prototype.hasOwnProperty.call(defaults, key)) return;
    defaults[key] = { allowed: true, scope: SCOPE_ACTION_KEYS.has(key) ? scope : "all" };
  });
}

function allowPrefix(defaults, prefix, scope = "all") {
  allowActions(defaults, ACCESS_ACTION_KEYS.filter(key => key.startsWith(prefix + ".")), scope);
}

/*
 * Simplified fixed role model. No per-user access overrides are evaluated.
 * Every active user receives the normal Team/User workspace automatically.
 */
function getRoleActionDefaults(role) {
  const normalizedRole = normalizeRole({ role });
  const defaults = createDeniedActionDefaults();

  if (normalizedRole === "super_admin") {
    ACCESS_ACTION_KEYS.forEach(key => { defaults[key] = { allowed: true, scope: "all" }; });
    return defaults;
  }

  // Standard Team/User workspace.
  allowActions(defaults, ["dashboard.view"], "all");
  allowActions(defaults, [
    "travel_agents.view", "travel_agents.create", "travel_agents.edit",
    "travel_agents.change_status", "travel_agents.change_potential", "travel_agents.assign"
  ], "all");
  allowActions(defaults, ["engagements.create"], "all");
  allowActions(defaults, ["engagements.view", "engagements.edit"], "own_assigned");
  allowActions(defaults, ["meetings.schedule"], "all");
  allowActions(defaults, ["meetings.view", "meetings.edit", "meetings.cancel"], "own_assigned");
  allowActions(defaults, ["leads.create"], "all");
  allowActions(defaults, ["leads.view", "leads.edit", "leads.close_won", "leads.close_lost", "leads.reopen", "leads.export"], "own_assigned");
  allowPrefix(defaults, "quotations", "own_assigned");
  allowActions(defaults, ["payments.view", "payments.create", "payments.edit"], "own_assigned");
  allowActions(defaults, ["communications.send"], "all");

  if (normalizedRole === "operation_executive") {
    ["travel_agents", "engagements", "meetings", "leads"].forEach(prefix => allowPrefix(defaults, prefix, "all"));
  }

  if (normalizedRole === "employee") {
    allowPrefix(defaults, "travel_agents", "all");
  }

  if (normalizedRole === "manager") {
    ["travel_agents", "engagements", "meetings", "leads", "quotations"].forEach(prefix => allowPrefix(defaults, prefix, "team"));
    allowActions(defaults, ["leads.assign", "meetings.assign_another_user"], "team");
    allowActions(defaults, [
      "payments.view", "payments.create", "payments.edit", "payments.approve",
      "payments.view_vendor_cost", "payments.view_revenue_gp",
      "reports.view", "reports.export"
    ], "team");
  }

  if (normalizedRole === "finance") {
    allowPrefix(defaults, "payments", "all");
    allowPrefix(defaults, "vendors", "all");
    allowActions(defaults, ["reports.view", "reports.export", "quotations.view", "leads.view"], "all");
  }

  if (normalizedRole === "admin") {
    ACCESS_ACTION_KEYS.forEach(key => { defaults[key] = { allowed: true, scope: "all" }; });
  }

  return defaults;
}

function getPermissionsByRole(role) {
  const actions = getRoleActionDefaults(role);
  return Object.fromEntries(Object.keys(MODULE_PERMISSIONS).map(key => {
    const actionKey = LEGACY_PERMISSION_TO_ACTION[key];
    return [key, Boolean(actionKey && actions[actionKey]?.allowed)];
  }));
}

function resolveUserAccess(user, permissionKey) {
  if (!user || user.active === false) return { allowed: false, scope: "none" };
  if (user.isSuperAdmin === true || normalizeRole(user) === "super_admin") return { allowed: true, scope: "all" };
  const key = LEGACY_PERMISSION_TO_ACTION[permissionKey] || permissionKey;
  return getRoleActionDefaults(user.role)[key] || { allowed: false, scope: "none" };
}

function hasAccess(user, permissionKey) {
  return resolveUserAccess(user, permissionKey).allowed === true;
}

function recordMatchesUser(record, fields, user) {
  const values = new Set([
    String(user?.uid || "").trim(),
    String(user?.id || "").trim(),
    String(user?.email || "").trim().toLowerCase()
  ].filter(Boolean));
  return fields.some(field => {
    const value = String(record?.[field] || "").trim();
    if (!value) return false;
    return values.has(value) || values.has(value.toLowerCase());
  });
}

function canAccessLeadByScope(user, permissionKey, lead = {}) {
  const access = resolveUserAccess(user, permissionKey);
  if (!access.allowed || access.scope === "none") return false;
  if (access.scope === "all") return true;

  const owns = recordMatchesUser(lead, ["ownerUid", "ownerEmail", "createdByUid", "createdByEmail", "createdBy", "creatorUid", "creatorEmail"], user);
  const assigned = recordMatchesUser(lead, ["assignedToUid", "assignedToEmail", "assignedTo", "assignedUserUid", "assigneeUid", "assigneeEmail"], user);
  if (access.scope === "own") return owns;
  if (access.scope === "assigned") return assigned;
  if (access.scope === "own_assigned") return owns || assigned;
  if (access.scope === "team") {
    const userTeam = String(user?.teamName || user?.team || user?.departmentName || user?.department || "").trim().toLowerCase();
    if (!userTeam) return false;
    return ["team", "teamName", "ownerTeam", "assignedTeam", "assignedToTeam", "createdByTeam"].some(field =>
      String(lead?.[field] || "").trim().toLowerCase() === userTeam
    );
  }
  return false;
}

function accessTimestampMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function pickCanonicalUserSnapshot(docs = []) {
  return [...docs].sort((a, b) => {
    const aData = a.data() || {};
    const bData = b.data() || {};
    const versionDelta = Number(bData.accessVersion || 0) - Number(aData.accessVersion || 0);
    if (versionDelta !== 0) return versionDelta;
    return Math.max(accessTimestampMillis(bData.accessUpdatedAt), accessTimestampMillis(bData.updatedAt)) -
      Math.max(accessTimestampMillis(aData.accessUpdatedAt), accessTimestampMillis(aData.updatedAt));
  })[0] || null;
}

async function getLoggedInUser(auth) {
  if (!auth) throw new HttpsError("unauthenticated", "Login required");

  const usersRef = admin.firestore().collection("users");
  const normalizedAuthEmail = String(auth?.token?.email || "").trim().toLowerCase();

  // Primary identity link: Firebase Auth UID.
  let docs = [];
  const uidSnap = await usersRef.where("uid", "==", auth.uid).get();
  if (!uidSnap.empty) docs.push(...uidSnap.docs);

  // Legacy CRM users were sometimes created before a Firebase UID was linked.
  // Fall back to the verified Firebase Auth email so email sending does not fail
  // simply because the profile has not been migrated yet.
  if (!docs.length && normalizedAuthEmail) {
    const emailSnap = await usersRef.where("email", "==", normalizedAuthEmail).get();
    if (!emailSnap.empty) docs.push(...emailSnap.docs);
  }

  if (!docs.length && normalizedAuthEmail) {
    const emailLowerSnap = await usersRef.where("emailLower", "==", normalizedAuthEmail).get();
    if (!emailLowerSnap.empty) docs.push(...emailLowerSnap.docs);
  }

  // Final compatibility fallback for older records whose email casing/field
  // differs. Team size is small enough that this is safe and it runs only when
  // the indexed identity lookups above fail.
  if (!docs.length && normalizedAuthEmail) {
    const allUsersSnap = await usersRef.get();
    docs = allUsersSnap.docs.filter((candidate) => {
      const data = candidate.data() || {};
      const candidates = [data.email, data.emailLower, data.workEmail, data.officialEmail]
        .map(value => String(value || "").trim().toLowerCase())
        .filter(Boolean);
      return candidates.includes(normalizedAuthEmail);
    });
  }

  if (!docs.length) {
    throw new HttpsError(
      "permission-denied",
      "CRM user profile not found for this login. Please sign out and sign in again or ask an administrator to relink the user profile.",
      { uid: auth.uid || "", email: normalizedAuthEmail }
    );
  }

  const doc = pickCanonicalUserSnapshot(docs);
  if (!doc) throw new HttpsError("permission-denied", "CRM user profile not found");

  const data = doc.data() || {};
  const role = normalizeRole(data);

  // Repair the UID link server-side once a legacy profile is identified by the
  // verified login email. This prevents repeat failures on future calls.
  if (data.uid !== auth.uid) {
    try {
      await doc.ref.update({
        uid: auth.uid,
        emailLower: normalizedAuthEmail || String(data.email || "").trim().toLowerCase(),
        authUidLinkedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      console.warn("Could not repair CRM user UID link", {
        userId: doc.id,
        uid: auth.uid || "",
        message: error?.message || String(error)
      });
    }
  }

  return {
    id: doc.id,
    ref: doc.ref,
    ...data,
    uid: auth.uid,
    email: normalizedAuthEmail || data.email || "",
    role,
    isSuperAdmin: role === "super_admin",
    isAdmin: role === "super_admin" || role === "admin",
    permissions: getPermissionsByRole(role)
  };
}

async function assertUserManagementAccess(auth, permissionKey = "users.view") {
  const currentUser = await getLoggedInUser(auth);
  if (currentUser.active === false) throw new HttpsError("permission-denied", "Only active users can perform this action");
  if (!hasAccess(currentUser, permissionKey)) {
    throw new HttpsError("permission-denied", "You do not have permission to manage this user action");
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

  if (role === "manager") {
    counterKey = "manager";
    prefix = "DT-MGR";
  }

  if (role === "employee") {
    counterKey = "employee";
    prefix = "DT-EMP";
  }

  if (role === "operation_executive") {
    counterKey = "operation_executive";
    prefix = "DT-OPE";
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

  if (role === "finance") {
    counterKey = "finance";
    prefix = "DT-FIN";
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

  const currentUser = await assertUserManagementAccess(auth, "users.create");

  let {
    email,
    name,
    role = "employee",
    mobile = "",
    teamName = "",
    associateType = "",
    active = true,
    authProvider = "google"
  } = data;

  email = email?.trim().toLowerCase();
  name = name?.trim();
  mobile = mobile?.trim();
  teamName = teamName?.trim() || "";

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
    "manager",
    "employee",
    "operation_executive",
    "associate",
    "partner",
    "finance"
  ];

  const allowedProviders = ["google", "microsoft"];

  if (!allowedRoles.includes(role)) {
    throw new HttpsError("invalid-argument", "Invalid role");
  }

  const actorIsSuperAdmin = currentUser.role === "super_admin" || currentUser.isSuperAdmin === true;
  if (role === "super_admin" && !actorIsSuperAdmin) {
    throw new HttpsError("permission-denied", "Only a Super Admin can create another Super Admin");
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

  const storedRole = getStoredBaseRole(role);
  const payload = {
    uid: null,
    email,
    emailLower: email,
    name,
    mobile,
    teamName,
    role: storedRole,
    accessRole: role === "operation_executive" ? "operation_executive" : "",
    employeeId,

    isAdmin,
    isSuperAdmin,
    permissions,
    accessOverrides: {},
    accessVersion: 1,

    active: active === true,
    authProvider,

    associateType: role === "associate" ? associateType : "",

    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  await userRef.set(payload);

  await admin.firestore().collection("accessAuditLogs").add({
    changedUserId: userRef.id,
    changedUserUid: "",
    changedUserEmail: email,
    changedUserName: name,
    changedByUserId: currentUser.id || "",
    changedByUid: currentUser.uid || "",
    changedByEmail: currentUser.email || "",
    changedByName: currentUser.name || "",
    previousAccess: null,
    newAccess: {
      role,
      active: payload.active,
      accessOverrides: {},
      accessVersion: 1
    },
    reason: "User created",
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return {
    id: userRef.id,
    uid: null,
    email,
    name,
    mobile,
    teamName,
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

  const currentUser = await assertUserManagementAccess(auth, "users.edit");

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

/* =========================
   ROLE & ACCESS MANAGEMENT
========================= */

function cleanAccessString(value = "") {
  return String(value || "").trim();
}

function parseAccessDate(value, fieldName) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new HttpsError("invalid-argument", fieldName + " is not a valid date");
  }
  return admin.firestore.Timestamp.fromDate(date);
}

function sanitizeAccessOverrides(input = {}) {
  const allowedStates = new Set(["allow", "deny"]);
  const allowedScopes = new Set(["none", "own", "assigned", "own_assigned", "team", "all"]);
  const result = {};

  Object.entries(input || {}).forEach(([key, raw]) => {
    if (!ACCESS_ACTION_KEYS.includes(key) || !raw || typeof raw !== "object") return;
    const state = cleanAccessString(raw.state).toLowerCase();
    if (!allowedStates.has(state)) return;

    const accessFrom = parseAccessDate(raw.accessFrom, key + " accessFrom");
    const accessUntil = parseAccessDate(raw.accessUntil, key + " accessUntil");
    if (accessFrom && accessUntil && accessFrom.toMillis() > accessUntil.toMillis()) {
      throw new HttpsError("invalid-argument", key + " accessFrom must be before accessUntil");
    }

    let scope = "none";
    if (state === "allow" && SCOPE_ACTION_KEYS.has(key)) {
      const requestedScope = cleanAccessString(raw.scope).toLowerCase() || "all";
      scope = allowedScopes.has(requestedScope) ? requestedScope : "all";
    }

    result[key] = {
      state,
      scope,
      accessFrom,
      accessUntil,
      reason: cleanAccessString(raw.reason).slice(0, 500)
    };
  });

  return result;
}

function accessComparable(value) {
  if (!value) return null;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  return value;
}

function serializeOverridesForCompare(overrides = {}) {
  return JSON.stringify(Object.fromEntries(Object.entries(overrides || {}).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, {
    state: item?.state || "default",
    scope: item?.scope || "none",
    accessFrom: accessComparable(item?.accessFrom),
    accessUntil: accessComparable(item?.accessUntil),
    reason: item?.reason || ""
  }])));
}

exports.updateUserAccess = onCall(async (request) => {
  const actor = await getLoggedInUser(request.auth);
  if (actor.active === false) {
    throw new HttpsError("permission-denied", "Inactive users cannot manage users");
  }

  const data = request.data || {};
  const userId = cleanAccessString(data.userId);
  if (!userId) throw new HttpsError("invalid-argument", "User document ID is required");

  const targetRef = admin.firestore().collection("users").doc(userId);
  const targetSnap = await targetRef.get();
  if (!targetSnap.exists) throw new HttpsError("not-found", "User not found");

  const previous = targetSnap.data() || {};
  const previousRole = normalizeRole(previous);
  const requestedRole = normalizeRole({ role: data.role || previousRole });
  let requestedActive = data.active === undefined ? previous.active !== false : data.active === true;

  if (requestedRole === "super_admin") requestedActive = true;

  const isSelf = actor.id === userId || (actor.uid && previous.uid && actor.uid === previous.uid);
  const targetIsSuperAdmin = previousRole === "super_admin" || previous.isSuperAdmin === true;
  const actorIsSuperAdmin = actor.role === "super_admin" || actor.isSuperAdmin === true;
  const roleChanged = requestedRole !== previousRole;
  const activeChanged = requestedActive !== (previous.active !== false);

  const profileChanged =
    (Object.prototype.hasOwnProperty.call(data, "name") && cleanAccessString(data.name) !== cleanAccessString(previous.name)) ||
    (Object.prototype.hasOwnProperty.call(data, "mobile") && cleanAccessString(data.mobile) !== cleanAccessString(previous.mobile)) ||
    (Object.prototype.hasOwnProperty.call(data, "teamName") && cleanAccessString(data.teamName) !== cleanAccessString(previous.teamName || previous.team || previous.departmentName)) ||
    (Object.prototype.hasOwnProperty.call(data, "authProvider") && cleanAccessString(data.authProvider) !== cleanAccessString(previous.authProvider || "google")) ||
    (Object.prototype.hasOwnProperty.call(data, "associateType") && cleanAccessString(data.associateType) !== cleanAccessString(previous.associateType));

  // Self role/status changes stay blocked to prevent self-elevation or lockout.
  if (isSelf && (roleChanged || activeChanged)) {
    throw new HttpsError("permission-denied", "You cannot change your own role or active status");
  }

  if (targetIsSuperAdmin && !actorIsSuperAdmin) {
    throw new HttpsError("permission-denied", "Only a Super Admin can manage another Super Admin");
  }

  if (requestedRole === "super_admin" && !actorIsSuperAdmin) {
    throw new HttpsError("permission-denied", "Only a Super Admin can assign the Super Admin role");
  }

  if (targetIsSuperAdmin && requestedRole === "super_admin" && requestedActive !== true) {
    throw new HttpsError("failed-precondition", "A Super Admin must remain active. Change the role first if you need to deactivate this user.");
  }

  if (roleChanged && !hasAccess(actor, "users.manage_role")) {
    throw new HttpsError("permission-denied", "Your role does not allow role changes");
  }

  if ((activeChanged || profileChanged) && !hasAccess(actor, "users.edit")) {
    throw new HttpsError("permission-denied", "Your role does not allow editing users");
  }

  const allowedProviders = new Set(["google", "microsoft"]);
  const authProvider = cleanAccessString(
    Object.prototype.hasOwnProperty.call(data, "authProvider")
      ? data.authProvider
      : (previous.authProvider || "google")
  );
  if (!allowedProviders.has(authProvider)) {
    throw new HttpsError("invalid-argument", "Invalid auth provider");
  }

  const associateType = requestedRole === "associate"
    ? cleanAccessString(
        Object.prototype.hasOwnProperty.call(data, "associateType")
          ? data.associateType
          : previous.associateType
      )
    : "";
  if (requestedRole === "associate" && !["freelancer", "consultant", "self-employed"].includes(associateType)) {
    throw new HttpsError("invalid-argument", "Associate type is required");
  }

  // Older CRM builds can contain more than one users document for the same
  // person (random document id, email-as-document-id, or a later UID-linked
  // profile). Role changes must be identity-wide or the auth loader can read a
  // stale duplicate after refresh and make the role appear to roll back.
  const previousEmail = cleanAccessString(previous.email).toLowerCase();
  const previousUid = cleanAccessString(previous.uid);
  const usersSnap = await admin.firestore().collection("users").get();
  const identityDocs = usersSnap.docs.filter(docSnap => {
    if (docSnap.id === userId) return true;
    const candidate = docSnap.data() || {};
    const candidateEmail = cleanAccessString(candidate.email).toLowerCase();
    const candidateUid = cleanAccessString(candidate.uid);
    if (previousUid && candidateUid && candidateUid === previousUid) return true;
    if (previousEmail && candidateEmail && candidateEmail === previousEmail) return true;
    return false;
  });

  const identityRefs = identityDocs
    .filter(docSnap => docSnap.id !== userId)
    .map(docSnap => docSnap.ref);
  const highestAccessVersion = identityDocs.reduce(
    (maxVersion, docSnap) => Math.max(maxVersion, Number(docSnap.data()?.accessVersion || 0)),
    Number(previous.accessVersion || 0)
  );
  const nextAccessVersion = highestAccessVersion + 1;
  const payload = {
    name: cleanAccessString(
      Object.prototype.hasOwnProperty.call(data, "name") ? data.name : previous.name
    ),
    mobile: cleanAccessString(
      Object.prototype.hasOwnProperty.call(data, "mobile") ? data.mobile : previous.mobile
    ),
    teamName: cleanAccessString(
      Object.prototype.hasOwnProperty.call(data, "teamName")
        ? data.teamName
        : (previous.teamName || previous.team || previous.departmentName)
    ),
    role: getStoredBaseRole(requestedRole),
    accessRole: requestedRole === "operation_executive" ? "operation_executive" : "",
    isAdmin: requestedRole === "super_admin" || requestedRole === "admin",
    isSuperAdmin: requestedRole === "super_admin",
    permissions: getPermissionsByRole(requestedRole),
    // Retire old per-user overrides without requiring a bulk migration.
    accessOverrides: {},
    permissionOverrides: {},
    accessVersion: nextAccessVersion,
    emailLower: previousEmail || cleanAccessString(previous.email).toLowerCase(),
    associateType,
    active: requestedActive,
    authProvider,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    accessUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    accessUpdatedByUid: actor.uid || "",
    accessUpdatedByUserId: actor.id || ""
  };

  try {
    await admin.firestore().runTransaction(async tx => {
      tx.update(targetRef, payload);

      identityRefs.forEach(ref => {
        tx.update(ref, {
          role: payload.role,
          accessRole: payload.accessRole,
          isAdmin: payload.isAdmin,
          isSuperAdmin: payload.isSuperAdmin,
          permissions: payload.permissions,
          accessOverrides: {},
          permissionOverrides: {},
          active: requestedActive,
          accessVersion: nextAccessVersion,
          emailLower: previousEmail || cleanAccessString(previous.email).toLowerCase(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          accessUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          accessUpdatedByUid: actor.uid || "",
          accessUpdatedByUserId: actor.id || ""
        });
      });

      if (roleChanged || activeChanged) {
        const auditRef = admin.firestore().collection("accessAuditLogs").doc();
        tx.set(auditRef, {
          changedUserId: userId,
          changedUserUid: previous.uid || "",
          changedUserEmail: previous.email || "",
          changedUserName: previous.name || "",
          changedByUserId: actor.id || "",
          changedByUid: actor.uid || "",
          changedByEmail: actor.email || "",
          changedByName: actor.name || "",
          previousAccess: {
            role: previousRole,
            active: previous.active !== false
          },
          newAccess: {
            role: requestedRole,
            active: requestedActive
          },
          reason: cleanAccessString(data.changeReason).slice(0, 500) || "Role or status updated from Team Management",
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    });
  } catch (error) {
    console.error("updateUserAccess transaction failed", {
      actorId: actor.id || "",
      actorUid: actor.uid || "",
      targetUserId: userId,
      previousRole,
      requestedRole,
      roleChanged,
      activeChanged,
      errorCode: error?.code || "",
      errorMessage: error?.message || String(error)
    });

    if (error instanceof HttpsError) throw error;
    throw new HttpsError(
      "failed-precondition",
      "Unable to save this user change. Check the updateUserAccess function logs for the recorded server error."
    );
  }

  const persistedSnap = await targetRef.get();
  if (!persistedSnap.exists) {
    throw new HttpsError("failed-precondition", "User could not be verified after save");
  }
  const persisted = persistedSnap.data() || {};
  const persistedRole = normalizeRole(persisted);
  const expectedIsAdmin = requestedRole === "super_admin" || requestedRole === "admin";
  const expectedIsSuperAdmin = requestedRole === "super_admin";

  if (persistedRole !== requestedRole || persisted.isAdmin !== expectedIsAdmin || persisted.isSuperAdmin !== expectedIsSuperAdmin) {
    console.error("updateUserAccess post-write verification failed", {
      userId, requestedRole, persistedRole,
      persistedIsAdmin: persisted.isAdmin, expectedIsAdmin,
      persistedIsSuperAdmin: persisted.isSuperAdmin, expectedIsSuperAdmin
    });
    throw new HttpsError("failed-precondition", "Role save verification failed. The user record was changed by another legacy path.");
  }

  const verifySnaps = await Promise.all(identityRefs.map(ref => ref.get()));
  const inconsistentIdentityDoc = verifySnaps.find(docSnap => {
    if (!docSnap.exists) return false;
    const item = docSnap.data() || {};
    return normalizeRole(item) !== requestedRole ||
      item.isAdmin !== expectedIsAdmin ||
      item.isSuperAdmin !== expectedIsSuperAdmin ||
      Number(item.accessVersion || 0) !== nextAccessVersion;
  });
  if (inconsistentIdentityDoc) {
    console.error("updateUserAccess identity synchronization verification failed", {
      userId,
      inconsistentUserId: inconsistentIdentityDoc.id,
      requestedRole,
      storedRole: normalizeRole(inconsistentIdentityDoc.data() || {})
    });
    throw new HttpsError(
      "failed-precondition",
      "A duplicate user record still contains an older role. The role change was not accepted."
    );
  }

  return {
    success: true,
    userId,
    role: persistedRole,
    active: persisted.active !== false,
    accessVersion: nextAccessVersion,
    syncedDuplicateUserDocs: identityRefs.length,
    canonicalAccessVersion: nextAccessVersion,
    roleModelVersion: "2.7.5.8.3"
  };
});

/* =========================
   PAYMENT RECEIPT UPLOAD
========================= */

const PAYMENT_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
const PAYMENT_UPLOAD_KINDS = {
  customer_receipt: "lead-payments/customer-receipts",
  vendor_proof: "lead-payments/vendor-proofs"
};

function cleanUploadString(value = "") {
  return String(value || "").trim();
}

function safeUploadFileName(name = "") {
  return cleanUploadString(name)
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
}

function isAllowedPaymentContentType(contentType = "") {
  const normalized = cleanUploadString(contentType).toLowerCase();
  return normalized === "application/pdf" || normalized.startsWith("image/");
}

async function assertPaymentUploadUser(auth) {
  if (!auth) {
    throw new HttpsError("unauthenticated", "Login required for receipt upload");
  }

  const db = admin.firestore();
  let snap = await db
    .collection("users")
    .where("uid", "==", auth.uid)
    .limit(1)
    .get();

  if (snap.empty && auth.token?.email) {
    snap = await db
      .collection("users")
      .where("email", "==", String(auth.token.email).trim().toLowerCase())
      .limit(1)
      .get();
  }

  if (snap.empty) {
    throw new HttpsError("permission-denied", "CRM user profile not found");
  }

  const user = snap.docs[0].data() || {};
  if (user.active === false) {
    throw new HttpsError("permission-denied", "Inactive users cannot upload receipts");
  }

  const role = normalizeRole(user);
  const actor = {
    id: snap.docs[0].id,
    ...user,
    role,
    isSuperAdmin: role === "super_admin",
    isAdmin: role === "super_admin" || role === "admin",
    uid: auth.uid,
    email: cleanUploadString(user.email || auth.token?.email),
    name: cleanUploadString(user.name || user.displayName)
  };

  if (!hasAccess(actor, "payments.create")) {
    throw new HttpsError("permission-denied", "Payment Create permission is required");
  }

  return actor;
}


const QUOTATION_PDF_MAX_BYTES = 9 * 1024 * 1024;

function cleanStorageBucketName(value = "") {
  return cleanUploadString(value)
    .replace(/^gs:\/\//i, "")
    .replace(/\/$/, "");
}

function getFirebaseProjectId() {
  return cleanUploadString(
    admin.app().options?.projectId ||
    process.env.GCLOUD_PROJECT ||
    process.env.GCP_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    ""
  );
}

function getProjectStorageBucketCandidates(requestedBucket = "") {
  const projectId = getFirebaseProjectId();
  const requested = cleanStorageBucketName(requestedBucket);
  const configured = cleanStorageBucketName(admin.app().options?.storageBucket || "");
  const envBucket = cleanStorageBucketName(process.env.FIREBASE_STORAGE_BUCKET || "");

  if (requested && projectId) {
    const allowed = requested === `${projectId}.appspot.com` || requested === `${projectId}.firebasestorage.app`;
    if (!allowed) {
      throw new HttpsError("invalid-argument", "Quotation PDF Storage bucket does not belong to this Firebase project");
    }
  }

  return [...new Set([
    requested,
    configured,
    envBucket,
    projectId ? `${projectId}.firebasestorage.app` : "",
    projectId ? `${projectId}.appspot.com` : ""
  ].filter(Boolean))];
}

async function saveQuotationPdfToStorage({
  buffer,
  storagePath,
  safeName,
  token,
  leadId,
  quotationId,
  revision,
  actor,
  originalFileName,
  requestedBucket
}) {
  const candidates = getProjectStorageBucketCandidates(requestedBucket);
  if (!candidates.length) {
    throw new HttpsError(
      "failed-precondition",
      "Firebase Storage bucket is not configured for quotation PDF sharing"
    );
  }

  const attempts = [];
  for (const bucketName of candidates) {
    try {
      const bucket = getStorage().bucket(bucketName);
      const file = bucket.file(storagePath);
      await file.save(buffer, {
        resumable: false,
        contentType: "application/pdf",
        metadata: {
          cacheControl: "private, max-age=0, no-transform",
          contentDisposition: `inline; filename="${safeName}"`,
          metadata: {
            firebaseStorageDownloadTokens: token,
            leadId,
            quotationId,
            revision,
            uploadedByUid: actor.uid || "",
            originalFileName
          }
        }
      });
      return { bucket, bucketName };
    } catch (error) {
      attempts.push({
        bucketName,
        code: cleanUploadString(error?.code || ""),
        message: cleanUploadString(error?.message || "Storage upload failed")
      });
      console.error("Quotation PDF Storage upload attempt failed", {
        bucketName,
        code: error?.code,
        message: error?.message,
        leadId,
        quotationId
      });
    }
  }

  const last = attempts[attempts.length - 1] || {};
  throw new HttpsError(
    "internal",
    last.message
      ? `Quotation PDF Storage upload failed: ${last.message}`
      : "Quotation PDF Storage upload failed",
    {
      projectId: getFirebaseProjectId(),
      bucketsTried: attempts.map(item => item.bucketName),
      lastCode: last.code || ""
    }
  );
}

exports.uploadQuotationPdf = onCall(
  {
    memory: "512MiB",
    timeoutSeconds: 90
  },
  async (request) => {
    const actor = await getLoggedInUser(request.auth);
    if (actor.active === false) {
      throw new HttpsError("permission-denied", "Inactive users cannot upload quotation PDFs");
    }

    const data = request.data || {};
    const leadId = cleanUploadString(data.leadId);
    const quotationId = cleanUploadString(data.quotationId);
    const revision = cleanUploadString(data.revision);
    const originalFileName = cleanUploadString(data.fileName) || "DreamTrawell-Quotation.pdf";
    const contentType = cleanUploadString(data.contentType).toLowerCase();
    const declaredSize = Number(data.size || 0);
    const base64 = cleanUploadString(data.base64);
    const requestedStorageBucket = cleanStorageBucketName(data.storageBucket);

    if (!leadId || !quotationId) {
      throw new HttpsError("invalid-argument", "Lead ID and quotation ID are required");
    }
    if (contentType !== "application/pdf") {
      throw new HttpsError("invalid-argument", "Only PDF quotation files are allowed");
    }
    if (!base64) {
      throw new HttpsError("invalid-argument", "Quotation PDF data is required");
    }
    if (declaredSize > QUOTATION_PDF_MAX_BYTES) {
      throw new HttpsError("invalid-argument", "Quotation PDF exceeds the 9 MB share limit");
    }

    const leadRef = admin.firestore().collection("leads").doc(leadId);
    const leadSnap = await leadRef.get();
    if (!leadSnap.exists) {
      throw new HttpsError("not-found", "Lead not found");
    }
    if (!canAccessLeadByScope(actor, "quotations.send", leadSnap.data() || {})) {
      throw new HttpsError("permission-denied", "You do not have permission to send quotations for this lead");
    }

    const quotationRef = leadRef.collection("quotations").doc(quotationId);
    const quotationSnap = await quotationRef.get();
    if (!quotationSnap.exists) {
      throw new HttpsError("not-found", "Quotation not found");
    }

    let buffer;
    try {
      buffer = Buffer.from(base64, "base64");
    } catch {
      throw new HttpsError("invalid-argument", "Quotation PDF data is invalid");
    }

    if (!buffer.length || buffer.length > QUOTATION_PDF_MAX_BYTES) {
      throw new HttpsError("invalid-argument", "Quotation PDF exceeds the 9 MB share limit");
    }

    const safeName = safeUploadFileName(originalFileName) || "DreamTrawell-Quotation.pdf";
    const revisionPart = revision ? `rev-${safeUploadFileName(revision)}-` : "";
    const storagePath = `quotation-pdfs/${leadId}/${quotationId}/${revisionPart}${Date.now()}-${safeName}`;
    const token = crypto.randomUUID();

    const { bucket, bucketName } = await saveQuotationPdfToStorage({
      buffer,
      storagePath,
      safeName,
      token,
      leadId,
      quotationId,
      revision,
      actor,
      originalFileName,
      requestedBucket: requestedStorageBucket
    });

    const encodedPath = encodeURIComponent(storagePath);
    const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${token}`;

    return {
      success: true,
      url,
      fileName: originalFileName,
      storagePath,
      contentType: "application/pdf",
      size: buffer.length,
      storageBucket: bucketName,
      pdfShareVersion: "2.7.5.11.2"
    };
  }
);

exports.uploadLeadPaymentReceipt = onCall(
  {
    memory: "512MiB",
    timeoutSeconds: 60
  },
  async (request) => {
    const actor = await assertPaymentUploadUser(request.auth);
    const data = request.data || {};

    const leadId = cleanUploadString(data.leadId);
    const kind = cleanUploadString(data.kind);
    const originalFileName = cleanUploadString(data.fileName);
    const contentType = cleanUploadString(data.contentType).toLowerCase();
    const declaredSize = Number(data.size || 0);
    const base64 = cleanUploadString(data.base64);
    const folder = PAYMENT_UPLOAD_KINDS[kind];

    if (!leadId) {
      throw new HttpsError("invalid-argument", "Lead ID is required");
    }

    const leadSnap = await admin.firestore().collection("leads").doc(leadId).get();
    if (!leadSnap.exists) {
      throw new HttpsError("not-found", "Lead not found");
    }
    if (!canAccessLeadByScope(actor, "payments.create", leadSnap.data() || {})) {
      throw new HttpsError("permission-denied", "Your data scope does not allow payment uploads for this lead");
    }

    if (!folder) {
      throw new HttpsError("invalid-argument", "Unsupported payment receipt type");
    }

    if (!originalFileName || !base64) {
      throw new HttpsError("invalid-argument", "Receipt file is required");
    }

    if (!isAllowedPaymentContentType(contentType)) {
      throw new HttpsError("invalid-argument", "Only image or PDF receipts are allowed");
    }

    if (declaredSize > PAYMENT_UPLOAD_MAX_BYTES) {
      throw new HttpsError("invalid-argument", "Receipt file exceeds the 10 MB limit");
    }

    let buffer;
    try {
      buffer = Buffer.from(base64, "base64");
    } catch {
      throw new HttpsError("invalid-argument", "Receipt file data is invalid");
    }

    if (!buffer.length || buffer.length > PAYMENT_UPLOAD_MAX_BYTES) {
      throw new HttpsError("invalid-argument", "Receipt file exceeds the 10 MB limit");
    }

    const safeName = safeUploadFileName(originalFileName) || "receipt";
    const storagePath = `${folder}/${leadId}/${Date.now()}-${safeName}`;
    const token = crypto.randomUUID();
    const bucket = getStorage().bucket();
    const file = bucket.file(storagePath);

    try {
      await file.save(buffer, {
        resumable: false,
        contentType,
        metadata: {
          cacheControl: "private, max-age=0, no-transform",
          metadata: {
            firebaseStorageDownloadTokens: token,
            leadId,
            paymentFileKind: kind,
            uploadedByUid: actor.uid,
            uploadedByUserId: actor.id,
            originalFileName
          }
        }
      });
    } catch (error) {
      console.error("Payment receipt Admin Storage upload failed", {
        message: error?.message,
        code: error?.code,
        leadId,
        kind
      });
      throw new HttpsError("internal", "Secure receipt upload failed");
    }

    const encodedPath = encodeURIComponent(storagePath);
    const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${token}`;

    return {
      url,
      fileName: originalFileName,
      storagePath,
      contentType,
      size: buffer.length
    };
  }
);


/* =====================================================
   BREVO TRANSACTIONAL EMAIL DELIVERY WEBHOOK
   ===================================================== */

function cleanWebhookText(value) {
  return String(value === undefined || value === null ? "" : value).trim();
}

function normalizeBrevoTags(payload = {}) {
  const tags = [];
  const direct = payload.tags;

  if (Array.isArray(direct)) {
    direct.forEach(tag => tags.push(cleanWebhookText(tag)));
  } else if (direct) {
    tags.push(cleanWebhookText(direct));
  }

  const legacyTag = payload.tag;
  if (Array.isArray(legacyTag)) {
    legacyTag.forEach(tag => tags.push(cleanWebhookText(tag)));
  } else if (legacyTag) {
    const raw = cleanWebhookText(legacyTag);
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) parsed.forEach(tag => tags.push(cleanWebhookText(tag)));
      else tags.push(raw);
    } catch {
      tags.push(raw);
    }
  }

  return Array.from(new Set(tags.filter(Boolean)));
}

function getBrevoTagValue(tags, prefix) {
  const match = tags.find(tag => tag.startsWith(prefix));
  return match ? match.slice(prefix.length) : "";
}

function getBrevoEventTime(payload = {}) {
  const millis = Number(payload.ts_epoch || 0);
  if (Number.isFinite(millis) && millis > 0) {
    return admin.firestore.Timestamp.fromMillis(millis);
  }

  const seconds = Number(payload.ts_event || payload.ts || 0);
  if (Number.isFinite(seconds) && seconds > 0) {
    return admin.firestore.Timestamp.fromMillis(seconds * 1000);
  }

  return admin.firestore.Timestamp.now();
}

function getBrevoDeliveryStatus(eventName = "") {
  const event = cleanWebhookText(eventName).toLowerCase();

  if (["request", "sent"].includes(event)) return "accepted";
  if (event === "delivered") return "delivered";
  if (event === "deferred") return "deferred";
  if (event === "soft_bounce") return "soft_bounce";
  if (event === "hard_bounce") return "hard_bounce";
  if (event === "blocked") return "blocked";
  if (event === "invalid_email") return "invalid_email";
  if (["spam", "complaint"].includes(event)) return "spam";
  if (event === "unsubscribed") return "unsubscribed";
  if (event === "error") return "failed";

  return "";
}

function getEmailDeliveryRank(status = "") {
  const ranks = {
    submission_failed: 5,
    accepted: 10,
    deferred: 20,
    soft_bounce: 30,
    delivered: 40,
    failed: 50,
    hard_bounce: 60,
    blocked: 60,
    invalid_email: 60,
    spam: 70,
    unsubscribed: 70
  };

  return ranks[cleanWebhookText(status).toLowerCase()] || 0;
}

function getBrevoFailureReason(payload = {}) {
  return cleanWebhookText(
    payload.reason ||
    payload.response ||
    payload.message ||
    payload.error ||
    payload.description
  );
}

function isWebhookTokenValid(req) {
  const configured = cleanWebhookText(BREVO_WEBHOOK_SECRET.value());
  if (!configured) return false;

  const supplied = cleanWebhookText(
    req.query?.token ||
    req.get?.("x-dreamtrawell-webhook-token")
  );

  if (!supplied) return false;

  const expectedBuffer = Buffer.from(configured);
  const suppliedBuffer = Buffer.from(supplied);
  if (expectedBuffer.length !== suppliedBuffer.length) return false;

  return crypto.timingSafeEqual(expectedBuffer, suppliedBuffer);
}

async function recordBrevoEventOnDocument({ docRef, payload, eventName, messageId, tags }) {
  if (!docRef) return;

  const eventTime = getBrevoEventTime(payload);
  const deliveryStatus = getBrevoDeliveryStatus(eventName);
  const reason = getBrevoFailureReason(payload);
  const recipient = cleanWebhookText(payload.email);
  const subject = cleanWebhookText(payload.subject);
  const mirrorLink = cleanWebhookText(payload.mirror_link);
  const sendingIp = cleanWebhookText(payload.sending_ip);
  const currentSnap = await docRef.get();
  const currentData = currentSnap.exists ? currentSnap.data() : {};
  const currentStatus = cleanWebhookText(currentData?.emailDeliveryStatus || currentData?.emailStatus);
  const currentMessageId = cleanWebhookText(currentData?.emailProviderMessageId);
  const isCurrentMessage = !currentMessageId || !messageId || currentMessageId === messageId;
  const shouldPromoteDeliveryStatus =
    isCurrentMessage &&
    deliveryStatus &&
    getEmailDeliveryRank(deliveryStatus) >= getEmailDeliveryRank(currentStatus);

  const update = {
    emailProvider: "brevo",
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  if (messageId) {
    update.emailProviderMessageIds = admin.firestore.FieldValue.arrayUnion(messageId);
  }

  // A quotation/request can be resent. Keep old-message webhook events in the
  // event history without allowing them to overwrite the latest attempt.
  if (isCurrentMessage) {
    update.emailLastEvent = eventName;
    update.emailLastEventAt = eventTime;
    update.emailRecipient = recipient;
    if (subject) update.emailSubject = subject;
    if (messageId) update.emailProviderMessageId = messageId;
    if (mirrorLink) update.emailBrevoPreviewUrl = mirrorLink;
    if (sendingIp) update.emailSendingIp = sendingIp;

    if (shouldPromoteDeliveryStatus) {
      update.emailStatus = deliveryStatus;
      update.emailDeliveryStatus = deliveryStatus;
    }

    if (reason && shouldPromoteDeliveryStatus) {
      update.emailError = reason;
      update.emailDeliveryReason = reason;
    } else if (shouldPromoteDeliveryStatus && ["accepted", "delivered"].includes(deliveryStatus)) {
      update.emailError = "";
      update.emailDeliveryReason = "";
    }

    if (eventName === "delivered") update.emailDeliveredAt = eventTime;
    if (eventName === "deferred") update.emailDeferredAt = eventTime;
    if (eventName === "soft_bounce") update.emailSoftBounceAt = eventTime;
    if (eventName === "hard_bounce") update.emailHardBounceAt = eventTime;
    if (eventName === "blocked") update.emailBlockedAt = eventTime;
    if (eventName === "invalid_email") update.emailInvalidAt = eventTime;
    if (["spam", "complaint"].includes(eventName)) update.emailSpamAt = eventTime;
    if (["opened", "unique_opened", "proxy_open"].includes(eventName)) {
      update.emailOpenedAt = eventTime;
    }
    if (["click", "clicked"].includes(eventName)) {
      update.emailClickedAt = eventTime;
    }
  }

  await docRef.set(update, { merge: true });

  await docRef.collection("emailEvents").add({
    provider: "brevo",
    event: eventName,
    deliveryStatus: deliveryStatus || null,
    email: recipient,
    subject,
    messageId,
    reason,
    mirrorLink,
    sendingIp,
    tags,
    providerEventId: payload.id || null,
    providerTimestamp: eventTime,
    receivedAt: admin.firestore.FieldValue.serverTimestamp()
  });
}



/* =========================
   AUTHENTICATED BREVO EMAIL SEND
   ========================= */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_SUBJECT_LENGTH = 180;
const MAX_EMAIL_HTML_BYTES = 1_500_000;
const MAX_EMAIL_TEXT_BYTES = 500_000;
const MAX_EMAIL_COPY_RECIPIENTS = 12;

function cleanEmailText(value = "") {
  return String(value === undefined || value === null ? "" : value).trim();
}

function normalizeEmailAddress(value = "") {
  return cleanEmailText(value).toLowerCase();
}

function validEmailAddress(value = "") {
  return EMAIL_RE.test(normalizeEmailAddress(value));
}

function normalizeBrevoRecipientList(list = []) {
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => {
      if (typeof item === "string") {
        return { email: normalizeEmailAddress(item), name: "" };
      }
      return {
        email: normalizeEmailAddress(item?.email),
        name: cleanEmailText(item?.name).slice(0, 120)
      };
    })
    .filter((item) => item.email && validEmailAddress(item.email));
}

function dedupeBrevoRecipients({ toEmail, cc = [], bcc = [] }) {
  const used = new Set([normalizeEmailAddress(toEmail)].filter(Boolean));
  const uniqueCc = [];
  const uniqueBcc = [];

  cc.forEach((item) => {
    const email = normalizeEmailAddress(item?.email);
    if (!email || used.has(email)) return;
    used.add(email);
    uniqueCc.push({ ...item, email });
  });

  bcc.forEach((item) => {
    const email = normalizeEmailAddress(item?.email);
    if (!email || used.has(email)) return;
    used.add(email);
    uniqueBcc.push({ ...item, email });
  });

  return { cc: uniqueCc, bcc: uniqueBcc };
}

function normalizeBrevoTags(tags = []) {
  if (!Array.isArray(tags)) return [];
  return Array.from(new Set(tags
    .map((tag) => cleanEmailText(tag))
    .filter(Boolean)
    .map((tag) => tag.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64))
    .filter(Boolean)
  )).slice(0, 20);
}

function emailHtmlToText(html = "") {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#039;/gi, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function emailByteSize(value = "") {
  return Buffer.byteLength(String(value || ""), "utf8");
}

function getBrevoSender(emailType = "transactional") {
  const normalizedType = cleanEmailText(emailType).toLowerCase() === "engagement"
    ? "engagement"
    : "transactional";

  const email = normalizeEmailAddress(
    normalizedType === "engagement"
      ? (process.env.BREVO_ENGAGEMENT_SENDER_EMAIL || process.env.BREVO_SENDER_EMAIL || "outbound@dreamtrawelldestination.com")
      : (process.env.BREVO_TRANSACTIONAL_SENDER_EMAIL || process.env.BREVO_SENDER_EMAIL || "outbound@dreamtrawelldestination.com")
  );

  const name = cleanEmailText(
    normalizedType === "engagement"
      ? (process.env.BREVO_ENGAGEMENT_SENDER_NAME || process.env.BREVO_SENDER_NAME || "DreamTrawell Destination")
      : (process.env.BREVO_TRANSACTIONAL_SENDER_NAME || process.env.BREVO_SENDER_NAME || "DreamTrawell Destination")
  );

  return { emailType: normalizedType, email, name };
}

exports.sendBrevoEmail = onCall(
  { secrets: [BREVO_API_KEY], timeoutSeconds: 60, memory: "256MiB" },
  async (request) => {
    const actor = await getLoggedInUser(request.auth);
    if (actor.active === false) {
      throw new HttpsError("permission-denied", "Only active CRM users can send email");
    }

    const data = request.data || {};
    const apiKey = cleanEmailText(BREVO_API_KEY.value());
    if (!apiKey) {
      throw new HttpsError(
        "failed-precondition",
        "BREVO_API_KEY is not configured in Firebase Functions"
      );
    }

    const toEmail = normalizeEmailAddress(data.toEmail);
    const toName = cleanEmailText(data.toName).slice(0, 120);
    const subject = cleanEmailText(data.subject);
    const html = String(data.html || "").trim();
    const text = String(data.text || "").trim();
    const sender = getBrevoSender(data.emailType);

    if (!toEmail || !validEmailAddress(toEmail)) {
      throw new HttpsError("invalid-argument", "Recipient email is missing or invalid");
    }
    if (!subject || subject.length > MAX_EMAIL_SUBJECT_LENGTH) {
      throw new HttpsError(
        "invalid-argument",
        `Subject is required and must be ${MAX_EMAIL_SUBJECT_LENGTH} characters or fewer`
      );
    }
    if (!html) {
      throw new HttpsError("invalid-argument", "Email body is required");
    }
    if (!sender.email || !validEmailAddress(sender.email)) {
      throw new HttpsError("failed-precondition", "Brevo sender email is missing or invalid");
    }
    if (emailByteSize(html) > MAX_EMAIL_HTML_BYTES || emailByteSize(text) > MAX_EMAIL_TEXT_BYTES) {
      throw new HttpsError(
        "invalid-argument",
        "Email body is too large. Use hosted links for large images/files."
      );
    }
    if (/src\s*=\s*["']data:/i.test(html)) {
      throw new HttpsError(
        "invalid-argument",
        "Embedded base64 images are not allowed. Use hosted HTTPS images."
      );
    }

    const normalizedCc = normalizeBrevoRecipientList(data.cc);
    const normalizedBcc = normalizeBrevoRecipientList(data.bcc);
    const recipients = dedupeBrevoRecipients({
      toEmail,
      cc: normalizedCc,
      bcc: normalizedBcc
    });

    if (recipients.cc.length + recipients.bcc.length > MAX_EMAIL_COPY_RECIPIENTS) {
      throw new HttpsError(
        "invalid-argument",
        `Too many CC/BCC recipients. Maximum ${MAX_EMAIL_COPY_RECIPIENTS}.`
      );
    }

    const tags = normalizeBrevoTags([
      ...(Array.isArray(data.tags) ? data.tags : []),
      `emailtype_${sender.emailType}`
    ]);

    const payload = {
      sender: { email: sender.email, name: sender.name },
      to: [{ email: toEmail, name: toName }],
      subject,
      htmlContent: html,
      textContent: text || emailHtmlToText(html),
      tags
    };

    if (recipients.cc.length) payload.cc = recipients.cc;
    if (recipients.bcc.length) payload.bcc = recipients.bcc;

    const replyToEmail = normalizeEmailAddress(data?.replyTo?.email);
    if (replyToEmail && validEmailAddress(replyToEmail)) {
      payload.replyTo = {
        email: replyToEmail,
        name: cleanEmailText(data?.replyTo?.name).slice(0, 120)
      };
    }

    let response;
    let rawResponse = "";
    try {
      response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "api-key": apiKey
        },
        body: JSON.stringify(payload)
      });
      rawResponse = await response.text();
    } catch (error) {
      console.error("Brevo network failure", {
        message: error?.message || String(error),
        toEmail,
        requestedByUid: request.auth?.uid || ""
      });
      throw new HttpsError(
        "unavailable",
        "Unable to connect to Brevo. Please try again."
      );
    }

    let result = {};
    if (rawResponse) {
      try {
        result = JSON.parse(rawResponse);
      } catch {
        result = { raw: rawResponse.slice(0, 1000) };
      }
    }

    if (!response.ok) {
      const providerMessage = cleanEmailText(result?.message || result?.code || result?.raw);
      console.error("Brevo API error", {
        status: response.status,
        providerMessage,
        toEmail,
        subject,
        emailType: sender.emailType,
        requestedByUid: request.auth?.uid || "",
        tags
      });

      throw new HttpsError(
        response.status === 400 ? "invalid-argument" : "internal",
        providerMessage || `Brevo rejected the email (HTTP ${response.status})`,
        {
          provider: "brevo",
          providerStatus: response.status,
          providerCode: cleanEmailText(result?.code),
          providerMessage: providerMessage || ""
        }
      );
    }

    const messageId = cleanEmailText(result?.messageId);
    console.info("Brevo email accepted", {
      messageId,
      toEmail,
      emailType: sender.emailType,
      requestedByUid: request.auth?.uid || "",
      tags
    });

    return {
      success: true,
      accepted: true,
      deliveryStatus: "accepted",
      provider: "brevo",
      messageId,
      transportVersion: "2.7.5.10.4",
      emailType: sender.emailType,
      senderDomain: sender.email.split("@")[1] || ""
    };
  }
);

exports.brevoEmailWebhook = onRequest(
  { secrets: [BREVO_WEBHOOK_SECRET] },
  async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  if (!isWebhookTokenValid(req)) {
    console.warn("Rejected Brevo webhook: invalid or missing BREVO_WEBHOOK_SECRET/token");
    res.status(401).send("Unauthorized");
    return;
  }

  let payload = req.body || {};
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      res.status(400).send("Invalid JSON");
      return;
    }
  }

  const eventName = cleanWebhookText(payload.event).toLowerCase();
  const messageId = cleanWebhookText(payload["message-id"] || payload.messageId);
  const tags = normalizeBrevoTags(payload);

  const leadId = getBrevoTagValue(tags, "lead_");
  const quotationId = getBrevoTagValue(tags, "quotation_");
  const vendorRequestId = getBrevoTagValue(tags, "vendorrequest_");

  if (!eventName) {
    res.status(400).send("Missing event");
    return;
  }

  try {
    const db = admin.firestore();
    let targetRef = null;
    let targetType = "";

    if (leadId && quotationId) {
      targetRef = db.collection("leads").doc(leadId).collection("quotations").doc(quotationId);
      targetType = "quotation";
    } else if (leadId && vendorRequestId) {
      targetRef = db.collection("leads").doc(leadId).collection("vendorRequests").doc(vendorRequestId);
      targetType = "vendor_request";
    }

    if (!targetRef) {
      console.warn("Brevo webhook could not identify CRM document", {
        eventName,
        messageId,
        tags,
        email: payload.email
      });
      res.status(202).json({ success: true, matched: false });
      return;
    }

    await recordBrevoEventOnDocument({
      docRef: targetRef,
      payload,
      eventName,
      messageId,
      tags
    });

    const leadRef = db.collection("leads").doc(leadId);
    const leadEventUpdate = {
      lastEmailDeliveryType: targetType,
      lastEmailDeliveryStatus: getBrevoDeliveryStatus(eventName) || eventName,
      lastEmailDeliveryEvent: eventName,
      lastEmailDeliveryAt: getBrevoEventTime(payload),
      lastEmailDeliveryRecipient: cleanWebhookText(payload.email),
      lastEmailDeliveryReason: getBrevoFailureReason(payload),
      lastEmailProviderMessageId: messageId,
      lastEmailSendingIp: cleanWebhookText(payload.sending_ip),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (targetType === "quotation") {
      leadEventUpdate.lastQuotationEmailDeliveryStatus =
        getBrevoDeliveryStatus(eventName) || eventName;
      leadEventUpdate.lastQuotationEmailEventAt = getBrevoEventTime(payload);
      leadEventUpdate.lastQuotationEmailQuotationId = quotationId;
    } else {
      leadEventUpdate.lastVendorEmailDeliveryStatus =
        getBrevoDeliveryStatus(eventName) || eventName;
      leadEventUpdate.lastVendorEmailEventAt = getBrevoEventTime(payload);
      leadEventUpdate.lastVendorEmailRequestId = vendorRequestId;
    }

    await leadRef.set(leadEventUpdate, { merge: true });

    res.status(200).json({ success: true, matched: true, targetType });
  } catch (error) {
    console.error("Brevo webhook processing failed", {
      message: error?.message,
      eventName,
      messageId,
      tags
    });
    res.status(500).send("Webhook processing failed");
  }
  });
