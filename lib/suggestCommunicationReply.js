// lib/suggestCommunicationReply.js

/* =========================
   SMART COMMUNICATION ENGINE
   Rule-based suggestion helper

   Priority:
   1. Manual intent
   2. Explicit engagement outcome
   3. Engagement type / message context
   4. Lead stage
   5. Previous engagement age
   6. Destination availability
   7. New agent / default requirement
========================= */

/* =========================
   INTENTS
========================= */

export const COMMUNICATION_INTENTS = {
  NEW_AGENT_INTRO: {
    code: "new_agent_intro",
    name: "New Agent Introduction",
    priority: 70,
    defaultFollowUpDays: 2,
    waitingOn: "agent",
    communicationStatus: "waiting_for_agent",
    nextAction: "follow_up",
    templateTypes: ["message", "document", "promotion"],
    assetUsageTypes: [
      "company_profile",
      "agent_onboarding",
      "branding_document"
    ]
  },

  ASK_REQUIREMENT: {
    code: "ask_requirement",
    name: "Ask Requirement",
    priority: 75,
    defaultFollowUpDays: 1,
    waitingOn: "agent",
    communicationStatus: "waiting_for_agent",
    nextAction: "collect_requirement",
    templateTypes: ["message"],
    assetUsageTypes: ["company_profile"]
  },

  SEND_DESTINATION_PACKAGE: {
    code: "send_destination_package",
    name: "Send Destination Package",
    priority: 80,
    defaultFollowUpDays: 2,
    waitingOn: "agent",
    communicationStatus: "waiting_for_agent",
    nextAction: "package_follow_up",
    templateTypes: [
      "package",
      "itinerary",
      "promotion",
      "message"
    ],
    assetUsageTypes: [
      "promotional_package",
      "destination_image",
      "destination_video",
      "hotel_image",
      "ongoing_promotion"
    ]
  },

  SEND_PROMOTION: {
    code: "send_promotion",
    name: "Send Promotion",
    priority: 68,
    defaultFollowUpDays: 3,
    waitingOn: "agent",
    communicationStatus: "waiting_for_agent",
    nextAction: "promotion_follow_up",
    templateTypes: [
      "promotion",
      "package",
      "message"
    ],
    assetUsageTypes: [
      "ongoing_promotion",
      "promotional_package",
      "social_media_creative",
      "festival_creative",
      "destination_image"
    ]
  },

  QUOTE_FOLLOW_UP: {
    code: "quote_follow_up",
    name: "Quote Follow-up",
    priority: 90,
    defaultFollowUpDays: 1,
    waitingOn: "agent",
    communicationStatus: "waiting_for_agent",
    nextAction: "quote_follow_up",
    templateTypes: ["message", "package"],
    assetUsageTypes: [
      "quotation_attachment",
      "promotional_package"
    ]
  },

  NO_RESPONSE_FOLLOW_UP: {
    code: "no_response_follow_up",
    name: "No Response Follow-up",
    priority: 88,
    defaultFollowUpDays: 1,
    waitingOn: "agent",
    communicationStatus: "waiting_for_agent",
    nextAction: "soft_follow_up",
    templateTypes: ["message"],
    assetUsageTypes: [
      "company_profile",
      "promotional_package"
    ]
  },

  HOT_LEAD_FOLLOW_UP: {
    code: "hot_lead_follow_up",
    name: "Hot Lead Follow-up",
    priority: 95,
    defaultFollowUpDays: 1,
    waitingOn: "agent",
    communicationStatus: "waiting_for_agent",
    nextAction: "call_and_close",
    templateTypes: ["message", "package"],
    assetUsageTypes: [
      "quotation_attachment",
      "promotional_package"
    ]
  },

  PAYMENT_REMINDER: {
    code: "payment_reminder",
    name: "Payment Reminder",
    priority: 96,
    defaultFollowUpDays: 1,
    waitingOn: "agent",
    communicationStatus: "waiting_for_agent",
    nextAction: "payment_follow_up",
    templateTypes: ["message", "document"],
    assetUsageTypes: [
      "payment_details",
      "terms_conditions"
    ]
  },

  REVISION_CONFIRMATION: {
    code: "revision_confirmation",
    name: "Revision Confirmation",
    priority: 86,
    defaultFollowUpDays: 1,
    waitingOn: "agent",
    communicationStatus: "waiting_for_agent",
    nextAction: "revision_follow_up",
    templateTypes: ["message"],
    assetUsageTypes: ["quotation_attachment"]
  },

  MEETING_FOLLOW_UP: {
    code: "meeting_follow_up",
    name: "Meeting Follow-up",
    priority: 82,
    defaultFollowUpDays: 2,
    waitingOn: "agent",
    communicationStatus: "waiting_for_agent",
    nextAction: "meeting_follow_up",
    templateTypes: ["message", "document"],
    assetUsageTypes: [
      "company_profile",
      "agent_onboarding"
    ]
  },

  LOST_LEAD_RECONNECT: {
    code: "lost_lead_reconnect",
    name: "Lost Lead Reconnect",
    priority: 60,
    defaultFollowUpDays: 3,
    waitingOn: "agent",
    communicationStatus: "waiting_for_agent",
    nextAction: "reconnect",
    templateTypes: ["message", "promotion"],
    assetUsageTypes: [
      "ongoing_promotion",
      "promotional_package"
    ]
  },

  THANK_YOU_RELATIONSHIP: {
    code: "thank_you_relationship",
    name: "Thank You / Relationship Message",
    priority: 50,
    defaultFollowUpDays: 7,
    waitingOn: "none",
    communicationStatus: "relationship_touchpoint",
    nextAction: "relationship_follow_up",
    templateTypes: ["message"],
    assetUsageTypes: []
  }
};

export const COMMUNICATION_INTENT_OPTIONS = Object.values(
  COMMUNICATION_INTENTS
).map(intent => ({
  value: intent.code,
  label: intent.name
}));

/* =========================
   BASIC HELPERS
========================= */

function normalize(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeCode(value = "") {
  return normalize(value).replace(/[\s-]+/g, "_");
}

function cleanString(value = "") {
  return String(value || "").trim();
}

function containsAny(value = "", terms = []) {
  const safeValue = normalize(value);

  return terms.some(term =>
    safeValue.includes(normalize(term))
  );
}

function getFirstValue(...values) {
  return (
    values.find(
      value =>
        typeof value === "string" &&
        value.trim().length > 0
    )?.trim() || ""
  );
}

function toDate(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : value;
  }

  if (typeof value?.toDate === "function") {
    return value.toDate();
  }

  if (typeof value?.seconds === "number") {
    return new Date(value.seconds * 1000);
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime())
    ? null
    : parsed;
}

function daysBetween(
  fromDate,
  toDateValue = new Date()
) {
  const from = toDate(fromDate);
  const to = toDate(toDateValue);

  if (!from || !to) return 0;

  const diff = to.getTime() - from.getTime();

  return Math.max(
    0,
    Math.floor(
      diff / (1000 * 60 * 60 * 24)
    )
  );
}

