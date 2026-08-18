// lib/engagementIntentMap.js

function normalize(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase();
}

/* =========================
   ENGAGEMENT OUTCOMES
========================= */

export const ENGAGEMENT_OUTCOME_OPTIONS = [
  {
    key: "call_not_picked",
    label: "Call Not Picked"
  },
  {
    key: "intro_done",
    label: "Introduction Done"
  },
  {
    key: "profile_shared",
    label: "Company Profile Shared"
  },
  {
    key: "meeting_scheduled",
    label: "Meeting Scheduled"
  },
  {
    key: "followup_required",
    label: "Follow-up Required"
  },
  {
    key: "general_update",
    label: "General Update"
  },
  {
    key: "no_response",
    label: "No Response"
  },
  {
    key: "requirement_pending",
    label: "Requirement Pending"
  },
  {
    key: "requirement_received",
    label: "Requirement Received"
  },
  {
    key: "quote_needed",
    label: "Quote Needed"
  },
  {
    key: "quote_shared",
    label: "Quote Shared"
  },
  {
    key: "revision_needed",
    label: "Revision Needed"
  },
  {
    key: "payment_pending",
    label: "Payment Pending"
  },
  {
    key: "not_interested",
    label: "Not Interested"
  },
  {
    key: "invalid_number",
    label: "Invalid Number"
  },
  {
    key: "business_shut_down",
    label: "Business Shut Down / Not in Business"
  },
  {
    key: "wrong_details",
    label: "Wrong Details"
  },
  {
    key: "do_not_contact",
    label: "Do Not Contact"
  },
  {
    key: "future_follow_up",
    label: "Future Follow-up"
  },

  /* =========================
     RELATIONSHIP OUTCOMES
  ========================= */

  {
    key: "relationship_started",
    label: "Relationship Started"
  },
  {
    key: "relationship_reconnected",
    label: "Relationship Reconnected"
  },
  {
    key: "relationship_strengthened",
    label: "Relationship Strengthened"
  },
  {
    key: "destination_interest_identified",
    label: "Destination Interest Identified"
  },
  {
    key: "client_segment_identified",
    label: "Client Segment Identified"
  },
  {
    key: "business_profile_updated",
    label: "Business Profile Updated"
  },

  /* =========================
     QUERY GENERATION OUTCOMES
  ========================= */

  {
    key: "no_current_query",
    label: "No Current Query"
  },
  {
    key: "promotion_shared",
    label: "Promotional Package Shared"
  },
  {
    key: "package_feedback_pending",
    label: "Package Feedback Pending"
  },
  {
    key: "tentative_query_expected",
    label: "Tentative Query Expected"
  },
  {
    key: "query_promised",
    label: "Agent Promised Query"
  },
  {
    key: "peak_season_requirement",
    label: "Peak-Season Requirement Expected"
  }
];

/* =========================
   INTENT CONFIGURATION
========================= */

export const INTENT_META = {
  agent_record_closed: {
    intentCode: "agent_record_closed",
    intentName: "Agent Record Closed",
    engagementType: "agent_record_status",
    nextAction: "none",
    nextActionLabel: "No follow-up",
    followUpDays: null,
    waitingOn: "none",
    communicationStatus: "closed",
    communicationReady: false
  },

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

/* =========================
   OUTCOME HELPERS
========================= */

export function getOutcomeLabel(outcomeCode = "") {
  const normalizedOutcome = normalize(outcomeCode);

  return (
    ENGAGEMENT_OUTCOME_OPTIONS.find(
      item =>
        normalize(item.key || item.value) === normalizedOutcome
    )?.label || ""
  );
}

/* =========================
   INTENT RESOLVER
========================= */

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

  /* =========================
     HIGH-PRIORITY OUTCOMES
  ========================= */

  if ([
    "invalid_number",
    "business_shut_down",
    "wrong_details",
    "do_not_contact"
  ].includes(outcome)) {
    meta = INTENT_META.agent_record_closed;
    reason = "Travel agent record is not contactable or no longer valid";
  } else if (outcome === "payment_pending") {
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
  }

  /* =========================
     NO QUERY & PROMOTION FLOW
  ========================= */

  else if (outcome === "no_current_query") {
    meta = INTENT_META.send_promotion;
    reason =
      "Agent has no current query; share a relevant promotional package";
  } else if (
    outcome === "promotion_shared" ||
    outcome === "package_feedback_pending"
  ) {
    meta = INTENT_META.send_promotion;
    reason =
      "Promotional package shared; follow up for relevance and feedback";
  }

  /* =========================
     AGENT BUSINESS UNDERSTANDING
  ========================= */

  else if (outcome === "destination_interest_identified") {
    meta = INTENT_META.send_destination_package;
    reason =
      "Agent destination interest identified; share a relevant package";
  } else if (outcome === "client_segment_identified") {
    meta = INTENT_META.send_promotion;
    reason =
      "Agent client segment identified; share a suitable promotional package";
  }

  /* =========================
     QUERY GENERATION FLOW
  ========================= */

  else if (
    outcome === "tentative_query_expected" ||
    outcome === "query_promised" ||
    outcome === "peak_season_requirement"
  ) {
    meta = INTENT_META.ask_requirement;
    reason =
      "Tentative or peak-season query expected from the travel agent";
  }

  /* =========================
     RELATIONSHIP FLOW
  ========================= */

  else if (
    outcome === "relationship_started" ||
    outcome === "relationship_reconnected" ||
    outcome === "relationship_strengthened" ||
    outcome === "business_profile_updated"
  ) {
    meta = INTENT_META.relationship_touchpoint;
    reason =
      "Relationship-building engagement with the travel agent";
  }

  /* =========================
     EXISTING ENGAGEMENT FLOW
  ========================= */

  else if (
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
  } else if (
    safeChannel === "email" &&
    safeDirection === "outbound"
  ) {
    meta = INTENT_META.new_agent_intro;
    reason = "Outbound email engagement";
  } else if (outcome === "general_update") {
    meta = INTENT_META.relationship_touchpoint;
    reason = "General relationship update";
  }

  /* =========================
     FOLLOW-UP RECOMMENDATION
  ========================= */

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
      "future_follow_up",

      "no_current_query",
      "promotion_shared",
      "package_feedback_pending",
      "destination_interest_identified",
      "client_segment_identified",
      "tentative_query_expected",
      "query_promised",
      "peak_season_requirement"
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