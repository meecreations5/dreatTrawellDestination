import {
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
  Timestamp
} from "firebase/firestore";
import { db } from "./firebase";

export async function markOverdueLeads() {
  const now = Timestamp.now();

  const snap = await getDocs(
    query(
      collection(db, "leads"),
      where("nextActionDueAt", "<", now),
      where("status", "==", "open")
    )
  );

  snap.docs.forEach(d =>
    updateDoc(doc(db, "leads", d.id), {
      isOverdue: true
    })
  );
}
