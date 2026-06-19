import {
  doc,
  getDoc,
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

import {
  LEAD_STAGES,
  normalizeLeadStage,
  getLeadStageMeta,
  isTerminalLeadStage,
  isLostStage,
  isConvertedStage,
  getLostReasonLabel
} from "./leadStages";

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
  return (
    getFirstValue(
      user?.name,
      user?.displayName,
      user?.fullName,
      user?.employeeName,
      user?.profile?.name,
      user?.email
    ) || "System"
  );
}

function getUserEmail(user) {
  return getFirstValue(
    user?.email,
    user?.workEmail,
    user?.officialEmail,
    user?.profile?.email
  );
}

function getUserUid(user) {
  return getFirstValue(
    user?.uid,
    user?.id,
    user?.email
  );
}

function getStageActivityTitle({
  newStage,
  newStageLabel,
  isTerminal,
  isLost,
  isConverted
}) {
  if (isConverted) return "Lead Converted";
  if (isLost) return "Lead Lost";
  if (isTerminal) return `Lead moved to ${newStageLabel}`;

  const titleMap = {
    [LEAD_STAGES.NEW_ENQUIRY]: "Lead moved to New enquiry",
    [LEAD_STAGES.REQUIREMENT_PENDING]: "Requirement Pending",
    [LEAD_STAGES.REQUIREMENT_COMPLETED]: "Requirement Completed",
    [LEAD_STAGES.QUOTE_PENDING]: "Quote Pending",
    [LEAD_STAGES.QUOTE_SENT]: "Quote Sent",
    [LEAD_STAGES.FOLLOW_UP_PENDING]: "Follow-up Pending",
    [LEAD_STAGES.REVISION_REQUIRED]: "Revision Required",
    [LEAD_STAGES.HOT_LEAD]: "Marked as Hot Lead",
    [LEAD_STAGES.PAYMENT_PENDING]: "Payment Pending",
    [LEAD_STAGES.FUTURE_FOLLOW_UP]: "Future Follow-up Scheduled"
  };

  return titleMap[newStage] || `Stage changed to ${newStageLabel}`;
}

function getStageAction(newStage) {
  if (isConvertedStage(newStage)) return "lead_converted";
  if (isLostStage(newStage)) return "lead_lost";

  const actionMap = {
    [LEAD_STAGES.REQUIREMENT_PENDING]: "requirement_pending",
    [LEAD_STAGES.REQUIREMENT_COMPLETED]: "requirement_completed",
    [LEAD_STAGES.QUOTE_PENDING]: "quote_pending",
    [LEAD_STAGES.QUOTE_SENT]: "quote_sent",
    [LEAD_STAGES.FOLLOW_UP_PENDING]: "follow_up_pending",
    [LEAD_STAGES.REVISION_REQUIRED]: "revision_required",
    [LEAD_STAGES.HOT_LEAD]: "hot_lead_marked",
    [LEAD_STAGES.PAYMENT_PENDING]: "payment_pending",
    [LEAD_STAGES.FUTURE_FOLLOW_UP]: "future_follow_up"
  };

  return actionMap[newStage] || "stage_changed";
}

