import {
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
  Timestamp
} from "firebase/firestore";
import { db } from "./firebase";
import { logLeadAction, LEAD_TIMELINE_TYPES } from "./logLeadAction";
import { canAccessRecord } from "./rolePermissions";

export async function reopenLead({
  leadId,
  user,
  reason
}) {
  if (!reason || !reason.trim()) {
    throw new Error("Reopen reason is mandatory");
  }

  const ref = doc(db, "leads", leadId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    throw new Error("Lead not found");
  }

  const lead = { id: snap.id, ...snap.data() };
  if (!canAccessRecord(user, "leads.reopen", lead, "lead")) {
    throw new Error("You do not have permission to reopen this lead.");
  }

  await updateDoc(ref, {
    stage: "follow_up",
    status: "open",

    // Clear the active closure snapshot when reopening. Historical closure remains
    // preserved in stageHistory / timeline entries.
    closureType: null,
    closureDate: null,
    closureReason: null,
    closureReasonLabel: null,
    closureNote: null,
    closedAt: null,
    closedByUid: null,
    closedByName: null,
    lostReason: null,
    lostReasonLabel: null,
    cancelReason: null,
    cancelReasonLabel: null,

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
