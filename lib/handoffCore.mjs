// Pure first-contact handover rules. One travel agent assignment is one handover.
export const DEFAULT_HANDOFF_SETTINGS = Object.freeze({ firstContactHours: 4 });
export const FIRST_CONTACT_OUTCOMES = Object.freeze([
  { value: "connected", label: "Connected - introduced myself", connected: true },
  { value: "follow_up", label: "Connected - follow-up needed", connected: true },
  { value: "no_answer", label: "No answer", connected: false },
  { value: "busy", label: "Busy / try again", connected: false }
]);
const clean = value => String(value ?? "").trim();
export function normalizeHandoffSettings(value = {}) {
  const hours = Number(value?.firstContactHours);
  return {
    firstContactHours: Number.isFinite(hours) ? Math.max(1, Math.min(48, Math.round(hours))) : DEFAULT_HANDOFF_SETTINGS.firstContactHours
  };
}
export function handoffDeadline(assignedAt, settings = DEFAULT_HANDOFF_SETTINGS) {
  const date = assignedAt instanceof Date ? assignedAt : new Date(assignedAt);
  if (!Number.isFinite(date.getTime())) throw new Error("Valid assignment date is required.");
  return new Date(date.getTime() + normalizeHandoffSettings(settings).firstContactHours * 60 * 60 * 1000);
}
export function handoffStatus(row = {}) {
  if (row.handoffStatus === "contacted") return "contacted";
  if (row.handoffStatus === "accepted") return "accepted";
  return "assigned";
}
export function isTelecallingHandoff(row = {}) {
  return row.source === "telecalling" && row.handoffType === "telecalling_handoff" && !!clean(row.assignedToUid) && !!clean(row.agentId);
}
export function asMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  if (Number.isFinite(value.seconds)) return value.seconds * 1000;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.getTime() : 0;
}
export function isHandoffOverdue(row, now = new Date()) {
  return isTelecallingHandoff(row) && handoffStatus(row) !== "contacted" &&
    asMillis(row.firstContactDueAt) > 0 && asMillis(now) > asMillis(row.firstContactDueAt);
}
export function isHandoffUnread(row) {
  return isTelecallingHandoff(row) && handoffStatus(row) === "assigned";
}
export function validateFirstContact({ outcome, summary }) {
  const result = FIRST_CONTACT_OUTCOMES.find(item => item.value === outcome);
  if (!result) throw new Error("Choose a valid first-contact outcome.");
  if (clean(summary).length < 5) throw new Error("Record at least five characters about the call.");
  if (clean(summary).length > 3000) throw new Error("Keep call notes under 3000 characters.");
  return result;
}
