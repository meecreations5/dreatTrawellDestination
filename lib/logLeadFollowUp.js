// lib/logLeadFollowUp.js

import {
  addDoc,
  collection,
  doc,
  updateDoc,
  serverTimestamp
} from "firebase/firestore";
import { db } from "./firebase";
import {
  logLeadAction,
  LEAD_TIMELINE_TYPES
} from "./logLeadAction";

/**
 * Log a follow-up action for a lead
 *
 * @param {string} leadId
 * @param {"call"|"whatsapp"|"meeting"} channel
 * @param {string} summary - what was discussed
 * @param {object} user - logged in user
 * @param {Date|null} nextFollowUpAt - optional
 */
export async function logLeadFollowUp({
  leadId,
  channel,
  summary,
  user,
  nextFollowUpAt = null
}) {
  if (!leadId || !channel || !summary) {
    throw new Error("LeadId, channel and summary are required");
  }

  const now = serverTimestamp();

  /* =========================
     SAVE FOLLOW-UP RECORD
  ========================== */
  await addDoc(
    collection(db, "leads", leadId, "followUps"),
    {
      channel, // call | whatsapp | meeting
      summary,
      createdByUid: user.uid,
      createdByEmail: user.email,
      createdAt: now,
      nextFollowUpAt: nextFollowUpAt || null
    }
  );

  /* =========================
     UPDATE LEAD (OPTIONAL NEXT FOLLOW-UP)
  ========================== */
  if (nextFollowUpAt) {
    await updateDoc(doc(db, "leads", leadId), {
      nextFollowUpAt,
      updatedAt: now
    });
  }

  /* =========================
     🔥 LEAD TIMELINE EVENT
  ========================== */
  await logLeadAction({
    leadId,
    type: LEAD_TIMELINE_TYPES.FOLLOW_UP,
    title: `Follow-up via ${channel.toUpperCase()}`,
    description: summary,
    metadata: {
      channel,
      nextFollowUpAt: nextFollowUpAt || null
    },
    user
  });
}
