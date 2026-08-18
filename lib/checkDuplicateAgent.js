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
 *
 * Rules:
 * - Create mode (excludeId = null) → ALWAYS ALLOW
 * - Edit mode:
 *   - Same record → ALLOW
 *   - Another agent with same phone/email → BLOCK
 */
export async function checkDuplicateAgent(
  phone,
  email,
  excludeId = null
) {
  // ✅ Create mode → never block
  if (!excludeId) return false;

  const ref = collection(db, "travelAgents");

  const checks = [];

  if (phone) {
    checks.push(
      getDocs(
        query(ref, where("genericContact.phone", "==", phone))
      )
    );
  }

  if (email) {
    checks.push(
      getDocs(
        query(ref, where("genericContact.email", "==", email))
      )
    );
  }

  if (!checks.length) return false;

  const results = await Promise.all(checks);

  for (const snap of results) {
    for (const doc of snap.docs) {
      // ❌ Found another agent with same contact
      if (doc.id !== excludeId) {
        return true;
      }
    }
  }

  return false; // ✅ SAFE
}
