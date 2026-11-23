// Pure workflow rules shared by the UI and transaction service.
export const TELECALL_OUTCOMES = [
  { value: "interested", label: "Connected - Interested", connected: true, qualified: true },
  { value: "follow_up", label: "Connected - Follow-up required", connected: true, qualified: false },
  { value: "not_interested", label: "Connected - Not interested", connected: true, qualified: false },
  { value: "no_answer", label: "No answer", connected: false, qualified: false },
  { value: "busy", label: "Busy / call later", connected: false, qualified: false },
  { value: "switched_off", label: "Switched off", connected: false, qualified: false },
  { value: "invalid_number", label: "Invalid number", connected: false, qualified: false }
];

export const TELECALLER_HANDOFF_ROLES = ["employee", "operation_executive"];
export const getTelecallOutcome = value => TELECALL_OUTCOMES.find(item => item.value === value) || null;
export const isAgentUnassigned = agent => !String(agent?.assignedToUid || agent?.accountManagerUid || agent?.assignedTo || agent?.assignedToName || "").trim();
const blockedStatus = new Set(["inactive", "invalid_number", "business_shut_down", "not_interested", "temporarily_closed", "wrong_details", "duplicate", "do_not_contact", "blacklisted"]);
export const isAgentContactable = agent => !blockedStatus.has(String(agent?.status || agent?.agentStatus || "").toLowerCase().replace(/[\s-]+/g, "_")) &&
  !["not_interested", "invalid_number"].includes(String(agent?.telecallerLastOutcome || "")) && agent?.active !== false;
export const isHandoffEligible = agent => isAgentUnassigned(agent) && isAgentContactable(agent) && agent?.telecallerQualification === "qualified";
export const canReceiveTelecallerHandoff = user => Boolean(user && user.active !== false && TELECALLER_HANDOFF_ROLES.includes(String(user.role || "").toLowerCase()));

export function validateTelecall({ outcome, summary, followUpAt }) {
  const value = getTelecallOutcome(outcome);
  if (!value) throw new Error("Choose a valid call outcome.");
  if (typeof summary !== "string" || summary.trim().length < 5) throw new Error("Enter at least five characters describing the call.");
  if (summary.length > 3000) throw new Error("Call summary must be under 3000 characters.");
  if (followUpAt && !Number.isFinite(new Date(followUpAt).getTime())) throw new Error("Invalid follow-up date.");
  return value;
}
