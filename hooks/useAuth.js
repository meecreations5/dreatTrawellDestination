"use client";

import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";

export function useAuth() {
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setUser(null);
        return;
      }

      console.log("🔥 AUTH UID:", fbUser.uid);

      const ref = doc(db, "users", fbUser.uid);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        console.error("❌ USER DOC NOT FOUND");
        setUser(null);
        return;
      }

      const data = snap.data();

      console.log("🔥 FIRESTORE DATA KEYS:", Object.keys(data));
      console.log("🔥 FULL FIRESTORE DATA:", data);

      setUser({
        uid: fbUser.uid,
        email: fbUser.email,
        ...data // 👈 spread EVERYTHING
      });
    });

    return () => unsub();
  }, []);

  return { user, loading: user === undefined };
}
