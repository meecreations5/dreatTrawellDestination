"use client";

import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";

function getFirebaseUserEmail(firebaseUser) {
  const rawEmail =
    firebaseUser?.email ||
    firebaseUser?.providerData?.[0]?.email ||
    null;

  if (!rawEmail) return null;

  return rawEmail.trim().toLowerCase();
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
          console.error("❌ AUTH EMAIL NOT FOUND", {
            uid: currentUser?.uid,
            email: currentUser?.email,
            providerData: currentUser?.providerData,
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
          console.error("❌ USER DOC NOT FOUND FOR EMAIL:", email);
          setUser(null);
          return;
        }

        const userDoc = snap.docs[0];
        const data = userDoc.data();

        if (data.uid !== currentUser.uid) {
          await updateDoc(userDoc.ref, {
            uid: currentUser.uid,
            updatedAt: new Date(),
          });
        }

        setUser({
          id: userDoc.id,
          ...data,
          uid: currentUser.uid,
          email,
        });
      } catch (err) {
        console.error("❌ AUTH LOAD ERROR:", err);
        setUser(null);
      }
    });

    return () => unsub();
  }, []);

  return {
    user,
    loading: user === undefined,
  };
}