/** Read-only Telecaller -> Relationship Executive -> Business reporting.
 * Never guesses agent attribution from a common name (duplicate names exist).
 * Period event metrics are independent; the separate cohort funnel only counts
 * the SAME unique contacted agents progressing through later events.
 */
import {
  asReportDate, businessDateKey, getDealWonEventDate,
  getLeadCreatedEventDate, getQuotationSentEventDate,
  isCurrentWon, isWithinBusinessDates
} from "./leadReportingDates.mjs";
import { getBookingFinance, summarizeConfirmedBusiness } from "./businessIntelligence.mjs";

const keyOf = x => String(x || "").trim();
const lower = x => keyOf(x).toLowerCase().replace(/[\s-]+/g, "_");
const isDeleted = x => x?.deleted === true || x?.isDeleted === true || Boolean(x?.deletedAt);
const blocked = new Set(["do_not_contact", "blacklisted", "invalid_number", "not_interested", "business_shut_down", "duplicate"]);
const getAgentId = x => keyOf(x?.agentId || x?.travelAgentId || x?.agencyId || x?.agentRefId || x?.travelAgentRefId);
const getEventDate = x => asReportDate(x?.createdAt || x?.engagementDate || x?.activityAt || x?.date);
const callChannel = x => lower(x?.channel || x?.type || x?.engagementType).includes("call") || x?.callAttempted === true;
const noConnection = new Set(["no_answer","busy","call_busy","switched_off","not_picked","not_connected","call_not_picked","call_not_connected","invalid_number","wrong_number"]);
const connected = x => {
  const outcome = lower(x?.callSourceOutcome || x?.outcomeCode || x?.callResult || x?.result);
  const negative = noConnection.has(outcome) || lower(x?.connectionStatus) === "not_connected";
  return !negative && callChannel(x) && (x?.callConnected === true || lower(x?.callResult) === "call_connected" || lower(x?.connectionStatus) === "connected" || ["interested","follow_up","not_interested","call_connected"].includes(outcome));
};
const contacted = x => connected(x) || (x?.meaningfulReply === true && !noConnection.has(lower(x?.callSourceOutcome))) || lower(x?.meetingStatus) === "completed";
const qualified = x => lower(x?.callSourceOutcome || x?.outcomeCode) === "interested" || (contacted(x) && ["requirement_received", "quote_needed", "query_promised", "destination_interest_identified"].includes(lower(x?.outcomeCode)));
const endTime = date => asReportDate(date)?.getTime() || 0;
const daysBetween = (a, b) => Math.floor((endTime(a) - endTime(b)) / 86_400_000);
const isAgentContactable = agent => agent?.active !== false && !blocked.has(lower(agent?.status || agent?.agentStatus)) && !blocked.has(lower(agent?.telecallerLastOutcome));
const isUnassigned = agent => !keyOf(agent?.assignedToUid || agent?.accountManagerUid || agent?.assignedTo || agent?.assignedToName);
const agentName = agent => agent?.agencyName || agent?.name || agent?.agentName || "Travel Agent";

