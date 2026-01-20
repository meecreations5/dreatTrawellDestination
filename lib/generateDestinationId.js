//lib/generateDestination.js

import { db } from "@/lib/firebase";
import { doc, runTransaction } from "firebase/firestore";

export async function generateDestinationId() {
  const ref = doc(db, "counters", "destinations");

  return await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const last = snap.exists() ? snap.data().current : 0;
    const next = last + 1;

    tx.set(ref, { current: next }, { merge: true });

    return `DST-${String(next).padStart(4, "0")}`;
  });
}
