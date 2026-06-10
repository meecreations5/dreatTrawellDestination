// lib/logFollowUp.js

import {
  addDoc,
  collection,
  serverTimestamp,
  doc,
  updateDoc,
  Timestamp
} from "firebase/firestore";

import { db } from "./firebase";
import { logLeadAction } from "./logLeadAction";
import { LEAD_EVENTS } from "./leadEvents";

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
    user?.email ||
    "System"
  );
}

function getUserEmail(user) {
  return user?.email || "";
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
    return "vendor_pricing_requested";
  }

  if (
    outcome === "connected" ||
    outcome === "follow_up_required" ||
    outcome === "no_response"
  ) {
    return "follow_up";
  }

  if (outcome === "not_interested") {
    return "closed_lost";
  }

  return "follow_up";
}

function isClosedOutcome(outcome) {
  return outcome === "not_interested";
}

export async function logFollowUp({
  leadId,
  channel,
  outcome,
  summary = "",
  nextFollowUpAt = null,
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

  const now = serverTimestamp();

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

  const closed = isClosedOutcome(cleanOutcome);
  const nextStage = getStageFromOutcome(cleanOutcome);
  const nextActionType = nextActionDate && !closed ? "follow_up" : null;

  /* =========================
     1. SAVE FOLLOW-UP DOCUMENT
  ========================== */
  const followUpRef = await addDoc(
    collection(db, "leads", leadId, "followUps"),
    {
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

      createdByUid: user?.uid || "",
      createdByName: userName,
      createdByEmail: userEmail,

      createdAt: now,
      updatedAt: now
    }
  );

  /* =========================
     2. UPDATE LEAD
  ========================== */
  const leadUpdate = {
    lastFollowUpAt: now,
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

    stage: nextStage,
    status: closed ? "closed" : "open",

    updatedAt: now
  };

  if (closed) {
    leadUpdate.closedAt = now;
    leadUpdate.closingStage = "closed_lost";
    leadUpdate.closingStageLabel = "Closed Lost";
    leadUpdate.closingRemark = cleanSummary;
    leadUpdate.closeRemark = cleanSummary;
    leadUpdate.closedReason = cleanSummary;
    leadUpdate.closedByUid = user?.uid || "";
    leadUpdate.closedByName = userName;
    leadUpdate.closedByEmail = userEmail;
  }

  await updateDoc(doc(db, "leads", leadId), leadUpdate);

  /* =========================
     3. TIMELINE
     IMPORTANT:
     Date is stored at top level AND inside metadata.
  ========================== */
  await logLeadAction({
    leadId,
    type: LEAD_EVENTS.FOLLOW_UP || "follow_up",
    title: `Follow-up via ${formatLabel(cleanChannel).toUpperCase()}`,
    description: cleanSummary,

    metadata: {
      action: "follow_up_logged",

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

      stage: nextStage,
      status: closed ? "closed" : "open",

      createdByUid: user?.uid || "",
      createdByName: userName,
      createdByEmail: userEmail
    },
    user
  });
}