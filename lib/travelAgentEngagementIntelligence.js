/**
 * DreamTrawell Travel Agent Engagement Intelligence (30-day, read-only).
 * A+ / A / B / C are relationship ENGAGEMENT grades, not business grades.
 * No inferred WhatsApp/email delivery, replies, or favourable outcomes.
 * Outgoing promotional messages can increase activity counts, not the score.
 */
import {
  EXPLICIT_CONNECTED_OUTCOMES,
  NOT_CONNECTED_OUTCOMES,
  isCallEngagementRecord
} from "./engagementProductivity.js";
import { buildTravelAgentActivationReport, toActivityDate } from "./travelAgentActivationReport.js";
import { normalizeTravelAgentStatus } from "./travelAgentStatus.js";
import {
  COMMUNICATION_PURPOSES,
  DOCUMENTED_RESPONSE_CODES,
  POSITIVE_RESPONSE_CODES,
  inferCommunicationPurpose,
  normalizeEngagementCode as normalize
} from "./engagementIntelligenceTaxonomy.js";

export const ENGAGEMENT_GRADES = [
  { value: "A+", label: "A+ · Highly engaged", minimum: 80 },
  { value: "A", label: "A · Active", minimum: 60 },
  { value: "B", label: "B · Developing", minimum: 35 },
  { value: "C", label: "C · Low engagement", minimum: 0 }
];

const DAY_MS = 86_400_000;
const BUSINESS_OUTCOMES = new Set([
  "requirement_received", "requirement_pending", "quote_needed", "quote_shared", "revision_needed",
  "destination_interest_identified", "client_segment_identified", "business_profile_updated",
  "package_feedback_pending", "tentative_query_expected", "query_promised", "peak_season_requirement",
  "relationship_strengthened", "meeting_completed"
]);
const POSITIVE_OUTCOMES = new Set([
  "requirement_received", "quote_needed", "destination_interest_identified", "tentative_query_expected",
  "query_promised", "peak_season_requirement", "client_segment_identified"
]);
const MEANINGFUL_PURPOSES = new Set(["requirements", "rate_sharing", "feedback", "meeting_training"]);
const DECLINED_OUTCOMES = new Set(["not_interested", "do_not_contact", "blacklisted", "business_shut_down", "invalid_number"]);
const CONTACT_BLOCKED_STATUSES = new Set(["not_interested", "do_not_contact", "blacklisted", "business_shut_down", "wrong_details", "duplicate", "temporarily_closed"]);
const agentIds = item => [...new Set([
  item?.travelAgentId, item?.agentId, item?.agencyId, item?.travelAgentRefId, item?.entityId,
  item?.agentRefId, item?.travelAgent?.id, item?.travelAgent?.agentId
].map(x => String(x || "").trim()).filter(Boolean))];
const agentName = item => item?.agentName || item?.travelAgentName || item?.agencyName ||
  item?.agentSnapshot?.agencyName || item?.travelAgent?.agencyName || item?.travelAgent?.name || "";
const normName = value => String(value || "").trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
const eventDate = item => toActivityDate(item?.createdAt || item?.engagementDate || item?.activityAt || item?.date || item?.timestamp || item?.updatedAt);
const isDeleted = item => item?.deleted === true || item?.isDeleted === true;
const mostRecent = (old, next) => !old || next > old ? next : old;
const capped = (value, goal, points) => Math.round(Math.min(1, value / goal) * points);
const daysSince = (end, date) => date ? Math.max(0, (end - date) / DAY_MS) : Infinity;

// Fixed reporting timezone: team and agency operations are based in India.
function istDateKey(date) {
  return new Date(date.getTime() + 330 * 60_000).toISOString().slice(0, 10);
}
function istWeekKey(date) {
  const shifted = new Date(date.getTime() + 330 * 60_000);
  const day = shifted.getUTCDay();
  shifted.setUTCDate(shifted.getUTCDate() - ((day + 6) % 7)); // Monday of ISO week
  return shifted.toISOString().slice(0, 10);
}

function createAgentResolver(agents) {
  const byId = new Map(agents.map(agent => [String(agent.id), agent]));
  const byName = new Map();
  agents.forEach(agent => {
    const name = normName(agent.agencyName || agent.name || agent.agentName);
    if (!name) return;
    if (byName.has(name)) byName.set(name, null);
    else byName.set(name, agent);
  });
  return item => {
    const ids = agentIds(item);
    if (ids.length) {
      const matches = [...new Set(ids.map(id => byId.get(id)).filter(Boolean))];
      return matches.length === 1 ? matches[0] : null;
    }
    return byName.get(normName(agentName(item))) || null;
  };
}

