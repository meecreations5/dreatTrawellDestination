// lib/logFollowUp.js

import {
  addDoc,
  collection,
  serverTimestamp,
  doc,
  updateDoc
} from "firebase/firestore";
import { db } from "./firebase";
import { logLeadAction } from "./logLeadAction";
import { LEAD_EVENTS } from "./leadEvents";

export async function logFollowUp({
  leadId,
  channel,
  outcome,
  summary = "",
  nextFollowUpAt = null,
  user
}) {
  if (!leadId || !channel || !outcome || !user) {
    throw new Error("logFollowUp: missing required fields");
  }

  const now = serverTimestamp();

  /* 1️⃣ SAVE FOLLOW-UP */
  await addDoc(
    collection(db, "leads", leadId, "followUps"),
    {
      channel,
      outcome,
      summary,
      nextFollowUpAt,
      createdByUid: user.uid,
      createdByEmail: user.email,
      createdAt: now
    }
  );

  /* 2️⃣ UPDATE LEAD (CANONICAL NEXT ACTION) */
  const leadUpdate = {
    updatedAt: now
  };

  if (nextFollowUpAt) {
    leadUpdate.nextActionDueAt = nextFollowUpAt;
    leadUpdate.nextActionType = "follow_up";
  }

  // Stage logic
  if (outcome === "quote_requested") {
    leadUpdate.stage = "quoted";
    leadUpdate.status = "open";
  }

  if (outcome === "interested") {
    leadUpdate.stage = "follow_up";
    leadUpdate.status = "open";
  }

  if (["lost", "not_interested"].includes(outcome)) {
    leadUpdate.stage = "closed_lost";
    leadUpdate.status = "closed";
    leadUpdate.nextActionDueAt = null;
    leadUpdate.nextActionType = null;
  }

  await updateDoc(doc(db, "leads", leadId), leadUpdate);

  /* 3️⃣ TIMELINE */
  await logLeadAction({
    leadId,
    type: LEAD_EVENTS.FOLLOW_UP,
    title: `Follow-up via ${channel.toUpperCase()}`,
    description: summary || outcome.replace("_", " "),
    metadata: {
      channel,
      outcome,
      nextFollowUpAt
    },
    user
  });
}
