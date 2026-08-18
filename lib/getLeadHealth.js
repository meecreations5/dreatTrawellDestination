// lib/getLeadHealth.js

export function getLeadHealth(lead) {
  if (!lead) return { label: "Unknown", color: "gray" };

  if (lead.stage === "closed_won")
    return { label: "Won", color: "green" };

  if (lead.stage === "closed_lost")
    return { label: "Lost", color: "red" };

  const now = Date.now();

  // 🔥 Overdue next action (CANONICAL)
  if (lead.nextActionDueAt?.seconds) {
    const next = lead.nextActionDueAt.seconds * 1000;
    if (next < now) {
      return { label: "At Risk", color: "red" };
    }
  }

  // Stale activity
  if (lead.lastActivityAt?.seconds) {
    const last = lead.lastActivityAt.seconds * 1000;
    const days = (now - last) / (1000 * 60 * 60 * 24);
    if (days > 7) {
      return { label: "Cold", color: "orange" };
    }
  }

  return { label: "Healthy", color: "green" };
}
