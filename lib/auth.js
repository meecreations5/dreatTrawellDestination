import {
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signOut
} from "firebase/auth";

import { auth, db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  updateDoc,
  where
} from "firebase/firestore";
import {
  getEffectiveAccessMap,
  getEffectiveLegacyPermissions,
  resolveUserRole
} from "@/lib/rolePermissions";

function normalizeEmail(email) {
  return email?.trim().toLowerCase() || "";
}

function getFirebaseUserEmail(firebaseUser) {
  const rawEmail =
    firebaseUser?.email ||
    firebaseUser?.providerData?.[0]?.email ||
    null;

  return normalizeEmail(rawEmail);
}

function normalizeRole(data = {}) {
  return resolveUserRole(data);
}


function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function pickCanonicalUserDoc(docs = [], firebaseUid = "") {
  return [...docs].sort((a, b) => {
    const aData = a.data() || {};
    const bData = b.data() || {};
    const versionDelta = Number(bData.accessVersion || 0) - Number(aData.accessVersion || 0);
    if (versionDelta !== 0) return versionDelta;

    const timeDelta = Math.max(toMillis(bData.accessUpdatedAt), toMillis(bData.updatedAt)) -
      Math.max(toMillis(aData.accessUpdatedAt), toMillis(aData.updatedAt));
    if (timeDelta !== 0) return timeDelta;

    const aUidMatch = firebaseUid && aData.uid === firebaseUid ? 1 : 0;
    const bUidMatch = firebaseUid && bData.uid === firebaseUid ? 1 : 0;
    return bUidMatch - aUidMatch;
  })[0] || null;
}

async function getUserProfileByEmail(firebaseUser, provider) {
  const email = getFirebaseUserEmail(firebaseUser);

  if (!email) {
    throw new Error("Email not found from login provider");
  }

  const snap = await getDocs(
    query(
      collection(db, "users"),
      where("email", "==", email)
    )
  );

  if (snap.empty) {
    await signOut(auth);
    throw new Error("User profile not found. Please contact administrator.");
  }

  const userDoc = pickCanonicalUserDoc(snap.docs, firebaseUser.uid);
  if (!userDoc) {
    await signOut(auth);
    throw new Error("User profile not found. Please contact administrator.");
  }
  const data = userDoc.data();

  const role = normalizeRole(data);
  const isSuperAdmin = role === "super_admin";
  const isAdmin = role === "super_admin" || role === "admin";

  const updates = {};

  if (data.uid !== firebaseUser.uid) {
    updates.uid = firebaseUser.uid;
  }

  // Login/profile reads must not write authorization fields.
  // Role changes are server-managed only.


  if (data.active === undefined) {
    updates.active = true;
  }

  if (Object.keys(updates).length > 0) {
    await updateDoc(userDoc.ref, {
      ...updates,
      updatedAt: new Date()
    });
  }

  return {
    id: userDoc.id,
    ...data,
    uid: firebaseUser.uid,
    email,
    role,
    isAdmin,
    isSuperAdmin,
    permissions: getEffectiveLegacyPermissions({ ...data, role, isAdmin, isSuperAdmin, active: data.active !== false }),
    effectiveAccess: getEffectiveAccessMap({ ...data, role, isAdmin, isSuperAdmin, active: data.active !== false }),
    active: data.active !== false,
    authProvider: data.authProvider || provider
  };
}

export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    prompt: "select_account"
  });

  const result = await signInWithPopup(auth, provider);
  return await getUserProfileByEmail(result.user, "google");
}

export async function loginWithMicrosoft() {
  const provider = new OAuthProvider("microsoft.com");
  provider.setCustomParameters({
    prompt: "select_account"
  });

  const result = await signInWithPopup(auth, provider);
  return await getUserProfileByEmail(result.user, "microsoft");
}

export function getLoginErrorMessage(error) {
  const code = error?.code || "";
  const message = error?.message || "";

  if (code === "auth/popup-closed-by-user") {
    return "Login was cancelled.";
  }

  if (code === "auth/cancelled-popup-request") {
    return "Another login popup is already open.";
  }

  if (code === "auth/account-exists-with-different-credential") {
    return "This email is already linked with another login provider.";
  }

  if (code === "auth/unauthorized-domain") {
    return "This domain is not authorized in Firebase Authentication.";
  }

  if (message) return message;

  return "Login failed. Please try again.";
}