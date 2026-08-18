// lib/engagementCadenceEngine.js

/* =========================
   CADENCE CONSTANTS
========================= */

export const AGENT_ENGAGEMENT_SEGMENTS = [
  {
    value: "new_agent",
    label: "New Agent",
    description: "3-4 structured touches during the first 10 days."
  },
  {
    value: "regular_business",
    label: "Regular Business Agent",
    description: "Relationship and active-query check twice per week."
  },
  {
    value: "warm_irregular",
    label: "Warm but Irregular Agent",
    description: "One useful campaign or query push every week."
  },
  {
    value: "inactive",
    label: "Old Inactive Agent",
    description: "Reactivation touch every 15 days."
  },
  {
    value: "cold",
    label: "Cold Agent",
    description: "Relationship touch once per month."
  }
];

/* =========================
   NEW AGENT SEQUENCE
========================= */

export const NEW_AGENT_SEQUENCE = [
  {
    step: 0,
    dayOffset: 0,
    ruleCode: "new_agent_day_0",
    title: "Send company introduction",
    purpose:
      "Share company introduction and supported destination list.",
    intentCode: "new_agent_intro",
    recommendedChannels: ["whatsapp", "email"],
    priority: 80,
    dueWindow: "same_day"
  },
  {
    step: 1,
    dayOffset: 1,
    ruleCode: "new_agent_day_1",
    title: "Ask for active query",
    purpose:
      "Check whether the agent has an active international requirement.",
    intentCode: "ask_requirement",
    recommendedChannels: ["whatsapp", "call"],
    priority: 79,
    dueWindow: "daytime"
  },
  {
    step: 2,
    dayOffset: 3,
    ruleCode: "new_agent_day_3",
    title: "Share destination package",
    purpose:
      "Send one useful package, promotion or destination offer.",
    intentCode: "send_destination_package",
    recommendedChannels: ["whatsapp", "email"],
    priority: 78,
    dueWindow: "daytime"
  },
  {
    step: 3,
    dayOffset: 5,
    ruleCode: "new_agent_day_5",
    title: "Follow-up call",
    purpose:
      "Call the new agent and check current or upcoming requirements.",
    intentCode: "ask_requirement",
    recommendedChannels: ["call"],
    priority: 77,
    dueWindow: "daytime"
  },
  {
    step: 4,
    dayOffset: 7,
    ruleCode: "new_agent_day_7",
    title: "Share another useful package",
    purpose:
      "Share a second relevant destination package or campaign.",
    intentCode: "send_destination_package",
    recommendedChannels: ["whatsapp", "email"],
    priority: 76,
    dueWindow: "daytime"
  },
  {
    step: 5,
    dayOffset: 10,
    ruleCode: "new_agent_day_10",
    title: "Relationship follow-up",
    purpose:
      "Reconnect and move the agent to a weekly relationship cadence.",
    intentCode: "thank_you_relationship",
    recommendedChannels: ["call", "whatsapp"],
    priority: 75,
    dueWindow: "daytime"
  }
];

/* =========================
   CADENCE RULES
========================= */

