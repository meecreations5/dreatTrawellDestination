// lib/createManualLead.js

import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { generateLeadCode } from "./generateLeadCode";
import { sendLeadNotifications } from "./sendLeadNotifications";
import {
  logLeadAction,
} from "./logLeadAction";

import { LEAD_EVENTS } from "./leadEvents";
export async function createManualLead({
  agent,
  spoc,
  destination,
  assignedUser,
  createdUser
}) {
  if (!destination?.code || !destination?.name) {
    throw new Error("Destination missing");
  }

  const leadCode = generateLeadCode({
    destination: destination.code, // 🔥 CODE
    agentName: agent.agencyName
  });

  const leadRef = await addDoc(collection(db, "leads"), {
    leadCode,
    source: "manual",

    agentId: agent.id,
    agentName: agent.agencyName,

    destinationRefId: destination.id,
    destinationId: destination.destinationId,
    destinationCode: destination.code,
    destinationName: destination.name,

    spoc,

    assignedToUid: assignedUser.uid,
    assignedTo: assignedUser.email,
    assignedByUid: createdUser.uid,
    assignedBy: createdUser.email,

    stage: "new",
    status: "open",

    createdByUid: createdUser.uid,
    createdByName: createdUser.name,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  /* =========================
     🔔 NOTIFICATIONS
  ========================== */
  await sendLeadNotifications({
    spoc,
    leadCode,
    destinationName: destination.name
  });

  /* =========================
     TIMELINE
  ========================== */
  await logLeadAction({
    leadId: leadRef.id,
    type: LEAD_EVENTS.CREATED,
    title: "Manual Lead Created",
    description: `Manual lead created for ${destination.name}`,
    metadata: {
      destinationCode: destination.code,
      destinationName: destination.name
    },
    user: createdUser
  });

  return leadRef.id;
}
