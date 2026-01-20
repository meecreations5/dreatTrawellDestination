//lib/generateTravelAgentCode.js

import { db } from "@/lib/firebase";
import { doc, runTransaction } from "firebase/firestore";

export async function generateTravelAgentCode() {
  const ref = doc(db, "counters", "travelAgents");

  return await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    const current = snap.exists() ? snap.data().current : 0;
    const next = current + 1;

    tx.set(ref, { current: next }, { merge: true });

    return `DT-TA-${String(next).padStart(4, "0")}`;
  });
}
