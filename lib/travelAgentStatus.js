export const TRAVEL_AGENT_STATUS_OPTIONS = [
  { value: "active", label: "Active", tone: "green", contactable: true },
  { value: "inactive", label: "Inactive", tone: "slate", contactable: false },
  { value: "invalid_number", label: "Invalid Number", tone: "red", contactable: false },
  { value: "business_shut_down", label: "Business Shut Down / Not in Business", tone: "red", contactable: false },
  { value: "not_reachable", label: "Not Reachable", tone: "amber", contactable: true },
  { value: "not_interested", label: "Not Interested", tone: "amber", contactable: false },
  { value: "temporarily_closed", label: "Temporarily Closed", tone: "amber", contactable: false },
  { value: "wrong_details", label: "Wrong Details", tone: "red", contactable: false },
  { value: "duplicate", label: "Duplicate", tone: "slate", contactable: false },
  { value: "do_not_contact", label: "Do Not Contact", tone: "red", contactable: false },
  { value: "blacklisted", label: "Blacklisted", tone: "red", contactable: false }
];

const STATUS_MAP = new Map(
  TRAVEL_AGENT_STATUS_OPTIONS.map(item => [item.value, item])
);

export function normalizeTravelAgentStatus(value, activeFlag) {
  const normalized = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");

  if (STATUS_MAP.has(normalized)) return normalized;
  if (activeFlag === true) return "active";
  if (activeFlag === false) return "inactive";
  // Legacy travel-agent records often have no explicit status field.
  // Preserve the historical behaviour and treat those records as Active.
  return "active";
}

export function getTravelAgentStatusMeta(value, activeFlag) {
  const status = normalizeTravelAgentStatus(value, activeFlag);
  return STATUS_MAP.get(status) || STATUS_MAP.get("inactive");
}

export function isTravelAgentActive(value, activeFlag) {
  return normalizeTravelAgentStatus(value, activeFlag) === "active";
}

export function getTravelAgentStatusLabel(value, activeFlag) {
  return getTravelAgentStatusMeta(value, activeFlag).label;
}

export function outcomeToTravelAgentStatus(outcomeCode) {
  const outcome = String(outcomeCode || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  const map = {
    invalid_number: "invalid_number",
    wrong_number: "invalid_number",

    business_shut_down: "business_shut_down",
    business_shut_down_not_in_business: "business_shut_down",
    business_closed: "business_shut_down",
    not_in_business: "business_shut_down",
    no_longer_in_business: "business_shut_down",

    not_interested: "not_interested",
    wrong_details: "wrong_details",
    do_not_contact: "do_not_contact",
    blacklisted: "blacklisted"
  };

  return map[outcome] || "";
}
