import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTravelAgentActivationReport, activationStageForRow } from '../lib/travelAgentActivationReport.js';
import { canAccess, getAdminModulesForRole, getRoleLabel } from '../lib/rolePermissions.js';

const employee = { uid: 'e1', role: 'employee', active: true };
const operations = { uid: 'o1', role: 'operation_executive', active: true };
const admin = { uid: 'a1', role: 'admin', active: true };

test('relationship executive can create and edit, but cannot delete or sync system templates', () => {
  assert.equal(canAccess(employee, 'communications.view'), true);
  assert.equal(canAccess(employee, 'communications.create'), true);
  assert.equal(canAccess(employee, 'communications.edit'), true);
  assert.equal(canAccess(employee, 'communications.delete'), false);
  assert.equal(canAccess(employee, 'settings.edit'), false);
  assert.ok(getAdminModulesForRole('employee').includes('communications'));
  assert.match(getRoleLabel('employee'), /Engagement \/ Relationship Executive/);
  assert.equal(canAccess(operations, 'communications.create'), false);
  assert.equal(canAccess(operations, 'communications.edit'), false);
  assert.equal(canAccess(admin, 'communications.delete'), true);
});

const agents = [
  { id: 'a1', agencyName: 'Sun Holidays', status: 'active', assignedToName: 'Pallavi' },
  { id: 'a2', agencyName: 'Moon Travel', status: 'active', assignedToName: 'Rizwan' },
  { id: 'a3', agencyName: 'Star Travel', status: 'active' },
  { id: 'a4', agencyName: 'Nova DMC', status: 'active' },
  { id: 'a5', agencyName: 'No Contact Yet', status: 'active' },
  { id: 'a6', agencyName: 'Wrong Number', status: 'invalid_number' },
  { id: 'a7', agencyName: 'Duplicate Co', status: 'active' },
  { id: 'a8', agencyName: 'Duplicate Co', status: 'active' },
  { id: 'a9', agencyName: 'Mail Only', status: 'active' }
];
const date = day => new Date(`2026-11-${day}T11:00:00Z`);
const engagements = [
  { agentId: 'a1', channel: 'call', outcomeCode: 'call_not_picked', createdAt: date('02') },
  { agentId: 'a1', channel: 'call', outcomeCode: 'call_connected', createdAt: date('03') },
  { agentId: 'a1', channel: 'email', outcomeCode: 'profile_shared', createdAt: date('04') },
  { agentId: 'a2', channel: 'whatsapp', outcomeCode: 'promotion_shared', createdAt: date('05') },
  { agentId: 'a2', channel: 'whatsapp', connectionStatus: 'not_applicable', outcomeCode: 'no_response', createdAt: date('05') },
  { agentId: 'a3', channel: 'call', outcomeCode: 'no_response', createdAt: date('06') },
  { agentId: 'a6', channel: 'call', outcomeCode: 'call_connected', createdAt: date('06') },
  { agentName: 'Duplicate Co', channel: 'call', outcomeCode: 'intro_done', createdAt: date('07') },
  { agentId: 'a9', channel: 'email', createdAt: date('07') }
];
const leads = [
  { id: 'l1', agentId: 'a1', createdAt: date('06'), stage: 'new_enquiry' },
  { id: 'l2', travelAgentId: 'a2', createdAt: date('07'), stage: 'converted', convertedAt: date('10') },
  { id: 'l3', agentId: 'a4', createdAt: date('07'), stage: 'lost', lostAt: date('09') },
  { id: 'l4', agentId: 'a1', createdAt: date('08'), stage: 'converted', convertedAt: date('11') },
  { id: 'l5', agentId: 'a1', createdAt: date('01'), stage: 'new_enquiry', convertedAt: date('08') }, // reopened
  { id: 'l6', agentName: 'Duplicate Co', createdAt: date('08'), stage: 'converted', convertedAt: date('10') },
  { id: 'l7', agentId: 'a6', createdAt: date('08'), stage: 'converted', convertedAt: date('09') },
  { id: 'l8', agentId: 'a4', createdAt: date('03'), stage: 'cancelled_invalid' }
];

