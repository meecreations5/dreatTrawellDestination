// lib/leadStages.js

export const LEAD_STAGES = {
  NEW_ENQUIRY: "new_enquiry",
  REQUIREMENT_PENDING: "requirement_pending",
  REQUIREMENT_COMPLETED: "requirement_completed",
  QUOTE_PENDING: "quote_pending",
  QUOTE_SENT: "quote_sent",
  FOLLOW_UP_PENDING: "follow_up_pending",
  REVISION_REQUIRED: "revision_required",
  HOT_LEAD: "hot_lead",
  PAYMENT_PENDING: "payment_pending",
  CONVERTED: "converted",
  LOST: "lost",
  FUTURE_FOLLOW_UP: "future_follow_up"
};

export const LEAD_STAGE_OPTIONS = [
  {
    value: LEAD_STAGES.NEW_ENQUIRY,
    label: "New enquiry",
    tone: "gray"
  },
  {
    value: LEAD_STAGES.REQUIREMENT_PENDING,
    label: "Requirement pending",
    tone: "amber"
  },
  {
    value: LEAD_STAGES.REQUIREMENT_COMPLETED,
    label: "Requirement completed",
    tone: "blue"
  },
  {
    value: LEAD_STAGES.QUOTE_PENDING,
    label: "Quote pending",
    tone: "orange"
  },
  {
    value: LEAD_STAGES.QUOTE_SENT,
    label: "Quote sent",
    tone: "purple"
  },
  {
    value: LEAD_STAGES.FOLLOW_UP_PENDING,
    label: "Follow-up pending",
    tone: "blue"
  },
  {
    value: LEAD_STAGES.REVISION_REQUIRED,
    label: "Revision required",
    tone: "violet"
  },
  {
    value: LEAD_STAGES.HOT_LEAD,
    label: "Hot lead",
    tone: "red"
  },
  {
    value: LEAD_STAGES.PAYMENT_PENDING,
    label: "Payment pending",
    tone: "yellow"
  },
  {
    value: LEAD_STAGES.CONVERTED,
    label: "Converted",
    tone: "green"
  },
  {
    value: LEAD_STAGES.LOST,
    label: "Lost",
    tone: "rose"
  },
  {
    value: LEAD_STAGES.FUTURE_FOLLOW_UP,
    label: "Future follow-up",
    tone: "cyan"
  }
];

export const LOST_REASONS = {
  PRICE_ISSUE: "price_issue",
  SLOW_RESPONSE: "slow_response",
  HOTEL_NOT_SUITABLE: "hotel_not_suitable",
  CUSTOMER_POSTPONED: "customer_postponed",
  AGENT_NOT_SERIOUS: "agent_not_serious",
  DESTINATION_CHANGED: "destination_changed",
  NO_RESPONSE: "no_response",
  COMPETITOR_WON: "competitor_won",
  BUDGET_MISMATCH: "budget_mismatch",
  TRAVEL_DATE_NOT_FIXED: "travel_date_not_fixed"
};

export const LOST_REASON_OPTIONS = [
  { value: LOST_REASONS.PRICE_ISSUE, label: "Price issue" },
  { value: LOST_REASONS.SLOW_RESPONSE, label: "Slow response" },
  { value: LOST_REASONS.HOTEL_NOT_SUITABLE, label: "Hotel not suitable" },
  { value: LOST_REASONS.CUSTOMER_POSTPONED, label: "Customer postponed" },
  { value: LOST_REASONS.AGENT_NOT_SERIOUS, label: "Agent not serious" },
  { value: LOST_REASONS.DESTINATION_CHANGED, label: "Destination changed" },
  { value: LOST_REASONS.NO_RESPONSE, label: "No response" },
  { value: LOST_REASONS.COMPETITOR_WON, label: "Competitor won" },
  { value: LOST_REASONS.BUDGET_MISMATCH, label: "Budget mismatch" },
  { value: LOST_REASONS.TRAVEL_DATE_NOT_FIXED, label: "Travel date not fixed" }
];

export const TERMINAL_LEAD_STAGES = [
  LEAD_STAGES.CONVERTED,
  LEAD_STAGES.LOST
];

export const LEGACY_STAGE_MAP = {
  new: LEAD_STAGES.NEW_ENQUIRY,
  assigned: LEAD_STAGES.REQUIREMENT_PENDING,
  follow_up: LEAD_STAGES.FOLLOW_UP_PENDING,
  vendor_pricing_requested: LEAD_STAGES.QUOTE_PENDING,
  awaiting_vendor_revert: LEAD_STAGES.QUOTE_PENDING,
  quoted: LEAD_STAGES.QUOTE_SENT,
  closed_won: LEAD_STAGES.CONVERTED,
  closed_lost: LEAD_STAGES.LOST
};

export function normalizeLeadStage(stage = "") {
  return LEGACY_STAGE_MAP[stage] || stage || LEAD_STAGES.NEW_ENQUIRY;
}

export function getLeadStageMeta(stage = "") {
  const normalizedStage = normalizeLeadStage(stage);

  return (
    LEAD_STAGE_OPTIONS.find(item => item.value === normalizedStage) || {
      value: normalizedStage,
      label: String(normalizedStage || "Unknown").replaceAll("_", " "),
      tone: "gray"
    }
  );
}

export function isTerminalLeadStage(stage = "") {
  return TERMINAL_LEAD_STAGES.includes(normalizeLeadStage(stage));
}

export function isLostStage(stage = "") {
  return normalizeLeadStage(stage) === LEAD_STAGES.LOST;
}

export function isConvertedStage(stage = "") {
  return normalizeLeadStage(stage) === LEAD_STAGES.CONVERTED;
}

export function getLostReasonLabel(reason = "") {
  return (
    LOST_REASON_OPTIONS.find(item => item.value === reason)?.label ||
    String(reason || "").replaceAll("_", " ")
  );
}