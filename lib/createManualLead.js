// lib/createManualLead.js

import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { generateLeadCode } from "./generateLeadCode";
import { sendLeadNotifications } from "./sendLeadNotifications";
import { logLeadAction } from "./logLeadAction";
import { canAccess, canAssignLeadOnCreate } from "./rolePermissions";

import { LEAD_EVENTS } from "./leadEvents";
import {
  LEAD_SCHEMA_VERSION,
  buildLeadAgentLinkFields,
  buildLeadOwnerFields
} from "./leadOwnership";
import { buildLeadTravelPayload } from "./leadTravelDates";
import {
  cleanOfficeClipboardText,
  richTextHtmlToText,
  sanitizeRichTextHtml
} from "./richTextSanitizer";

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

  const notesHtml = sanitizeRichTextHtml(clientReference?.notesHtml || "");
  const notes = cleanOfficeClipboardText(
    clientReference?.notes || richTextHtmlToText(notesHtml) || ""
  );

  return {
    source: cleanOfficeClipboardText(clientReference?.source || ""),
    notes,
    notesHtml,
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

  return "Client reference details were added during lead creation.";
}

export async function createManualLead({
  agent,
  spoc,
  destination,
  assignedUser,
  createdUser,
  clientReference = null,
  engagement = null,
  sourceMeetingId = "",
  travelStartDate = "",
  travelEndDate = "",
  travelMonth = ""
}) {
  if (!createdUser || !canAccess(createdUser, "leads.create")) {
    throw new Error("You do not have permission to create leads.");
  }

  if (!canAssignLeadOnCreate(createdUser, assignedUser)) {
    throw new Error("You do not have permission to hand over this new lead to the selected user.");
  }

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
  const ownerFields = buildLeadOwnerFields(createdUser);

  /* =========================
     OPTIONAL ENGAGEMENT SOURCE
  ========================== */
  const sourceEngagementId =
    engagement?.id ||
    engagement?.engagementId ||
    engagement?.sourceEngagementId ||
    "";

  const hasSourceEngagement = Boolean(engagement);
  const cleanSourceMeetingId = String(sourceMeetingId || "").trim();
  const hasSourceMeeting = Boolean(cleanSourceMeetingId);

  const leadSource = hasSourceMeeting
    ? "meeting"
    : hasSourceEngagement
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

  const agentLinkFields = buildLeadAgentLinkFields({
    ...agent,
    id: sourceAgentId,
    agencyName: sourceAgentName,
    agentCode: sourceAgentCode
  });

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

  const leadTravelPayload = buildLeadTravelPayload({
    travelStartDate,
    travelEndDate,
    travelMonth,
    source: "lead_creation"
  });

  const leadRef = await addDoc(collection(db, "leads"), {
    schemaVersion: LEAD_SCHEMA_VERSION,
    ...ownerFields,
    ...agentLinkFields,
    ...leadTravelPayload,

    leadCode,
    source: leadSource,
    sourceEngagementId,
    sourceMeetingId: cleanSourceMeetingId,
    meetingId: cleanSourceMeetingId,

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
    closingPotential: "warm",
    closingPotentialLabel: "Warm / Medium",
    isDeleted: false,

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
     HTML EMAIL IS SENT FROM sendLeadNotifications.js
  ========================== */
  try {
    const notificationResult = await sendLeadNotifications({
      spoc,
      leadId: leadRef.id,
      leadCode,
      destinationName: sourceDestinationName,
      user: createdUser,
      assignedUser,
      clientReference
    });

    await updateDoc(leadRef, {
      notificationDelivery: notificationResult || {},
      notificationDeliveryUpdatedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    const message = String(error?.message || error || "Lead notification failed");
    console.warn("Lead notification failed:", message);
    try {
      await updateDoc(leadRef, {
        notificationDelivery: {
          status: "failed",
          error: message
        },
        notificationDeliveryUpdatedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (updateError) {
      console.warn("Could not store lead notification failure:", updateError?.message || updateError);
    }
  }

  /* =========================
     TIMELINE - LEAD CREATED
  ========================== */
  await logLeadAction({
    leadId: leadRef.id,
    type: LEAD_EVENTS.CREATED,
    title: hasSourceEngagement
      ? "Lead Created from Engagement"
      : hasSourceMeeting
        ? "Lead Created from Meeting"
        : "Manual Lead Created",
    description: hasSourceEngagement
      ? `Lead created from engagement for ${sourceDestinationName}`
      : hasSourceMeeting
        ? `Lead created from meeting for ${sourceDestinationName}`
        : `Manual lead created for ${sourceDestinationName}`,
    metadata: {
      action: hasSourceEngagement
        ? "lead_created_from_engagement"
        : hasSourceMeeting
          ? "lead_created_from_meeting"
          : "lead_created",

      leadCode,
      source: leadSource,
      sourceEngagementId,
      sourceMeetingId: cleanSourceMeetingId,

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
  if (hasSourceMeeting) {
    try {
      await updateDoc(doc(db, "meetings", cleanSourceMeetingId), {
        leadId: leadRef.id,
        leadCode,
        leadCreatedAt: serverTimestamp(),
        leadCreatedByUid: createdUserUid,
        leadCreatedByName: createdUserName,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Meeting lead linkage failed:", error);
    }
  }

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