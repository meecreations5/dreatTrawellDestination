// lib/suggestCommunicationReply.js

/* =========================
   SMART COMMUNICATION ENGINE
   Rule-based suggestion helper

   Priority:
   1. Manual intent
   2. Engagement type
   3. Lead stage
   4. Previous engagement age / context
   5. Destination availability
   6. New agent / default requirement
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
    assetUsageTypes: ["company_profile", "agent_onboarding", "branding_document"]
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
    templateTypes: ["package", "itinerary", "promotion", "message"],
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
    defaultFollowUpDays: 2,
    waitingOn: "agent",
    communicationStatus: "waiting_for_agent",
    nextAction: "promotion_follow_up",
    templateTypes: ["promotion", "package", "message"],
    assetUsageTypes: [
      "ongoing_promotion",
      "promotional_package",
      "social_media_creative",
      "festival_creative"
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
    assetUsageTypes: ["quotation_attachment", "promotional_package"]
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
    assetUsageTypes: ["company_profile", "promotional_package"]
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
    assetUsageTypes: ["quotation_attachment", "promotional_package"]
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
    assetUsageTypes: ["payment_details", "terms_conditions"]
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
    assetUsageTypes: ["company_profile", "agent_onboarding"]
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
    assetUsageTypes: ["ongoing_promotion", "promotional_package"]
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
  return String(value || "").trim().toLowerCase();
}

function cleanString(value = "") {
  return String(value || "").trim();
}

function getFirstValue(...values) {
  return (
    values.find(
      value => typeof value === "string" && value.trim().length > 0
    )?.trim() || ""
  );
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === "function") return value.toDate();

  if (typeof value?.seconds === "number") {
    return new Date(value.seconds * 1000);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function daysBetween(fromDate, toDateValue = new Date()) {
  const from = toDate(fromDate);
  const to = toDate(toDateValue);

  if (!from || !to) return 0;

  const diff = to.getTime() - from.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function addDays(dateValue, days = 1) {
  const date = toDate(dateValue) || new Date();
  const next = new Date(date);

  next.setDate(next.getDate() + Number(days || 0));

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
    const aTime = toDate(getTimestamp(a))?.getTime() || 0;
    const bTime = toDate(getTimestamp(b))?.getTime() || 0;

    return bTime - aTime;
  });
}

function getLatestEngagement(engagements = [], fallback = null) {
  const rows = Array.isArray(engagements)
    ? engagements.filter(item => item && !isDeleted(item))
    : [];

  if (fallback) rows.push(fallback);

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
  return getFirstValue(agent.agentCode, agent.code, agent.id);
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
  return getFirstValue(spoc.email, agent.spocEmail, agent.email);
}

function getSpocMobile(spoc = {}, agent = {}) {
  return getFirstValue(spoc.mobile, spoc.phone, agent.spocMobile, agent.mobile);
}

function getDestinationName(destination = {}, lead = {}, engagement = {}) {
  return getFirstValue(
    destination.name,
    destination.destinationName,
    lead.destinationName,
    engagement.destinationName,
    Array.isArray(lead.destinationNames)
      ? lead.destinationNames.filter(Boolean).join(", ")
      : "",
    "{{destination}}"
  );
}

function getDestinationId(destination = {}, lead = {}, engagement = {}) {
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
  return normalize(
    lead.stage ||
      lead.leadStage ||
      lead.status ||
      lead.currentStage ||
      ""
  );
}

function getEngagementChannel(engagement = {}) {
  return normalize(engagement.channel || engagement.communicationChannel || "");
}

function getEngagementType(engagement = {}) {
  return normalize(
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

function getEngagementOutcome(engagement = {}) {
  return normalize(
    engagement.outcome ||
      engagement.result ||
      engagement.response ||
      engagement.agentResponse ||
      engagement.interestLevel ||
      ""
  );
}

function getEngagementMessage(engagement = {}) {
  return getFirstValue(
    engagement.messageText,
    engagement.message,
    engagement.notes,
    engagement.remark,
    engagement.subject,
    engagement.outcome
  );
}

/* =========================
   INTENT HELPERS
========================= */

