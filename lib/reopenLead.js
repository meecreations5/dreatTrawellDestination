import {
  doc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
  Timestamp
} from "firebase/firestore";
import { db } from "./firebase";
import { logLeadAction, LEAD_TIMELINE_TYPES } from "./logLeadAction";

export async function reopenLead({
  leadId,
  user,
  reason
}) {
  if (!user || user.role !== "admin") {
    throw new Error("Only admin can reopen a lead");
  }

  if (!reason || !reason.trim()) {
    throw new Error("Reopen reason is mandatory");
  }

  const ref = doc(db, "leads", leadId);

  await updateDoc(ref, {
    stage: "follow_up",
    status: "open",

    stageHistory: arrayUnion({
      stage: "reopened",
      remark: reason,
      changedAt: Timestamp.now(),
      changedBy: user.email,
      changedByUid: user.uid
    }),

    updatedAt: serverTimestamp()
  });

  await logLeadAction({
    leadId,
    type: LEAD_TIMELINE_TYPES.STAGE_CHANGED,
    title: "Lead Reopened",
    description: reason,
    metadata: {
      from: "closed",
      to: "follow_up"
    },
    user
  });
}