export const CADENCE_RULES = {
  payment_pending: {
    ruleCode: "payment_pending",
    ruleGroup: "lead_override",
    label: "Payment Pending",
    title: "Follow up for pending payment",
    purpose:
      "Obtain payment update and keep booking arrangements on track.",
    priority: 100,
    frequencyLabel: "Morning and evening",
    intentCode: "payment_reminder",
    recommendedChannels: ["call", "whatsapp"],
    dueWindow: "twice_daily"
  },

  hot_lead: {
    ruleCode: "hot_lead",
    ruleGroup: "lead_override",
    label: "Hot Lead",
    title: "Call and close hot lead",
    purpose:
      "Follow up daily by call and WhatsApp until a decision is received.",
    priority: 95,
    frequencyLabel: "Daily call and WhatsApp",
    intentCode: "hot_lead_follow_up",
    recommendedChannels: ["call", "whatsapp"],
    dueWindow: "daily"
  },

  active_query: {
    ruleCode: "active_query",
    ruleGroup: "lead_override",
    label: "Active Query",
    title: "Follow up on active query",
    purpose:
      "Move the active requirement to quotation or confirmation.",
    priority: 90,
    frequencyLabel: "Daily",
    intentCode: "ask_requirement",
    recommendedChannels: ["call", "whatsapp"],
    dueWindow: "daily"
  },

  revision_pending: {
    ruleCode: "revision_pending",
    ruleGroup: "lead_override",
    label: "Revision Pending",
    title: "Follow up on revised quotation",
    purpose:
      "Confirm revision requirements and move the query forward.",
    priority: 88,
    frequencyLabel: "Daily",
    intentCode: "revision_confirmation",
    recommendedChannels: ["call", "whatsapp"],
    dueWindow: "daily"
  },

  active_quotation: {
    ruleCode: "active_quotation",
    ruleGroup: "lead_override",
    label: "Active Quotation",
    title: "Follow up on quotation",
    purpose:
      "Collect client feedback and progress the quotation toward closure.",
    priority: 85,
    frequencyLabel: "Alternate day",
    intentCode: "quote_follow_up",
    recommendedChannels: ["call", "whatsapp"],
    dueWindow: "alternate_day"
  },

  regular_business: {
    ruleCode: "regular_business",
    ruleGroup: "relationship",
    label: "Regular Business Agent",
    title: "Relationship and query check",
    purpose:
      "Check active requirements and maintain the business relationship.",
    priority: 60,
    frequencyLabel: "Twice per week",
    intentCode: "ask_requirement",
    recommendedChannels: ["call", "whatsapp"],
    dueWindow: "monday_thursday"
  },

  warm_irregular: {
    ruleCode: "warm_irregular",
    ruleGroup: "relationship",
    label: "Warm but Irregular Agent",
    title: "Weekly destination campaign",
    purpose:
      "Share one useful destination campaign and ask for active queries.",
    priority: 50,
    frequencyLabel: "Weekly",
    intentCode: "send_promotion",
    recommendedChannels: ["whatsapp", "email"],
    dueWindow: "weekly"
  },

  inactive: {
    ruleCode: "inactive",
    ruleGroup: "reactivation",
    label: "Old Inactive Agent",
    title: "Reactivate inactive agent",
    purpose:
      "Reconnect with a useful campaign and check upcoming requirements.",
    priority: 40,
    frequencyLabel: "Every 15 days",
    intentCode: "lost_lead_reconnect",
    recommendedChannels: ["call", "whatsapp"],
    dueWindow: "every_15_days"
  },

  cold: {
    ruleCode: "cold",
    ruleGroup: "reactivation",
    label: "Cold Agent",
    title: "Monthly relationship touch",
    purpose:
      "Maintain light contact and check for future international queries.",
    priority: 30,
    frequencyLabel: "Monthly",
    intentCode: "lost_lead_reconnect",
    recommendedChannels: ["whatsapp", "call"],
    dueWindow: "monthly"
  }
};

/* =========================
   BASIC HELPERS
========================= */