export function getCommunicationIntentByCode(code = "") {
  const normalizedCode = normalize(code);

  return (
    Object.values(COMMUNICATION_INTENTS).find(
      intent => intent.code === normalizedCode
    ) || null
  );
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
  const explicitIntent = getCommunicationIntentByCode(explicitIntentCode);

  if (explicitIntent) {
    return {
      ...explicitIntent,
      reason: "Selected manually"
    };
  }

  const leadStage = getLeadStage(lead);
  const latestChannel = getEngagementChannel(latestEngagement || {});
  const engagementType = getEngagementType(latestEngagement || {});
  const engagementOutcome = getEngagementOutcome(latestEngagement || {});
  const latestMessage = normalize(getEngagementMessage(latestEngagement || {}));
  const latestAgeDays = daysBetween(getTimestamp(latestEngagement), now);

  const engagementCount = Array.isArray(engagements)
    ? engagements.filter(item => item && !isDeleted(item)).length
    : 0;

  const hasDestination = Boolean(
    getDestinationId(destination, lead, latestEngagement || {}) ||
      getDestinationName(destination, lead, latestEngagement || "")
  );

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
     PRIORITY 1: ENGAGEMENT TYPE / OUTCOME
  ========================= */

  if (
    contextText.includes("payment") ||
    contextText.includes("advance") ||
    contextText.includes("token")
  ) {
    return {
      ...COMMUNICATION_INTENTS.PAYMENT_REMINDER,
      reason: "Based on engagement type / outcome: payment"
    };
  }

  if (
    contextText.includes("hot") ||
    contextText.includes("urgent") ||
    contextText.includes("closing")
  ) {
    return {
      ...COMMUNICATION_INTENTS.HOT_LEAD_FOLLOW_UP,
      reason: "Based on engagement type / outcome: hot lead"
    };
  }

  if (
    contextText.includes("revision") ||
    contextText.includes("revise") ||
    contextText.includes("change required") ||
    contextText.includes("changes required")
  ) {
    return {
      ...COMMUNICATION_INTENTS.REVISION_CONFIRMATION,
      reason: "Based on engagement type / outcome: revision"
    };
  }

  if (
    contextText.includes("quotation") ||
    contextText.includes("quote")
  ) {
    return {
      ...COMMUNICATION_INTENTS.QUOTE_FOLLOW_UP,
      reason: "Based on engagement type / outcome: quotation"
    };
  }

  if (
    contextText.includes("meeting") ||
    contextText.includes("agent_meeting") ||
    contextText.includes("f2f") ||
    contextText.includes("face to face")
  ) {
    return {
      ...COMMUNICATION_INTENTS.MEETING_FOLLOW_UP,
      reason: "Based on engagement type: meeting"
    };
  }

  if (
    contextText.includes("package") ||
    contextText.includes("promotion") ||
    contextText.includes("brochure") ||
    contextText.includes("destination") ||
    contextText.includes("campaign")
  ) {
    if (contextText.includes("promotion") || contextText.includes("campaign")) {
      return {
        ...COMMUNICATION_INTENTS.SEND_PROMOTION,
        reason: "Based on engagement type: promotion"
      };
    }

    return {
      ...COMMUNICATION_INTENTS.SEND_DESTINATION_PACKAGE,
      reason: "Based on engagement type: package / destination"
    };
  }

  if (
    contextText.includes("no response") ||
    contextText.includes("not replied") ||
    contextText.includes("no reply") ||
    contextText.includes("pending response")
  ) {
    return {
      ...COMMUNICATION_INTENTS.NO_RESPONSE_FOLLOW_UP,
      reason: "Based on engagement outcome: no response"
    };
  }

  if (
    contextText.includes("requirement") ||
    contextText.includes("query") ||
    contextText.includes("enquiry") ||
    contextText.includes("inquiry")
  ) {
    return {
      ...COMMUNICATION_INTENTS.ASK_REQUIREMENT,
      reason: "Based on engagement type: requirement / enquiry"
    };
  }

  if (
    engagementType.includes("call") ||
    engagementType.includes("phone") ||
    engagementType.includes("telecalling")
  ) {
    return {
      ...COMMUNICATION_INTENTS.ASK_REQUIREMENT,
      reason: "Based on engagement type: call"
    };
  }

  if (
    engagementType.includes("whatsapp") ||
    engagementType.includes("message") ||
    engagementType.includes("chat")
  ) {
    if (latestAgeDays >= 2) {
      return {
        ...COMMUNICATION_INTENTS.NO_RESPONSE_FOLLOW_UP,
        reason: `Based on engagement type: WhatsApp/message, no response for ${latestAgeDays} day(s)`
      };
    }

    return {
      ...COMMUNICATION_INTENTS.ASK_REQUIREMENT,
      reason: "Based on engagement type: WhatsApp/message"
    };
  }

  if (
    engagementType.includes("email") ||
    engagementType.includes("mail")
  ) {
    if (latestAgeDays >= 2) {
      return {
        ...COMMUNICATION_INTENTS.NO_RESPONSE_FOLLOW_UP,
        reason: `Based on engagement type: email, no response for ${latestAgeDays} day(s)`
      };
    }

    return {
      ...COMMUNICATION_INTENTS.NEW_AGENT_INTRO,
      reason: "Based on engagement type: email"
    };
  }

  /* =========================
     PRIORITY 2: LEAD STAGE
  ========================= */

  if (
    leadStage.includes("payment") ||
    leadStage.includes("payment_pending")
  ) {
    return {
      ...COMMUNICATION_INTENTS.PAYMENT_REMINDER,
      reason: "Lead is in payment pending stage"
    };
  }

  if (
    leadStage.includes("hot") ||
    leadStage.includes("hot_lead")
  ) {
    return {
      ...COMMUNICATION_INTENTS.HOT_LEAD_FOLLOW_UP,
      reason: "Lead is marked as hot"
    };
  }

  if (
    leadStage.includes("revision")
  ) {
    return {
      ...COMMUNICATION_INTENTS.REVISION_CONFIRMATION,
      reason: "Lead is in revision stage"
    };
  }

  if (
    leadStage.includes("quote_sent") ||
    leadStage.includes("quotation_sent") ||
    leadStage.includes("quote sent") ||
    leadStage.includes("quotation")
  ) {
    return {
      ...COMMUNICATION_INTENTS.QUOTE_FOLLOW_UP,
      reason: "Lead is in quotation / quote sent stage"
    };
  }

  if (
    leadStage.includes("lost") ||
    leadStage.includes("dormant")
  ) {
    return {
      ...COMMUNICATION_INTENTS.LOST_LEAD_RECONNECT,
      reason: "Lead is lost or dormant"
    };
  }

  /* =========================
     PRIORITY 3: AGE / CONTEXT
  ========================= */

  if (latestEngagement && latestAgeDays >= 2) {
    return {
      ...COMMUNICATION_INTENTS.NO_RESPONSE_FOLLOW_UP,
      reason: `No recent response for ${latestAgeDays} day(s)`
    };
  }

  if (hasDestination) {
    return {
      ...COMMUNICATION_INTENTS.SEND_DESTINATION_PACKAGE,
      reason: "Destination is available"
    };
  }

  if (engagementCount === 0 || agent.isNew === true) {
    return {
      ...COMMUNICATION_INTENTS.NEW_AGENT_INTRO,
      reason: "No previous engagement found"
    };
  }

  return {
    ...COMMUNICATION_INTENTS.ASK_REQUIREMENT,
    reason: "Default suggestion to collect requirement"
  };
}