function metricsBase(agent) {
  return {
    id: String(agent.id),
    agentCode: agent.agentCode || agent.code || "",
    agencyName: agent.agencyName || agent.name || agent.agentName || "Unnamed Travel Agent",
    city: agent.city || agent.location?.city || agent.address?.city || agent.area || "—",
    assignedTo: agent.assignedToName || agent.assignedToUserName || agent.relationshipOwnerName || agent.assignedToEmail || agent.assignedTo || "—",
    masterStatus: normalizeTravelAgentStatus(agent.status || agent.agentStatus, agent.active),
    callAttempts: 0, connectedCalls: 0, notConnectedCalls: 0, unknownCallOutcomes: 0,
    whatsappOutbound: 0, emailOutbound: 0, whatsappInbound: 0, emailInbound: 0,
    replyEvents: 0, replyDays: 0, meaningfulDiscussions: 0, meetingsCompleted: 0,
    activeDays: 0, activeWeeks: 0, positiveResponseDays: 0, lastConnectedAt: null,
    lastActivityAt: null, contentCounts: Object.fromEntries([
      ...COMMUNICATION_PURPOSES.map(p => p.value), "unclassified"
    ].map(value => [value, 0])),
    leads: 0, won: 0, lost: 0, score: 0, grade: "C", scoreBreakdown: {},
    highEngagementNoEnquiry: false, nextAction: "Start personalised outreach"
  };
}

