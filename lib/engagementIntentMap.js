// lib/engagementIntentMap.js

function normalize(value = "") {
  return String(value || "").trim().toLowerCase();
}

export const ENGAGEMENT_OUTCOME_OPTIONS = [
  { key: "call_not_picked", label: "Call Not Picked" },
  { key: "intro_done", label: "Introduction Done" },
  { key: "profile_shared", label: "Company Profile Shared" },
  { key: "meeting_scheduled", label: "Meeting Scheduled" },
  { key: "followup_required", label: "Follow-up Required" },
  { key: "general_update", label: "General Update" },

  { key: "no_response", label: "No Response" },
  { key: "requirement_pending", label: "Requirement Pending" },
  { key: "requirement_received", label: "Requirement Received" },
  { key: "quote_needed", label: "Quote Needed" },
  { key: "quote_shared", label: "Quote Shared" },
  { key: "revision_needed", label: "Revision Needed" },
  { key: "payment_pending", label: "Payment Pending" },
  { key: "not_interested", label: "Not Interested" },
  { key: "future_follow_up", label: "Future Follow-up" }
];

export const INTENT_META = {
  new_agent_intro: {
    intentCode: "new_agent_intro",
    intentName: "New Agent Introduction",
    engagementType: "new_agent_intro",
    nextAction: "follow_up",
    nextActionLabel: "Follow up",
    followUpDays: 2,
    waitingOn: "agent",
    communicationStatus: "waiting_for_agent",
    communicationReady: true
  },

  ask_requirement: {
    intentCode: "ask_requirement",
    intentName: "Ask Requirement",
    engagementType: "requirement_collection",
    nextAction: "collect_requirement",
    nextActionLabel: "Collect requirement",
    followUpDays: 1,
    waitingOn: "agent",
    communicationStatus: "waiting_for_agent",
    communicationReady: true
  },

  send_destination_package: {
    intentCode: "send_destination_package",
    intentName: "Send Destination Package",
    engagementType: "package_shared",
    nextAction: "package_follow_up",
    nextActionLabel: "Package follow-up",
    followUpDays: 2,
    waitingOn: "agent",
    communicationStatus: "waiting_for_agent",
    communicationReady: true
  },

  send_promotion: {
    intentCode: "send_promotion",
    intentName: "Send Promotion",
    engagementType: "promotion_shared",
    nextAction: "promotion_follow_up",
    nextActionLabel: "Promotion follow-up",
    followUpDays: 2,
    waitingOn: "agent",
    communicationStatus: "waiting_for_agent",
    communicationReady: true
  },

  quote_follow_up: {
    intentCode: "quote_follow_up",
    intentName: "Quote Follow-up",
    engagementType: "quotation_follow_up",
    nextAction: "quote_follow_up",
    nextActionLabel: "Quotation follow-up",
    followUpDays: 1,
    waitingOn: "agent",
    communicationStatus: "waiting_for_agent",
    communicationReady: true
  },

  no_response_follow_up: {
    intentCode: "no_response_follow_up",
    intentName: "No Response Follow-up",
    engagementType: "no_response_follow_up",
    nextAction: "soft_follow_up",
    nextActionLabel: "Soft follow-up",
    followUpDays: 1,
    waitingOn: "agent",
    communicationStatus: "waiting_for_agent",
    communicationReady: true
  },

  payment_reminder: {
    intentCode: "payment_reminder",
    intentName: "Payment Reminder",
    engagementType: "payment_follow_up",
    nextAction: "payment_follow_up",
    nextActionLabel: "Payment follow-up",
    followUpDays: 1,
    waitingOn: "agent",
    communicationStatus: "waiting_for_agent",
    communicationReady: true
  },

  revision_confirmation: {
    intentCode: "revision_confirmation",
    intentName: "Revision Confirmation",
    engagementType: "revision_follow_up",
    nextAction: "revision_follow_up",
    nextActionLabel: "Revision follow-up",
    followUpDays: 1,
    waitingOn: "agent",
    communicationStatus: "waiting_for_agent",
    communicationReady: true
  },

  meeting_follow_up: {
    intentCode: "meeting_follow_up",
    intentName: "Meeting Follow-up",
    engagementType: "meeting_follow_up",
    nextAction: "meeting_follow_up",
    nextActionLabel: "Meeting follow-up",
    followUpDays: 2,
    waitingOn: "agent",
    communicationStatus: "waiting_for_agent",
    communicationReady: true
  },

  lost_lead_reconnect: {
    intentCode: "lost_lead_reconnect",
    intentName: "Lost Lead Reconnect",
    engagementType: "lost_reconnect",
    nextAction: "reconnect",
    nextActionLabel: "Reconnect",
    followUpDays: 3,
    waitingOn: "agent",
    communicationStatus: "waiting_for_agent",
    communicationReady: true
  },

  relationship_touchpoint: {
    intentCode: "thank_you_relationship",
    intentName: "Relationship Touchpoint",
    engagementType: "relationship_touchpoint",
    nextAction: "relationship_follow_up",
    nextActionLabel: "Relationship follow-up",
    followUpDays: 7,
    waitingOn: "none",
    communicationStatus: "relationship_touchpoint",
    communicationReady: true
  }
};