function getStageSpecificPayload({
  newStage,
  userUid,
  userName,
  remark
}) {
  const payload = {};

  if (newStage === LEAD_STAGES.REQUIREMENT_PENDING) {
    payload.requirementPendingAt = serverTimestamp();
    payload.requirementPendingByUid = userUid;
    payload.requirementPendingByName = userName;
    payload.requirementPendingRemark = remark || "";
  }

  if (newStage === LEAD_STAGES.REQUIREMENT_COMPLETED) {
    payload.requirementCompletedAt = serverTimestamp();
    payload.requirementCompletedByUid = userUid;
    payload.requirementCompletedByName = userName;
    payload.requirementCompletedRemark = remark || "";
  }

  if (newStage === LEAD_STAGES.QUOTE_PENDING) {
    payload.quotePendingAt = serverTimestamp();
    payload.quotePendingByUid = userUid;
    payload.quotePendingByName = userName;
    payload.quotePendingRemark = remark || "";
  }

  if (newStage === LEAD_STAGES.QUOTE_SENT) {
    payload.quoteSentAt = serverTimestamp();
    payload.quoteSentByUid = userUid;
    payload.quoteSentByName = userName;
    payload.quoteSentRemark = remark || "";
  }

  if (newStage === LEAD_STAGES.FOLLOW_UP_PENDING) {
    payload.followUpPendingAt = serverTimestamp();
    payload.followUpPendingByUid = userUid;
    payload.followUpPendingByName = userName;
    payload.followUpPendingRemark = remark || "";
  }

  if (newStage === LEAD_STAGES.REVISION_REQUIRED) {
    payload.revisionRequiredAt = serverTimestamp();
    payload.revisionRequiredByUid = userUid;
    payload.revisionRequiredByName = userName;
    payload.revisionRequiredRemark = remark || "";
  }

  if (newStage === LEAD_STAGES.HOT_LEAD) {
    payload.hotLeadAt = serverTimestamp();
    payload.hotLeadByUid = userUid;
    payload.hotLeadByName = userName;
    payload.hotLeadRemark = remark || "";
  }

  if (newStage === LEAD_STAGES.PAYMENT_PENDING) {
    payload.paymentPendingAt = serverTimestamp();
    payload.paymentPendingByUid = userUid;
    payload.paymentPendingByName = userName;
    payload.paymentPendingRemark = remark || "";
  }

  if (newStage === LEAD_STAGES.FUTURE_FOLLOW_UP) {
    payload.futureFollowUpAt = serverTimestamp();
    payload.futureFollowUpByUid = userUid;
    payload.futureFollowUpByName = userName;
    payload.futureFollowUpRemark = remark || "";
  }

  return payload;
}

/* =========================
   UPDATE LEAD STAGE
========================= */