function normalize(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function toDate(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value?.toDate === "function") {
    return value.toDate();
  }

  if (typeof value?.seconds === "number") {
    return new Date(value.seconds * 1000);
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function cloneDate(value = new Date()) {
  return new Date(toDate(value) || new Date());
}

function setClock(value, hour = 11, minute = 0) {
  const date = cloneDate(value);

  date.setHours(hour, minute, 0, 0);

  return date;
}

function addDays(value, days = 0) {
  const date = cloneDate(value);

  date.setDate(date.getDate() + Number(days || 0));

  return date;
}

function nextWeekdayOccurrence({
  from = new Date(),
  weekdays = [],
  hour = 11,
  minute = 0,
  minimumGapMinutes = 30
}) {
  const start = cloneDate(from);

  const minimum = new Date(
    start.getTime() + minimumGapMinutes * 60 * 1000
  );

  for (let offset = 0; offset <= 21; offset += 1) {
    const candidate = addDays(start, offset);

    candidate.setHours(hour, minute, 0, 0);

    if (
      weekdays.includes(candidate.getDay()) &&
      candidate >= minimum
    ) {
      return candidate;
    }
  }

  return setClock(addDays(start, 7), hour, minute);
}

function nextTwiceDailyDue(now = new Date()) {
  const current = cloneDate(now);

  const morning = setClock(current, 10, 0);
  const evening = setClock(current, 17, 0);

  if (current < morning) {
    return morning;
  }

  if (current < evening) {
    return evening;
  }

  return setClock(addDays(current, 1), 10, 0);
}

function getLeadStage(lead = {}) {
  return normalize(
    lead.stage ||
      lead.leadStage ||
      lead.status ||
      lead.currentStage ||
      ""
  );
}

function getOutcomeCode(engagement = {}) {
  return normalize(
    engagement.outcomeCode ||
      engagement.outcomeLabel ||
      engagement.outcome ||
      engagement.result ||
      engagement.status ||
      ""
  );
}

function containsAny(value, terms = []) {
  return terms.some(term => value.includes(term));
}

/* =========================
   AGENT SEGMENT
========================= */

export function inferAgentEngagementSegment(agent = {}) {
  const explicit = normalize(agent.engagementSegment);

  if (
    [
      "new_agent",
      "regular_business",
      "warm_irregular",
      "inactive",
      "cold"
    ].includes(explicit)
  ) {
    return explicit;
  }

  const lifecycle = normalize(agent.lifecycleStatus);
  const partnerSegment = normalize(agent.partnerSegment);
  const relationshipStage = normalize(agent.relationshipStage);
  const followUpFrequency = normalize(agent.followUpFrequency);

  if (
    containsAny(lifecycle, ["dormant"]) ||
    containsAny(partnerSegment, ["dormant"]) ||
    relationshipStage === "dormant"
  ) {
    return "inactive";
  }

  if (
    containsAny(lifecycle, ["prospect", "onboarding"]) ||
    containsAny(partnerSegment, ["new_partner"]) ||
    relationshipStage === "new"
  ) {
    return "new_agent";
  }

  if (
    containsAny(partnerSegment, [
      "strategic_partner",
      "preferred_partner",
      "regular_partner"
    ]) ||
    containsAny(relationshipStage, [
      "active",
      "preferred",
      "strategic"
    ]) ||
    followUpFrequency === "daily" ||
    followUpFrequency === "twice_weekly"
  ) {
    return "regular_business";
  }

  if (
    followUpFrequency === "weekly" ||
    followUpFrequency === "bi_weekly"
  ) {
    return "warm_irregular";
  }

  if (
    followUpFrequency === "monthly" ||
    followUpFrequency === "quarterly"
  ) {
    return "cold";
  }

  return "warm_irregular";
}

/* =========================
   PRIORITY OVERRIDE
========================= */

export function inferPriorityOverride({
  lead = {},
  engagement = {}
} = {}) {
  const stage = getLeadStage(lead);
  const outcome = getOutcomeCode(engagement);
  const context = `${stage} ${outcome}`;

  if (
    containsAny(context, [
      "payment_pending",
      "payment",
      "advance_pending",
      "token_pending"
    ])
  ) {
    return "payment_pending";
  }

  if (
    containsAny(context, [
      "hot_lead",
      "hot",
      "closing",
      "urgent"
    ])
  ) {
    return "hot_lead";
  }

  if (
    containsAny(context, [
      "revision_required",
      "revision_needed",
      "revision",
      "revise"
    ])
  ) {
    return "revision_pending";
  }

  if (
    containsAny(context, [
      "quote_sent",
      "quotation_sent",
      "quote_shared",
      "quotation_shared",
      "quote_needed",
      "quotation"
    ])
  ) {
    return "active_quotation";
  }

  if (
    containsAny(context, [
      "new_enquiry",
      "requirement_pending",
      "requirement_completed",
      "active_query",
      "query",
      "enquiry",
      "inquiry"
    ])
  ) {
    return "active_query";
  }

  return "";
}

/* =========================
   DUE DATE BUILDERS
========================= */

function buildRelationshipDue(
  ruleCode,
  now = new Date()
) {
  if (ruleCode === "regular_business") {
    return nextWeekdayOccurrence({
      from: now,
      weekdays: [1, 4],
      hour: 11
    });
  }

  if (ruleCode === "warm_irregular") {
    return nextWeekdayOccurrence({
      from: now,
      weekdays: [3],
      hour: 11
    });
  }

  if (ruleCode === "inactive") {
    const base = setClock(addDays(now, 15), 11);

    return nextWeekdayOccurrence({
      from: base,
      weekdays: [6],
      hour: 11,
      minimumGapMinutes: 0
    });
  }

  if (ruleCode === "cold") {
    const base = setClock(addDays(now, 30), 11);

    return nextWeekdayOccurrence({
      from: base,
      weekdays: [6],
      hour: 11,
      minimumGapMinutes: 0
    });
  }

  return setClock(addDays(now, 7), 11);
}

function buildOverrideDue(
  ruleCode,
  now = new Date()
) {
  if (ruleCode === "payment_pending") {
    return nextTwiceDailyDue(now);
  }

  if (ruleCode === "active_quotation") {
    return setClock(addDays(now, 2), 11);
  }

  return setClock(addDays(now, 1), 11);
}

function buildNewAgentPlan({
  agent = {},
  now = new Date(),
  nextStep = 0
}) {
  const stepNumber = Number.isFinite(Number(nextStep))
    ? Number(nextStep)
    : 0;

  if (stepNumber >= NEW_AGENT_SEQUENCE.length) {
    const fallbackRule = CADENCE_RULES.warm_irregular;

    return {
      ...fallbackRule,

      nextDueAt: buildRelationshipDue(
        "warm_irregular",
        now
      ),

      cadencePhase: "weekly_after_new_agent",
      newAgentSequenceComplete: true,
      sequenceStep: null,
      sequenceDay: null
    };
  }

  const sequence = NEW_AGENT_SEQUENCE[stepNumber];

  const startedAt =
    toDate(agent.newAgentSequenceStartedAt) ||
    toDate(agent.firstContactedAt) ||
    cloneDate(now);

  let nextDueAt = setClock(
    addDays(startedAt, sequence.dayOffset),
    11
  );

  if (
    sequence.dayOffset === 0 &&
    nextDueAt < now
  ) {
    nextDueAt = new Date(
      now.getTime() + 15 * 60 * 1000
    );
  }

  return {
    ...sequence,

    ruleGroup: "new_agent_sequence",
    label: `New Agent - Day ${sequence.dayOffset}`,
    frequencyLabel: "Structured first 10 days",

    nextDueAt,

    cadencePhase: "new_agent_sequence",
    newAgentSequenceComplete: false,

    sequenceStep: sequence.step,
    sequenceDay: sequence.dayOffset
  };
}

/* =========================
   MAIN RESOLVER
========================= */

export function resolveCadencePlan({
  agent = {},
  lead = null,
  engagement = null,
  now = new Date(),
  nextNewAgentStep = null
} = {}) {
  const safeNow = cloneDate(now);

  const status = normalize(agent.status);
  const lifecycle = normalize(agent.lifecycleStatus);

  if (
    status === "blacklisted" ||
    lifecycle === "blacklisted" ||
    lifecycle === "suspended"
  ) {
    return null;
  }

  const overrideCode = inferPriorityOverride({
    lead: lead || {},
    engagement: engagement || {}
  });

  if (
    overrideCode &&
    CADENCE_RULES[overrideCode]
  ) {
    const rule = CADENCE_RULES[overrideCode];

    return {
      ...rule,

      nextDueAt: buildOverrideDue(
        overrideCode,
        safeNow
      ),

      cadencePhase: "lead_override",

      newAgentSequenceComplete: false,
      sequenceStep: null,
      sequenceDay: null
    };
  }

  const segment = inferAgentEngagementSegment(agent);

  if (segment === "new_agent") {
    const step =
      nextNewAgentStep === null ||
      nextNewAgentStep === undefined
        ? Number(agent.newAgentSequenceStep || 0)
        : Number(nextNewAgentStep);

    return buildNewAgentPlan({
      agent,
      now: safeNow,
      nextStep: step
    });
  }

  const rule =
    CADENCE_RULES[segment] ||
    CADENCE_RULES.warm_irregular;

  return {
    ...rule,

    nextDueAt: buildRelationshipDue(
      rule.ruleCode,
      safeNow
    ),

    cadencePhase: rule.ruleGroup,

    newAgentSequenceComplete: false,
    sequenceStep: null,
    sequenceDay: null
  };
}

/* =========================
   WEEKLY FOCUS
========================= */

export function getWeeklyEngagementFocus(
  dateValue = new Date()
) {
  const date = cloneDate(dateValue);

  const map = {
    1: {
      day: "Monday",
      title: "Existing Active Agents",
      purpose:
        "Call regular agents and ask for upcoming international queries."
    },

    2: {
      day: "Tuesday",
      title: "New Agent Follow-up",
      purpose:
        "Follow up with agents contacted during the previous 10 days."
    },

    3: {
      day: "Wednesday",
      title: "Destination Campaign",
      purpose:
        "Share a focused Bali, Dubai, Thailand or other destination campaign."
    },

    4: {
      day: "Thursday",
      title: "Quotation and Hot Leads",
      purpose:
        "Call quote-sent agents and hot leads."
    },

    5: {
      day: "Friday",
      title: "Closing Push",
      purpose:
        "Prioritize payment pending, revised quotes and serious clients."
    },

    6: {
      day: "Saturday",
      title: "Reactivation and CRM Cleanup",
      purpose:
        "Call old inactive agents and update pending CRM information."
    },

    0: {
      day: "Sunday",
      title: "Planning",
      purpose:
        "Review the next week's engagement queue."
    }
  };

  return map[date.getDay()];
}

/* =========================
   OPTION EXPORT
========================= */

export function getEngagementSegmentOptions() {
  return AGENT_ENGAGEMENT_SEGMENTS;
}