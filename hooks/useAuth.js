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
  normalizeRole
} from "@/lib/rolePermissions";

/*
 * Browser-wide auth store.
 *
 * useAuth() is used throughout many nested CRM components. Keeping Firebase
 * listeners and permission timers inside every hook instance caused duplicate
 * listeners and repeated user-object replacements. Those updates retriggered
 * page effects and looked like periodic page refreshes.
 *
 * This preserves the existing useAuth() API while sharing one Auth listener and
 * one Firestore user-profile listener for the whole browser tab.
 */

let sharedUser = undefined;
let storeStarted = false;
let authUnsub = null;
let profileUnsub = null;
let accessBoundaryTimer = null;
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
  if (data.role === "super_admin" || data.isSuperAdmin === true) {
    return "super_admin";
  }

  if (data.role === "admin" || data.isAdmin === true) {
    return "admin";
  }

  return normalizeRole(data.role);
}

function toMillis(value) {
  if (!value) return null;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function getNextAccessBoundary(user, now = Date.now()) {
  if (!user?.accessOverrides && !user?.permissionOverrides) return null;

  const overrides = user.accessOverrides || user.permissionOverrides || {};
  let nextBoundary = null;

  Object.values(overrides).forEach(override => {
    if (!override || override.state === "default") return;

    [toMillis(override.accessFrom), toMillis(override.accessUntil)]
      .filter(value => Number.isFinite(value) && value > now)
      .forEach(value => {
        if (nextBoundary === null || value < nextBoundary) {
          nextBoundary = value;
        }
      });
  });

  return nextBoundary;
}

function effectiveSignature(user) {
  if (!user) return "";
  return JSON.stringify({
    permissions: user.permissions || {},
    effectiveAccess: user.effectiveAccess || {}
  });
}

function buildEffectiveUser(baseUser) {
  return {
    ...baseUser,
    permissions: getEffectiveLegacyPermissions(baseUser),
    effectiveAccess: getEffectiveAccessMap(baseUser)
  };
}

function scheduleAccessBoundaryRefresh() {
  if (accessBoundaryTimer) {
    clearTimeout(accessBoundaryTimer);
    accessBoundaryTimer = null;
  }

  if (!sharedUser) return;

  const now = Date.now();
  const nextBoundary = getNextAccessBoundary(sharedUser, now);
  if (!nextBoundary) return;

  const delay = Math.min(
    Math.max(nextBoundary - now + 150, 150),
    2147483000
  );

  accessBoundaryTimer = setTimeout(() => {
    accessBoundaryTimer = null;
    if (!sharedUser) return;

    const nextUser = buildEffectiveUser(sharedUser);
    if (effectiveSignature(nextUser) !== effectiveSignature(sharedUser)) {
      emitUser(nextUser);
    }

    scheduleAccessBoundaryRefresh();
  }, delay);
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

    if (accessBoundaryTimer) {
      clearTimeout(accessBoundaryTimer);
      accessBoundaryTimer = null;
    }

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
        console.error("AUTH EMAIL NOT FOUND", {
          uid: currentUser?.uid,
          email: currentUser?.email,
          providerData: currentUser?.providerData
        });
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

          const userDoc =
            snap.docs.find(item => item.data()?.uid === currentUser.uid) ||
            snap.docs[0];
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

          const updates = {};
          if (data.uid !== currentUser.uid) updates.uid = currentUser.uid;
          if (data.role !== role) updates.role = role;
          if (data.isAdmin !== isAdmin) updates.isAdmin = isAdmin;
          if (data.isSuperAdmin !== isSuperAdmin) updates.isSuperAdmin = isSuperAdmin;
          if (data.active === undefined) updates.active = true;

          emitUser(buildEffectiveUser(baseUser));
          scheduleAccessBoundaryRefresh();

          // Legacy normalization remains non-blocking. This compatibility write
          // may trigger one Firestore snapshot, but never a repeating timer.
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
  if (accessBoundaryTimer) clearTimeout(accessBoundaryTimer);
  profileUnsub = null;
  authUnsub = null;
  accessBoundaryTimer = null;
  storeStarted = false;
  sharedUser = undefined;
}
