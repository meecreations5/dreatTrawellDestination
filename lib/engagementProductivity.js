function normalize(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export const NOT_CONNECTED_OUTCOMES = new Set([
  "call_not_picked",
  "not_picked",
  "no_response",
  "busy",
  "call_busy",
  "not_reachable",
  "not_connected",
  "call_not_connected",
  "invalid_number",
  "wrong_details",
  "wrong_number",
  "business_shut_down",
  "do_not_contact",
  "blacklisted"
]);

export const EXPLICIT_CONNECTED_OUTCOMES = new Set([
  "call_connected",
  "intro_done",
  "profile_shared",
  "meeting_scheduled",
  "followup_required",
  "general_update",
  "requirement_pending",
  "requirement_received",
  "quote_needed",
  "quote_shared",
  "revision_needed",
  "payment_pending",
  "not_interested",
  "future_follow_up",
  "relationship_started",
  "relationship_reconnected",
  "relationship_strengthened",
  "destination_interest_identified",
  "client_segment_identified",
  "business_profile_updated",
  "no_current_query",
  "promotion_shared",
  "package_feedback_pending",
  "tentative_query_expected",
  "query_promised",
  "peak_season_requirement"
]);

export const MEANINGFUL_OUTCOMES = new Set([
  "intro_done",
  "profile_shared",
  "meeting_scheduled",
  "followup_required",
  "requirement_pending",
  "requirement_received",
  "quote_needed",
  "quote_shared",
  "revision_needed",
  "payment_pending",
  "relationship_started",
  "relationship_reconnected",
  "relationship_strengthened",
  "destination_interest_identified",
  "client_segment_identified",
  "business_profile_updated",
  "promotion_shared",
  "package_feedback_pending",
  "tentative_query_expected",
  "query_promised",
  "peak_season_requirement"
]);

export function isCallEngagementRecord(item = {}) {
  const channel = normalize(item.channel || item.type || item.activityType || item.engagementType);
  return channel.includes("call") || item.callAttempted === true;
}

export function getEngagementConnectionStatus(item = {}) {
  const explicit = normalize(item.connectionStatus);
  if (["connected", "not_connected", "not_applicable"].includes(explicit)) {
    return explicit;
  }

  const outcome = normalize(item.outcomeCode || item.result || item.response || item.agentResponse);
  if (NOT_CONNECTED_OUTCOMES.has(outcome)) return "not_connected";
  if (EXPLICIT_CONNECTED_OUTCOMES.has(outcome)) return "connected";

  const combined = [
    item.outcomeCode,
    item.outcomeLabel,
    item.result,
    item.response,
    item.agentResponse
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const negativeSignals = [
    "call not picked",
    "no response",
    "no answer",
    "not connected",
    "busy",
    "wrong number",
    "wrong details",
    "invalid number",
    "invalid contact",
    "business shut down",
    "do not contact",
    "not reachable",
    "unreachable",
    "switched off",
    "declined"
  ];

  if (negativeSignals.some(signal => combined.includes(signal))) {
    return "not_connected";
  }

  // Backward compatibility: legacy completed call/engagement rows that do not
  // contain a negative outcome were historically treated as successful contact.
  return combined || item.status === "completed" ? "connected" : "not_applicable";
}

export function isSuccessfulEngagementConnection(item = {}) {
  return getEngagementConnectionStatus(item) === "connected";
}

export function isMeaningfulEngagement(item = {}) {
  if (typeof item.meaningfulEngagement === "boolean") return item.meaningfulEngagement;
  const outcome = normalize(item.outcomeCode);
  return MEANINGFUL_OUTCOMES.has(outcome);
}

export function getBusinessProgressStage(item = {}) {
  const outcome = normalize(item.outcomeCode);
  if (outcome === "requirement_received" || outcome === "quote_needed") return "requirement";
  if (outcome === "quote_shared" || outcome === "revision_needed") return "quotation";
  if (outcome === "meeting_scheduled") return "meeting";
  if (outcome === "payment_pending") return "payment";
  return "relationship";
}

export function buildEngagementProductivityFields({ channel = "", outcomeCode = "" } = {}) {
  const record = { channel, outcomeCode };
  const isCall = isCallEngagementRecord(record);
  const connectionStatus = isCall
    ? getEngagementConnectionStatus(record)
    : "not_applicable";

  return {
    callAttempted: isCall,
    connectionStatus,
    callConnected: isCall && connectionStatus === "connected",
    meaningfulEngagement: isMeaningfulEngagement(record),
    businessProgressStage: getBusinessProgressStage(record),
    productivityVersion: 2
  };
}
