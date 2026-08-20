// lib/getLatestDocumnetVersion.js

import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit
} from "firebase/firestore";
import { db } from "./firebase";

export async function getLatestDocumentVersion(documentId) {
  const q = query(
    collection(db, "documents", documentId, "versions"),
    where("active", "==", true),
    orderBy("version", "desc"),
    limit(1)
  );

  const snap = await getDocs(q);
  if (snap.empty) return null;

  return snap.docs[0].data();
}