function addDays(dateValue, days = 1) {
  const date = toDate(dateValue) || new Date();
  const next = new Date(date);

  next.setDate(
    next.getDate() + Number(days || 0)
  );

  return next;
}

function isDeleted(item = {}) {
  return (
    item.deleted === true ||
    item.isDeleted === true ||
    item.archived === true
  );
}

function getTimestamp(item = {}) {
  return (
    item.createdAt ||
    item.updatedAt ||
    item.lastContactedAt ||
    item.sentAt ||
    item.date ||
    null
  );
}

function sortByLatest(items = []) {
  return [...items].sort((a, b) => {
    const aTime =
      toDate(getTimestamp(a))?.getTime() || 0;

    const bTime =
      toDate(getTimestamp(b))?.getTime() || 0;

    return bTime - aTime;
  });
}

function getLatestEngagement(
  engagements = [],
  fallback = null
) {
  const rows = Array.isArray(engagements)
    ? engagements.filter(
        item => item && !isDeleted(item)
      )
    : [];

  if (fallback && !isDeleted(fallback)) {
    rows.push(fallback);
  }

  return sortByLatest(rows)[0] || null;
}

function getAgentName(agent = {}) {
  return getFirstValue(
    agent.agencyName,
    agent.agentName,
    agent.name,
    agent.companyName,
    agent.businessName,
    "Travel Partner"
  );
}

function getAgentCode(agent = {}) {
  return getFirstValue(
    agent.agentCode,
    agent.code,
    agent.id
  );
}

function getSpocName(spoc = {}, agent = {}) {
  return getFirstValue(
    spoc.name,
    spoc.displayName,
    agent.spocName,
    agent.contactPerson,
    "Partner"
  );
}

function getSpocEmail(spoc = {}, agent = {}) {
  return getFirstValue(
    spoc.email,
    agent.spocEmail,
    agent.email
  );
}

function getSpocMobile(spoc = {}, agent = {}) {
  return getFirstValue(
    spoc.mobile,
    spoc.phone,
    agent.spocMobile,
    agent.mobile
  );
}

function getDestinationNameValue(
  destination = {},
  lead = {},
  engagement = {}
) {
  return getFirstValue(
    destination.name,
    destination.destinationName,
    lead.destinationName,
    engagement.destinationName,
    Array.isArray(lead.destinationNames)
      ? lead.destinationNames
          .filter(Boolean)
          .join(", ")
      : ""
  );
}

function getDestinationName(
  destination = {},
  lead = {},
  engagement = {}
) {
  return (
    getDestinationNameValue(
      destination,
      lead,
      engagement
    ) || "{{destination}}"
  );
}

function getDestinationId(
  destination = {},
  lead = {},
  engagement = {}
) {
  return getFirstValue(
    destination.id,
    destination.destinationRefId,
    destination.destinationId,
    lead.destinationRefId,
    lead.destinationId,
    engagement.destinationRefId,
    engagement.destinationId
  );
}

function getLeadStage(lead = {}) {
  return normalizeCode(
    lead.stage ||
      lead.leadStage ||
      lead.status ||
      lead.currentStage ||
      ""
  );
}

function getEngagementChannel(
  engagement = {}
) {
  return normalizeCode(
    engagement.channel ||
      engagement.communicationChannel ||
      ""
  );
}

function getEngagementType(
  engagement = {}
) {
  return normalizeCode(
    engagement.engagementType ||
      engagement.type ||
      engagement.activityType ||
      engagement.communicationType ||
      engagement.eventType ||
      engagement.category ||
      engagement.channel ||
      ""
  );
}

function getEngagementOutcome(
  engagement = {}
) {
  return normalizeCode(
    engagement.outcomeCode ||
      engagement.outcomeLabel ||
      engagement.outcome ||
      engagement.result ||
      engagement.response ||
      engagement.agentResponse ||
      engagement.interestLevel ||
      engagement.status ||
      ""
  );
}

function getEngagementMessage(
  engagement = {}
) {
  return getFirstValue(
    engagement.messageText,
    engagement.message,
    engagement.notes,
    engagement.remark,
    engagement.subject,
    engagement.outcomeLabel,
    engagement.outcome
  );
}

/* =========================
   INTENT HELPERS
========================= */

export function getCommunicationIntentByCode(
  code = ""
) {
  const normalizedCode = normalizeCode(code);

  return (
    Object.values(
      COMMUNICATION_INTENTS
    ).find(
      intent =>
        intent.code === normalizedCode
    ) || null
  );
}

function getIntentFromExplicitOutcome(
  outcomeCode = ""
) {
  const outcome = normalizeCode(outcomeCode);

  const mapping = {
    payment_pending: {
      intent:
        COMMUNICATION_INTENTS.PAYMENT_REMINDER,
      reason: "Outcome is payment pending"
    },

    revision_needed: {
      intent:
        COMMUNICATION_INTENTS.REVISION_CONFIRMATION,
      reason: "Outcome is revision needed"
    },

    call_not_picked: {
      intent:
        COMMUNICATION_INTENTS.NO_RESPONSE_FOLLOW_UP,
      reason: "Call was not picked"
    },

    no_response: {
      intent:
        COMMUNICATION_INTENTS.NO_RESPONSE_FOLLOW_UP,
      reason:
        "No response from travel agent"
    },

    quote_needed: {
      intent:
        COMMUNICATION_INTENTS.QUOTE_FOLLOW_UP,
      reason: "Quotation is required"
    },

    quote_shared: {
      intent:
        COMMUNICATION_INTENTS.QUOTE_FOLLOW_UP,
      reason: "Quotation has been shared"
    },

    no_current_query: {
      intent:
        COMMUNICATION_INTENTS.SEND_PROMOTION,
      reason:
        "Agent has no current query; share a relevant promotional package image"
    },

    promotion_shared: {
      intent:
        COMMUNICATION_INTENTS.SEND_PROMOTION,
      reason:
        "Promotional package has been shared"
    },

    package_feedback_pending: {
      intent:
        COMMUNICATION_INTENTS.SEND_PROMOTION,
      reason: "Package feedback is pending"
    },

    destination_interest_identified: {
      intent:
        COMMUNICATION_INTENTS.SEND_DESTINATION_PACKAGE,
      reason:
        "Destination interest identified; share a relevant destination package"
    },

    client_segment_identified: {
      intent:
        COMMUNICATION_INTENTS.SEND_PROMOTION,
      reason:
        "Client segment identified; share a relevant promotional package"
    },

    tentative_query_expected: {
      intent:
        COMMUNICATION_INTENTS.ASK_REQUIREMENT,
      reason:
        "Tentative query is expected from the travel agent"
    },

    query_promised: {
      intent:
        COMMUNICATION_INTENTS.ASK_REQUIREMENT,
      reason:
        "Travel agent has promised to share a query"
    },

    peak_season_requirement: {
      intent:
        COMMUNICATION_INTENTS.ASK_REQUIREMENT,
      reason:
        "Peak-season requirement is expected"
    },

    requirement_pending: {
      intent:
        COMMUNICATION_INTENTS.ASK_REQUIREMENT,
      reason:
        "Requirement details are pending"
    },

    requirement_received: {
      intent:
        COMMUNICATION_INTENTS.ASK_REQUIREMENT,
      reason:
        "Requirement has been received"
    },

    followup_required: {
      intent:
        COMMUNICATION_INTENTS.ASK_REQUIREMENT,
      reason:
        "Requirement follow-up is needed"
    },

    meeting_scheduled: {
      intent:
        COMMUNICATION_INTENTS.MEETING_FOLLOW_UP,
      reason: "Meeting has been scheduled"
    },

    not_interested: {
      intent:
        COMMUNICATION_INTENTS.LOST_LEAD_RECONNECT,
      reason:
        "Travel agent is not interested currently"
    },

    future_follow_up: {
      intent:
        COMMUNICATION_INTENTS.THANK_YOU_RELATIONSHIP,
      reason:
        "Future relationship follow-up is planned"
    },

    intro_done: {
      intent:
        COMMUNICATION_INTENTS.NEW_AGENT_INTRO,
      reason:
        "Introduction has been completed"
    },

    profile_shared: {
      intent:
        COMMUNICATION_INTENTS.NEW_AGENT_INTRO,
      reason:
        "Company profile has been shared"
    },

    relationship_started: {
      intent:
        COMMUNICATION_INTENTS.THANK_YOU_RELATIONSHIP,
      reason:
        "Relationship-building journey has started"
    },

    relationship_reconnected: {
      intent:
        COMMUNICATION_INTENTS.THANK_YOU_RELATIONSHIP,
      reason:
        "Existing travel-agent relationship has been reconnected"
    },

    relationship_strengthened: {
      intent:
        COMMUNICATION_INTENTS.THANK_YOU_RELATIONSHIP,
      reason:
        "Travel-agent relationship has been strengthened"
    },

    business_profile_updated: {
      intent:
        COMMUNICATION_INTENTS.THANK_YOU_RELATIONSHIP,
      reason:
        "Travel-agent business profile has been updated"
    },

    general_update: {
      intent:
        COMMUNICATION_INTENTS.THANK_YOU_RELATIONSHIP,
      reason:
        "General relationship update"
    }
  };

  const match = mapping[outcome];

  if (!match) return null;

  return {
    ...match.intent,
    reason: match.reason
  };
}

