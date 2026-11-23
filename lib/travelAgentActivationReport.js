/**
 * Travel Agent relationship activation is a business metric, NOT the master
 * Travel Agent active/inactive/contactability flag.
 *
 * No outreach -> Attempted -> Contacted -> Activated -> Lead contributor -> Converted
 * Closed-lost is a separate outcome for closures with no new lead/closed-won
 * in the report period, so a past lead lost now is not labelled No outreach.
 *
 * - Attempted: only not-connected engagement attempts.
 * - Contacted: a qualified engagement, but no proven meaningful conversation.
 * - Activated: a connected call, meeting or meaningful outcome (or a later lead).
 * - Lead contributor: at least one agent-linked lead created in the date window.
 * - Converted: at least one agent-linked lead closed-won in the date window.
 *
 * Lead counts are based on CREATED date; closure counts are based on the actual
 * conversion/loss date, including leads created before the selected date range.
 * This is a read-only calculation; no master records are mutated.
 */
import {
  getEngagementConnectionStatus,
  NOT_CONNECTED_OUTCOMES,
  isCallEngagementRecord,
  isMeaningfulEngagement
} from "./engagementProductivity.js";
import { isConvertedStage, isLostStage } from "./leadStages.js";
import { getDealWonEventDate, getLeadCreatedEventDate } from "./reporting/leadReportingDates.mjs";
import { normalizeTravelAgentStatus } from "./travelAgentStatus.js";

const normalized = value => String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
// A rejection is a valid contact, but not a positive business activation.
const NON_ACTIVATING_OUTCOMES = new Set([
  "not_interested", "do_not_contact", "blacklisted", "wrong_details",
  "invalid_number", "business_shut_down"
]);
const normalizeName = value => String(value || "").trim().toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();

export const ACTIVATION_STAGES = [
  { key: "no_outreach", label: "No outreach", tone: "slate" },
  { key: "attempted", label: "Attempted", tone: "amber" },
  { key: "contacted", label: "Contacted", tone: "blue" },
  { key: "activated", label: "Activated", tone: "indigo" },
  { key: "lead_contributor", label: "Lead contributor", tone: "purple" },
  { key: "closed_lost", label: "Closed lost", tone: "rose" },
  { key: "converted", label: "Converted partner", tone: "green" }
];

export function activationStageForRow(row) {
  if (row.won > 0) return "converted";
  if (row.leads > 0) return "lead_contributor";
  if (row.lost > 0) return "closed_lost";
  if (row.activatedEngagements > 0) return "activated";
  if (row.engagements > 0) return "contacted";
  if (row.notConnected > 0) return "attempted";
  return "no_outreach";
}

export function toActivityDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value?.toDate === "function") return toActivityDate(value.toDate());
  if (typeof value?.seconds === "number") return new Date(value.seconds * 1000);
  const result = new Date(value);
  return Number.isNaN(result.getTime()) ? null : result;
}

function eventDate(item) {
  return toActivityDate(item?.createdAt || item?.engagementDate || item?.activityAt || item?.date || item?.timestamp || item?.updatedAt);
}

function leadCreatedDate(item) {
  return getLeadCreatedEventDate(item);
}

/** Use only the current stage. Historical convertedAt must not count reopened leads. */
function leadClosureDate(lead, kind) {
  if (kind === "won") return getDealWonEventDate(lead);
  const explicit = lead.lostAt;
  const timestamp = toActivityDate(explicit || lead.closedAt || lead.closureDate);
  if (timestamp) return timestamp;
  const history = Array.isArray(lead.stageHistory) ? lead.stageHistory : [];
  const matching = history.filter(item => kind === "won"
    ? isConvertedStage(item?.toStage || item?.stage)
    : isLostStage(item?.toStage || item?.stage));
  return toActivityDate(matching[matching.length - 1]?.changedAt);
}

function within(date, fromDate, toDate) {
  if (!fromDate && !toDate) return true;
  if (!date) return false;
  return (!fromDate || date >= fromDate) && (!toDate || date <= toDate);
}

function getAgentIdCandidates(item) {
  return [...new Set([
    item?.travelAgentId, item?.agentId, item?.agencyId,
    item?.travelAgentRefId, item?.entityId, item?.agentRefId,
    item?.travelAgent?.id, item?.travelAgent?.agentId
  ].map(value => String(value || "").trim()).filter(Boolean))];
}

function getAgentName(item) {
  return item?.agentName || item?.travelAgentName || item?.agencyName ||
    item?.agentSnapshot?.agencyName || item?.travelAgent?.agencyName ||
    item?.travelAgent?.name || "";
}

function getChannel(item) {
  return normalized(item?.channel || item?.type || item?.engagementType || item?.activityType);
}

function latestOf(current, next) {
  return next && (!current || next > current) ? next : current;
}

function getAssignedName(agent) {
  return agent?.assignedToName || agent?.assignedToUserName ||
    agent?.relationshipOwnerName || agent?.assignedToEmail || agent?.assignedTo || "—";
}

function getCity(agent) {
  return agent?.city || agent?.location?.city || agent?.address?.city || agent?.area || "—";
}