/* =========================
   TEMPLATE RECOMMENDATION
========================= */

function templateSupportsChannel(template = {}, channel = "whatsapp") {
  const normalizedChannel = normalize(channel);

  if (!template || isDeleted(template)) return false;
  if (template.active === false || template.status === "draft") return false;

  if (normalizedChannel === "email") {
    if (template.channels && template.channels.email === false) return false;
    return Boolean(template.emailHtml || template.emailSubject);
  }

  if (normalizedChannel === "whatsapp") {
    if (template.channels && template.channels.whatsapp === false) return false;
    return Boolean(template.whatsappText);
  }

  return true;
}

function templateMatchesDestination(template = {}, destinationContext = {}) {
  const selectedDestinationId = getFirstValue(destinationContext.id);
  const selectedDestinationName = normalize(destinationContext.name);

  if (!selectedDestinationId && !selectedDestinationName) return true;

  const templateDestinationIds = Array.isArray(template.destinationIds)
    ? template.destinationIds
    : [];

  const templateDestinationNames = Array.isArray(template.destinationNames)
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
    templateDestinationIds.includes(selectedDestinationId);

  const nameMatch =
    selectedDestinationName &&
    templateDestinationNames
      .map(name => normalize(name))
      .includes(selectedDestinationName);

  return Boolean(idMatch || nameMatch);
}

