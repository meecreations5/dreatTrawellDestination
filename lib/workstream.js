import { normalizeRole, resolveUserRole } from "@/lib/rolePermissions";

export const WORKSTREAMS = {
  ENGAGEMENT: "engagement",
  LEAD_OPERATIONS: "lead_operations",
  MANAGEMENT: "management",
  FINANCE: "finance",
  MIXED: "mixed"
};

export function roleWorkstream(role) {
  const normalized = normalizeRole(role);
  if (normalized === "employee") return WORKSTREAMS.ENGAGEMENT;
  if (normalized === "operation_executive") return WORKSTREAMS.LEAD_OPERATIONS;
  if (["manager", "admin", "super_admin"].includes(normalized)) return WORKSTREAMS.MANAGEMENT;
  if (normalized === "finance") return WORKSTREAMS.FINANCE;
  return WORKSTREAMS.MIXED;
}

export function userWorkstream(user = {}) {
  return roleWorkstream(resolveUserRole(user));
}

export function workstreamLabel(workstream) {
  if (workstream === WORKSTREAMS.ENGAGEMENT) return "Engagement / Relationship";
  if (workstream === WORKSTREAMS.LEAD_OPERATIONS) return "Lead & Operations";
  if (workstream === WORKSTREAMS.MANAGEMENT) return "Management";
  if (workstream === WORKSTREAMS.FINANCE) return "Finance";
  return "General";
}

export function workstreamShortLabel(workstream) {
  if (workstream === WORKSTREAMS.ENGAGEMENT) return "Engagement";
  if (workstream === WORKSTREAMS.LEAD_OPERATIONS) return "Lead & Ops";
  if (workstream === WORKSTREAMS.MANAGEMENT) return "Management";
  if (workstream === WORKSTREAMS.FINANCE) return "Finance";
  return "General";
}

export function isEngagementWorkstream(userOrRole) {
  const stream = typeof userOrRole === "string"
    ? roleWorkstream(userOrRole)
    : userWorkstream(userOrRole || {});
  return stream === WORKSTREAMS.ENGAGEMENT;
}

export function isLeadOperationsWorkstream(userOrRole) {
  const stream = typeof userOrRole === "string"
    ? roleWorkstream(userOrRole)
    : userWorkstream(userOrRole || {});
  return stream === WORKSTREAMS.LEAD_OPERATIONS;
}
