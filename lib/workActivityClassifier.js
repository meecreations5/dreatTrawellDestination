const CANONICAL_TYPES = new Set([
  "quote_creation",
  "quote_follow_up",
  "requote_follow_up",
  "vendor_coordination",
  "lead_follow_up",
  "group_coordination",
  "supplier_coordination",
  "ticket_editing",
  "payment_management"
]);

const TYPE_META = {
  quote_creation: { label: "Quote Creation", group: "lead" },
  quote_follow_up: { label: "Quote", group: "lead" },
  requote_follow_up: { label: "Re-Quote", group: "lead" },
  vendor_coordination: { label: "Vendor Coordination", group: "lead" },
  lead_follow_up: { label: "Lead Follow-up", group: "lead" },
  payment_management: { label: "Payment / Operations", group: "lead" },
  group_coordination: { label: "Group Coordination", group: "on_ground" },
  supplier_coordination: { label: "Supplier Coordination", group: "on_ground" },
  ticket_editing: { label: "Ticket Editing", group: "on_ground" }
};

function clean(value) {
  return String(value || "").trim();
}

function normalize(value) {
  return clean(value).toLowerCase();
}

function numericRevision(value) {
  const direct = Number(value || 0);
  return Number.isFinite(direct) && direct > 0 ? direct : 0;
}

