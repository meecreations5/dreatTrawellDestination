// lib/auth.js

import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { auth, db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";

export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);

  const email = result.user.email;
  const ref = doc(db, "users", email);
  const snap = await getDoc(ref);

  // User must exist in Firestore
  if (!snap.exists()) {
    await signOut(auth);
    throw new Error("User not registered");
  }

  const user = snap.data();

  // User must be active
  if (!user.active) {
    await signOut(auth);
    throw new Error("User is inactive");
  }

  // ✅ NO ROLE CHECK HERE
  return {
    email,
    ...user
  };
}

export function logout() {
  return signOut(auth);
}
