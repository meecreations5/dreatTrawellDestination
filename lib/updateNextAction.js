// lib/updateNextAction.js

import {
  doc,
  updateDoc,
  serverTimestamp
} from "firebase/firestore";
import { db } from "./firebase";
import { logLeadAction } from "./logLeadAction";
import { LEAD_EVENTS } from "./leadEvents";

export async function updateNextAction({
  leadId,
  nextActionType,
  nextActionDueAt,
  user
}) {
  if (!leadId || !user) {
    throw new Error("Missing next action data");
  }

  if (nextActionType && !nextActionDueAt) {
    throw new Error("Due date is required");
  }

  await updateDoc(doc(db, "leads", leadId), {
    nextActionType: nextActionType || null,
    nextActionDueAt: nextActionType ? nextActionDueAt : null,
    updatedAt: serverTimestamp()
  });

  await logLeadAction({
    leadId,
    type: LEAD_EVENTS.REMARK,
    title: "Next Action Updated",
    description: "Manual next action override",
    metadata: {
      nextActionType,
      nextActionDueAt
    },
    user
  });
}