/** Accepts existing Firestore client document snapshots as plain JS objects. */
export function buildTravelAgentEngagementIntelligence({
  travelAgents = [], engagements = [], leads = [], leadsAvailable = true, now = new Date()
} = {}) {
  const end = toActivityDate(now) || new Date();
  const from = new Date(end.getTime() - 30 * DAY_MS);
  const eligibleAgents = travelAgents.filter(agent =>
    !isDeleted(agent) && normalizeTravelAgentStatus(agent.status || agent.agentStatus, agent.active) !== "invalid_number"
  );
  const resolve = createAgentResolver(eligibleAgents);
  const rowsById = new Map(eligibleAgents.map(agent => [String(agent.id), metricsBase(agent)]));
  const privateSets = new Map(eligibleAgents.map(agent => [String(agent.id), {
    contactDays: new Set(), weeks: new Set(), replies: new Set(), meaningfulDays: new Set(), positiveDays: new Set()
  }]));

  let ignoredUndated = 0;
  let unmatchedEngagements = 0;
  engagements.forEach(item => {
    if (isDeleted(item)) return;
    const date = eventDate(item);
    if (!date) { ignoredUndated++; return; }
    if (date < from || date > end) return;
    const agent = resolve(item);
    if (!agent) { unmatchedEngagements++; return; }
    const row = rowsById.get(String(agent.id));
    const sets = privateSets.get(String(agent.id));
    const day = istDateKey(date);
    const channel = normalize(item.channel || item.type || item.engagementType || item.activityType);
    const outcome = normalize(item.outcomeCode || item.result || item.response || item.agentResponse);
    const response = normalize(item.agentResponseStatus || item.agentReplyStatus);
    const isCall = isCallEngagementRecord(item);
    const isMeeting = channel.includes("meeting");
    const isWhatsApp = channel.includes("whatsapp");
    const isEmail = channel.includes("email");
    const isMessage = isWhatsApp || isEmail;
    const connection = normalize(item.connectionStatus);
    const result = normalize(item.callResult);
    const callFailed = NOT_CONNECTED_OUTCOMES.has(outcome) || NOT_CONNECTED_OUTCOMES.has(result) || connection === "not_connected";
    const callConnected = isCall && !callFailed && (
      item.callConnected === true || connection === "connected" || result === "call_connected" || EXPLICIT_CONNECTED_OUTCOMES.has(outcome)
    );
    const meetingCompleted = isMeeting && (
      normalize(item.meetingStatus) === "completed" || normalize(item.meetingOutcome) === "completed" ||
      (normalize(item.status) === "completed" && !item.meetingAt && !item.tentativeMeetingDate) ||
      (Boolean(item.meetingId) && Boolean(item.engagedAt))
    );
    const inbound = normalize(item.direction) === "inbound";
    const responseDocumented = isMessage && (inbound || DOCUMENTED_RESPONSE_CODES.has(response) || item.agentResponded === true);
    const twoWay = callConnected || meetingCompleted || responseDocumented;
    const purpose = inferCommunicationPurpose(item);

    row.lastActivityAt = mostRecent(row.lastActivityAt, date);
    row.contentCounts[purpose] += 1;
    if (isCall) {
      row.callAttempts += 1;
      if (callConnected) row.connectedCalls += 1;
      else if (callFailed) row.notConnectedCalls += 1;
      else row.unknownCallOutcomes += 1;
    }
    if (isMessage) {
      const metric = `${isWhatsApp ? "whatsapp" : "email"}${inbound ? "Inbound" : "Outbound"}`;
      row[metric] += 1;
      if (responseDocumented) {
        row.replyEvents += 1;
        sets.replies.add(`${isWhatsApp ? "whatsapp" : "email"}:${day}`);
      }
    }
    if (meetingCompleted) row.meetingsCompleted += 1;
    if (twoWay) {
      row.lastConnectedAt = mostRecent(row.lastConnectedAt, date);
      sets.contactDays.add(day);
      sets.weeks.add(istWeekKey(date));
      if (!DECLINED_OUTCOMES.has(outcome) && response !== "not_interested" &&
        (BUSINESS_OUTCOMES.has(outcome) || (MEANINGFUL_PURPOSES.has(purpose) && (
          (isCall && callConnected) || meetingCompleted || responseDocumented
        )))) sets.meaningfulDays.add(day);
      if (POSITIVE_RESPONSE_CODES.has(response) || POSITIVE_OUTCOMES.has(outcome)) sets.positiveDays.add(day);
    }
  });

  // Reuse existing agent alias/lead-date semantics. Grades do NOT use these counts.
  const business = leadsAvailable ? buildTravelAgentActivationReport({
    travelAgents: eligibleAgents, engagements: [], leads, fromDate: from, toDate: end
  }) : { rows: [] };
  const businessById = new Map(business.rows.map(row => [row.id, row]));
  const rows = [...rowsById.values()].map(row => {
    const sets = privateSets.get(row.id);
    row.replyDays = sets.replies.size;
    row.meaningfulDiscussions = sets.meaningfulDays.size;
    row.activeDays = sets.contactDays.size;
    row.activeWeeks = sets.weeks.size;
    row.positiveResponseDays = sets.positiveDays.size;
    const recency = daysSince(end, row.lastConnectedAt);
    const breakdown = {
      connectedConversations: capped(row.connectedCalls + row.meetingsCompleted, 3, 25),
      twoWayMessages: capped(row.replyDays, 3, 25),
      meaningfulDiscussions: capped(row.meaningfulDiscussions, 2, 20),
      consistency: capped(row.activeWeeks, 3, 15),
      positiveResponse: capped(row.positiveResponseDays, 2, 10),
      recency: recency <= 10 ? 5 : recency <= 15 ? 3 : recency <= 30 ? 1 : 0
    };
    row.scoreBreakdown = breakdown;
    row.score = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
    // A+ must be established across separate days and weeks, never a one-day campaign.
    row.grade = row.score >= 80 && row.activeDays >= 3 && row.meaningfulDiscussions >= 2 && recency <= 10
      ? "A+"
      : row.score >= 60 && row.activeDays >= 2 && recency <= 15
        ? "A"
        : row.score >= 35 && row.activeDays >= 1
          ? "B" : "C";
    const activity = businessById.get(row.id);
    row.leads = activity?.leads || 0;
    row.won = activity?.won || 0;
    row.lost = activity?.lost || 0;
    const contactBlocked = CONTACT_BLOCKED_STATUSES.has(row.masterStatus);
    row.highEngagementNoEnquiry = leadsAvailable && !contactBlocked &&
      ["A+", "A"].includes(row.grade) && row.leads === 0;
    const totalOutbound = row.whatsappOutbound + row.emailOutbound;
    row.nextAction = contactBlocked ? "Respect agent master status; do not initiate outreach"
      : !leadsAvailable ? "Review relationship; lead data unavailable"
      : row.highEngagementNoEnquiry ? "Ask for a qualified requirement"
      : recency > 15 && row.activeDays > 0 ? "Reconnect with the agent"
      : row.grade === "A+" ? "Maintain weekly personal contact"
      : row.grade === "A" ? "Discuss upcoming bookings"
      : totalOutbound >= 4 && row.activeDays === 0 ? "Stop bulk sends; try a personal call"
      : row.grade === "B" ? "Arrange a meaningful follow-up"
      : "Start personalised outreach";
    return row;
  });
  const sum = key => rows.reduce((total, row) => total + (row[key] || 0), 0);
  return {
    period: { from, to: end }, rows,
    summary: {
      agents: rows.length,
      gradeCounts: Object.fromEntries(ENGAGEMENT_GRADES.map(grade => [grade.value, rows.filter(row => row.grade === grade.value).length])),
      connectedCalls: sum("connectedCalls"), callAttempts: sum("callAttempts"),
      messagesLogged: sum("whatsappOutbound") + sum("emailOutbound"),
      repliesDocumented: sum("replyEvents"), meaningfulDiscussions: sum("meaningfulDiscussions"),
      highEngagementNoEnquiry: rows.filter(row => row.highEngagementNoEnquiry).length,
      agentsWithTwoWayContact: rows.filter(row => row.activeDays > 0).length,
      leads: sum("leads"), won: sum("won"),
      ignoredUndated, unmatchedEngagements
    }
  };
}
