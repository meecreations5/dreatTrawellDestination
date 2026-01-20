// lib/getNextActionStatus.js

export function getNextActionStatus(lead) {
  if (!lead?.nextActionDueAt) return "none";

  const due = lead.nextActionDueAt.toDate();
  const now = new Date();

  if (due < now) return "overdue";
  if (due.toDateString() === now.toDateString())
    return "today";

  return "upcoming";
}