function scoreTemplate(template = {}, context = {}) {
  const {
    intent,
    channel,
    destinationContext,
    latestEngagement
  } = context;

  let score = 0;
  const reasons = [];

  if (!templateSupportsChannel(template, channel)) {
    return {
      score: -999,
      reasons: ["Channel not supported"]
    };
  }

  if (!templateMatchesDestination(template, destinationContext)) {
    return {
      score: -999,
      reasons: ["Destination not matching"]
    };
  }

  score += 20;
  reasons.push("Active usable template");

  if (template.channels?.[channel]) {
    score += 15;
    reasons.push(`${channel} enabled`);
  }

  const templateType = normalize(template.templateType || "message");

  if (intent?.templateTypes?.includes(templateType)) {
    score += 30;
    reasons.push("Template type matches intent");
  }

  const templateDestinationIds = Array.isArray(template.destinationIds)
    ? template.destinationIds
    : [];

  const templateDestinationNames = Array.isArray(template.destinationNames)
    ? template.destinationNames
    : [];

  if (templateDestinationIds.length || templateDestinationNames.length) {
    score += 20;
    reasons.push("Destination-specific template");
  } else {
    score += 8;
    reasons.push("General template");
  }

  const searchable = normalize(
    [
      template.name,
      template.categoryName,
      template.category,
      template.categoryCode,
      template.templateType,
      template.primaryDestination
    ]
      .filter(Boolean)
      .join(" ")
  );

  const intentWords = normalize(intent?.name || "")
    .split(/\s+/)
    .filter(Boolean);

  intentWords.forEach(word => {
    if (searchable.includes(word)) {
      score += 4;
    }
  });

  if (
    latestEngagement?.templateId &&
    latestEngagement.templateId === template.id
  ) {
    score -= 8;
    reasons.push("Recently used template");
  }

  score += Math.min(Number(template.usageCount || 0), 10);

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
  return (Array.isArray(templates) ? templates : [])
    .map(template => {
      const scored = scoreTemplate(template, {
        intent,
        channel,
        destinationContext,
        latestEngagement
      });

      return {
        id: template.id,
        templateId: template.id,
        name: template.name || "Untitled Template",
        templateType: template.templateType || "message",
        categoryName: template.categoryName || "",
        channels: template.channels || {},
        destinationIds: template.destinationIds || [],
        destinationNames: template.destinationNames || [],
        defaultAssets: template.defaultAssets || [],
        usageCount: template.usageCount || 0,
        score: scored.score,
        reasons: scored.reasons,
        raw: template
      };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
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
  return getFirstValue(asset.assetId, asset.id, asset.documentId, getAssetUrl(asset));
}

function getAssetUsageType(asset = {}) {
  return normalize(asset.usageType || asset.usage || "");
}

function getAssetChannelUsage(asset = {}) {
  return Array.isArray(asset.channelUsage) ? asset.channelUsage : [];
}

function assetMatchesDestination(asset = {}, destinationContext = {}) {
  const selectedDestinationId = getFirstValue(destinationContext.id);
  const selectedDestinationName = normalize(destinationContext.name);

  if (!selectedDestinationId && !selectedDestinationName) return true;

  const assetDestinationId = getFirstValue(asset.destinationId);
  const assetDestinationName = normalize(asset.destinationName);

  const isGeneral = !assetDestinationId && !assetDestinationName;

  if (isGeneral) return true;

  return Boolean(
    (selectedDestinationId && assetDestinationId === selectedDestinationId) ||
      (selectedDestinationName && assetDestinationName === selectedDestinationName)
  );
}

function assetSupportsChannel(asset = {}, channel = "whatsapp") {
  const channelUsage = getAssetChannelUsage(asset);

  if (!channelUsage.length) return true;

  return channelUsage.includes(channel);
}

function isAssetValid(asset = {}) {
  if (asset.approvedForUse === false) return false;
  if (asset.active === false) return false;
  if (isDeleted(asset)) return false;
  if (!getAssetUrl(asset)) return false;

  const validTo = asset.validTo ? new Date(`${asset.validTo}T23:59:59`) : null;
  const validFrom = asset.validFrom
    ? new Date(`${asset.validFrom}T00:00:00`)
    : null;

  const now = new Date();

  if (validTo && !Number.isNaN(validTo.getTime()) && validTo < now) {
    return false;
  }

  if (validFrom && !Number.isNaN(validFrom.getTime()) && validFrom > now) {
    return false;
  }

  return true;
}

function scoreAsset(asset = {}, context = {}) {
  const { intent, channel, destinationContext } = context;

  let score = 0;
  const reasons = [];

  if (!isAssetValid(asset)) {
    return {
      score: -999,
      reasons: ["Asset not valid"]
    };
  }

  if (!assetMatchesDestination(asset, destinationContext)) {
    return {
      score: -999,
      reasons: ["Destination not matching"]
    };
  }

  if (!assetSupportsChannel(asset, channel)) {
    return {
      score: -999,
      reasons: ["Channel not matching"]
    };
  }

  score += 20;
  reasons.push("Active approved asset");

  const usageType = getAssetUsageType(asset);

  if (intent?.assetUsageTypes?.includes(usageType)) {
    score += 35;
    reasons.push("Usage type matches intent");
  }

  if (asset.destinationId || asset.destinationName) {
    score += 20;
    reasons.push("Destination-specific asset");
  } else {
    score += 8;
    reasons.push("General asset");
  }

  if (asset.approvedForUse !== false) {
    score += 10;
    reasons.push("Approved for use");
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

  const intentWords = normalize(intent?.name || "")
    .split(/\s+/)
    .filter(Boolean);

  intentWords.forEach(word => {
    if (searchable.includes(word)) {
      score += 3;
    }
  });

  return {
    score,
    reasons
  };
}

function normalizeRecommendedAsset(asset = {}, scored = {}) {
  return {
    assetId: getAssetId(asset),
    title: getAssetTitle(asset),
    url: getAssetUrl(asset),

    categoryId: asset.categoryId || "",
    categoryName: asset.categoryName || "",
    categorySlug: asset.categorySlug || "",

    assetType: asset.assetType || asset.documentType || "document",
    usageType: asset.usageType || "",
    visibility: asset.visibility || "team",

    currentVersion: asset.currentVersion || asset.version || 1,

    fileName: asset.fileName || asset.currentFileName || "",
    fileSize: asset.fileSize || asset.currentFileSize || null,
    fileType: asset.fileType || asset.currentFileType || "",
    fileExtension:
      asset.fileExtension || asset.currentFileExtension || "",

    destinationId: asset.destinationId || "",
    destinationName: asset.destinationName || "",

    sharedAs: asset.sharedAs || "file_link",
    shareMode: asset.shareMode || "link",

    score: scored.score || 0,
    reasons: scored.reasons || [],

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
  return (Array.isArray(assets) ? assets : [])
    .map(asset => {
      const scored = scoreAsset(asset, {
        intent,
        channel,
        destinationContext
      });

      return normalizeRecommendedAsset(asset, scored);
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/* =========================
   MESSAGE BUILDERS
========================= */

function buildContextVariables({
  agent = {},
  spoc = {},
  lead = {},
  destination = {},
  latestEngagement = null
}) {
  return {
    spocName: getSpocName(spoc, agent),
    agencyName: getAgentName(agent),
    agentCode: getAgentCode(agent),
    destination: getDestinationName(destination, lead, latestEngagement || {}),

    teamMemberName: "{{teamMemberName}}",
    companyName: "{{companyName}}",
    companyEmail: "{{companyEmail}}",
    companyPhone: "{{companyPhone}}",

    assetLinks: "{{assetLinks}}",
    assetLinksHtml: "{{assetLinksHtml}}",
    signature: "{{signature}}"
  };
}

function applyVars(template = "", vars = {}) {
  return String(template || "").replace(
    /{{\s*([a-zA-Z0-9_]+)\s*}}/g,
    (_, key) => vars[key] ?? `{{${key}}}`
  );
}

function buildEmailHtmlFromText(text = "") {
  return String(text || "")
    .split(/\n{2,}/)
    .map(block => `<p>${block.replace(/\n/g, "<br />")}</p>`)
    .join("");
}

function getSuggestionTemplates(intentCode) {
  const map = {
    new_agent_intro: [
      {
        id: "intro_polished",
        title: "Professional Introduction",
        tone: "polished",
        subject: "Introduction from {{companyName}}",
        body: `Hi {{spocName}},

Hope you are doing well.

We are {{companyName}}, a B2B destination management partner for travel agents and tour operators.

We support travel partners with destination packages, hotel options, transfers, sightseeing and smooth on-ground arrangements.

Please feel free to share your upcoming travel requirements.

{{signature}}`
      },
      {
        id: "intro_short",
        title: "Short WhatsApp Intro",
        tone: "short",
        subject: "{{companyName}} | Travel Partner Support",
        body: `Hi {{spocName}},

This is {{teamMemberName}} from {{companyName}}.

We support travel agents with packages, hotels, transfers and sightseeing.

Please feel free to share your upcoming requirements.

{{signature}}`
      }
    ],

    ask_requirement: [
      {
        id: "requirement_checklist",
        title: "Requirement Checklist",
        tone: "structured",
        subject: "Please share travel requirement for {{destination}}",
        body: `Hi {{spocName}},

Please share the below details so we can plan the {{destination}} package properly:

Travel dates:
Number of adults / children:
Hotel category:
Meal plan:
Approx budget:
Sightseeing preference:
Any special requirement:

Once received, we will prepare the best possible options.

{{signature}}`
      }
    ],

    send_destination_package: [
      {
        id: "package_share",
        title: "Share Destination Package",
        tone: "helpful",
        subject: "{{destination}} package details for {{agencyName}}",
        body: `Hi {{spocName}},

Please find the {{destination}} package details for your client.

We have planned this keeping comfort, smooth arrangements and memorable travel moments in mind.

Please check and let us know if you need any changes or specific hotel options.

{{signature}}`
      },
      {
        id: "package_short",
        title: "Short Package Share",
        tone: "short",
        subject: "{{destination}} package details",
        body: `Hi {{spocName}},

Sharing {{destination}} package details for your reference.

Please let us know your client preference so we can customize further.

{{signature}}`
      }
    ],

    send_promotion: [
      {
        id: "promotion_push",
        title: "Promotion Share",
        tone: "sales",
        subject: "{{destination}} promotion for your clients",
        body: `Hi {{spocName}},

We have a good ongoing promotion for {{destination}}.

This can be useful for your upcoming client queries and seasonal enquiries.

Please share your requirement and we will help you with suitable options.

{{signature}}`
      }
    ],

    quote_follow_up: [
      {
        id: "quote_soft_follow_up",
        title: "Soft Quote Follow-up",
        tone: "soft",
        subject: "Follow-up on {{destination}} quotation",
        body: `Hi {{spocName}},

Just following up on the {{destination}} quotation shared earlier.

Please let us know if your client has any feedback or changes required.

We will be happy to revise it accordingly.

{{signature}}`
      },
      {
        id: "quote_closing_follow_up",
        title: "Closing Follow-up",
        tone: "closing",
        subject: "{{destination}} quotation confirmation",
        body: `Hi {{spocName}},

Following up on the {{destination}} quotation.

Please confirm if we should proceed with availability check / booking process for your client.

Rates and availability may change, so early confirmation will help us secure better options.

{{signature}}`
      }
    ],

    no_response_follow_up: [
      {
        id: "no_response_soft",
        title: "No Response Soft Reminder",
        tone: "soft",
        subject: "Gentle follow-up",
        body: `Hi {{spocName}},

Just checking if you had a chance to review the details shared earlier.

Please let us know if the client is still planning for {{destination}}, or if any changes are required.

Happy to assist.

{{signature}}`
      }
    ],

    hot_lead_follow_up: [
      {
        id: "hot_lead_close",
        title: "Hot Lead Closing",
        tone: "closing",
        subject: "{{destination}} booking confirmation",
        body: `Hi {{spocName}},

As discussed, please confirm the client decision for {{destination}}.

We can proceed with final availability and booking steps once confirmed.

To avoid rate or availability changes, we recommend closing this at the earliest.

{{signature}}`
      }
    ],

    payment_reminder: [
      {
        id: "payment_reminder",
        title: "Payment Reminder",
        tone: "polite",
        subject: "Payment reminder for {{destination}} booking",
        body: `Hi {{spocName}},

This is a gentle reminder for the pending payment for the {{destination}} booking.

Please share the payment update so we can proceed smoothly with the arrangements.

{{signature}}`
      }
    ],

    revision_confirmation: [
      {
        id: "revision_confirmation",
        title: "Revision Confirmation",
        tone: "service",
        subject: "Revision update for {{destination}}",
        body: `Hi {{spocName}},

We have noted the revision requirement for {{destination}}.

Please confirm if the requested changes are correct, and we will update the package accordingly.

{{signature}}`
      }
    ],

    meeting_follow_up: [
      {
        id: "meeting_follow_up",
        title: "Meeting Follow-up",
        tone: "relationship",
        subject: "Thank you for the discussion",
        body: `Hi {{spocName}},

Thank you for your time and discussion.

As discussed, we will be happy to support your team with packages, hotel options, transfers and sightseeing.

Please share upcoming client requirements and we will assist accordingly.

{{signature}}`
      }
    ],

    lost_lead_reconnect: [
      {
        id: "lost_reconnect",
        title: "Reconnect Message",
        tone: "relationship",
        subject: "Reconnect for upcoming travel queries",
        body: `Hi {{spocName}},

Hope you are doing well.

Just reconnecting to check if you have any upcoming {{destination}} or international travel requirements.

We will be happy to support you with suitable packages and quick quotations.

{{signature}}`
      }
    ],

    thank_you_relationship: [
      {
        id: "thank_you",
        title: "Thank You Message",
        tone: "relationship",
        subject: "Thank you",
        body: `Hi {{spocName}},

Thank you for staying connected with {{companyName}}.

We look forward to supporting your upcoming travel requirements.

{{signature}}`
      }
    ]
  };

  return map[intentCode] || map.ask_requirement;
}

function buildSuggestions({
  intent,
  channel = "whatsapp",
  vars = {}
}) {
  const templates = getSuggestionTemplates(intent.code);

  return templates.map(item => {
    const bodyText = applyVars(item.body, vars);
    const subject = applyVars(item.subject, vars);

    return {
      id: item.id,
      title: item.title,
      intentCode: intent.code,
      intentName: intent.name,
      tone: item.tone,
      channel,

      subject,
      emailSubject: subject,
      emailHtml: buildEmailHtmlFromText(bodyText),
      whatsappText: bodyText,
      bodyText,

      recommendedFollowUpDays: intent.defaultFollowUpDays,
      nextAction: intent.nextAction,
      waitingOn: intent.waitingOn,
      communicationStatus: intent.communicationStatus
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
  const followUpAt = addDays(now, intent.defaultFollowUpDays || 1);

  const labelMap = {
    follow_up: "Follow up",
    collect_requirement: "Collect requirement",
    package_follow_up: "Package follow-up",
    promotion_follow_up: "Promotion follow-up",
    quote_follow_up: "Quotation follow-up",
    soft_follow_up: "Soft follow-up",
    call_and_close: "Call and close",
    payment_follow_up: "Payment follow-up",
    revision_follow_up: "Revision follow-up",
    meeting_follow_up: "Meeting follow-up",
    reconnect: "Reconnect",
    relationship_follow_up: "Relationship follow-up"
  };

  return {
    nextAction: intent.nextAction,
    nextActionLabel: labelMap[intent.nextAction] || "Follow up",
    waitingOn: intent.waitingOn,
    communicationStatus: intent.communicationStatus,
    defaultFollowUpDays: intent.defaultFollowUpDays,
    nextFollowUpAt: followUpAt,
    nextFollowUpAtIso: followUpAt.toISOString()
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
  const safeLead = lead || {};
  const safeDestination = destination || {};

  const latestEngagement = getLatestEngagement(engagements, engagement);

  const destinationContext = {
    id: getDestinationId(safeDestination, safeLead, latestEngagement || {}),
    name: getDestinationName(safeDestination, safeLead, latestEngagement || {})
  };

  const intent = inferIntent({
    explicitIntentCode: intentCode,
    agent,
    lead: safeLead,
    latestEngagement,
    engagements,
    destination: destinationContext,
    now
  });

  const vars = buildContextVariables({
    agent,
    spoc,
    lead: safeLead,
    destination: destinationContext,
    latestEngagement
  });

  const recommendedTemplates = recommendTemplates({
    templates,
    intent,
    channel,
    destinationContext,
    latestEngagement,
    limit: templateLimit
  });

  const recommendedAssets = recommendAssets({
    assets,
    intent,
    channel,
    destinationContext,
    limit: assetLimit
  });

  const suggestions = buildSuggestions({
    intent,
    channel,
    vars
  });

  const nextAction = buildNextAction({
    intent,
    now
  });

  return {
    ok: true,

    intent: {
      code: intent.code,
      name: intent.name,
      reason: intent.reason || "",
      priority: intent.priority,
      defaultFollowUpDays: intent.defaultFollowUpDays,
      nextAction: intent.nextAction,
      waitingOn: intent.waitingOn,
      communicationStatus: intent.communicationStatus,
      templateTypes: intent.templateTypes,
      assetUsageTypes: intent.assetUsageTypes
    },

    channel,

    context: {
      agentId: agent.id || agent.agentId || "",
      agentName: getAgentName(agent),
      agentCode: getAgentCode(agent),

      spocName: vars.spocName,
      spocEmail: getSpocEmail(spoc, agent),
      spocMobile: getSpocMobile(spoc, agent),

      destinationId: destinationContext.id,
      destinationName: destinationContext.name,

      leadId: safeLead.id || safeLead.leadId || "",
      leadStage: getLeadStage(safeLead),

      latestEngagementId: latestEngagement?.id || "",
      latestEngagementType: getEngagementType(latestEngagement || ""),
      latestEngagementChannel: getEngagementChannel(latestEngagement || ""),
      latestEngagementAgeDays: latestEngagement
        ? daysBetween(getTimestamp(latestEngagement), now)
        : null
    },

    suggestions,
    recommendedTemplates,
    recommendedAssets,
    nextAction,

    diagnostics: {
      templateCount: Array.isArray(templates) ? templates.length : 0,
      assetCount: Array.isArray(assets) ? assets.length : 0,
      engagementCount: Array.isArray(engagements) ? engagements.length : 0
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
  const latestEngagement = getLatestEngagement(engagements, engagement);

  return inferIntent({
    explicitIntentCode: intentCode,
    agent,
    lead: lead || {},
    latestEngagement,
    engagements,
    destination: destination || {},
    now
  });
}

export function getIntentOptions() {
  return COMMUNICATION_INTENT_OPTIONS;
}