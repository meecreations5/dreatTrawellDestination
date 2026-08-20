"use client";

import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  limit,
  onSnapshot,
  query,
  updateDoc,
  where
} from "firebase/firestore";
import { useSyncExternalStore } from "react";
import {
  getEffectiveAccessMap,
  getEffectiveLegacyPermissions,
  resolveUserRole
} from "@/lib/rolePermissions";

/*
 * Browser-wide auth/profile store.
 *
 * Access is role based, so no repeating permission timers are needed. One Auth
 * listener and one Firestore profile listener are shared by the whole tab.
 */
let sharedUser = undefined;
let storeStarted = false;
let authUnsub = null;
let profileUnsub = null;
let authGeneration = 0;
const subscribers = new Set();

function emitUser(nextUser) {
  sharedUser = nextUser;
  subscribers.forEach(listener => listener());
}

function getSnapshot() {
  return sharedUser;
}

function getServerSnapshot() {
  return undefined;
}

function getFirebaseUserEmail(firebaseUser) {
  const rawEmail =
    firebaseUser?.email ||
    firebaseUser?.providerData?.[0]?.email ||
    null;

  if (!rawEmail) return null;
  return rawEmail.trim().toLowerCase();
}

function resolveStoredRole(data = {}) {
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

function buildEffectiveUser(baseUser) {
  return {
    ...baseUser,
    permissions: getEffectiveLegacyPermissions(baseUser),
    effectiveAccess: getEffectiveAccessMap(baseUser)
  };
}

function subscribe(listener) {
  subscribers.add(listener);
  startAuthStore();

  return () => {
    subscribers.delete(listener);
  };
}

function startAuthStore() {
  if (storeStarted || typeof window === "undefined" || !auth || !db) return;
  storeStarted = true;

  authUnsub = onAuthStateChanged(auth, async fbUser => {
    const generation = ++authGeneration;

    if (fbUser && sharedUser?.uid && sharedUser.uid !== fbUser.uid) {
      emitUser(undefined);
    }

    profileUnsub?.();
    profileUnsub = null;

    if (!fbUser) {
      emitUser(null);
      return;
    }

    try {
      await fbUser.reload();
      if (generation !== authGeneration) return;

      const currentUser = auth.currentUser || fbUser;
      const email = getFirebaseUserEmail(currentUser);

      if (!email) {
        console.error("AUTH EMAIL NOT FOUND", { uid: currentUser?.uid });
        emitUser(null);
        return;
      }

      const userQuery = query(
        collection(db, "users"),
        where("email", "==", email),
        limit(10)
      );

      profileUnsub = onSnapshot(
        userQuery,
        async snap => {
          if (generation !== authGeneration) return;

          if (snap.empty) {
            console.error("USER DOC NOT FOUND FOR EMAIL:", email);
            emitUser(null);
            return;
          }

          const userDoc = pickCanonicalUserDoc(snap.docs, currentUser.uid);
          if (!userDoc) {
            emitUser(null);
            return;
          }
          const data = userDoc.data();
          const role = resolveStoredRole(data);
          const isSuperAdmin = role === "super_admin";
          const isAdmin = role === "super_admin" || role === "admin";

          const baseUser = {
            id: userDoc.id,
            ...data,
            uid: currentUser.uid,
            email,
            role,
            isAdmin,
            isSuperAdmin,
            active: data.active !== false
          };

          emitUser(buildEffectiveUser(baseUser));

          // Keep legacy identity flags normalized without changing the login flow.
          const updates = {};
          // Authentication/profile reads must never rewrite authorization fields.
          // Older CRM builds used to normalize unknown roles here and could
          // overwrite Operation Executive back to Employee. Only identity
          // linking/default-active maintenance remains client-side.
          if (data.uid !== currentUser.uid) updates.uid = currentUser.uid;
          if (data.active === undefined) updates.active = true;

          if (Object.keys(updates).length > 0) {
            try {
              await updateDoc(userDoc.ref, {
                ...updates,
                updatedAt: new Date()
              });
            } catch (updateError) {
              console.error("AUTH PROFILE NORMALIZATION ERROR:", updateError);
            }
          }
        },
        err => {
          if (generation !== authGeneration) return;
          console.error("AUTH PROFILE LISTENER ERROR:", err);
          emitUser(null);
        }
      );
    } catch (err) {
      if (generation !== authGeneration) return;
      console.error("AUTH LOAD ERROR:", err);
      emitUser(null);
    }
  });
}

export function useAuth() {
  const user = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return {
    user,
    loading: user === undefined
  };
}

export function __resetAuthStoreForTests() {
  authGeneration += 1;
  profileUnsub?.();
  authUnsub?.();
  profileUnsub = null;
  authUnsub = null;
  storeStarted = false;
  sharedUser = undefined;
}
