import test from 'node:test';
import assert from 'node:assert/strict';
import {
  businessDateKey, getDealWonEventDate, getQuotationSentEventDate,
  getLeadCreatedEventDate, isWithinBusinessDates, isCurrentWon,
  validateWonDateInput, asReportDate
} from '../lib/reporting/leadReportingDates.mjs';
import { buildRelationshipPerformance } from '../lib/reporting/relationshipPerformance.mjs';
import { getEngagementConnectionStatus } from '../lib/engagementProductivity.js';
import { buildTravelAgentActivationReport } from '../lib/travelAgentActivationReport.js';

const at = (day,month=10) => new Date(`2026-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}T11:00:00+05:30`);
const sep=at(15,9),oct=at(8,10),nov=at(19,11);
const lead = {id:'lead-1',agentId:'a',stage:'converted',createdAt:sep,dealWonDateKey:'2026-10-08',convertedAt:nov,updatedAt:nov,latestQuotationSentAt:at(20,9)};

test('September enquiry confirmed in October is an October win even if updated in November',()=>{
  assert.equal(businessDateKey(getLeadCreatedEventDate(lead)),'2026-09-15');
  assert.equal(businessDateKey(getDealWonEventDate(lead)),'2026-10-08');
  assert.equal(isWithinBusinessDates(getDealWonEventDate(lead),'2026-09-01','2026-09-30'),false);
  assert.equal(isWithinBusinessDates(getDealWonEventDate(lead),'2026-10-01','2026-10-31'),true);
  assert.equal(isWithinBusinessDates(getDealWonEventDate(lead),'2026-11-01','2026-11-30'),false);
  assert.equal(businessDateKey(getQuotationSentEventDate(lead)),'2026-09-20');
});

test('No quotation date inferred from finalisation, latest edit or lead creation',()=>{
  assert.equal(getQuotationSentEventDate({stage:'quote_pending',finalQuotationAt:oct,updatedAt:nov,createdAt:sep}),null);
  assert.equal(getQuotationSentEventDate({stage:'converted',latestQuotationId:'quote-1',createdAt:sep}),null);
  assert.equal(businessDateKey(getQuotationSentEventDate({stage:'converted',quoteSentAt:sep,updatedAt:nov})),'2026-09-15');
});

test('Reopened lead is not a new win even with historic timestamps',()=>{
  const reopened={...lead,stage:'follow_up',status:'open'};
  assert.equal(isCurrentWon(reopened),false);
  assert.equal(getDealWonEventDate(reopened),null);
  assert.equal(getDealWonEventDate({stage:'converted',createdAt:sep,updatedAt:nov}),null);
});

test('Admin backdates only with confirmation evidence, no future/impossible dates',()=>{
  const base={wonDateKey:'2026-10-08',leadCreatedAt:sep,now:nov};
  assert.throws(()=>validateWonDateInput({...base,mayBackdate:false}),/Only Admin/);
  assert.throws(()=>validateWonDateInput({...base,mayBackdate:true}),/correction reason/);
  assert.throws(()=>validateWonDateInput({...base,mayBackdate:true,correctionReason:'Verified with agent'}),/confirmation reference/);
  const result=validateWonDateInput({...base,mayBackdate:true,correctionReason:'Verified with agent',confirmationReference:'AB123'});
  assert.equal(result.dateKey,'2026-10-08');
  assert.equal(result.isBackdated,true);
  assert.throws(()=>validateWonDateInput({wonDateKey:'2026-02-30',now:nov}),/valid actual/);
  assert.throws(()=>validateWonDateInput({wonDateKey:'2026-12-01',now:nov}),/future/);
  assert.throws(()=>validateWonDateInput({wonDateKey:'2026-09-14',leadCreatedAt:sep,now:nov,mayBackdate:true}),/before the lead/);
  assert.equal(businessDateKey(asReportDate('2026-10-08')),'2026-10-08');
});

const agents=[
  {id:'a',agencyName:'Sun Travel',status:'active',assignedToUid:'exec-1',assignedToName:'Pallavi',
    telecallerHandoffAt:at(18,9),telecallerHandoffByUid:'tc-1',telecallerHandoffByName:'Caller One'},
  {id:'b',agencyName:'Moon Travel',status:'active',telecallerQualification:'qualified',telecallerLastCalledByName:'Caller Two'}
];
const events=[
  {id:'t1',agentId:'a',source:'telecalling',channel:'call',callAttempted:true,callConnected:false,callSourceOutcome:'no_answer',createdAt:at(16,9),createdByUid:'tc-1',createdByName:'Caller One'},
  {id:'t2',agentId:'a',source:'telecalling',channel:'call',callAttempted:true,callConnected:true,callSourceOutcome:'interested',createdAt:at(17,9),createdByUid:'tc-1',createdByName:'Caller One'},
  {id:'p',agentId:'a',source:'engagement',channel:'whatsapp',status:'completed',createdAt:at(18,9)}
];
const leads=[
  {...lead,id:'lead-1',agentId:'a',assignedToUid:'exec-1',assignedToName:'Pallavi',createdAt:at(20,9),dealWonDateKey:'2026-10-08',latestQuotationSentAt:at(21,9)},
  {id:'lead-2',agentId:'a',assignedToUid:'exec-1',stage:'converted',createdAt:at(5,10),dealWonDateKey:'2026-11-02',convertedAt:at(2,11)}
];