export function buildRelationshipPerformance({
  travelAgents = [], engagements = [], leads = [], period = { from: "", to: "" },
  asOf = new Date(), engagementGrades = []
} = {}) {
  const from = period?.from || "", to = period?.to || "";
  const agents = travelAgents.filter(a => !isDeleted(a));
  const byAgent = new Map(agents.map(a => [keyOf(a.id), a]));
  const matchingEngagements = engagements.filter(item => !isDeleted(item) && byAgent.has(getAgentId(item)));
  const matchingLeads = leads.filter(item => !isDeleted(item) && byAgent.has(getAgentId(item)));
  const periodEngagements = matchingEngagements.filter(x => isWithinBusinessDates(getEventDate(x), from, to));
  const periodLeads = matchingLeads.filter(x => isWithinBusinessDates(getLeadCreatedEventDate(x), from, to));
  const periodQuoteLeads = matchingLeads.filter(x => isWithinBusinessDates(getQuotationSentEventDate(x), from, to));
  const periodWonLeads = matchingLeads.filter(x => isCurrentWon(x) && isWithinBusinessDates(getDealWonEventDate(x), from, to));
  const periodHandedAgents = agents.filter(x => isWithinBusinessDates(x.telecallerHandoffAt, from, to));
  const confirmedBusiness = summarizeConfirmedBusiness(periodWonLeads, {from,to});

  const uniqueAgents = rows => new Set(rows.map(getAgentId).filter(id => byAgent.has(id)));
  const callAttempts = periodEngagements.filter(callChannel);
  const callsConnected = callAttempts.filter(connected);
  const realConnections = periodEngagements.filter(contacted);
  const telecalls = periodEngagements.filter(x => lower(x.source) === "telecalling" && callChannel(x));
  const telecallQualified = telecalls.filter(qualified);

  // Contacted agent COHORT -> later qualified -> handoff -> leads -> won.
  // Downstream events may occur after the reporting window, but never before
  // the selected contact / handoff. This is not a monthly closure count.
  const contactedAgentDates = new Map();
  realConnections.forEach(e => {
    const id = getAgentId(e), date = getEventDate(e);
    if (date && (!contactedAgentDates.has(id) || date < contactedAgentDates.get(id))) contactedAgentDates.set(id, date);
  });
  const cohortConnected = new Set(contactedAgentDates.keys());
  const cohortQualified = new Set();
  const cohortHanded = new Set();
  const cohortEnquiry = new Set();
  const cohortWon = new Set();
  const cohortRepeat = new Set();
  cohortConnected.forEach(id => {
    const firstContact = contactedAgentDates.get(id);
    const qualifying = matchingEngagements.filter(e => getAgentId(e) === id && qualified(e) && getEventDate(e) >= firstContact)
      .sort((a,b) => endTime(getEventDate(a)) - endTime(getEventDate(b)))[0];
    if (!qualifying) return;
    cohortQualified.add(id);
    const agent = byAgent.get(id);
    const handoff = asReportDate(agent.telecallerHandoffAt);
    if (!handoff || handoff < getEventDate(qualifying)) return;
    cohortHanded.add(id);
    const agentLeads = matchingLeads.filter(lead => getAgentId(lead) === id && getLeadCreatedEventDate(lead) >= handoff);
    if (!agentLeads.length) return;
    cohortEnquiry.add(id);
    const wins = agentLeads.filter(lead => isCurrentWon(lead) && getDealWonEventDate(lead));
    if (wins.length) cohortWon.add(id);
    const allWinMonths = new Set(matchingLeads.filter(lead => getAgentId(lead) === id && isCurrentWon(lead) && getDealWonEventDate(lead))
      .map(lead => businessDateKey(getDealWonEventDate(lead)).slice(0,7)));
    if (wins.length && allWinMonths.size >= 2) cohortRepeat.add(id);
  });

  // Preserve PRIMARY closure attribution for the lead's sales owner. Telecaller
  // gets an independent "assisted" credit, not a second booking.
  const performanceByCaller = new Map();
  const getCaller = (uid, name) => {
    const key = keyOf(uid) || keyOf(name) || "unmapped";
    if (!performanceByCaller.has(key)) performanceByCaller.set(key, {
      id:key, name:name || "Unknown caller", attempts:0, connected:0,
      qualifiedAgentIds:new Set(), handoverAgentIds:new Set(), assistedWonLeadIds:new Set()
    });
    return performanceByCaller.get(key);
  };
  telecalls.forEach(e => {
    const row = getCaller(e.createdByUid || e.assignedToUid, e.createdByName || e.assignedToName);
    row.attempts++;
    if (connected(e)) row.connected++;
    if (qualified(e)) row.qualifiedAgentIds.add(getAgentId(e));
  });
  periodHandedAgents.forEach(a => getCaller(a.telecallerHandoffByUid, a.telecallerHandoffByName).handoverAgentIds.add(keyOf(a.id)));
  periodWonLeads.forEach(l => {
    const agent = byAgent.get(getAgentId(l));
    if (!agent?.telecallerHandoffByUid || !agent.telecallerHandoffAt) return;
    if (endTime(getDealWonEventDate(l)) < endTime(agent.telecallerHandoffAt)) return;
    getCaller(agent.telecallerHandoffByUid, agent.telecallerHandoffByName).assistedWonLeadIds.add(keyOf(l.id));
  });
  const callerRows = Array.from(performanceByCaller.values()).map(row=>({
    id:row.id, name:row.name, attempts:row.attempts, connected:row.connected,
    qualified:row.qualifiedAgentIds.size, handovers:row.handoverAgentIds.size,
    assistedWins:row.assistedWonLeadIds.size,
    assistedBookedInr:periodWonLeads.filter(lead => row.assistedWonLeadIds.has(keyOf(lead.id)))
      .reduce((sum,lead)=>sum+(getBookingFinance(lead).sellingInr||0),0),
    assistedPendingInr:periodWonLeads.filter(lead => row.assistedWonLeadIds.has(keyOf(lead.id))&&!getBookingFinance(lead).verified).length
  })).sort((a,b)=>b.handovers-a.handovers || b.connected-a.connected);

  const executiveRowsByKey = new Map();
  periodWonLeads.forEach(lead => {
    const agent=byAgent.get(getAgentId(lead));
    const id=keyOf(lead.dealWonExecutiveUid || lead.assignedToUid || agent?.assignedToUid || lead.ownerUid || "unassigned");
    if (!executiveRowsByKey.has(id)) executiveRowsByKey.set(id,{
      id, name:lead.dealWonExecutiveName || lead.assignedToName || agent?.assignedToName || lead.ownerName || "Unassigned", primaryWins:0, leadIds:[], bookedInr:0, expectedGpInr:0, pendingInr:0
    });
    executiveRowsByKey.get(id).primaryWins++;
    executiveRowsByKey.get(id).leadIds.push(keyOf(lead.id));
    const finance = getBookingFinance(lead);
    if (finance.verified) {
      executiveRowsByKey.get(id).bookedInr += finance.sellingInr;
      executiveRowsByKey.get(id).expectedGpInr += finance.grossProfitInr;
    } else executiveRowsByKey.get(id).pendingInr += 1;
  });
  const executiveRows=Array.from(executiveRowsByKey.values()).sort((a,b)=>b.primaryWins-a.primaryWins);

  // Action queue is always current, not filtered by reporting period.
  const gradeMap=new Map(engagementGrades.map(row=>[keyOf(row.id),row]));
  const actions=[];
  const seen=new Set();
  const push=(id,type,title,description,href,owner)=>{
    const k=`${type}:${id}`; if(seen.has(k)) return;
    seen.add(k); actions.push({id:k,type,title,description,href,owner});
  };
  agents.forEach(agent => {
    const id=keyOf(agent.id),name=agentName(agent);
    if (!isAgentContactable(agent)) return;
    if (isUnassigned(agent) && agent.telecallerQualification === "qualified") {
      push(id,"handover",name,"Qualified agent awaiting executive assignment",`/admin/telecalling`,agent.telecallerLastCalledByName || "Telecalling");
    }
    const handoff=asReportDate(agent.telecallerHandoffAt);
    if (handoff && !isUnassigned(agent) && daysBetween(asOf,handoff)>=1) {
      const execEngaged=matchingEngagements.some(e=>getAgentId(e)===id &&
        keyOf(e.createdByUid || e.assignedToUid)===keyOf(agent.assignedToUid) &&
        getEventDate(e)>handoff);
      if (!execEngaged) push(id,"first_contact",name,"Handover complete; executive has not logged first contact",`/admin/travel-agents/${encodeURIComponent(id)}`,agent.assignedToName || "Relationship Executive");
    }
    const grade=gradeMap.get(id);
    if (grade?.highEngagementNoEnquiry) push(id,"relationship",name,"A+/A engagement but no enquiry in the last 30 days",`/admin/travel-agents/${encodeURIComponent(id)}`,agent.assignedToName || "Relationship Executive");
  });
  matchingLeads.forEach(lead=>{
    const id=keyOf(lead.id), label=lead.leadCode || lead.customerName || id;
    if (isCurrentWon(lead) && !getDealWonEventDate(lead)) {
      push(id,"missing_win_date",label,"Won lead missing a reliable confirmation date",`/admin/leads/${encodeURIComponent(id)}`,lead.assignedToName || "Admin");
    }
    if (isCurrentWon(lead) && lower(lead.dealWonDateSource) === "customer_payment_auto") {
      push(id,"verify_win_date",label,"Payment triggered conversion: verify the actual booking confirmation date (which may be earlier)",`/admin/leads/${encodeURIComponent(id)}`,"Admin");
    }
    const sent=getQuotationSentEventDate(lead);
    if (sent && !isCurrentWon(lead) && !["lost","cancelled_invalid","closed_lost"].includes(lower(lead.stage)) &&
       daysBetween(asOf,sent)>=3 && endTime(lead.lastFollowUpAt)<endTime(sent)) {
      push(id,"quote_followup",label,"Quotation sent but no later follow-up logged",`/admin/leads/${encodeURIComponent(id)}`,lead.assignedToName || "Relationship Executive");
    }
    const next=asReportDate(lead.nextActionDueAt || lead.nextFollowUpAt);
    if (next && !isCurrentWon(lead) && !["lost","cancelled_invalid","closed_lost"].includes(lower(lead.stage)) && next<asOf) {
      push(id,"overdue",label,"Follow-up overdue",`/admin/leads/${encodeURIComponent(id)}`,lead.assignedToName || "Relationship Executive");
    }
  });
  const priorities={handover:0,first_contact:1,verify_win_date:2,missing_win_date:2,overdue:3,quote_followup:4,relationship:5};
  actions.sort((a,b)=>priorities[a.type]-priorities[b.type]);

  return {
    window:{from,to},
    summary:{
      callAttempts:callAttempts.length, connectedCalls:callsConnected.length,
      distinctAgentsContacted:uniqueAgents(realConnections).size,
      qualifiedByTelecaller:uniqueAgents(telecallQualified).size,
      agentsHandedOver:periodHandedAgents.length,
      newLeads:periodLeads.length, quotesSent:periodQuoteLeads.length,
      dealsWon:periodWonLeads.length, agentsWithWonDeals:uniqueAgents(periodWonLeads).size,
      bookedInr:confirmedBusiness.totals.sellingInr,
      vendorCostInr:confirmedBusiness.totals.vendorCostInr,
      expectedGpInr:confirmedBusiness.totals.grossProfitInr,
      bookingAmountsPending:confirmedBusiness.totals.pendingWins,
      financialCoveragePct:confirmedBusiness.totals.coveragePct,
      connectionRate:callAttempts.length ? Math.round(callsConnected.length/callAttempts.length*100) : 0
    },
    cohort:[
      {name:"Connected agents",count:cohortConnected.size},
      {name:"Qualified agents",count:cohortQualified.size},
      {name:"Handover completed",count:cohortHanded.size},
      {name:"Enquiry received",count:cohortEnquiry.size},
      {name:"Booking confirmed",count:cohortWon.size},
      {name:"Repeat booking agent",count:cohortRepeat.size}
    ],
    callerRows, executiveRows, actions, confirmedBusiness,
    dealRows:periodWonLeads.map(lead=>({id:lead.id,label:lead.leadCode || lead.customerName || lead.id,date:businessDateKey(getDealWonEventDate(lead)),href:`/admin/leads/${encodeURIComponent(keyOf(lead.id))}`})),
    leadRows:periodLeads.map(lead=>({id:lead.id,label:lead.leadCode || lead.customerName || lead.id,date:businessDateKey(getLeadCreatedEventDate(lead)),href:`/admin/leads/${encodeURIComponent(keyOf(lead.id))}`}))
  };
}
