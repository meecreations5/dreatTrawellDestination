import {
  addDoc,
  collection,
  serverTimestamp,
  updateDoc,
  doc,
  Timestamp
} from "firebase/firestore";
import { db } from "./firebase";
import { generateLeadCode } from "./generateLeadCode";
import {
  logLeadAction,
  // LEAD_TIMELINE_TYPES
} from "./logLeadAction";
import { sendLeadNotifications } from "./sendLeadNotifications";
import { LEAD_EVENTS } from "./leadEvents";
export async function createLeadFromEngagement({
  engagement,
  assignedUser,
  createdUser
}) {
  /* =========================
     VALIDATIONS
  ========================== */
  if (!engagement?.agentId || !engagement?.agentName) {
    throw new Error("Invalid engagement: agent details missing");
  }

  if (!engagement?.destinationName || !engagement?.destinationCode) {
    throw new Error(
      "Cannot create lead: destination missing in engagement"
    );
  }

  const now = serverTimestamp();
  const historyTime = Timestamp.now();

  /* =========================
     LEAD CODE
  ========================== */
  const leadCode = generateLeadCode({
    destination: engagement.destinationCode, // 🔥 CODE ONLY
    agentName: engagement.agentName
  });

  /* =========================
     CREATE LEAD
  ========================== */
  const leadRef = await addDoc(collection(db, "leads"), {
    leadCode,
    source: "engagement",

    engagementId: engagement.id || null,

    agentId: engagement.agentId,
    agentName: engagement.agentName,

    destinationRefId: engagement.destinationRefId || null,
    destinationId: engagement.destinationId || null,
    destinationCode: engagement.destinationCode,
    destinationName: engagement.destinationName,

    spoc: engagement.spoc || null,

    assignedToUid: assignedUser.uid,
    assignedTo: assignedUser.email,
    assignedByUid: createdUser.uid,
    assignedBy: createdUser.email,

    stage: "new",
    status: "open",

    stageHistory: [
      {
        stage: "new",
        changedAt: historyTime,
        changedByUid: createdUser.uid
      }
    ],

    createdByUid: createdUser.uid,
    createdByName: createdUser.name,
    createdAt: now,
    updatedAt: now
  });

  /* =========================
     LEAD TIMELINE
  ========================== */
  await logLeadAction({
    leadId: leadRef.id,
    type: LEAD_EVENTS.CREATED,
    title: "Lead Created",
    description: `Lead ${leadCode} created from engagement`,
    metadata: {
      source: "engagement",
      destinationCode: engagement.destinationCode,
      destinationName: engagement.destinationName
    },
    user: createdUser
  });

  /* =========================
     🔔 NOTIFICATIONS
  ========================== */
  await sendLeadNotifications({
    spoc: engagement.spoc,
    leadCode,
    destinationName: engagement.destinationName
  });

  /* =========================
     LINK ENGAGEMENT → LEAD
  ========================== */
  if (engagement.id) {
    await updateDoc(doc(db, "engagements", engagement.id), {
      leadId: leadRef.id,
      updatedAt: now
    });
  }

  return leadRef.id;
}
