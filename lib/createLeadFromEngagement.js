// lib/createLeadFromEngagement.js

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
import { logLeadAction } from "./logLeadAction";
import { sendLeadNotifications } from "./sendLeadNotifications";
import { LEAD_EVENTS } from "./leadEvents";

/* =========================
   HELPERS
========================= */

function getFirstValue(...values) {
  return (
    values.find(
      value => typeof value === "string" && value.trim().length > 0
    )?.trim() || ""
  );
}

function getUserName(user) {
  return getFirstValue(
    user?.name,
    user?.fullName,
    user?.displayName,
    user?.email
  );
}

function getUserEmail(user) {
  return getFirstValue(
    user?.email,
    user?.workEmail,
    user?.officialEmail
  );
}

function getUserRole(user) {
  return getFirstValue(
    user?.role,
    user?.designation,
    user?.jobTitle
  );
}

function normalizeClientReference(clientReference) {
  const attachments = Array.isArray(clientReference?.attachments)
    ? clientReference.attachments
    : [];

  return {
    source: clientReference?.source || "",
    notes: clientReference?.notes || "",
    notesHtml: clientReference?.notesHtml || "",
    attachments
  };
}

function hasClientReference(clientReference) {
  return Boolean(
    clientReference?.source ||
    clientReference?.notes ||
    clientReference?.notesHtml ||
    clientReference?.attachments?.length
  );
}

function getReferenceDescription(clientReference) {
  if (clientReference?.notes) {
    return clientReference.notes.length > 180
      ? `${clientReference.notes.slice(0, 180)}...`
      : clientReference.notes;
  }

  if (clientReference?.attachments?.length) {
    return `${clientReference.attachments.length} reference file${clientReference.attachments.length === 1 ? "" : "s"
      } attached.`;
  }

  return "Client reference details were added while creating lead from engagement.";
}

/* =========================
   MAIN FUNCTION
========================= */

