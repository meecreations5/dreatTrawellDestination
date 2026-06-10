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
import { getPermissionsByRole } from "@/lib/rolePermissions";

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

  const userDoc = snap.docs[0];
  const data = userDoc.data();

  const role = normalizeRole(data);
  const permissions = getPermissionsByRole(role);

  const isSuperAdmin = role === "super_admin";
  const isAdmin = role === "super_admin" || role === "admin";

  const updates = {};

  if (data.uid !== firebaseUser.uid) {
    updates.uid = firebaseUser.uid;
  }

  if (data.role !== role) {
    updates.role = role;
  }

  if (data.isAdmin !== isAdmin) {
    updates.isAdmin = isAdmin;
  }

  if (data.isSuperAdmin !== isSuperAdmin) {
    updates.isSuperAdmin = isSuperAdmin;
  }

  if (!data.permissions) {
    updates.permissions = permissions;
  }

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
    permissions,
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