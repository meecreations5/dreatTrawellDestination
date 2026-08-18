export const MEETING_TYPES = [
  { value: "in_person", label: "In-person" },
  { value: "online", label: "Online" },
  { value: "phone", label: "Phone Call" }
];

export const MEETING_STATUSES = [
  { value: "scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed" },
  { value: "rescheduled", label: "Rescheduled" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no_show", label: "No Show" }
];

export const MEETING_OUTCOMES = [
  { value: "positive", label: "Positive" },
  { value: "lead_generated", label: "Lead Generated" },
  { value: "quotation_required", label: "Quotation Required" },
  { value: "follow_up_required", label: "Follow-up Required" },
  { value: "no_requirement", label: "No Requirement" },
  { value: "not_interested", label: "Not Interested" },
  { value: "invalid_agent", label: "Invalid Agent" },
  { value: "other", label: "Other" }
];

export const NO_SHOW_PARTIES = [
  { value: "agent", label: "Travel Agent No Show" },
  { value: "team_member", label: "Team Member No Show" }
];

export function toMeetingDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value?.toDate === "function") return value.toDate();
  if (typeof value?.seconds === "number") return new Date(value.seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getMeetingStatusMeta(status = "scheduled") {
  return MEETING_STATUSES.find(item => item.value === status) || MEETING_STATUSES[0];
}

export function formatMeetingDateTime(value) {
  const date = toMeetingDate(value);
  if (!date) return "Date not available";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
}