test('Monthly event counts are independent and do not double-credit primary wins',()=>{
  const october=buildRelationshipPerformance({travelAgents:agents,engagements:events,leads,period:{from:'2026-10-01',to:'2026-10-31'},asOf:nov});
  assert.equal(october.summary.dealsWon,1);
  assert.equal(october.summary.newLeads,1);
  assert.equal(october.summary.quotesSent,0);
  assert.equal(october.summary.agentsHandedOver,0);
  assert.equal(october.callerRows.find(r=>r.id==='tc-1').assistedWins,1);
  assert.equal(october.executiveRows.find(r=>r.id==='exec-1').primaryWins,1);
  assert.equal(october.dealRows[0].date,'2026-10-08');
});

test('A distinct-agent cohort progresses through contact, qualify, handover, enquiry, win and repeat',()=>{
  const september=buildRelationshipPerformance({travelAgents:agents,engagements:events,leads,period:{from:'2026-09-01',to:'2026-09-30'},asOf:nov});
  assert.equal(september.summary.callAttempts,2);
  assert.equal(september.summary.connectedCalls,1);
  assert.equal(september.summary.qualifiedByTelecaller,1);
  assert.equal(september.summary.agentsHandedOver,1);
  assert.equal(september.summary.newLeads,1);
  assert.equal(september.summary.quotesSent,1);
  assert.equal(september.summary.dealsWon,0);
  assert.deepEqual(september.cohort.map(x=>x.count),[1,1,1,1,1,1]);
  assert.equal(september.callerRows.find(r=>r.id==='tc-1').connected,1);
  assert.equal(september.callerRows.find(r=>r.id==='tc-1').handovers,1);
});

test('Unanswered calls, one-way marketing, and duplicate names do not inflate genuine connections',()=>{
  const r=buildRelationshipPerformance({
    travelAgents:[{id:'x',agencyName:'Same Name'},{id:'y',agencyName:'Same Name'}],
    engagements:[
      {agentId:'x',channel:'call',outcomeCode:'no_answer',status:'completed',createdAt:oct},
      {agentId:'x',channel:'email',status:'completed',createdAt:oct},
      {agentName:'Same Name',channel:'call',callConnected:true,createdAt:oct}
    ],period:{from:'2026-10-01',to:'2026-10-31'},asOf:nov
  });
  assert.equal(r.summary.connectedCalls,0);
  assert.equal(r.summary.distinctAgentsContacted,0);
  assert.equal(getEngagementConnectionStatus({channel:'call',status:'completed'}),'not_applicable');
});

test('Management queue identifies qualified unassigned agents and missing executive first contact',()=>{
  const r=buildRelationshipPerformance({travelAgents:agents,engagements:events,leads,asOf:nov});
  assert.ok(r.actions.some(x=>x.type==='handover' && x.title==='Moon Travel'));
  assert.ok(r.actions.some(x=>x.type==='first_contact' && x.title==='Sun Travel'));
});

test('Agent activation counts October wins without counting the same lead in new October leads',()=>{
  const report=buildTravelAgentActivationReport({travelAgents:agents,engagements:events,leads,fromDate:at(1,10),toDate:at(31,10)});
  const row=report.rows.find(r=>r.id==='a');
  assert.equal(row.leads,1);
  assert.equal(row.won,1);
});

test('Payment-triggered conversion is flagged for verification instead of assumed confirmed on payment day',()=>{
  const paymentLead={...lead,id:'paid-auto',dealWonDateSource:'customer_payment_auto'};
  const report=buildRelationshipPerformance({travelAgents:agents,engagements:events,leads:[paymentLead],asOf:nov});
  assert.ok(report.actions.some(item => item.type === 'verify_win_date' && item.href.includes('paid-auto')));
});

test('Later agent / lead reassignment does not transfer the original closer credit',()=>{
  const won={...lead,id:'freeze-1',assignedToUid:'exec-2',assignedToName:'New Executive',
    dealWonExecutiveUid:'exec-1',dealWonExecutiveName:'Original Executive'};
  const report=buildRelationshipPerformance({travelAgents:agents,engagements:events,leads:[won],
    period:{from:'2026-10-01',to:'2026-10-31'},asOf:nov});
  assert.equal(report.executiveRows.length,1);
  assert.equal(report.executiveRows[0].id,'exec-1');
  assert.equal(report.executiveRows[0].name,'Original Executive');
  assert.equal(report.executiveRows[0].primaryWins,1);
});
