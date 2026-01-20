import {
  doc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
  Timestamp
} from "firebase/firestore";
import { db } from "./firebase";
import {
  logLeadAction,
  LEAD_TIMELINE_TYPES
} from "./logLeadAction";

const CLOSED_STAGES = ["closed_won", "closed_lost"];

export async function updateLeadStage({
  leadId,
  newStage,
  user,
  remark = ""
}) {
  // 🔒 HARD BUSINESS RULE
  if (CLOSED_STAGES.includes(newStage)) {
    if (!remark || !remark.trim()) {
      throw new Error(
        "Closing remark is mandatory for closed leads"
      );
    }
  }

  const ref = doc(db, "leads", leadId);

  await updateDoc(ref, {
    stage: newStage,
    status: CLOSED_STAGES.includes(newStage)
      ? "closed"
      : "open",

    stageHistory: arrayUnion({
      stage: newStage,
      remark: remark || null,
      changedAt: Timestamp.now(),
      changedBy: user.email,
      changedByUid: user.uid
    }),

    updatedAt: serverTimestamp()
  });

  // 🔥 Timeline (auditable)
  await logLeadAction({
    leadId,
    type: LEAD_TIMELINE_TYPES.STAGE_CHANGED,
    title: "Lead Stage Updated",
    description: CLOSED_STAGES.includes(newStage)
      ? `Lead closed (${newStage.replace("_", " ")})`
      : `Stage changed to ${newStage.replace("_", " ")}`,
    metadata: {
      stage: newStage,
      remark: remark || null
    },
    user
  });
}
