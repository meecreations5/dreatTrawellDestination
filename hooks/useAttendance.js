//hooks/useAttendance.js

"use client";

import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function markAttendance(user) {
  const today = new Date().toISOString().split("T")[0];

  const ref = doc(db, "attendance", user.email, "days", today);
  const snap = await getDoc(ref);

  // Prevent duplicate check-in
  if (snap.exists()) return;

  await setDoc(ref, {
    email: user.email,
    name: user.name,
    mobile: user.mobile,
    role: user.role,
    checkIn: serverTimestamp(),
    status: "Present",
    device: navigator.userAgent
  });
}
