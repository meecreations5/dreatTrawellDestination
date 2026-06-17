// lib/createManualLead.js

import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { generateLeadCode } from "./generateLeadCode";
import { sendLeadNotifications } from "./sendLeadNotifications";
import { logLeadAction } from "./logLeadAction";

import { LEAD_EVENTS } from "./leadEvents";

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
    return `${clientReference.attachments.length} reference file${
      clientReference.attachments.length === 1 ? "" : "s"
    } attached.`;
  }

  return "Client reference details were added during lead creation.";
}

export async function createManualLead({
  agent,
  spoc,
  destination,
  assignedUser,
  createdUser,
  clientReference = null,
  engagement = null
}) {
  if (!destination?.code || !destination?.name) {
    throw new Error("Destination missing");
  }

  if (!agent?.id || !agent?.agencyName) {
    throw new Error("Travel agent missing");
  }

  if (!spoc) {
    throw new Error("SPOC missing");
  }

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

  /* =========================
     OPTIONAL ENGAGEMENT SOURCE
  ========================== */
  const sourceEngagementId =
    engagement?.id ||
    engagement?.engagementId ||
    engagement?.sourceEngagementId ||
    "";

  const hasSourceEngagement = Boolean(engagement);

  const leadSource = hasSourceEngagement
    ? "engagement"
    : "manual";

  const sourceAgentId =
    engagement?.agentId ||
    engagement?.travelAgentId ||
    agent.id;

  const sourceAgentName =
    engagement?.agentName ||
    engagement?.agencyName ||
    engagement?.travelAgentName ||
    agent.agencyName;

  const sourceAgentCode =
    engagement?.agentCode ||
    agent.agentCode ||
    "";

  const sourceDestinationRefId =
    engagement?.destinationRefId ||
    destination.id;

  const sourceDestinationId =
    engagement?.destinationId ||
    destination.destinationId ||
    destination.id;

  const sourceDestinationCode =
    engagement?.destinationCode ||
    destination.code;

  const sourceDestinationName =
    engagement?.destinationName ||
    destination.name;

  const leadCode = generateLeadCode({
    destination: sourceDestinationCode,
    agentName: sourceAgentName
  });

  const leadRef = await addDoc(collection(db, "leads"), {
    leadCode,
    source: leadSource,
    sourceEngagementId,

    /* =========================
       TRAVEL AGENT
    ========================== */
    agentId: sourceAgentId,
    agentName: sourceAgentName,
    travelAgentName: sourceAgentName,
    agencyName: sourceAgentName,
    agentCode: sourceAgentCode,

    /* =========================
       DESTINATION
    ========================== */
    destinationRefId: sourceDestinationRefId,
    destinationId: sourceDestinationId,
    destinationCode: sourceDestinationCode,
    destinationName: sourceDestinationName,

    /* =========================
       SPOC / CONTACT
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
    assignedAt: serverTimestamp(),

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
       STATUS
    ========================== */
    stage: assignedUserUid ? "assigned" : "new",
    status: "open",

    /* =========================
       AUDIT
    ========================== */
    createdByUid: createdUserUid,
    createdByName: createdUserName,
    createdByEmail: createdUserEmail,

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  /* =========================
     NOTIFICATIONS
  ========================== */
  await sendLeadNotifications({
    spoc,
    leadCode,
    destinationName: sourceDestinationName
  });

  /* =========================
     TIMELINE - LEAD CREATED
  ========================== */
  await logLeadAction({
    leadId: leadRef.id,
    type: LEAD_EVENTS.CREATED,
    title: hasSourceEngagement
      ? "Lead Created from Engagement"
      : "Manual Lead Created",
    description: hasSourceEngagement
      ? `Lead created from engagement for ${sourceDestinationName}`
      : `Manual lead created for ${sourceDestinationName}`,
    metadata: {
      action: hasSourceEngagement
        ? "lead_created_from_engagement"
        : "lead_created",

      leadCode,
      source: leadSource,
      sourceEngagementId,

      destinationRefId: sourceDestinationRefId,
      destinationId: sourceDestinationId,
      destinationCode: sourceDestinationCode,
      destinationName: sourceDestinationName,

      agentId: sourceAgentId,
      agentName: sourceAgentName,
      agentCode: sourceAgentCode,

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

  return leadRef.id;
}