test('per-agent activation and closure funnel uses linked real outcomes, excludes duplicates and invalid agents', () => {
  const report = buildTravelAgentActivationReport({ travelAgents: agents, engagements, leads });
  assert.equal(report.summary.validAgents, 8);
  assert.equal(report.summary.invalidAgents, 1);
  assert.equal(report.summary.notConnected, 3);
  assert.equal(report.summary.engagements, 4);
  assert.equal(report.summary.leads, 6); // Includes cancelled; excludes ambiguous name and invalid agent
  assert.equal(report.summary.won, 2);
  assert.equal(report.summary.lost, 1);
  const rows = Object.fromEntries(report.rows.map(row => [row.id, row]));
  assert.equal(rows.a1.activationStage, 'converted');
  assert.equal(rows.a1.notConnected, 1);
  assert.equal(rows.a1.callConnected, 1);
  assert.equal(rows.a1.won, 1);
  assert.equal(rows.a2.activationStage, 'converted');
  assert.equal(rows.a3.activationStage, 'attempted');
  assert.equal(rows.a4.activationStage, 'lead_contributor');
  assert.equal(rows.a5.activationStage, 'no_outreach');
  assert.equal(rows.a9.activationStage, 'contacted');
  assert.equal(rows.a7.leads, 0);
  assert.equal(rows.a8.leads, 0);
  assert.equal(report.summary.convertedPartners, 2);
  assert.equal(report.summary.leadContributors, 3);
});

test('closures have an independent date window; current status prevents historic reopened wins', () => {
  const report = buildTravelAgentActivationReport({
    travelAgents: agents, engagements, leads,
    fromDate: date('09'),
    toDate: date('12')
  });
  const rows = Object.fromEntries(report.rows.map(row => [row.id, row]));
  assert.equal(report.summary.leads, 0);
  assert.equal(report.summary.won, 2);
  assert.equal(report.summary.lost, 1);
  assert.equal(rows.a1.activationStage, 'converted');
  assert.equal(rows.a4.activationStage, 'closed_lost');
});

test('activation stage order is deterministic', () => {
  assert.equal(activationStageForRow({ won: 1 }), 'converted');
  assert.equal(activationStageForRow({ won: 0, leads: 1 }), 'lead_contributor');
  assert.equal(activationStageForRow({ won: 0, leads: 0, lost: 1 }), 'closed_lost');
  assert.equal(activationStageForRow({ won: 0, leads: 0, lost: 0, activatedEngagements: 1 }), 'activated');
  assert.equal(activationStageForRow({ won: 0, leads: 0, activatedEngagements: 0, engagements: 1 }), 'contacted');
  assert.equal(activationStageForRow({ won: 0, leads: 0, activatedEngagements: 0, engagements: 0, notConnected: 1 }), 'attempted');
  assert.equal(activationStageForRow({ won: 0, leads: 0, activatedEngagements: 0, engagements: 0, notConnected: 0 }), 'no_outreach');
});

test('not interested is a contact but cannot activate an agent relationship', () => {
  const report = buildTravelAgentActivationReport({
    travelAgents: [{ id: 'reject', agencyName: 'Not Interested Agent', status: 'not_interested' }],
    engagements: [{ agentId: 'reject', channel: 'call', outcomeCode: 'not_interested', createdAt: date('05') }]
  });
  assert.equal(report.rows[0].activationStage, 'contacted');
  assert.equal(report.rows[0].activatedEngagements, 0);
});

test('legacy ID aliases resolve safely without attributing a conflicting agent', () => {
  const result = buildTravelAgentActivationReport({
    travelAgents: [{ id: 'a', agencyName: 'अदिति ट्रॅव्हल्स' }, { id: 'b', agencyName: 'Other' }],
    leads: [
      { id: 'new', travelAgentId: 'retired-id', agentId: 'a', createdAt: date('05') },
      { id: 'bad', travelAgentId: 'a', agentId: 'b', createdAt: date('05') },
      { id: 'legacy', agentName: 'अदिति ट्रॅव्हल्स', createdAt: date('05') }
    ]
  });
  assert.equal(result.rows.find(row => row.id === 'a').leads, 2);
  assert.equal(result.rows.find(row => row.id === 'b').leads, 0);
});
