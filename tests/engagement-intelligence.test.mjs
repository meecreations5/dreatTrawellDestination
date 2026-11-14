import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTravelAgentEngagementIntelligence } from '../lib/travelAgentEngagementIntelligence.js';
import { inferCommunicationPurpose } from '../lib/engagementIntelligenceTaxonomy.js';

const now = new Date('2026-11-13T18:00:00+05:30');
const at = day => new Date(`2026-11-${String(day).padStart(2, '0')}T12:00:00+05:30`);
const agents = [
  { id: 'a1', agencyName: 'Quality Travels', status: 'active', assignedToName: 'Pallavi' },
  { id: 'a2', agencyName: 'Broadcast Only', status: 'active', assignedToName: 'Eshaan' },
  { id: 'a3', agencyName: 'Never Contacted', status: 'active', assignedToName: 'Rizwan' },
  { id: 'a4', agencyName: 'Invalid Number', status: 'invalid_number' },
  { id: 'a5', agencyName: 'Duplicate Agency' },
  { id: 'a6', agencyName: 'Duplicate Agency' }
];
const call = (agentId, day, outcomeCode) => ({ agentId, channel: 'call', outcomeCode, createdAt: at(day) });
const inbound = (agentId, day, channel = 'whatsapp') => ({
  agentId, channel, direction: 'inbound', outcomeCode: 'general_update', createdAt: at(day)
});
const outbound = (agentId, day, communicationPurpose = 'promotion') => ({
  agentId, channel: 'whatsapp', direction: 'outbound', communicationPurpose, createdAt: at(day)
});

const realConversations = [
  call('a1', 1, 'requirement_received'),
  call('a1', 8, 'quote_needed'),
  call('a1', 12, 'call_connected'),
  inbound('a1', 2), inbound('a1', 9), inbound('a1', 13, 'email'), inbound('a1', 13, 'email'),
  call('a1', 10, 'busy'),
  ...[1,2,3,4,5,6,7,8,9,10,11,12].map(i => outbound('a2', i))
];

const build = args => buildTravelAgentEngagementIntelligence({
  travelAgents: agents, engagements: realConversations, now, ...args
});
const byId = report => Object.fromEntries(report.rows.map(row => [row.id, row]));

test('A+ is earned from sustained multi-week two-way interaction, not message volume', () => {
  const report = build();
  const rows = byId(report);
  assert.equal(report.summary.agents, 5);
  assert.equal(rows.a1.grade, 'A+');
  assert.equal(rows.a1.score, 100);
  assert.equal(rows.a1.callAttempts, 4);
  assert.equal(rows.a1.connectedCalls, 3);
  assert.equal(rows.a1.notConnectedCalls, 1);
  assert.equal(rows.a1.replyEvents, 4);
  assert.equal(rows.a1.replyDays, 3); // Same channel/day cannot inflate the grade.
  assert.equal(rows.a1.meaningfulDiscussions, 2);
  assert.equal(rows.a1.activeWeeks, 3);
  assert.equal(rows.a1.highEngagementNoEnquiry, true);
  assert.equal(rows.a2.whatsappOutbound, 12);
  assert.equal(rows.a2.score, 0);
  assert.equal(rows.a2.grade, 'C');
  assert.equal(rows.a3.grade, 'C');
});

test('Only documented replies are counted; call attempt is not a successful connection by default', () => {
  const report = build({ engagements: [
    { agentId: 'a1', channel: 'call', status: 'completed', createdAt: at(12) }, // unknown
    { agentId: 'a1', channel: 'email', direction: 'outbound', status: 'completed', createdAt: at(12) },
    { agentId: 'a1', channel: 'email', direction: 'outbound', agentResponseStatus: 'not_confirmed', createdAt: at(12) },
    { agentId: 'a1', channel: 'email', direction: 'outbound', agentResponseStatus: 'rates_requested', createdAt: at(13) },
    { agentId: 'a1', channel: 'whatsapp', direction: 'inbound', createdAt: at(13) },
    { agentId: 'a1', channel: 'call', outcomeCode: 'not_interested', createdAt: at(13) }
  ] });
  const a1 = byId(report).a1;
  assert.equal(a1.unknownCallOutcomes, 1);
  assert.equal(a1.connectedCalls, 1); // Not interested still means a connected call.
  assert.equal(a1.emailOutbound, 3);
  assert.equal(a1.replyEvents, 2);
  assert.equal(a1.replyDays, 2);
  assert.equal(a1.positiveResponseDays, 1);
});

