"use client";

import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  updateDoc,
  where
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { getPermissionsByRole } from "@/lib/rolePermissions";

function getFirebaseUserEmail(firebaseUser) {
  const rawEmail =
    firebaseUser?.email ||
    firebaseUser?.providerData?.[0]?.email ||
    null;

  if (!rawEmail) return null;

  return rawEmail.trim().toLowerCase();
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

function samePermissions(a = {}, b = {}) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function useAuth() {
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setUser(null);
        return;
      }

      try {
        await fbUser.reload();

        const currentUser = auth.currentUser || fbUser;
        const email = getFirebaseUserEmail(currentUser);

        if (!email) {
          console.error("AUTH EMAIL NOT FOUND", {
            uid: currentUser?.uid,
            email: currentUser?.email,
            providerData: currentUser?.providerData
          });

          setUser(null);
          return;
        }

        const snap = await getDocs(
          query(
            collection(db, "users"),
            where("email", "==", email)
          )
        );

        if (snap.empty) {
          console.error("USER DOC NOT FOUND FOR EMAIL:", email);
          setUser(null);
          return;
        }

        const userDoc = snap.docs[0];
        const data = userDoc.data();

        const role = normalizeRole(data);
        const permissions = getPermissionsByRole(role);

        const isSuperAdmin = role === "super_admin";
        const isAdmin = role === "super_admin" || role === "admin";

        const updates = {};

        if (data.uid !== currentUser.uid) {
          updates.uid = currentUser.uid;
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

        if (
          !data.permissions ||
          !samePermissions(data.permissions, permissions)
        ) {
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

        setUser({
          id: userDoc.id,
          ...data,
          uid: currentUser.uid,
          email,
          role,
          isAdmin,
          isSuperAdmin,
          permissions,
          active: data.active !== false
        });
      } catch (err) {
        console.error("AUTH LOAD ERROR:", err);
        setUser(null);
      }
    });

    return () => unsub();
  }, []);

  return {
    user,
    loading: user === undefined
  };
}