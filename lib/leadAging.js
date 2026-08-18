import { normalizeLeadStage, isTerminalLeadStage } from "./leadStages";

function toDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function diffDays(from, to = new Date()) {
  const start = toDate(from);
  const end = toDate(to);
  if (!start || !end) return null;
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000));
}

function getLastStageDate(lead) {
  const history = Array.isArray(lead?.stageHistory) ? lead.stageHistory : [];
  const normalizedStage = normalizeLeadStage(lead?.stage || lead?.status || "");
  const matching = [...history]
    .reverse()
    .find(row => normalizeLeadStage(row?.stage || row?.status || "") === normalizedStage);

  return (
    matching?.changedAt ||
    matching?.createdAt ||
    lead?.stageUpdatedAt ||
    lead?.updatedAt ||
    lead?.createdAt ||
    null
  );
}

export function getLeadNextActionDate(lead) {
  return toDate(
    lead?.nextActionDueAt ||
      lead?.nextActionAt ||
      lead?.nextFollowUpAt ||
      lead?.followUpAt ||
      lead?.followUpDate ||
      null
  );
}

export function getLeadLastActivityDate(lead) {
  return toDate(
    lead?.lastActivityAt ||
      lead?.lastEngagementAt ||
      lead?.lastFollowUpAt ||
      lead?.updatedAt ||
      lead?.createdAt ||
      null
  );
}

export function getLeadAging(lead, now = new Date()) {
  const stage = normalizeLeadStage(lead?.stage || lead?.status || "");
  const terminal = isTerminalLeadStage(stage);
  const createdAt = toDate(lead?.createdAt);
  const lastActivityAt = getLeadLastActivityDate(lead);
  const nextActionAt = getLeadNextActionDate(lead);
  const stageStartedAt = toDate(getLastStageDate(lead));

  const ageDays = diffDays(createdAt, now);
  const inactivityDays = diffDays(lastActivityAt, now);
  const stageAgeDays = diffDays(stageStartedAt, now);
  const overdue = Boolean(!terminal && nextActionAt && nextActionAt.getTime() < now.getTime());
  const noNextAction = Boolean(!terminal && !nextActionAt);

  let sla = "healthy";
  let slaLabel = "On Track";

  if (!terminal) {
    if (overdue) {
      sla = "overdue";
      slaLabel = "Follow-up Overdue";
    } else if (noNextAction) {
      sla = "no_action";
      slaLabel = "No Next Action";
    } else if ((inactivityDays ?? 0) >= 3) {
      sla = "at_risk";
      slaLabel = `${inactivityDays}d Inactive`;
    } else if ((stageAgeDays ?? 0) >= 5) {
      sla = "at_risk";
      slaLabel = `${stageAgeDays}d in Stage`;
    }
  }

  return {
    stage,
    terminal,
    createdAt,
    lastActivityAt,
    nextActionAt,
    stageStartedAt,
    ageDays,
    inactivityDays,
    stageAgeDays,
    overdue,
    noNextAction,
    sla,
    slaLabel
  };
}

export function formatLeadAge(days) {
  if (days == null) return "—";
  if (days === 0) return "Today";
  return `${days}d`;
}