function inferIntent({
  explicitIntentCode = "",
  agent = {},
  lead = {},
  latestEngagement = null,
  engagements = [],
  destination = {},
  now = new Date()
}) {
  const explicitIntent =
    getCommunicationIntentByCode(
      explicitIntentCode
    );

  if (explicitIntent) {
    return {
      ...explicitIntent,
      reason: "Selected manually"
    };
  }

  const leadStage = getLeadStage(lead);

  const latestChannel =
    getEngagementChannel(
      latestEngagement || {}
    );

  const engagementType =
    getEngagementType(
      latestEngagement || {}
    );

  const engagementOutcome =
    getEngagementOutcome(
      latestEngagement || {}
    );

  const latestMessage = normalize(
    getEngagementMessage(
      latestEngagement || {}
    )
  );

  const latestAgeDays = daysBetween(
    getTimestamp(latestEngagement),
    now
  );

  const engagementCount =
    Array.isArray(engagements)
      ? engagements.filter(
          item =>
            item &&
            !isDeleted(item)
        ).length
      : 0;

  const destinationId =
    getDestinationId(
      destination,
      lead,
      latestEngagement || {}
    );

  const destinationName =
    getDestinationNameValue(
      destination,
      lead,
      latestEngagement || {}
    );

  const hasDestination = Boolean(
    destinationId ||
    destinationName
  );

  /* =========================
     PRIORITY 1: EXPLICIT OUTCOME
  ========================= */

  const outcomeIntent =
    getIntentFromExplicitOutcome(
      engagementOutcome
    );

  if (outcomeIntent) {
    return outcomeIntent;
  }

  const contextText = normalize(
    [
      engagementType,
      engagementOutcome,
      latestChannel,
      latestMessage
    ]
      .filter(Boolean)
      .join(" ")
  );

  /* =========================
     PRIORITY 2: ENGAGEMENT CONTEXT
  ========================= */

  if (
    containsAny(contextText, [
      "payment",
      "advance",
      "token"
    ])
  ) {
    return {
      ...COMMUNICATION_INTENTS.PAYMENT_REMINDER,
      reason:
        "Based on engagement context: payment"
    };
  }

  if (
    containsAny(contextText, [
      "hot",
      "urgent",
      "closing"
    ])
  ) {
    return {
      ...COMMUNICATION_INTENTS.HOT_LEAD_FOLLOW_UP,
      reason:
        "Based on engagement context: hot lead"
    };
  }

  if (
    containsAny(contextText, [
      "revision",
      "revise",
      "change required",
      "changes required"
    ])
  ) {
    return {
      ...COMMUNICATION_INTENTS.REVISION_CONFIRMATION,
      reason:
        "Based on engagement context: revision"
    };
  }

  if (
    containsAny(contextText, [
      "quotation",
      "quote"
    ])
  ) {
    return {
      ...COMMUNICATION_INTENTS.QUOTE_FOLLOW_UP,
      reason:
        "Based on engagement context: quotation"
    };
  }

  if (
    containsAny(contextText, [
      "meeting",
      "agent_meeting",
      "f2f",
      "face to face"
    ])
  ) {
    return {
      ...COMMUNICATION_INTENTS.MEETING_FOLLOW_UP,
      reason:
        "Based on engagement context: meeting"
    };
  }

  if (
    containsAny(contextText, [
      "no current query",
      "no_current_query",
      "no query",
      "nothing currently"
    ])
  ) {
    return {
      ...COMMUNICATION_INTENTS.SEND_PROMOTION,
      reason:
        "Agent has no current query; recommend a promotional package image"
    };
  }

  if (
    containsAny(contextText, [
      "promotion",
      "campaign",
      "offer"
    ])
  ) {
    return {
      ...COMMUNICATION_INTENTS.SEND_PROMOTION,
      reason:
        "Based on engagement context: promotion"
    };
  }

  if (
    containsAny(contextText, [
      "package",
      "brochure",
      "destination"
    ])
  ) {
    return {
      ...COMMUNICATION_INTENTS.SEND_DESTINATION_PACKAGE,
      reason:
        "Based on engagement context: package or destination"
    };
  }

  if (
    containsAny(contextText, [
      "no response",
      "not replied",
      "no reply",
      "pending response",
      "call not picked"
    ])
  ) {
    return {
      ...COMMUNICATION_INTENTS.NO_RESPONSE_FOLLOW_UP,
      reason:
        "Based on engagement context: no response"
    };
  }

  if (
    containsAny(contextText, [
      "requirement",
      "query",
      "enquiry",
      "inquiry",
      "peak season",
      "tentative"
    ])
  ) {
    return {
      ...COMMUNICATION_INTENTS.ASK_REQUIREMENT,
      reason:
        "Based on engagement context: requirement or enquiry"
    };
  }

  if (
    containsAny(engagementType, [
      "call",
      "phone",
      "telecalling"
    ])
  ) {
    return {
      ...COMMUNICATION_INTENTS.ASK_REQUIREMENT,
      reason:
        "Based on engagement type: call"
    };
  }

  if (
    containsAny(engagementType, [
      "whatsapp",
      "message",
      "chat"
    ])
  ) {
    if (latestAgeDays >= 2) {
      return {
        ...COMMUNICATION_INTENTS.NO_RESPONSE_FOLLOW_UP,
        reason:
          `WhatsApp or message response pending for ${latestAgeDays} day(s)`
      };
    }

    return {
      ...COMMUNICATION_INTENTS.ASK_REQUIREMENT,
      reason:
        "Based on engagement type: WhatsApp or message"
    };
  }

  if (
    containsAny(engagementType, [
      "email",
      "mail"
    ])
  ) {
    if (latestAgeDays >= 2) {
      return {
        ...COMMUNICATION_INTENTS.NO_RESPONSE_FOLLOW_UP,
        reason:
          `Email response pending for ${latestAgeDays} day(s)`
      };
    }

    return {
      ...COMMUNICATION_INTENTS.NEW_AGENT_INTRO,
      reason:
        "Based on engagement type: email"
    };
  }

  /* =========================
     PRIORITY 3: LEAD STAGE
  ========================= */

  if (
    containsAny(leadStage, [
      "payment",
      "payment_pending"
    ])
  ) {
    return {
      ...COMMUNICATION_INTENTS.PAYMENT_REMINDER,
      reason:
        "Lead is in payment-pending stage"
    };
  }

  if (
    containsAny(leadStage, [
      "hot",
      "hot_lead"
    ])
  ) {
    return {
      ...COMMUNICATION_INTENTS.HOT_LEAD_FOLLOW_UP,
      reason:
        "Lead is marked as hot"
    };
  }

  if (
    leadStage.includes("revision")
  ) {
    return {
      ...COMMUNICATION_INTENTS.REVISION_CONFIRMATION,
      reason:
        "Lead is in revision stage"
    };
  }

  if (
    containsAny(leadStage, [
      "quote_sent",
      "quotation_sent",
      "quotation",
      "quote_shared"
    ])
  ) {
    return {
      ...COMMUNICATION_INTENTS.QUOTE_FOLLOW_UP,
      reason:
        "Lead is in quotation or quote-shared stage"
    };
  }

  if (
    containsAny(leadStage, [
      "lost",
      "dormant"
    ])
  ) {
    return {
      ...COMMUNICATION_INTENTS.LOST_LEAD_RECONNECT,
      reason:
        "Lead is lost or dormant"
    };
  }

  /* =========================
     PRIORITY 4: AGE / CONTEXT
  ========================= */

  if (
    latestEngagement &&
    latestAgeDays >= 2
  ) {
    return {
      ...COMMUNICATION_INTENTS.NO_RESPONSE_FOLLOW_UP,
      reason:
        `No recent response for ${latestAgeDays} day(s)`
    };
  }

  if (hasDestination) {
    return {
      ...COMMUNICATION_INTENTS.SEND_DESTINATION_PACKAGE,
      reason:
        "Destination is available"
    };
  }

  if (
    engagementCount === 0 ||
    agent.isNew === true
  ) {
    return {
      ...COMMUNICATION_INTENTS.NEW_AGENT_INTRO,
      reason:
        "No previous engagement found"
    };
  }

  return {
    ...COMMUNICATION_INTENTS.ASK_REQUIREMENT,
    reason:
      "Default suggestion to understand and collect requirement"
  };
}

