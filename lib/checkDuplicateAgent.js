// lib/checkDuplicateAgent.js

import {
  collection,
  getDocs,
  query,
  where
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * Normalize values before comparison
 */
export const normalize = v => (v || "").trim().toLowerCase();

/**
 * Duplicate check based ONLY on generic contact
 * - genericContact.phone
 * - genericContact.email
 */
export async function checkDuplicateAgent(
  phone,
  email,
  excludeId = null
) {
  const ref = collection(db, "travelAgents");
  const queries = [];

  if (phone) {
    queries.push(
      getDocs(query(ref, where("genericContact.phone", "==", phone)))
    );
  }

  if (email) {
    queries.push(
      getDocs(query(ref, where("genericContact.email", "==", email)))
    );
  }

  const results = await Promise.all(queries);

  for (const snap of results) {
    for (const doc of snap.docs) {
      // Allow same record in edit mode
      if (!excludeId || doc.id !== excludeId) {
        return true; // 🚫 DUPLICATE FOUND
      }
    }
  }

  return false; // ✅ SAFE
}
