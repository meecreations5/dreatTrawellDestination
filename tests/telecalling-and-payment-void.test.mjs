import test from 'node:test';
import assert from 'node:assert/strict';
import { TELECALL_OUTCOMES, getTelecallOutcome, isAgentUnassigned, isAgentContactable, isHandoffEligible, canReceiveTelecallerHandoff, validateTelecall } from '../lib/telecallingCore.mjs';
import { paymentIsVoided, validVoidReason, invoiceAllocationAfterVoid } from '../lib/paymentVoidCore.mjs';
import { canAccess, canAccessAdminModule, getAdminLandingPathForRole } from '../lib/rolePermissions.js';

const active = role => ({ uid: role, role, active: true });

test('Telecaller is isolated from leads, vendor, quotation and finance tools', () => {
  const caller = active('telecaller');
  assert.ok(canAccess(caller, 'telecalling.view'));
  assert.ok(canAccess(caller, 'telecalling.call'));
  assert.ok(canAccess(caller, 'telecalling.assign'));
  assert.ok(canAccessAdminModule(caller, 'telecalling'));
  assert.equal(getAdminLandingPathForRole('telecaller'), '/admin/telecalling');
  for (const denied of ['leads.create', 'leads.view', 'quotations.send', 'payments.create', 'payments.void', 'invoices.vendor.view', 'users.manage_role', 'travel_agents.edit', 'travel_agents.assign']) {
    assert.equal(canAccess(caller, denied), false, `Denied action: ${denied}`);
  }
  assert.equal(canAccessAdminModule(caller, 'invoices'), false);
  assert.equal(canAccess(active('operation_executive'), 'telecalling.assign'), false);
});

test('Only admins can void payments, including not finance', () => {
  assert.equal(canAccess(active('admin'), 'payments.void'), true);
  assert.equal(canAccess(active('super_admin'), 'payments.void'), true);
  for (const role of ['finance', 'manager', 'operation_executive', 'employee', 'telecaller']) {
    assert.equal(canAccess(active(role), 'payments.void'), false, role);
  }
});

test('Voided payments are excluded and reasons audited', () => {
  assert.equal(paymentIsVoided({ status: 'paid' }), false);
  assert.equal(paymentIsVoided({ status: 'voided' }), true);
  assert.equal(paymentIsVoided({ status: 'paid', voided: true }), true);
  assert.equal(validVoidReason('Mistaken CRM entry'), true);
  assert.equal(validVoidReason('wrong'), false);
  assert.equal(invoiceAllocationAfterVoid(100, 35.25), 64.75);
  assert.throws(() => invoiceAllocationAfterVoid(20, 35.25), /does not match/);
});

test('Interested call required for safe agent handover', () => {
  assert.ok(TELECALL_OUTCOMES.length >= 5);
  assert.equal(getTelecallOutcome('interested').connected, true);
  assert.equal(getTelecallOutcome('no_answer').connected, false);
  assert.equal(isAgentUnassigned({}), true);
  assert.equal(isAgentContactable({ status: "do_not_contact" }), false);
  assert.equal(isAgentContactable({ status: "active" }), true);
  assert.equal(isAgentUnassigned({ assignedToName: 'Pallavi' }), false);
  assert.equal(isHandoffEligible({}), false);
  assert.equal(isHandoffEligible({ telecallerQualification: 'qualified' }), true);
  assert.equal(isHandoffEligible({ assignedToUid: 'team1', telecallerQualification: 'qualified' }), false);
  assert.equal(canReceiveTelecallerHandoff(active('employee')), true);
  assert.equal(canReceiveTelecallerHandoff(active('operation_executive')), true);
  assert.equal(canReceiveTelecallerHandoff(active('finance')), false);
  assert.equal(canReceiveTelecallerHandoff({ role:'employee', active:false }), false);
});

test('Invalid outcomes, empty summaries and invalid dates are rejected', () => {
  assert.throws(() => validateTelecall({ outcome:'unknown', summary:'Talked' }), /valid call outcome/);
  assert.throws(() => validateTelecall({ outcome:'interested', summary:'hi' }), /five characters/);
  assert.throws(() => validateTelecall({ outcome:'interested', summary:'Connected', followUpAt:'invalid-date' }), /Invalid follow-up date/);
  assert.equal(validateTelecall({ outcome:'interested', summary:'Interested in Singapore' }).qualified, true);
});


test('Telecaller call evidence feeds the existing 30-day engagement score', async () => {
  const { buildTravelAgentEngagementIntelligence } = await import('../lib/travelAgentEngagementIntelligence.js');
  const row = buildTravelAgentEngagementIntelligence({
    travelAgents: [{ id:'a1', agencyName:'Sample Agent', status:'active' }],
    engagements: [{
      agentId:'a1', channel:'call', source:'telecalling',
      callAttempted:true,callConnected:true,callResult:'call_connected',
      outcomeCode:'call_connected', communicationPurpose:'introduction',
      createdAt: new Date('2026-11-19T10:00:00Z')
    }],
    leads: [], now: new Date('2026-11-19T11:00:00Z')
  });
  assert.equal(row.rows[0].callAttempts, 1);
  assert.equal(row.rows[0].connectedCalls, 1);
});