/* =========================
   TEMPLATE RECOMMENDATION
========================= */

function templateSupportsChannel(
  template = {},
  channel = "whatsapp"
) {
  const normalizedChannel =
    normalizeCode(channel);

  if (
    !template ||
    isDeleted(template)
  ) {
    return false;
  }

  if (
    template.active === false ||
    template.status === "draft"
  ) {
    return false;
  }

  if (normalizedChannel === "email") {
    if (
      template.channels?.email === false
    ) {
      return false;
    }

    return Boolean(
      template.emailHtml ||
      template.emailSubject
    );
  }

  if (
    normalizedChannel === "whatsapp"
  ) {
    if (
      template.channels?.whatsapp === false
    ) {
      return false;
    }

    return Boolean(
      template.whatsappText
    );
  }

  return true;
}

function templateMatchesDestination(
  template = {},
  destinationContext = {}
) {
  const selectedDestinationId =
    getFirstValue(
      destinationContext.id
    );

  const selectedDestinationName =
    normalize(
      destinationContext.name
    );

  if (
    !selectedDestinationId &&
    !selectedDestinationName
  ) {
    return true;
  }

  const templateDestinationIds =
    Array.isArray(
      template.destinationIds
    )
      ? template.destinationIds
      : [];

  const templateDestinationNames =
    Array.isArray(
      template.destinationNames
    )
      ? template.destinationNames
      : template.primaryDestination
        ? [template.primaryDestination]
        : [];

  const isGeneral =
    templateDestinationIds.length === 0 &&
    templateDestinationNames.length === 0;

  if (isGeneral) return true;

  const idMatch =
    selectedDestinationId &&
    templateDestinationIds.includes(
      selectedDestinationId
    );

  const nameMatch =
    selectedDestinationName &&
    templateDestinationNames
      .map(name => normalize(name))
      .includes(
        selectedDestinationName
      );

  return Boolean(
    idMatch ||
    nameMatch
  );
}