export function buildTravelAgentActivationReport({
  travelAgents = [], engagements = [], leads = [], fromDate = null, toDate = null
} = {}) {
  const validAgents = travelAgents.filter(agent => {
    if (agent?.deleted === true || agent?.isDeleted === true) return false;
    return normalizeTravelAgentStatus(agent?.status || agent?.agentStatus, agent?.active) !== "invalid_number";
  });
  const invalidAgents = travelAgents.filter(agent =>
    agent?.deleted !== true && agent?.isDeleted !== true &&
    normalizeTravelAgentStatus(agent?.status || agent?.agentStatus, agent?.active) === "invalid_number"
  );

  const byId = new Map(validAgents.map(agent => [String(agent.id), agent]));
  const byName = new Map();
  validAgents.forEach(agent => {
    const name = normalizeName(agent?.agencyName || agent?.name || agent?.agentName);
    if (!name) return;
    // Ambiguous company names must not randomly attribute leads to one agent.
    if (byName.has(name)) byName.set(name, null);
    else byName.set(name, agent);
  });

  const rows = new Map(validAgents.map(agent => [String(agent.id), {
    id: String(agent.id),
    agentCode: agent?.agentCode || agent?.code || "",
    agencyName: agent?.agencyName || agent?.name || agent?.agentName || "Unnamed Travel Agent",
    city: getCity(agent),
    assignedTo: getAssignedName(agent),
    masterStatus: normalizeTravelAgentStatus(agent?.status || agent?.agentStatus, agent?.active),
    engagements: 0,
    notConnected: 0,
    activatedEngagements: 0,
    callConnected: 0,
    meetings: 0,
    email: 0,
    whatsapp: 0,
    leads: 0,
    won: 0,
    lost: 0,
    lastActivityAt: null
  }]));

  const resolveAgent = item => {
    const ids = getAgentIdCandidates(item);
    if (ids.length) {
      const matches = [...new Set(ids.map(id => byId.get(id)).filter(Boolean))];
      // An unmatched legacy ID can coexist with a valid newer ID. Conflicting
      // IDs identifying DIFFERENT agents are ambiguous and are not guessed.
      return matches.length === 1 ? matches[0] : null;
    }
    const name = normalizeName(getAgentName(item));
    return name ? byName.get(name) || null : null;
  };

  let excludedNotConnected = 0;
  engagements.forEach(item => {
    if (item?.deleted === true || item?.isDeleted === true) return;
    const when = eventDate(item);
    if (!within(when, fromDate, toDate)) return;
    const agent = resolveAgent(item);
    if (!agent) return;
    const row = rows.get(String(agent.id));
    if (!row) return;

    const outcome = normalized(item?.outcomeCode || item?.result || item?.response || item?.agentResponse);
    // Non-call engagement rows sometimes explicitly carry "not_applicable"
    // from the productivity mapper; a negative outcome must still win.
    const connectionStatus = NOT_CONNECTED_OUTCOMES.has(outcome)
      ? "not_connected" : getEngagementConnectionStatus(item);
    if (connectionStatus === "not_connected") {
      row.notConnected += 1;
      row.lastActivityAt = latestOf(row.lastActivityAt, when);
      excludedNotConnected += 1;
      return;
    }
    row.engagements += 1;
    row.lastActivityAt = latestOf(row.lastActivityAt, when);
    const channel = getChannel(item);
    if (channel.includes("email")) row.email += 1;
    if (channel.includes("whatsapp")) row.whatsapp += 1;
    const isMeeting = channel.includes("meeting");
    if (isMeeting) row.meetings += 1;
    const isConnectedCall = isCallEngagementRecord(item) && connectionStatus === "connected";
    if (isConnectedCall) row.callConnected += 1;
    if (!NON_ACTIVATING_OUTCOMES.has(outcome) && (isConnectedCall || isMeeting || isMeaningfulEngagement(item))) {
      row.activatedEngagements += 1;
    }
  });

  leads.forEach(item => {
    if (item?.deleted === true || item?.isDeleted === true) return;
    const agent = resolveAgent(item);
    if (!agent) return;
    const row = rows.get(String(agent.id));
    if (!row) return;
    const createdDate = leadCreatedDate(item);
    if (within(createdDate, fromDate, toDate)) {
      row.leads += 1;
      row.lastActivityAt = latestOf(row.lastActivityAt, createdDate);
    }
    const stage = item?.stage || item?.leadStage || item?.leadStatus || item?.pipelineStatus || "";
    const kind = isConvertedStage(stage) ? "won" : isLostStage(stage) ? "lost" : "";
    if (kind) {
      const closureDate = leadClosureDate(item, kind);
      if (within(closureDate, fromDate, toDate)) {
        row[kind] += 1;
        row.lastActivityAt = latestOf(row.lastActivityAt, closureDate);
      }
    }
  });

  const allRows = Array.from(rows.values()).map(row => ({
    ...row,
    totalActivity: row.engagements + row.leads,
    activationStage: activationStageForRow(row)
  }));

  const sum = key => allRows.reduce((total, row) => total + row[key], 0);
  const stageCounts = Object.fromEntries(ACTIVATION_STAGES.map(stage => [
    stage.key, allRows.filter(row => row.activationStage === stage.key).length
  ]));

  return {
    rows: allRows,
    summary: {
      validAgents: validAgents.length,
      invalidAgents: invalidAgents.length,
      stageCounts,
      activeAgents: allRows.filter(row => row.totalActivity > 0 || row.won > 0 || row.lost > 0).length,
      agentsContacted: allRows.filter(row => row.engagements > 0).length,
      activatedAgents: allRows.filter(row => row.activatedEngagements > 0 || row.leads > 0 || row.won > 0 || row.lost > 0).length,
      leadContributors: allRows.filter(row => row.leads > 0).length,
      convertedPartners: allRows.filter(row => row.won > 0).length,
      engagements: sum("engagements"),
      meaningfulEngagements: sum("activatedEngagements"),
      callConnected: sum("callConnected"),
      meetings: sum("meetings"),
      notConnected: sum("notConnected"),
      email: sum("email"),
      whatsapp: sum("whatsapp"),
      leads: sum("leads"),
      won: sum("won"),
      lost: sum("lost"),
      excludedNotConnected
    }
  };
}