export function getOutcomeLabel(outcomeCode = "") {
  return (
    ENGAGEMENT_OUTCOME_OPTIONS.find(item => item.key === outcomeCode)?.label ||
    ""
  );
}

export function getIntentFromEngagement({
  channel = "",
  direction = "outbound",
  outcomeCode = "",
  hasDestination = false,
  hasSharedAssets = false,
  scheduledAt = "",
  isMeeting = false
} = {}) {
  const safeChannel = normalize(channel);
  const safeDirection = normalize(direction);
  const outcome = normalize(outcomeCode);

  let meta = INTENT_META.ask_requirement;
  let reason = "Default requirement collection";

  if (outcome === "payment_pending") {
    meta = INTENT_META.payment_reminder;
    reason = "Outcome is payment pending";
  } else if (outcome === "revision_needed") {
    meta = INTENT_META.revision_confirmation;
    reason = "Outcome is revision needed";
  } else if (
    outcome === "call_not_picked" ||
    outcome === "no_response"
  ) {
    meta = INTENT_META.no_response_follow_up;
    reason = "No response from travel agent";
  } else if (
    outcome === "quote_shared" ||
    outcome === "quote_needed"
  ) {
    meta = INTENT_META.quote_follow_up;
    reason = "Quotation related outcome";
  } else if (
    outcome === "profile_shared" ||
    hasSharedAssets
  ) {
    meta = INTENT_META.send_destination_package;
    reason = "Assets or profile/package shared";
  } else if (
    outcome === "requirement_pending" ||
    outcome === "requirement_received" ||
    outcome === "followup_required"
  ) {
    meta = INTENT_META.ask_requirement;
    reason = "Requirement or follow-up required";
  } else if (
    outcome === "meeting_scheduled" ||
    safeChannel === "meeting" ||
    isMeeting
  ) {
    meta = INTENT_META.meeting_follow_up;
    reason = "Meeting engagement";
  } else if (outcome === "not_interested") {
    meta = INTENT_META.lost_lead_reconnect;
    reason = "Agent not interested";
  } else if (outcome === "future_follow_up") {
    meta = INTENT_META.no_response_follow_up;
    reason = "Future follow-up required";
  } else if (outcome === "intro_done") {
    meta = INTENT_META.new_agent_intro;
    reason = "Introduction completed";
  } else if (hasDestination) {
    meta = INTENT_META.send_destination_package;
    reason = "Destination selected";
  } else if (safeChannel === "email" && safeDirection === "outbound") {
    meta = INTENT_META.new_agent_intro;
    reason = "Outbound email engagement";
  } else if (outcome === "general_update") {
    meta = INTENT_META.relationship_touchpoint;
    reason = "General relationship update";
  }

  const followUpRecommended =
    Boolean(scheduledAt) ||
    [
      "call_not_picked",
      "no_response",
      "followup_required",
      "requirement_pending",
      "quote_shared",
      "quote_needed",
      "payment_pending",
      "revision_needed",
      "future_follow_up"
    ].includes(outcome);

  return {
    ...meta,
    reason,
    source: "engagement_form",
    outcomeCode,
    outcomeLabel: getOutcomeLabel(outcomeCode),
    channel: safeChannel,
    direction: safeDirection,
    followUpRecommended
  };
}