test('Completed meeting counts; merely scheduled meeting does not', () => {
  const report = build({ engagements: [
    { agentId: 'a1', channel: 'meeting', status: 'scheduled', meetingAt: at(12), createdAt: at(11) },
    { agentId: 'a1', channel: 'meeting', meetingId: 'm1', engagedAt: at(12), createdAt: at(12) }
  ] });
  assert.equal(byId(report).a1.meetingsCompleted, 1);
  assert.equal(byId(report).a1.activeDays, 1);
});

test('Old, invalid, deleted, ambiguous and unmatched engagements cannot inflate agent grades', () => {
  const report = build({ engagements: [
    call('a1', 1, 'call_connected'),
    { agentId: 'a1', channel: 'call', outcomeCode: 'call_connected', createdAt: new Date('2026-10-01T10:00:00Z') },
    { agentId: 'a4', channel: 'call', outcomeCode: 'call_connected', createdAt: at(1) },
    { agentName: 'Duplicate Agency', channel: 'call', outcomeCode: 'call_connected', createdAt: at(1) },
    { agentId: 'a1', channel: 'call', outcomeCode: 'call_connected', deleted: true, createdAt: at(1) },
    { agentId: 'a1', agentRefId: 'a2', channel: 'call', outcomeCode: 'call_connected', createdAt: at(1) },
    { agentId: 'a1', channel: 'call', outcomeCode: 'call_connected' }
  ] });
  assert.equal(byId(report).a1.connectedCalls, 1);
  assert.equal(byId(report).a5.connectedCalls, 0);
  assert.equal(byId(report).a6.connectedCalls, 0);
  assert.equal(report.summary.ignoredUndated, 1);
  assert.equal(report.summary.unmatchedEngagements, 3);
});

test('Score and grade do not use lead or booking counts', () => {
  const none = build();
  const withBusiness = build({ leads: [
    { agentId: 'a1', stage: 'converted', createdAt: at(10), convertedAt: at(11) },
    { agentId: 'a2', stage: 'converted', createdAt: at(10), convertedAt: at(11) }
  ] });
  assert.equal(byId(withBusiness).a1.score, byId(none).a1.score);
  assert.equal(byId(withBusiness).a1.grade, 'A+');
  assert.equal(byId(withBusiness).a1.highEngagementNoEnquiry, false);
  assert.equal(byId(withBusiness).a2.grade, 'C');
  assert.equal(byId(withBusiness).a2.won, 1);
});

test('Legacy outcome classification is conservative and ignores message text', () => {
  assert.equal(inferCommunicationPurpose({ outcomeCode: 'quote_needed' }), 'rate_sharing');
  assert.equal(inferCommunicationPurpose({ message: 'HOT Dubai package offer' }), 'unclassified');
  assert.equal(inferCommunicationPurpose({ communicationPurpose: 'requirements' }), 'requirements');
});


test('No-enquiry flag is suppressed when leads cannot be read', () => {
  const report = build({ leadsAvailable: false });
  const a1 = byId(report).a1;
  assert.equal(a1.grade, 'A+');
  assert.equal(a1.highEngagementNoEnquiry, false);
  assert.match(a1.nextAction, /lead data unavailable/i);
});

test('Declined responses are documented replies but not positive meaningful conversations', () => {
  const report = build({ engagements: [
    { agentId: 'a1', channel: 'whatsapp', direction: 'outbound',
      communicationPurpose: 'feedback', agentResponseStatus: 'not_interested',
      outcomeCode: 'not_interested', createdAt: at(13) }
  ]});
  const row = byId(report).a1;
  assert.equal(row.replyEvents, 1);
  assert.equal(row.positiveResponseDays, 0);
  assert.equal(row.meaningfulDiscussions, 0);
});

test('Agent master do-not-contact status prevents outreach recommendations', () => {
  const report = build({ travelAgents: [
    { id: 'a1', agencyName: 'Quality Travels', status: 'do_not_contact' }
  ]});
  const row = byId(report).a1;
  assert.equal(row.highEngagementNoEnquiry, false);
  assert.match(row.nextAction, /do not initiate outreach/i);
});