export function getOperationalRevision(item = {}) {
  const direct = numericRevision(
    item.revision ||
    item.quotationRevision ||
    item.metadata?.revision ||
    item.metadata?.quotationRevision
  );
  if (direct) return direct;

  const text = [item.title, item.note, item.taskTypeLabel, item.description]
    .map(clean)
    .filter(Boolean)
    .join(" ");
  const match = text.match(/\brev(?:ision)?\s*[-:#]?\s*(\d+)\b/i);
  return match ? numericRevision(match[1]) : 0;
}

export function classifyOperationalActivity(item = {}) {
  const rawType = normalize(item.taskType || item.activityType);
  if (CANONICAL_TYPES.has(rawType)) {
    const meta = TYPE_META[rawType];
    return {
      activityType: rawType,
      activityTypeLabel: meta.label,
      activityGroup: meta.group,
      revision: getOperationalRevision(item),
      trackable: true
    };
  }

  const action = normalize(
    item.timelineAction ||
    item.leadTimelineAction ||
    item.action ||
    item.metadata?.action ||
    item.eventType
  );
  const timelineType = normalize(
    item.timelineType ||
    item.leadTimelineType ||
    item.type ||
    item.sourceTimelineType ||
    rawType
  );
  const titleText = normalize([item.title, item.note, item.taskTypeLabel, item.description].filter(Boolean).join(" "));
  const revision = getOperationalRevision(item);

  const isPayment =
    timelineType.includes("payment") ||
    action.includes("payment") ||
    titleText.includes("payment");
  if (isPayment) {
    return { activityType: "payment_management", activityTypeLabel: TYPE_META.payment_management.label, activityGroup: "lead", revision, trackable: true };
  }

  const isVendor =
    timelineType.includes("vendor") ||
    action.startsWith("vendor_") ||
    titleText.includes("vendor ");
  if (isVendor) {
    return { activityType: "vendor_coordination", activityTypeLabel: TYPE_META.vendor_coordination.label, activityGroup: "lead", revision, trackable: true };
  }

  const isQuotation =
    timelineType.includes("quotation") ||
    action.includes("quotation") ||
    action.includes("draft_saved") ||
    action.includes("draft_updated") ||
    titleText.includes("quotation") ||
    titleText.includes("re-quote") ||
    titleText.includes("requote");

  if (isQuotation) {
    const isRequote =
      revision > 1 ||
      action.includes("revision") ||
      titleText.includes("re-quote") ||
      titleText.includes("requote");
    if (isRequote) {
      return { activityType: "requote_follow_up", activityTypeLabel: TYPE_META.requote_follow_up.label, activityGroup: "lead", revision, trackable: true };
    }

    const isCreation =
      action === "draft_saved" ||
      action === "draft_updated" ||
      action === "quotation_created" ||
      titleText.includes("draft saved") ||
      titleText.includes("draft updated") ||
      titleText.includes("draft created");
    const activityType = isCreation ? "quote_creation" : "quote_follow_up";
    return {
      activityType,
      activityTypeLabel: TYPE_META[activityType].label,
      activityGroup: "lead",
      revision,
      trackable: true
    };
  }

  const isLeadFollowUp =
    timelineType === "follow_up" ||
    action.includes("follow_up") ||
    titleText.includes("lead follow-up") ||
    titleText.includes("lead follow up");
  if (isLeadFollowUp) {
    return { activityType: "lead_follow_up", activityTypeLabel: TYPE_META.lead_follow_up.label, activityGroup: "lead", revision, trackable: true };
  }

  return {
    activityType: rawType || timelineType || "lead_activity",
    activityTypeLabel: clean(item.taskTypeLabel || item.title || "Lead Activity"),
    activityGroup: clean(item.taskGroup || item.activityGroup || "lead"),
    revision,
    trackable: false
  };
}

export function getOperationalWorkUnitKey(item = {}, classification = null) {
  const info = classification || classifyOperationalActivity(item);
  if (clean(item.workUnitKey)) return clean(item.workUnitKey);
  if (clean(item.taskId)) return clean(item.taskId);

  const leadId = clean(item.leadId || item.metadata?.leadId);
  const quotationId = clean(item.quotationId || item.metadata?.quotationId);
  const vendorRequestId = clean(item.vendorRequestId || item.metadata?.vendorRequestId);
  const paymentId = clean(item.paymentId || item.metadata?.paymentId);
  const revision = info.revision || getOperationalRevision(item);

  if (info.activityType === "requote_follow_up") {
    return [info.activityType, leadId, revision || quotationId || clean(item.id)].filter(Boolean).join(":");
  }
  if (["quote_creation", "quote_follow_up"].includes(info.activityType)) {
    return [info.activityType, leadId, revision || quotationId || clean(item.id)].filter(Boolean).join(":");
  }
  if (info.activityType === "vendor_coordination") {
    return [info.activityType, leadId, vendorRequestId || clean(item.vendorId) || clean(item.vendorName) || clean(item.id)].filter(Boolean).join(":");
  }
  if (info.activityType === "payment_management") {
    return [info.activityType, leadId, paymentId || clean(item.id)].filter(Boolean).join(":");
  }
  return [info.activityType, leadId, clean(item.id)].filter(Boolean).join(":");
}

export function isOperationalCompletionEvent(item = {}, classification = null) {
  const info = classification || classifyOperationalActivity(item);
  const status = normalize(item.toStatus || item.status || item.activityStatus);
  const action = normalize(item.timelineAction || item.leadTimelineAction || item.action || item.eventType);
  const text = normalize([item.title, item.note, item.taskTypeLabel].filter(Boolean).join(" "));

  if (["completed", "complete", "sent", "final", "verified", "paid", "confirmed"].includes(status)) return true;
  if (action === "lead_follow_up_completed") return true;

  if (["quote_creation", "quote_follow_up", "requote_follow_up"].includes(info.activityType)) {
    return action.includes("sent") || action.includes("final_quotation") || text.includes("quotation sent") || text.includes("quotation resent");
  }
  if (info.activityType === "vendor_coordination") {
    return action.includes("vendor_quote_received") || action.includes("vendor_quote_finalized");
  }
  if (info.activityType === "payment_management") {
    return status === "paid" || status === "verified" || text.includes("marked paid") || text.includes("payment verified");
  }
  return false;
}

export function calculateOperationalActivityMetrics(events = []) {
  const classified = events
    .map(item => ({
      item,
      info: classifyOperationalActivity(item)
    }))
    .filter(row => row.info.trackable);

  const keysFor = predicate => new Set(
    classified
      .filter(predicate)
      .map(row => getOperationalWorkUnitKey(row.item, row.info))
      .filter(Boolean)
  );

  const all = keysFor(() => true);
  const completed = keysFor(row => isOperationalCompletionEvent(row.item, row.info));
  const lead = keysFor(row => row.info.activityGroup === "lead");
  const onGround = keysFor(row => row.info.activityGroup === "on_ground");
  const quote = keysFor(row => ["quote_creation", "quote_follow_up"].includes(row.info.activityType));
  const requote = keysFor(row => row.info.activityType === "requote_follow_up");
  const leadFollowUp = keysFor(row => row.info.activityType === "lead_follow_up");
  const vendor = keysFor(row => row.info.activityType === "vendor_coordination");
  const supplier = keysFor(row => row.info.activityType === "supplier_coordination");
  const group = keysFor(row => row.info.activityType === "group_coordination");
  const ticket = keysFor(row => row.info.activityType === "ticket_editing");
  const payment = keysFor(row => row.info.activityType === "payment_management");

  return {
    workActions: all.size,
    completedWork: completed.size,
    leadWork: lead.size,
    onGroundWork: onGround.size,
    quoteWork: quote.size,
    requoteWork: requote.size,
    leadFollowUps: leadFollowUp.size,
    vendorCoordination: vendor.size,
    supplierCoordination: supplier.size,
    groupCoordination: group.size,
    ticketEditing: ticket.size,
    paymentWork: payment.size
  };
}