export async function updateLeadStage({
  leadId,
  newStage,
  user,
  remark = "",
  lostReason = ""
}) {
  if (!leadId) {
    throw new Error("Lead ID is required");
  }

  if (!newStage) {
    throw new Error("Lead stage is required");
  }

  if (!user) {
    throw new Error("User session is required");
  }

  const normalizedNewStage = normalizeLeadStage(newStage);
  const cleanRemark = String(remark || "").trim();
  const cleanLostReason = String(lostReason || "").trim();

  const terminal = isTerminalLeadStage(normalizedNewStage);
  const lost = isLostStage(normalizedNewStage);
  const converted = isConvertedStage(normalizedNewStage);

  if (terminal && !cleanRemark) {
    throw new Error(
      lost
        ? "Lost remark is mandatory."
        : "Conversion remark is mandatory."
    );
  }

  if (lost && !cleanLostReason) {
    throw new Error("Lost reason is mandatory.");
  }

  const leadRef = doc(db, "leads", leadId);
  const leadSnap = await getDoc(leadRef);

  if (!leadSnap.exists()) {
    throw new Error("Lead not found");
  }

  const lead = {
    id: leadSnap.id,
    ...leadSnap.data()
  };

  const oldStage = normalizeLeadStage(lead.stage || "new_enquiry");

  if (oldStage === normalizedNewStage) {
    return {
      updated: false,
      reason: "same_stage"
    };
  }

  const oldStageMeta = getLeadStageMeta(oldStage);
  const newStageMeta = getLeadStageMeta(normalizedNewStage);

  const oldStageLabel = oldStageMeta.label;
  const newStageLabel = newStageMeta.label;

  const userUid = getUserUid(user);
  const userName = getUserName(user);
  const userEmail = getUserEmail(user);

  const action = getStageAction(normalizedNewStage);

  const stageHistoryItem = {
    fromStage: oldStage,
    fromStageLabel: oldStageLabel,

    toStage: normalizedNewStage,
    toStageLabel: newStageLabel,

    stage: normalizedNewStage,
    stageLabel: newStageLabel,

    action,

    remark: cleanRemark || null,

    lostReason: lost ? cleanLostReason : null,
    lostReasonLabel: lost ? getLostReasonLabel(cleanLostReason) : null,

    changedAt: Timestamp.now(),
    changedBy: userEmail,
    changedByUid: userUid,
    changedByName: userName,
    changedByEmail: userEmail
  };

  const activitySummary = cleanRemark
    ? cleanRemark
    : `Lead moved from ${oldStageLabel} to ${newStageLabel}`;

  const updatePayload = {
    stage: normalizedNewStage,
    stageLabel: newStageLabel,

    status: terminal ? "closed" : "open",

    previousStage: oldStage,
    previousStageLabel: oldStageLabel,

    stageRemark: cleanRemark || "",
    lastStageRemark: cleanRemark || "",

    stageUpdatedAt: serverTimestamp(),
    stageUpdatedByUid: userUid,
    stageUpdatedByName: userName,
    stageUpdatedByEmail: userEmail,

    lastActivityAt: serverTimestamp(),
    lastActivityType: action,
    lastActivitySummary: activitySummary,

    stageHistory: arrayUnion(stageHistoryItem),

    updatedAt: serverTimestamp(),

    ...getStageSpecificPayload({
      newStage: normalizedNewStage,
      userUid,
      userName,
      remark: cleanRemark
    })
  };

  /* =========================
     CONVERTED
  ========================== */
  if (converted) {
    updatePayload.convertedAt = serverTimestamp();
    updatePayload.convertedByUid = userUid;
    updatePayload.convertedByName = userName;
    updatePayload.convertedByEmail = userEmail;
    updatePayload.conversionRemark = cleanRemark;

    updatePayload.closingStage = normalizedNewStage;
    updatePayload.closingStageLabel = newStageLabel;
    updatePayload.closingRemark = cleanRemark;
    updatePayload.closeRemark = cleanRemark;
    updatePayload.closedReason = cleanRemark;
  }

  /* =========================
     LOST
  ========================== */
  if (lost) {
    updatePayload.lostAt = serverTimestamp();
    updatePayload.lostByUid = userUid;
    updatePayload.lostByName = userName;
    updatePayload.lostByEmail = userEmail;

    updatePayload.lostReason = cleanLostReason;
    updatePayload.lostReasonLabel = getLostReasonLabel(cleanLostReason);
    updatePayload.lostRemark = cleanRemark;

    updatePayload.closingStage = normalizedNewStage;
    updatePayload.closingStageLabel = newStageLabel;
    updatePayload.closingRemark = cleanRemark;
    updatePayload.closeRemark = cleanRemark;
    updatePayload.closedReason = cleanLostReason;
    updatePayload.closedReasonLabel = getLostReasonLabel(cleanLostReason);
  }

  /* =========================
     TERMINAL STAGES CLEAR NEXT ACTION
  ========================== */
  if (terminal) {
    updatePayload.closedAt = serverTimestamp();
    updatePayload.closedByUid = userUid;
    updatePayload.closedByName = userName;
    updatePayload.closedByEmail = userEmail;

    updatePayload.nextActionDueAt = null;
    updatePayload.nextFollowUpAt = null;
    updatePayload.nextActionType = null;

    updatePayload.nextActionDueAtIso = "";
    updatePayload.nextFollowUpAtIso = "";
    updatePayload.nextActionDueAtMs = null;
    updatePayload.nextFollowUpAtMs = null;
  }

  await updateDoc(leadRef, updatePayload);

  await logLeadAction({
    leadId,
    type: LEAD_TIMELINE_TYPES.STAGE_CHANGED || "stage",
    title: getStageActivityTitle({
      newStage: normalizedNewStage,
      newStageLabel,
      isTerminal: terminal,
      isLost: lost,
      isConverted: converted
    }),
    description: activitySummary,
    metadata: {
      action,

      oldStage,
      oldStageLabel,

      newStage: normalizedNewStage,
      newStageLabel,

      fromStage: oldStage,
      fromStageLabel: oldStageLabel,

      toStage: normalizedNewStage,
      toStageLabel: newStageLabel,

      stage: normalizedNewStage,
      stageLabel: newStageLabel,

      remark: cleanRemark || "",

      lostReason: lost ? cleanLostReason : "",
      lostReasonLabel: lost ? getLostReasonLabel(cleanLostReason) : "",

      closingRemark: terminal ? cleanRemark : "",
      closeRemark: terminal ? cleanRemark : "",
      closedReason: lost ? cleanLostReason : terminal ? cleanRemark : "",
      closedReasonLabel: lost ? getLostReasonLabel(cleanLostReason) : "",

      status: terminal ? "closed" : "open",

      changedByUid: userUid,
      changedByName: userName,
      changedByEmail: userEmail
    },
    user
  });

  return {
    updated: true,
    oldStage,
    newStage: normalizedNewStage,
    stageLabel: newStageLabel
  };
}