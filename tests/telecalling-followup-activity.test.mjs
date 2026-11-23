import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildTelecallingActivityLists,
  followUpBucket,
  sortTelecallingList,
  telecallingTimeMs
} from '../lib/telecallingActivity.mjs';
import { validateTelecall } from '../lib/telecallingCore.mjs';
const source = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const at = value => new Date(value);
const now = at('2026-11-23T12:00:00');

const agents = [
  { id: 'a', agencyName:'Today', telecallerLastCalledByUid:'caller', telecallerLastOutcome:'follow_up', telecallerFollowUpAt:at('2026-11-23T18:00:00'), telecallerLastCallAt:at('2026-11-22T09:00:00') },
  { id: 'b', agencyName:'Overdue', telecallerLastCalledByUid:'caller', telecallerLastOutcome:'busy', telecallerFollowUpAt:at('2026-11-22T09:00:00'), telecallerLastCallAt:at('2026-11-21T09:00:00') },
  { id: 'c', agencyName:'Tomorrow', telecallerLastCalledByUid:'other', telecallerLastOutcome:'interested', telecallerQualification:'qualified', telecallerFollowUpAt:at('2026-11-24T11:00:00') },
  { id: 'd', agencyName:'Not interested', telecallerLastCalledByUid:'caller', telecallerLastOutcome:'not_interested' },
  { id: 'e', agencyName:'Handed', telecallerLastCalledByUid:'caller', assignedToUid:'executive' },
  { id: 'f', agencyName:'History from another caller', telecallerLastCalledByUid:'other' },
  { id: 'g', agencyName:'Never called' },
  { id: 'h', agencyName:'Interested', telecallerLastCalledByUid:'caller', telecallerLastOutcome:'interested', telecallerQualification:'qualified' }
];

test('Every call can be located without an assignment, including history after another telecaller calls', () => {
  const lists = buildTelecallingActivityLists({ agents, userUid:'caller', calledAgentIds:['f'] });
  assert.deepEqual(lists.called.map(a => a.id).sort(), ['a','b','d','e','f','h']);
  assert.deepEqual(lists.interested.map(a => a.id), ['h']);
  assert.deepEqual(lists.excluded.map(a => a.id), ['d']);
  assert.ok(lists.queue.some(a => a.id === 'g'));
  assert.ok(!lists.queue.some(a => a.id === 'd' || a.id === 'e'));
});

test('Follow-up list contains only eligible unassigned agents belonging to this caller', () => {
  const lists = buildTelecallingActivityLists({ agents, userUid:'caller' });
  assert.deepEqual(lists.followups.map(a => a.id).sort(), ['a','b']);
  const admin = buildTelecallingActivityLists({ agents, userUid:'admin', adminView:true });
  assert.deepEqual(admin.followups.map(a => a.id).sort(), ['a','b','c']);
});

test('Follow-up statuses separate overdue, today, and future in the client timezone', () => {
  const byId = Object.fromEntries(agents.map(a => [a.id, a]));
  assert.equal(followUpBucket(byId.b, now), 'overdue');
  assert.equal(followUpBucket(byId.a, now), 'today');
  assert.equal(followUpBucket(byId.c, now), 'upcoming');
  assert.equal(followUpBucket(byId.g, now), 'none');
  assert.deepEqual(sortTelecallingList([byId.a, byId.c, byId.b], 'followups').map(a => a.id), ['b','a','c']);
});

test('Firestore timestamps, dates and ISO strings are supported, malformed dates are ignored', () => {
  const t = Date.parse('2026-11-23T12:00:00Z');
  assert.equal(telecallingTimeMs({toMillis:()=>t}), t);
  assert.equal(telecallingTimeMs({seconds:t/1000, nanoseconds:0}), t);
  assert.equal(telecallingTimeMs(at('2026-11-23T12:00:00Z')), t);
  assert.equal(telecallingTimeMs('invalid'), null);
  assert.equal(telecallingTimeMs(null), null);
});

test('A connected Follow-up required call must have a scheduled date and meaningful notes', () => {
  assert.throws(() => validateTelecall({outcome:'follow_up',summary:'Talked to partner'}), /schedule a follow-up date/);
  assert.equal(validateTelecall({outcome:'follow_up',summary:'Talked to partner',followUpAt:'2026-11-24T11:00:00'}).connected, true);
});

test('Workspace shows My Calls, Follow-ups with due buckets, Interested and Excluded', () => {
  const ui = source('../components/telecalling/TelecallingWorkspace.js');
  for (const term of ['"My Calls"', '"Follow-ups"', '"Interested - Pending Assignment"', '"Excluded"', '"Overdue"', '"Due today"', '"Upcoming"']) {
    assert.ok(ui.includes(term), term);
  }
  assert.match(ui, /where\("createdByUid", "==", user\.uid\)/);
  assert.match(ui, /switchView\("followups"\)/);
  assert.match(ui, /switchView\("called"\)/);
  assert.match(ui, /getTelecallingContactSearchText\(a\)/);
  assert.match(ui, /setPhoneFilter\] = useState\("with_phone"\)/);
});

test('Missed calls preserve an existing follow-up rather than erasing the reminder', () => {
  const service = source('../lib/telecallingService.js');
  assert.match(service, /const keepPreviousFollowUp = !followUpAt && \["no_answer", "busy", "switched_off"\]/);
  assert.match(service, /telecallerFollowUpAt: nextFollowUpAt/);
  assert.match(service, /status: "completed", scheduledAt: nextFollowUpAt/);
});