function scoreTemplate(
  template = {},
  context = {}
) {
  const {
    intent,
    channel,
    destinationContext,
    latestEngagement
  } = context;

  const normalizedChannel =
    normalizeCode(channel);

  const latestOutcome =
    getEngagementOutcome(
      latestEngagement || {}
    );

  let score = 0;
  const reasons = [];

  if (
    !templateSupportsChannel(
      template,
      normalizedChannel
    )
  ) {
    return {
      score: -999,
      reasons: [
        "Channel not supported"
      ]
    };
  }

  if (
    !templateMatchesDestination(
      template,
      destinationContext
    )
  ) {
    return {
      score: -999,
      reasons: [
        "Destination not matching"
      ]
    };
  }

  score += 20;
  reasons.push(
    "Active usable template"
  );

  if (
    template.channels?.[
      normalizedChannel
    ]
  ) {
    score += 15;

    reasons.push(
      `${normalizedChannel} enabled`
    );
  }

  const templateIntentCodes =
    Array.isArray(
      template.intentCodes
    )
      ? template.intentCodes.map(
          normalizeCode
        )
      : [];

  if (
    intent?.code &&
    templateIntentCodes.includes(
      normalizeCode(intent.code)
    )
  ) {
    score += 60;
    reasons.push(
      "Intent code matches"
    );
  }

  const templateOutcomeCodes =
    Array.isArray(
      template.outcomeCodes
    )
      ? template.outcomeCodes.map(
          normalizeCode
        )
      : [];

  if (
    latestOutcome &&
    templateOutcomeCodes.includes(
      latestOutcome
    )
  ) {
    score += 45;

    reasons.push(
      "Latest engagement outcome matches"
    );
  }

  const templateType =
    normalizeCode(
      template.templateType ||
      "message"
    );

  if (
    intent?.templateTypes
      ?.map(normalizeCode)
      .includes(templateType)
  ) {
    score += 30;

    reasons.push(
      "Template type matches intent"
    );
  }

  const templateDestinationIds =
    Array.isArray(
      template.destinationIds
    )
      ? template.destinationIds
      : [];

  const templateDestinationNames =
    Array.isArray(
      template.destinationNames
    )
      ? template.destinationNames
      : [];

  if (
    templateDestinationIds.length ||
    templateDestinationNames.length
  ) {
    score += 20;

    reasons.push(
      "Destination-specific template"
    );
  } else {
    score += 8;

    reasons.push(
      "General template"
    );
  }

  const searchable = normalize(
    [
      template.name,
      template.slug,
      template.categoryName,
      template.category,
      template.categoryCode,
      template.templateType,
      template.primaryDestination,
      ...(template.intentCodes || []),
      ...(template.outcomeCodes || [])
    ]
      .filter(Boolean)
      .join(" ")
  );

  const intentWords =
    normalize(
      intent?.name || ""
    )
      .split(/\s+/)
      .filter(Boolean);

  intentWords.forEach(word => {
    if (
      searchable.includes(word)
    ) {
      score += 4;
    }
  });

  if (
    latestEngagement?.templateId &&
    latestEngagement.templateId ===
      template.id
  ) {
    score -= 8;

    reasons.push(
      "Recently used template"
    );
  }

  score += Math.min(
    Number(
      template.usageCount || 0
    ),
    10
  );

  return {
    score,
    reasons
  };
}

function recommendTemplates({
  templates = [],
  intent,
  channel = "whatsapp",
  destinationContext = {},
  latestEngagement = null,
  limit = 5
}) {
  return (
    Array.isArray(templates)
      ? templates
      : []
  )
    .map(template => {
      const scored = scoreTemplate(
        template,
        {
          intent,
          channel,
          destinationContext,
          latestEngagement
        }
      );

      return {
        id: template.id,
        templateId: template.id,
        slug: template.slug || "",

        name:
          template.name ||
          "Untitled Template",

        templateType:
          template.templateType ||
          "message",

        categoryName:
          template.categoryName ||
          "",

        intentCodes:
          template.intentCodes ||
          [],

        outcomeCodes:
          template.outcomeCodes ||
          [],

        channels:
          template.channels ||
          {},

        destinationIds:
          template.destinationIds ||
          [],

        destinationNames:
          template.destinationNames ||
          [],

        defaultAssets:
          template.defaultAssets ||
          [],

        usageCount:
          template.usageCount ||
          0,

        score: scored.score,
        reasons: scored.reasons,
        raw: template
      };
    })
    .filter(
      item => item.score > 0
    )
    .sort(
      (a, b) =>
        b.score - a.score
    )
    .slice(0, limit);
}

/* =========================
   ASSET RECOMMENDATION
========================= */

function getAssetTitle(asset = {}) {
  return getFirstValue(
    asset.title,
    asset.name,
    asset.fileName,
    asset.currentFileName,
    "Asset"
  );
}

function getAssetUrl(asset = {}) {
  return getFirstValue(
    asset.url,
    asset.currentUrl,
    asset.externalUrl,
    asset.downloadUrl,
    asset.fileUrl
  );
}

function getAssetId(asset = {}) {
  return getFirstValue(
    asset.assetId,
    asset.id,
    asset.documentId,
    getAssetUrl(asset)
  );
}

function getAssetUsageType(
  asset = {}
) {
  return normalizeCode(
    asset.usageType ||
      asset.usage ||
      ""
  );
}

function getAssetChannelUsage(
  asset = {}
) {
  return Array.isArray(
    asset.channelUsage
  )
    ? asset.channelUsage.map(
        normalizeCode
      )
    : [];
}

function assetMatchesDestination(
  asset = {},
  destinationContext = {}
) {
  const selectedDestinationId =
    getFirstValue(
      destinationContext.id
    );

  const selectedDestinationName =
    normalize(
      destinationContext.name
    );

  if (
    !selectedDestinationId &&
    !selectedDestinationName
  ) {
    return true;
  }

  const assetDestinationId =
    getFirstValue(
      asset.destinationId
    );

  const assetDestinationName =
    normalize(
      asset.destinationName
    );

  const isGeneral =
    !assetDestinationId &&
    !assetDestinationName;

  if (isGeneral) return true;

  return Boolean(
    (
      selectedDestinationId &&
      assetDestinationId ===
        selectedDestinationId
    ) ||
    (
      selectedDestinationName &&
      assetDestinationName ===
        selectedDestinationName
    )
  );
}

function assetSupportsChannel(
  asset = {},
  channel = "whatsapp"
) {
  const channelUsage =
    getAssetChannelUsage(asset);

  if (!channelUsage.length) {
    return true;
  }

  return channelUsage.includes(
    normalizeCode(channel)
  );
}

function isAssetValid(asset = {}) {
  if (
    asset.approvedForUse === false
  ) {
    return false;
  }

  if (asset.active === false) {
    return false;
  }

  if (isDeleted(asset)) {
    return false;
  }

  if (!getAssetUrl(asset)) {
    return false;
  }

  const validTo =
    asset.validTo
      ? new Date(
          `${asset.validTo}T23:59:59`
        )
      : null;

  const validFrom =
    asset.validFrom
      ? new Date(
          `${asset.validFrom}T00:00:00`
        )
      : null;

  const now = new Date();

  if (
    validTo &&
    !Number.isNaN(
      validTo.getTime()
    ) &&
    validTo < now
  ) {
    return false;
  }

  if (
    validFrom &&
    !Number.isNaN(
      validFrom.getTime()
    ) &&
    validFrom > now
  ) {
    return false;
  }

  return true;
}

function scoreAsset(
  asset = {},
  context = {}
) {
  const {
    intent,
    channel,
    destinationContext
  } = context;

  let score = 0;
  const reasons = [];

  if (!isAssetValid(asset)) {
    return {
      score: -999,
      reasons: [
        "Asset not valid"
      ]
    };
  }

  if (
    !assetMatchesDestination(
      asset,
      destinationContext
    )
  ) {
    return {
      score: -999,
      reasons: [
        "Destination not matching"
      ]
    };
  }

  if (
    !assetSupportsChannel(
      asset,
      channel
    )
  ) {
    return {
      score: -999,
      reasons: [
        "Channel not matching"
      ]
    };
  }

  score += 20;

  reasons.push(
    "Active approved asset"
  );

  const usageType =
    getAssetUsageType(asset);

  if (
    intent?.assetUsageTypes
      ?.map(normalizeCode)
      .includes(usageType)
  ) {
    score += 35;

    reasons.push(
      "Usage type matches intent"
    );
  }

  if (
    asset.destinationId ||
    asset.destinationName
  ) {
    score += 20;

    reasons.push(
      "Destination-specific asset"
    );
  } else {
    score += 8;

    reasons.push(
      "General asset"
    );
  }

  if (
    asset.approvedForUse !== false
  ) {
    score += 10;

    reasons.push(
      "Approved for use"
    );
  }

  const searchable = normalize(
    [
      asset.title,
      asset.name,
      asset.categoryName,
      asset.assetType,
      asset.usageType,
      asset.destinationName
    ]
      .filter(Boolean)
      .join(" ")
  );

  const intentWords =
    normalize(
      intent?.name || ""
    )
      .split(/\s+/)
      .filter(Boolean);

  intentWords.forEach(word => {
    if (
      searchable.includes(word)
    ) {
      score += 3;
    }
  });

  return {
    score,
    reasons
  };
}

