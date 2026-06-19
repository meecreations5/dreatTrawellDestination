// lib/logFollowUp.js

import {
  addDoc,
  collection,
  serverTimestamp,
  doc,
  getDoc,
  updateDoc,
  Timestamp
} from "firebase/firestore";

import { db } from "./firebase";

import {
  logLeadAction,
  LEAD_TIMELINE_TYPES
} from "./logLeadAction";

import {
  LEAD_STAGES,
  LOST_REASONS,
  getLeadStageMeta,
  getLostReasonLabel,
  normalizeLeadStage
} from "./leadStages";

/* =========================
   HELPERS
========================= */

function formatLabel(value = "") {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, char => char.toUpperCase());
}

function getUserName(user) {
  return (
    user?.name ||
    user?.displayName ||
    user?.fullName ||
    user?.employeeName ||
    user?.email ||
    "System"
  );
}

function getUserEmail(user) {
  return (
    user?.email ||
    user?.workEmail ||
    user?.officialEmail ||
    ""
  );
}

function getUserUid(user) {
  return (
    user?.uid ||
    user?.id ||
    user?.email ||
    ""
  );
}

function normalizeDate(value) {
  if (!value) return null;

  if (value?.toDate) return value.toDate();

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeOutcome(outcome = "") {
  const value = String(outcome || "").trim();

  if (value === "quote_requested") return "quotation_requested";
  if (value === "interested") return "follow_up_required";
  if (value === "lost") return "not_interested";

  return value || "connected";
}

function normalizeChannel(channel = "") {
  return String(channel || "call").trim();
}

function getStageFromOutcome(outcome) {
  if (outcome === "quotation_requested") {
    return LEAD_STAGES.QUOTE_PENDING;
  }

  if (
    outcome === "connected" ||
    outcome === "follow_up_required" ||
    outcome === "no_response"
  ) {
    return LEAD_STAGES.FOLLOW_UP_PENDING;
  }

  if (outcome === "not_interested") {
    return LEAD_STAGES.LOST;
  }

  return LEAD_STAGES.FOLLOW_UP_PENDING;
}

function isClosedOutcome(outcome) {
  return outcome === "not_interested";
}

function getFollowUpTitle(channel) {
  return `Follow-up via ${formatLabel(channel).toUpperCase()}`;
}

function getStageTimelineTitle(nextStage) {
  if (nextStage === LEAD_STAGES.QUOTE_PENDING) return "Quote Pending";
  if (nextStage === LEAD_STAGES.FOLLOW_UP_PENDING) return "Follow-up Pending";
  if (nextStage === LEAD_STAGES.LOST) return "Lead Lost";

  return `Stage changed to ${getLeadStageMeta(nextStage).label}`;
}

function resolveLostReason(lostReason = "") {
  const cleanLostReason = String(lostReason || "").trim();

  // Existing follow-up modal does not collect a lost reason.
  // So defaulting safely to Agent not serious when outcome is not_interested.
  return cleanLostReason || LOST_REASONS.AGENT_NOT_SERIOUS;
}

/* =========================
   LOG FOLLOW-UP
========================= */

export async function logFollowUp({
  leadId,
  channel,
  outcome,
  summary = "",
  nextFollowUpAt = null,
  lostReason = "",
  user
}) {
  if (!leadId) {
    throw new Error("logFollowUp: leadId is required");
  }

  if (!user) {
    throw new Error("logFollowUp: user is required");
  }

  const cleanChannel = normalizeChannel(channel);
  const cleanOutcome = normalizeOutcome(outcome);
  const cleanSummary = String(summary || "").trim();

  if (!cleanSummary) {
    throw new Error("Conversation summary is required");
  }

  const leadRef = doc(db, "leads", leadId);
  const leadSnap = await getDoc(leadRef);

  if (!leadSnap.exists()) {
    throw new Error("Lead not found");
  }

  const lead = leadSnap.data();

  const oldStage = normalizeLeadStage(
    lead.stage || LEAD_STAGES.NEW_ENQUIRY
  );

  const oldStageMeta = getLeadStageMeta(oldStage);

  const closed = isClosedOutcome(cleanOutcome);
  const nextStage = getStageFromOutcome(cleanOutcome);
  const nextStageMeta = getLeadStageMeta(nextStage);

  const shouldLogStageChange = oldStage !== nextStage;

  const userUid = getUserUid(user);
  const userName = getUserName(user);
  const userEmail = getUserEmail(user);

  const nextActionDate = normalizeDate(nextFollowUpAt);

  const nextActionTimestamp = nextActionDate
    ? Timestamp.fromDate(nextActionDate)
    : null;

  const nextActionIso = nextActionDate
    ? nextActionDate.toISOString()
    : "";

  const nextActionMs = nextActionDate
    ? nextActionDate.getTime()
    : null;

  const nextActionType =
    nextActionDate && !closed ? "follow_up" : null;

  const finalLostReason = closed
    ? resolveLostReason(lostReason)
    : "";

  const finalLostReasonLabel = closed
    ? getLostReasonLabel(finalLostReason)
    : "";

  /* =========================
     1. SAVE FOLLOW-UP DOCUMENT
  ========================== */

  const followUpRef = await addDoc(
    collection(db, "leads", leadId, "followUps"),
    {
      leadId,

      channel: cleanChannel,
      outcome: cleanOutcome,
      outcomeLabel: formatLabel(cleanOutcome),

      summary: cleanSummary,

      nextFollowUpAt: closed ? null : nextActionTimestamp,
      nextActionDueAt: closed ? null : nextActionTimestamp,
      nextActionType: closed ? null : nextActionType,

      nextFollowUpAtIso: closed ? "" : nextActionIso,
      nextActionDueAtIso: closed ? "" : nextActionIso,
      nextFollowUpAtMs: closed ? null : nextActionMs,
      nextActionDueAtMs: closed ? null : nextActionMs,

      stage: nextStage,
      stageLabel: nextStageMeta.label,

      lostReason: finalLostReason,
      lostReasonLabel: finalLostReasonLabel,

      createdByUid: userUid,
      createdByName: userName,
      createdByEmail: userEmail,

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }
  );

  /* =========================
     2. UPDATE LEAD
  ========================== */

  const leadUpdate = {
    lastFollowUpAt: serverTimestamp(),
    lastFollowUpChannel: cleanChannel,
    lastFollowUpOutcome: cleanOutcome,
    lastFollowUpOutcomeLabel: formatLabel(cleanOutcome),
    lastFollowUpSummary: cleanSummary,

    nextActionDueAt: closed ? null : nextActionTimestamp,
    nextActionType: closed ? null : nextActionType,
    nextFollowUpAt: closed ? null : nextActionTimestamp,

    nextFollowUpAtIso: closed ? "" : nextActionIso,
    nextActionDueAtIso: closed ? "" : nextActionIso,
    nextFollowUpAtMs: closed ? null : nextActionMs,
    nextActionDueAtMs: closed ? null : nextActionMs,

    previousStage: oldStage,
    previousStageLabel: oldStageMeta.label,

    stage: nextStage,
    stageLabel: nextStageMeta.label,
    status: closed ? "closed" : "open",

    lastActivityAt: serverTimestamp(),
    lastActivityType: closed ? "lead_lost" : "follow_up_logged",
    lastActivitySummary: cleanSummary,

    updatedAt: serverTimestamp()
  };

  if (closed) {
    leadUpdate.closedAt = serverTimestamp();

    leadUpdate.closingStage = LEAD_STAGES.LOST;
    leadUpdate.closingStageLabel = nextStageMeta.label;

    leadUpdate.closingRemark = cleanSummary;
    leadUpdate.closeRemark = cleanSummary;

    leadUpdate.closedReason = finalLostReason;
    leadUpdate.closedReasonLabel = finalLostReasonLabel;

    leadUpdate.lostAt = serverTimestamp();
    leadUpdate.lostReason = finalLostReason;
    leadUpdate.lostReasonLabel = finalLostReasonLabel;
    leadUpdate.lostRemark = cleanSummary;

    leadUpdate.closedByUid = userUid;
    leadUpdate.closedByName = userName;
    leadUpdate.closedByEmail = userEmail;

    leadUpdate.lostByUid = userUid;
    leadUpdate.lostByName = userName;
    leadUpdate.lostByEmail = userEmail;
  }

  await updateDoc(leadRef, leadUpdate);

  /* =========================
     3. FOLLOW-UP TIMELINE
  ========================== */

  await logLeadAction({
    leadId,
    type: LEAD_TIMELINE_TYPES.FOLLOW_UP || "follow_up",
    title: getFollowUpTitle(cleanChannel),
    description: cleanSummary,

    metadata: {
      action: "follow_up_logged",

      leadId,
      followUpId: followUpRef.id,

      channel: cleanChannel,
      followUpChannel: cleanChannel,

      outcome: cleanOutcome,
      outcomeLabel: formatLabel(cleanOutcome),

      summary: cleanSummary,
      followUpSummary: cleanSummary,

      nextFollowUpAt: closed ? null : nextActionTimestamp,
      nextActionDueAt: closed ? null : nextActionTimestamp,
      nextActionType: closed ? null : nextActionType,

      nextFollowUpAtIso: closed ? "" : nextActionIso,
      nextActionDueAtIso: closed ? "" : nextActionIso,
      nextFollowUpAtMs: closed ? null : nextActionMs,
      nextActionDueAtMs: closed ? null : nextActionMs,

      oldStage,
      oldStageLabel: oldStageMeta.label,

      stage: nextStage,
      stageLabel: nextStageMeta.label,

      newStage: nextStage,
      newStageLabel: nextStageMeta.label,

      lostReason: finalLostReason,
      lostReasonLabel: finalLostReasonLabel,

      status: closed ? "closed" : "open",

      createdByUid: userUid,
      createdByName: userName,
      createdByEmail: userEmail
    },
    user
  });

  /* =========================
     4. STAGE TIMELINE
     Logs only when follow-up changes stage.
  ========================== */

  if (shouldLogStageChange) {
    await logLeadAction({
      leadId,
      type: LEAD_TIMELINE_TYPES.STAGE_CHANGED || "stage",
      title: getStageTimelineTitle(nextStage),
      description: cleanSummary,

      metadata: {
        action: closed ? "lead_lost" : "stage_changed_by_follow_up",

        leadId,
        followUpId: followUpRef.id,

        oldStage,
        oldStageLabel: oldStageMeta.label,

        fromStage: oldStage,
        fromStageLabel: oldStageMeta.label,

        newStage: nextStage,
        newStageLabel: nextStageMeta.label,

        toStage: nextStage,
        toStageLabel: nextStageMeta.label,

        stage: nextStage,
        stageLabel: nextStageMeta.label,

        outcome: cleanOutcome,
        outcomeLabel: formatLabel(cleanOutcome),

        remark: cleanSummary,
        closingRemark: closed ? cleanSummary : "",
        closeRemark: closed ? cleanSummary : "",

        lostReason: finalLostReason,
        lostReasonLabel: finalLostReasonLabel,

        status: closed ? "closed" : "open",

        changedByUid: userUid,
        changedByName: userName,
        changedByEmail: userEmail
      },
      user
    });
  }

  return {
    followUpId: followUpRef.id,
    stage: nextStage,
    stageLabel: nextStageMeta.label,
    status: closed ? "closed" : "open"
  };
}