export async function createLeadFromEngagement({
  engagement,
  assignedUser,
  createdUser,
  clientReference = null
}) {
  /* =========================
     VALIDATIONS
  ========================== */
  if (!engagement?.agentId || !engagement?.agentName) {
    throw new Error("Invalid engagement: agent details missing");
  }

  if (!engagement?.destinationName || !engagement?.destinationCode) {
    throw new Error("Cannot create lead: destination missing in engagement");
  }

  const now = serverTimestamp();
  const historyTime = Timestamp.now();

  const normalizedClientReference =
    normalizeClientReference(clientReference);

  const hasReference =
    hasClientReference(normalizedClientReference);

  const assignedUserUid =
    assignedUser?.uid ||
    assignedUser?.id ||
    "";

  const assignedUserName = getUserName(assignedUser);
  const assignedUserEmail = getUserEmail(assignedUser);
  const assignedUserRole = getUserRole(assignedUser);

  const createdUserUid =
    createdUser?.uid ||
    createdUser?.id ||
    "";

  const createdUserName = getUserName(createdUser);
  const createdUserEmail = getUserEmail(createdUser);

  const spoc = engagement.spoc || null;

  /* =========================
     LEAD CODE
  ========================== */
  const leadCode = generateLeadCode({
    destination: engagement.destinationCode,
    agentName: engagement.agentName
  });

  /* =========================
     CREATE LEAD
  ========================== */
  const leadRef = await addDoc(collection(db, "leads"), {
    leadCode,
    source: "engagement",

    engagementId: engagement.id || null,

    /* =========================
       TRAVEL AGENT
    ========================== */
    agentId: engagement.agentId,
    agentName: engagement.agentName,
    travelAgentName: engagement.agentName,
    agencyName: engagement.agentName,

    /* =========================
       DESTINATION
    ========================== */
    destinationRefId: engagement.destinationRefId || null,
    destinationId:
      engagement.destinationId ||
      engagement.destinationRefId ||
      null,
    destinationCode: engagement.destinationCode,
    destinationName: engagement.destinationName,

    /* =========================
       SPOC / CUSTOMER CONTACT
    ========================== */
    spoc,

    customerName: spoc?.name || "",
    customerEmail: spoc?.email || "",
    customerMobile:
      spoc?.mobile ||
      spoc?.phone ||
      spoc?.whatsapp ||
      "",

    /* =========================
       ASSIGNMENT
    ========================== */
    assignedToUid: assignedUserUid,
    assignedTo: assignedUserEmail || assignedUserUid,
    assignedToName: assignedUserName,
    assignedToEmail: assignedUserEmail,
    assignedToRole: assignedUserRole,

    assignedByUid: createdUserUid,
    assignedBy: createdUserEmail,
    assignedByName: createdUserName,
    assignedAt: now,

    /* =========================
       CLIENT REFERENCE
    ========================== */
    clientReference: normalizedClientReference,

    clientReferenceSource:
      normalizedClientReference.source || "",

    clientReferenceNotes:
      normalizedClientReference.notes || "",

    clientReferenceNotesHtml:
      normalizedClientReference.notesHtml || "",

    clientReferenceAttachmentCount:
      normalizedClientReference.attachments.length || 0,

    hasClientReference: hasReference,

    /* =========================
       STATUS / STAGE
    ========================== */
    stage: assignedUserUid ? "assigned" : "new",
    status: "open",

    stageHistory: [
      {
        stage: assignedUserUid ? "assigned" : "new",
        changedAt: historyTime,
        changedByUid: createdUserUid,
        changedByName: createdUserName
      }
    ],

    /* =========================
       AUDIT
    ========================== */
    createdByUid: createdUserUid,
    createdByName: createdUserName,
    createdByEmail: createdUserEmail,

    createdAt: now,
    updatedAt: now
  });

  /* =========================
     TIMELINE - LEAD CREATED
  ========================== */
  await logLeadAction({
    leadId: leadRef.id,
    type: LEAD_EVENTS.CREATED,
    title: "Lead Created",
    description: `Lead ${leadCode} created from engagement`,
    metadata: {
      action: "lead_created",

      leadCode,
      source: "engagement", // or "manual"

      destinationCode: engagement.destinationCode,
      destinationName: engagement.destinationName,

      agentId: engagement.agentId,
      agentName: engagement.agentName,

      assignedToUid: assignedUserUid,
      assignedToName: assignedUserName,
      assignedToEmail: assignedUserEmail,

      hasClientReference: hasReference,
      clientReferenceSource:
        normalizedClientReference.source || "",
      clientReferenceAttachmentCount:
        normalizedClientReference.attachments.length || 0
    },
    user: createdUser
  });

  /* =========================
     TIMELINE - CLIENT REFERENCE
  ========================== */
  if (hasReference) {
    await logLeadAction({
      leadId: leadRef.id,
      type: LEAD_EVENTS.REMARK || "remark",
      title: "Client reference captured",
      description: getReferenceDescription(normalizedClientReference),
      metadata: {
        action: "client_reference_added",

        source: normalizedClientReference.source || "",
        notes: normalizedClientReference.notes || "",
        notesHtml: normalizedClientReference.notesHtml || "",

        attachmentCount:
          normalizedClientReference.attachments.length || 0,

        attachments:
          normalizedClientReference.attachments || []
      },
      user: createdUser
    });
  }

  /* =========================
     NOTIFICATIONS
  ========================== */
  await sendLeadNotifications({
    spoc,
    leadCode,
    destinationName: engagement.destinationName
  });

  /* =========================
     LINK ENGAGEMENT → LEAD
  ========================== */
  if (engagement.id) {
    await updateDoc(doc(db, "engagements", engagement.id), {
      leadId: leadRef.id,
      leadCode,
      leadCreatedAt: now,
      leadCreatedByUid: createdUserUid,
      leadCreatedByName: createdUserName,
      status: "converted_to_lead",
      updatedAt: now
    });
  }

  return leadRef.id;
}