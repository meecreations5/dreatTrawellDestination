/** Stable, optional metadata for new Travel Agent engagement records.
 * Legacy engagements without these fields remain readable and score conservatively.
 */
export const COMMUNICATION_PURPOSES = [
  { value: "introduction", label: "Introduction / Relationship Building" },
  { value: "promotion", label: "Destination / Package Promotion" },
  { value: "rate_sharing", label: "Package / Rate Sharing" },
  { value: "requirements", label: "Requirement Discussion" },
  { value: "destination_update", label: "Market / Destination Updates" },
  { value: "feedback", label: "Follow-up / Feedback" },
  { value: "meeting_training", label: "Meeting / Training" },
  { value: "other", label: "Other" }
];

export const AGENT_RESPONSE_OPTIONS = [
  { value: "not_confirmed", label: "No reply confirmed" },
  { value: "replied", label: "Replied / Discussed" },
  { value: "interested", label: "Interested in packages" },
  { value: "rates_requested", label: "Requested costing / rates" },
  { value: "requirement_shared", label: "Shared a travel requirement" },
  { value: "not_interested", label: "Not interested" }
];

export const DOCUMENTED_RESPONSE_CODES = new Set(
  AGENT_RESPONSE_OPTIONS.map(item => item.value).filter(value => value !== "not_confirmed")
);
export const POSITIVE_RESPONSE_CODES = new Set(["interested", "rates_requested", "requirement_shared"]);

const LEGACY_PURPOSE_OUTCOMES = {
  intro_done: "introduction", relationship_started: "introduction", relationship_reconnected: "introduction",
  promotion_shared: "promotion", profile_shared: "introduction",
  quote_shared: "rate_sharing", quote_needed: "rate_sharing", revision_needed: "rate_sharing",
  requirement_received: "requirements", requirement_pending: "requirements",
  destination_interest_identified: "requirements", client_segment_identified: "requirements",
  tentative_query_expected: "requirements", query_promised: "requirements", peak_season_requirement: "requirements",
  package_feedback_pending: "feedback", followup_required: "feedback",
  meeting_scheduled: "meeting_training", meeting_completed: "meeting_training"
};

export const normalizeEngagementCode = value => String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");

export function inferCommunicationPurpose(item = {}) {
  const explicit = normalizeEngagementCode(item.communicationPurpose || item.contentCategory);
  if (COMMUNICATION_PURPOSES.some(purpose => purpose.value === explicit)) return explicit;
  return LEGACY_PURPOSE_OUTCOMES[normalizeEngagementCode(item.outcomeCode)] || "unclassified";
}
