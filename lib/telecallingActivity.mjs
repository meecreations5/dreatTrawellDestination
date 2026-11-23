// Shared, side-effect-free Telecalling list rules. Do not infer call ownership
// from assignment ownership: these are separate relationships.
import { isAgentUnassigned, isAgentContactable } from './telecallingCore.mjs';

const clean = value => String(value ?? '').trim();
const doneOutcomes = new Set(['not_interested', 'invalid_number']);

export function telecallingTimeMs(value) {
  if (value == null || value === '') return null;
  if (typeof value?.toMillis === 'function') {
    const result = value.toMillis();
    return Number.isFinite(result) ? result : null;
  }
  if (typeof value?.toDate === 'function') {
    const result = value.toDate()?.getTime?.();
    return Number.isFinite(result) ? result : null;
  }
  if (typeof value?.seconds === 'number') return value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1e6);
  const result = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(result) ? result : null;
}

export function followUpBucket(agent, now = new Date()) {
  const due = telecallingTimeMs(agent?.telecallerFollowUpAt);
  if (due == null) return 'none';
  const current = now instanceof Date ? now : new Date(now);
  if (!Number.isFinite(current.getTime())) return 'none';
  const startToday = new Date(current.getFullYear(), current.getMonth(), current.getDate()).getTime();
  const startTomorrow = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 1).getTime();
  if (due < startToday) return 'overdue';
  if (due < startTomorrow) return 'today';
  return 'upcoming';
}

export function buildTelecallingActivityLists({ agents = [], userUid = '', calledAgentIds = [], adminView = false } = {}) {
  const uid = clean(userUid);
  const calledIds = new Set(calledAgentIds.map(clean));
  const active = agents.filter(a => a && !a.deleted && !a.isDeleted);
  const ownCall = a => Boolean(uid) && (clean(a.telecallerLastCalledByUid) === uid || calledIds.has(clean(a.id)));
  const queue = active.filter(a => isAgentUnassigned(a) && isAgentContactable(a));
  const called = active.filter(ownCall);
  const followups = queue.filter(a => telecallingTimeMs(a.telecallerFollowUpAt) != null &&
    (adminView || clean(a.telecallerLastCalledByUid) === uid));
  const interested = queue.filter(a => a.telecallerQualification === 'qualified' && (adminView || ownCall(a)));
  const excluded = active.filter(a => doneOutcomes.has(clean(a.telecallerLastOutcome)) && ownCall(a));
  return { queue, called, followups, interested, excluded };
}

export function sortTelecallingList(items, view) {
  const name = a => clean(a.agencyName || a.name || a.agentName).toLowerCase();
  return [...items].sort((a, b) => {
    if (view === 'followups') {
      return (telecallingTimeMs(a.telecallerFollowUpAt) ?? Infinity) -
        (telecallingTimeMs(b.telecallerFollowUpAt) ?? Infinity) || name(a).localeCompare(name(b));
    }
    const aCall = telecallingTimeMs(a.telecallerLastCallAt) ?? 0;
    const bCall = telecallingTimeMs(b.telecallerLastCallAt) ?? 0;
    return (view === 'queue' ? aCall - bCall : bCall - aCall) || name(a).localeCompare(name(b));
  });
}