function normalizeRecommendedAsset(
  asset = {},
  scored = {}
) {
  return {
    assetId:
      getAssetId(asset),

    title:
      getAssetTitle(asset),

    url:
      getAssetUrl(asset),

    categoryId:
      asset.categoryId || "",

    categoryName:
      asset.categoryName || "",

    categorySlug:
      asset.categorySlug || "",

    assetType:
      asset.assetType ||
      asset.documentType ||
      "document",

    usageType:
      asset.usageType || "",

    visibility:
      asset.visibility ||
      "team",

    currentVersion:
      asset.currentVersion ||
      asset.version ||
      1,

    fileName:
      asset.fileName ||
      asset.currentFileName ||
      "",

    fileSize:
      asset.fileSize ||
      asset.currentFileSize ||
      null,

    fileType:
      asset.fileType ||
      asset.currentFileType ||
      "",

    fileExtension:
      asset.fileExtension ||
      asset.currentFileExtension ||
      "",

    destinationId:
      asset.destinationId ||
      "",

    destinationName:
      asset.destinationName ||
      "",

    sharedAs:
      asset.sharedAs ||
      "file_link",

    shareMode:
      asset.shareMode ||
      "link",

    score:
      scored.score || 0,

    reasons:
      scored.reasons || [],

    raw: asset
  };
}

function recommendAssets({
  assets = [],
  intent,
  channel = "whatsapp",
  destinationContext = {},
  limit = 6
}) {
  return (
    Array.isArray(assets)
      ? assets
      : []
  )
    .map(asset => {
      const scored = scoreAsset(
        asset,
        {
          intent,
          channel,
          destinationContext
        }
      );

      return normalizeRecommendedAsset(
        asset,
        scored
      );
    })
    .filter(
      item => item.score > 0
    )
    .sort(
      (a, b) =>
        b.score - a.score
    )
    .slice(0, limit);
}

/* =========================
   MESSAGE BUILDERS

   DreamTrawell tone:
   Sage + Creator
========================= */

function buildContextVariables({
  agent = {},
  spoc = {},
  lead = {},
  destination = {},
  latestEngagement = null
}) {
  return {
    spocName:
      getSpocName(
        spoc,
        agent
      ),

    agencyName:
      getAgentName(agent),

    agentCode:
      getAgentCode(agent),

    destination:
      getDestinationName(
        destination,
        lead,
        latestEngagement || {}
      ),

    teamMemberName:
      "{{teamMemberName}}",

    companyName:
      "{{companyName}}",

    companyEmail:
      "{{companyEmail}}",

    companyPhone:
      "{{companyPhone}}",

    assetLinks:
      "{{assetLinks}}",

    assetLinksHtml:
      "{{assetLinksHtml}}",

    signature:
      "{{signature}}"
  };
}

function applyVars(
  template = "",
  vars = {}
) {
  return String(
    template || ""
  ).replace(
    /{{\s*([a-zA-Z0-9_]+)\s*}}/g,
    (_, key) =>
      vars[key] ??
      `{{${key}}}`
  );
}

function buildEmailHtmlFromText(
  text = ""
) {
  return String(text || "")
    .split(/\n{2,}/)
    .map(
      block =>
        `<p>${block.replace(
          /\n/g,
          "<br />"
        )}</p>`
    )
    .join("");
}

