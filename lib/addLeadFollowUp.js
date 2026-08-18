// lib/addLeadFollowUp.js
import { logFollowUp } from "./logFollowUp";

/**
 * ⚠️ Deprecated wrapper (DO NOT add logic)
 */
export async function addLeadFollowUp({
  leadId,
  type,
  note,
  nextFollowUpAt,
  user
}) {
  return logFollowUp({
    leadId,
    channel: type,
    outcome: "connected",
    summary: note || "",
    nextFollowUpAt: nextFollowUpAt
      ? new Date(nextFollowUpAt)
      : null,
    user
  });
}
