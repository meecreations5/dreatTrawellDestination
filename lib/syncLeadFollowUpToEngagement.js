import {
  doc,
  serverTimestamp,
  setDoc,
  updateDoc
} from "firebase/firestore";

import { db } from "./firebase";
import { getLeadTravelAgentId } from "./leadOwnership";
import { getOutcomeLabel } from "./engagementIntentMap";

function firstValue(...values) {
  return (
    values.find(
      value => typeof value === "string" && value.trim().length > 0
    )?.trim() || ""
  );
}

function formatLabel(value = "") {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, char => char.toUpperCase());
}

function getUserUid(user = {}) {
  return firstValue(user.uid, user.id, user.userId, user.email);
}

function getUserName(user = {}) {
  return firstValue(
    user.name,
    user.displayName,
    user.fullName,
    user.employeeName,
    user.email,
    "System"
  );
}

function getUserEmail(user = {}) {
  return firstValue(user.email, user.workEmail, user.officialEmail);
}

function getLeadAgentName(lead = {}) {
  return firstValue(
    lead.travelAgentName,
    lead.agentName,
    lead.agencyName,
    lead.agentSnapshot?.agencyName,
    lead.travelAgent?.agencyName,
    "Travel Agent"
  );
}

function getLeadCode(lead = {}) {
  return firstValue(
    lead.leadCode,
    lead.code,
    lead.referenceNo,
    lead.referenceNumber
  );
}

function mapLeadOutcomeToEngagement(outcome = "") {
  const value = String(outcome || "").trim().toLowerCase();

  const map = {
    connected: "general_update",
    no_response: "no_response",
    follow_up_required: "followup_required",
    quotation_requested: "quote_needed",
    quote_requested: "quote_needed",
    not_interested: "not_interested"
  };

  return map[value] || value || "general_update";
}

/**
 * Mirrors a Lead follow-up into the Travel Agent engagement stream.
 *
 * The engagement document ID is deterministic for the lead follow-up so a
 * retry cannot create a duplicate activity row.
 */
export async function syncLeadFollowUpToEngagement({
  lead,
  leadId,
  followUpId,
  followUpRef = null,
  channel,
  outcome,
  summary,
  nextFollowUpAt = null,
  user
}) {
  if (!leadId || !followUpId) {
    return {
      synced: false,
      reason: "missing_follow_up_identity"
    };
  }

  const travelAgentId = getLeadTravelAgentId(lead || {});

  if (!travelAgentId) {
    if (followUpRef) {
      try {
        await updateDoc(followUpRef, {
          engagementSyncStatus: "skipped_missing_travel_agent_id",
          engagementSyncUpdatedAt: serverTimestamp()
        });
      } catch (error) {
        console.warn("Unable to record skipped engagement sync status:", error);
      }
    }

    return {
      synced: false,
      reason: "missing_travel_agent_id"
    };
  }

  const userUid = getUserUid(user);
  const userName = getUserName(user);
  const userEmail = getUserEmail(user);
  const leadCode = getLeadCode(lead || {});
  const agentName = getLeadAgentName(lead || {});
  const engagementOutcome = mapLeadOutcomeToEngagement(outcome);
  const engagementId = `lead_follow_up_${followUpId}`;
  const engagementRef = doc(db, "engagements", engagementId);

  const payload = {
    entityType: "travelAgent",
    agentId: travelAgentId,
    travelAgentId,
    agentName,
    travelAgentName: agentName,

    channel: String(channel || "call").trim().toLowerCase(),
    direction: "outbound",
    subject: leadCode
      ? `Lead follow-up - ${leadCode}`
      : "Lead follow-up",
    message: String(summary || "").trim(),
    messageText: String(summary || "").trim(),
    remarks: String(summary || "").trim(),

    outcomeCode: engagementOutcome,
    outcomeLabel: getOutcomeLabel(engagementOutcome) || formatLabel(engagementOutcome),
    status: "completed",
    completedAt: serverTimestamp(),

    nextEngagementAt: nextFollowUpAt || null,
    nextFollowUpAt: nextFollowUpAt || null,

    leadId,
    leadCode: leadCode || "",
    sourceType: "lead_follow_up",
    source: "lead_follow_up",
    sourceLeadId: leadId,
    sourceFollowUpId: followUpId,
    sourceLabel: "Lead Follow-up",
    autoSyncedFromLead: true,
    syncVersion: 1,

    assignedToUid: userUid,
    assignedToName: userName,
    assignedToEmail: userEmail,
    createdByUid: userUid,
    createdByName: userName,
    createdByEmail: userEmail,

    deleted: false,
    isDeleted: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  await setDoc(engagementRef, payload, { merge: true });

  if (followUpRef) {
    await updateDoc(followUpRef, {
      engagementId,
      engagementSyncStatus: "synced",
      engagementSyncedAt: serverTimestamp(),
      engagementTravelAgentId: travelAgentId
    });
  }

  return {
    synced: true,
    engagementId,
    travelAgentId,
    agentName
  };
}