function getSuggestionTemplates(
  intentCode
) {
  const map = {
    new_agent_intro: [
      {
        id: "intro_rapport",
        title:
          "Relationship-Focused Introduction",
        tone: "sage_creator",
        subject:
          "Introduction from {{companyName}}",
        body: `Hi {{spocName}},

It was a pleasure connecting with you.

At {{companyName}}, we believe strong travel partnerships begin by understanding how each agent works and what their clients truly expect.

We support travel partners with destination knowledge, thoughtfully planned packages, hotel options, transfers, sightseeing and dependable on-ground coordination.

We would be happy to understand your destination focus and support your upcoming requirements with clarity and confidence.

{{signature}}`
      },

      {
        id: "intro_short",
        title:
          "Short WhatsApp Introduction",
        tone:
          "short_sage_creator",
        subject:
          "{{companyName}} | Travel Partner Support",
        body: `Hi {{spocName}},

This is {{teamMemberName}} from {{companyName}}.

We support travel agents with thoughtfully planned packages, hotels, transfers, sightseeing and reliable destination coordination.

We look forward to understanding your travel focus and supporting your upcoming client requirements.

{{signature}}`
      }
    ],

    ask_requirement: [
      {
        id:
          "peak_season_query_planning",
        title:
          "Peak-Season Query Planning",
        tone:
          "sage_creator",
        subject:
          "Planning upcoming {{destination}} requirements",
        body: `Hi {{spocName}},

As the upcoming travel season approaches, we are connecting with our travel partners in advance to understand their expected destination requirements.

Even if the travel plan is still tentative, you may share the destination, expected month, pax and approximate budget with us.

Early planning will help us suggest suitable routing, hotel options and a well-structured package before availability becomes limited.

{{signature}}`
      },

      {
        id:
          "tentative_requirement",
        title:
          "Tentative Requirement Request",
        tone:
          "helpful",
        subject:
          "Share your tentative {{destination}} requirement",
        body: `Hi {{spocName}},

You do not need to wait until every travel detail is finalized to begin planning.

You may share the tentative destination, travel month, pax, hotel preference and approximate budget with us.

Our team will help you shape the initial idea into a clearer and more confidently sellable travel proposal.

{{signature}}`
      },

      {
        id:
          "requirement_checklist",
        title:
          "Requirement Checklist",
        tone:
          "structured",
        subject:
          "Details required for {{destination}} planning",
        body: `Hi {{spocName}},

To plan the {{destination}} package thoughtfully, please share:

Travel dates:
Number of adults and children:
Hotel category:
Number of rooms:
Transfer preference:
Sightseeing preference:
Approximate budget:
Any special requirement:

Once received, we will structure suitable options for your client.

{{signature}}`
      }
    ],

    send_destination_package: [
      {
        id:
          "package_image_share",
        title:
          "Destination Package Image",
        tone:
          "sage_creator",
        subject:
          "{{destination}} package for your reference",
        body: `Hi {{spocName}},

Sharing a thoughtfully curated {{destination}} package for your reference.

You may keep it handy for your upcoming client discussions. Whenever a suitable requirement comes up, share the tentative dates, pax and budget with us.

We will customize the package to match your client's preferences and help you present it with greater confidence.

{{signature}}`
      },

      {
        id:
          "package_share",
        title:
          "Share Destination Package",
        tone:
          "helpful",
        subject:
          "{{destination}} package details for {{agencyName}}",
        body: `Hi {{spocName}},

Sharing the {{destination}} package details for your reference.

The package has been planned with a balanced focus on comfort, smooth arrangements and meaningful travel experiences.

Please review it and let us know if your client needs a different hotel category, itinerary flow or budget range. We will be happy to refine it thoughtfully.

{{signature}}`
      }
    ],

    send_promotion: [
      {
        id:
          "no_query_promotion_image",
        title:
          "No Current Query - Package Image",
        tone:
          "sage_creator",
        subject:
          "{{destination}} promotional package",
        body: `Hi {{spocName}},

Understood. Sharing a thoughtfully curated {{destination}} promotional package for your reference.

You may keep it handy for your upcoming client discussions.

Whenever a suitable opportunity comes up, share the tentative dates, pax and budget with us. We will customize the package to match your client's preferences and help you present it with greater confidence.

{{signature}}`
      },

      {
        id:
          "peak_season_promotion",
        title:
          "Peak-Season Promotional Package",
        tone:
          "commercial_sage_creator",
        subject:
          "{{destination}} travel idea for the upcoming season",
        body: `Hi {{spocName}},

Sharing a carefully designed {{destination}} promotional package that may be useful for your upcoming seasonal client conversations.

You may use it as a starting point and, whenever a client shows interest, share the tentative requirement with us.

Our team will help you convert the idea into a clear, attractive and customized travel proposal.

{{signature}}`
      },

      {
        id:
          "promotion_feedback",
        title:
          "Promotional Package Feedback",
        tone:
          "relationship",
        subject:
          "Feedback on the {{destination}} package",
        body: `Hi {{spocName}},

Just checking whether the {{destination}} package shared earlier is relevant for the type of clients you currently handle.

Your feedback will help us understand whether Budget, Standard, Premium, Honeymoon, Family or Group packages would be more useful for your market.

Based on your preference, we can share more focused travel ideas for your future client discussions.

{{signature}}`
      }
    ],

    quote_follow_up: [
      {
        id:
          "quote_soft_follow_up",
        title:
          "Thoughtful Quote Follow-up",
        tone:
          "sage_creator",
        subject:
          "Follow-up on {{destination}} quotation",
        body: `Hi {{spocName}},

Just checking if you had a chance to review the {{destination}} quotation shared earlier.

Please let us know if your client would like any change in the hotel option, inclusions, sightseeing or budget.

We will be happy to refine the package and support you in moving the requirement forward smoothly.

{{signature}}`
      },

      {
        id:
          "quote_closing_follow_up",
        title:
          "Confirmation Follow-up",
        tone:
          "confident",
        subject:
          "{{destination}} quotation confirmation",
        body: `Hi {{spocName}},

Just checking if we can proceed further with the shared {{destination}} package.

The package has been planned as per the discussed requirement. Once your client is comfortable, we can check final availability and take the next steps.

As rooms and rates remain subject to availability, early confirmation will help us explore the most suitable options.

{{signature}}`
      }
    ],

    no_response_follow_up: [
      {
        id:
          "no_response_soft",
        title:
          "Soft Relationship Follow-up",
        tone:
          "soft_sage_creator",
        subject:
          "Staying connected",
        body: `Hi {{spocName}},

Just staying connected regarding the details shared earlier.

Whenever convenient, please let us know whether the requirement is still active or if your client needs any changes.

We will be happy to support you with suitable guidance and thoughtfully planned options.

{{signature}}`
      }
    ],

    hot_lead_follow_up: [
      {
        id:
          "hot_lead_close",
        title:
          "Hot Lead Closing",
        tone:
          "confident",
        subject:
          "{{destination}} booking confirmation",
        body: `Hi {{spocName}},

As discussed, please share the client's decision for the {{destination}} requirement.

Once confirmed, we can check final availability and move ahead with the booking steps.

An early decision will help us protect the most suitable options from possible rate or availability changes.

{{signature}}`
      }
    ],

    payment_reminder: [
      {
        id:
          "payment_reminder",
        title:
          "Professional Payment Reminder",
        tone:
          "polite",
        subject:
          "Payment reminder for {{destination}} booking",
        body: `Hi {{spocName}},

This is a gentle reminder regarding the pending payment for the {{destination}} booking.

Kindly share the payment update so our team can move the booking and operational arrangements forward smoothly.

{{signature}}`
      }
    ],

    revision_confirmation: [
      {
        id:
          "revision_confirmation",
        title:
          "Revision Confirmation",
        tone:
          "service",
        subject:
          "Revision update for {{destination}}",
        body: `Hi {{spocName}},

We have noted the requested changes for the {{destination}} package.

Please confirm whether the revision details are complete. Once confirmed, we will thoughtfully update the package to better match your client's expectations.

{{signature}}`
      }
    ],

    meeting_follow_up: [
      {
        id:
          "meeting_follow_up",
        title:
          "Post-Meeting Relationship Message",
        tone:
          "sage_creator",
        subject:
          "Thank you for the meaningful discussion",
        body: `Hi {{spocName}},

Thank you for your time and the meaningful discussion.

It was valuable to understand your destination focus, working style and future business opportunities.

We look forward to supporting you with relevant packages, destination guidance and dependable coordination as we build a stronger association together.

{{signature}}`
      }
    ],

    lost_lead_reconnect: [
      {
        id:
          "lost_reconnect",
        title:
          "Relationship Reconnect",
        tone:
          "relationship",
        subject:
          "Reconnecting for upcoming travel opportunities",
        body: `Hi {{spocName}},

Hope you are doing well.

We are reconnecting with our valued travel partners to understand their upcoming destination focus and seasonal requirements.

Whenever a suitable opportunity comes up for {{destination}} or another international destination, please feel free to share it with us.

We will be happy to support you with thoughtful planning and dependable destination coordination.

{{signature}}`
      }
    ],

    thank_you_relationship: [
      {
        id:
          "after_call_rapport",
        title:
          "After-Call Rapport Message",
        tone:
          "sage_creator",
        subject:
          "Thank you for connecting",
        body: `Hi {{spocName}},

It was a pleasure connecting with you.

At {{companyName}}, we believe strong travel partnerships grow through understanding, consistency and shared success.

We look forward to learning more about your destination focus and supporting your future requirements with clarity, creativity and confidence.

{{signature}}`
      },

      {
        id:
          "existing_agent_reconnect",
        title:
          "Existing Agent Reconnect",
        tone:
          "relationship",
        subject:
          "Staying connected for future travel requirements",
        body: `Hi {{spocName}},

Hope you are doing well.

We wanted to reconnect and understand how the travel movement is shaping up for your business.

Whenever you have an upcoming international requirement, even at a tentative stage, please feel free to share it with us. We will be happy to support you with relevant ideas and thoughtful package planning.

{{signature}}`
      },

      {
        id:
          "relationship_appreciation",
        title:
          "Relationship Appreciation",
        tone:
          "warm_sage_creator",
        subject:
          "Thank you for staying connected",
        body: `Hi {{spocName}},

We truly appreciate staying connected with you.

Every conversation gives us an opportunity to understand your business better and support you more meaningfully.

We look forward to growing together and helping you create travel experiences your clients can trust and remember.

{{signature}}`
      }
    ]
  };

  return (
    map[intentCode] ||
    map.ask_requirement
  );
}

