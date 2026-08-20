// lib/getCommunicationTemplates.js

import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "./firebase";

export async function getActiveTemplates() {
  const q = query(
    collection(db, "communicationTemplates"),
    where("active", "==", true)
  );

  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
