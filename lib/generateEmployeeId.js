// lib/generateEmployeeIds.js

import { db } from "@/lib/firebase";
import { doc, runTransaction } from "firebase/firestore";

export async function generateEmployeeId() {
  const ref = doc(db, "counters", "users");

  return await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);

    const last = snap.exists()
      ? snap.data().lastEmployeeNumber
      : 0;

    const next = last + 1;

    tx.set(ref, { lastEmployeeNumber: next }, { merge: true });

    return `DT-EMP-${String(next).padStart(4, "0")}`;
  });
}