function buildSuggestions({
  intent,
  channel = "whatsapp",
  vars = {}
}) {
  const templates =
    getSuggestionTemplates(
      intent.code
    );

  return templates.map(item => {
    const bodyText = applyVars(
      item.body,
      vars
    );

    const subject = applyVars(
      item.subject,
      vars
    );

    return {
      id: item.id,
      title: item.title,

      intentCode:
        intent.code,

      intentName:
        intent.name,

      tone:
        item.tone,

      channel,

      subject,
      emailSubject: subject,

      emailHtml:
        buildEmailHtmlFromText(
          bodyText
        ),

      whatsappText:
        bodyText,

      bodyText,

      recommendedFollowUpDays:
        intent.defaultFollowUpDays,

      nextAction:
        intent.nextAction,

      waitingOn:
        intent.waitingOn,

      communicationStatus:
        intent.communicationStatus
    };
  });
}

/* =========================
   NEXT ACTION
========================= */

function buildNextAction({
  intent,
  now = new Date()
}) {
  const followUpAt = addDays(
    now,
    intent.defaultFollowUpDays ||
      1
  );

  const labelMap = {
    follow_up:
      "Follow up",

    collect_requirement:
      "Collect requirement",

    package_follow_up:
      "Package follow-up",

    promotion_follow_up:
      "Promotion follow-up",

    quote_follow_up:
      "Quotation follow-up",

    soft_follow_up:
      "Soft follow-up",

    call_and_close:
      "Call and close",

    payment_follow_up:
      "Payment follow-up",

    revision_follow_up:
      "Revision follow-up",

    meeting_follow_up:
      "Meeting follow-up",

    reconnect:
      "Reconnect",

    relationship_follow_up:
      "Relationship follow-up"
  };

  return {
    nextAction:
      intent.nextAction,

    nextActionLabel:
      labelMap[
        intent.nextAction
      ] || "Follow up",

    waitingOn:
      intent.waitingOn,

    communicationStatus:
      intent.communicationStatus,

    defaultFollowUpDays:
      intent.defaultFollowUpDays,

    nextFollowUpAt:
      followUpAt,

    nextFollowUpAtIso:
      followUpAt.toISOString()
  };
}

/* =========================
   MAIN EXPORT
========================= */

export function suggestCommunicationReply({
  agent = {},
  spoc = {},
  lead = null,
  engagement = null,
  engagements = [],
  destination = null,

  templates = [],
  assets = [],

  channel = "whatsapp",
  intentCode = "",

  now = new Date(),

  templateLimit = 5,
  assetLimit = 6
} = {}) {
  const safeLead =
    lead || {};

  const safeDestination =
    destination || {};

  const latestEngagement =
    getLatestEngagement(
      engagements,
      engagement
    );

  const destinationContext = {
    id: getDestinationId(
      safeDestination,
      safeLead,
      latestEngagement || {}
    ),

    name:
      getDestinationNameValue(
        safeDestination,
        safeLead,
        latestEngagement || {}
      )
  };

  const intent = inferIntent({
    explicitIntentCode:
      intentCode,

    agent,

    lead:
      safeLead,

    latestEngagement,

    engagements,

    destination:
      destinationContext,

    now
  });

  const vars =
    buildContextVariables({
      agent,
      spoc,

      lead:
        safeLead,

      destination:
        destinationContext,

      latestEngagement
    });

  const recommendedTemplates =
    recommendTemplates({
      templates,
      intent,
      channel,
      destinationContext,
      latestEngagement,
      limit: templateLimit
    });

  const recommendedAssets =
    recommendAssets({
      assets,
      intent,
      channel,
      destinationContext,
      limit: assetLimit
    });

  const suggestions =
    buildSuggestions({
      intent,
      channel,
      vars
    });

  const nextAction =
    buildNextAction({
      intent,
      now
    });

  return {
    ok: true,

    intent: {
      code:
        intent.code,

      name:
        intent.name,

      reason:
        intent.reason || "",

      priority:
        intent.priority,

      defaultFollowUpDays:
        intent.defaultFollowUpDays,

      nextAction:
        intent.nextAction,

      waitingOn:
        intent.waitingOn,

      communicationStatus:
        intent.communicationStatus,

      templateTypes:
        intent.templateTypes,

      assetUsageTypes:
        intent.assetUsageTypes
    },

    channel,

    context: {
      agentId:
        agent.id ||
        agent.agentId ||
        "",

      agentName:
        getAgentName(agent),

      agentCode:
        getAgentCode(agent),

      spocName:
        vars.spocName,

      spocEmail:
        getSpocEmail(
          spoc,
          agent
        ),

      spocMobile:
        getSpocMobile(
          spoc,
          agent
        ),

      destinationId:
        destinationContext.id,

      destinationName:
        destinationContext.name,

      leadId:
        safeLead.id ||
        safeLead.leadId ||
        "",

      leadStage:
        getLeadStage(
          safeLead
        ),

      latestEngagementId:
        latestEngagement?.id ||
        "",

      latestEngagementType:
        getEngagementType(
          latestEngagement || {}
        ),

      latestEngagementOutcome:
        getEngagementOutcome(
          latestEngagement || {}
        ),

      latestEngagementChannel:
        getEngagementChannel(
          latestEngagement || {}
        ),

      latestEngagementAgeDays:
        latestEngagement
          ? daysBetween(
              getTimestamp(
                latestEngagement
              ),
              now
            )
          : null
    },

    suggestions,
    recommendedTemplates,
    recommendedAssets,
    nextAction,

    diagnostics: {
      templateCount:
        Array.isArray(templates)
          ? templates.length
          : 0,

      assetCount:
        Array.isArray(assets)
          ? assets.length
          : 0,

      engagementCount:
        Array.isArray(
          engagements
        )
          ? engagements.length
          : 0,

      latestOutcomeCode:
        getEngagementOutcome(
          latestEngagement || {}
        )
    }
  };
}

/* =========================
   SMALL UTIL EXPORTS
========================= */

export function getRecommendedIntent({
  agent = {},
  lead = null,
  engagement = null,
  engagements = [],
  destination = null,
  intentCode = "",
  now = new Date()
} = {}) {
  const latestEngagement =
    getLatestEngagement(
      engagements,
      engagement
    );

  return inferIntent({
    explicitIntentCode:
      intentCode,

    agent,

    lead:
      lead || {},

    latestEngagement,

    engagements,

    destination:
      destination || {},

    now
  });
}

export function getIntentOptions() {
  return COMMUNICATION_INTENT_OPTIONS;
}