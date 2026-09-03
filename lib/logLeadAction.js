// lib/logLeadAction.js

import {
  addDoc,
  collection,
  serverTimestamp
} from "firebase/firestore";

import { db } from "./firebase";
import { cleanOfficeClipboardText } from "./richTextSanitizer";
import { recordDailyActivity } from "./workTaskService";
import { classifyOperationalActivity, getOperationalWorkUnitKey } from "./workActivityClassifier";

export const LEAD_TIMELINE_TYPES = {
  CREATED: "created",
  STAGE_CHANGED: "stage_changed",
  FOLLOW_UP: "follow_up",
  QUOTATION: "quotation",
  ASSIGNED: "assigned",
  REMARK: "remark"
};

function getUserName(user) {
  return (
    user?.name ||
    user?.displayName ||
    user?.fullName ||
    user?.email ||
    "System"
  );
}

function getUserEmail(user) {
  return user?.email || "";
}

function cleanUndefined(obj = {}) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined)
  );
}

function normalizeMetadata(metadata = {}) {
  return cleanUndefined({
    // keep all incoming metadata
    ...metadata,

    // quotation backward-compatible aliases
    amount:
      metadata.amount ??
      metadata.totalPrice ??
      metadata.totalAmount ??
      metadata.customerQuotedAmount ??
      null,

    currency:
      metadata.currency ??
      "INR",

    revision:
      metadata.revision ??
      metadata.revisionNumber ??
      metadata.rev ??
      metadata.version ??
      null,

    sendVia:
      metadata.sendVia ??
      metadata.sentVia ??
      [],

    sentVia:
      metadata.sentVia ??
      metadata.sendVia ??
      null,

    itineraryHtml:
      metadata.itineraryHtml ??
      null,

    notes:
      metadata.notes !== undefined && metadata.notes !== null
        ? cleanOfficeClipboardText(metadata.notes)
        : metadata.note !== undefined && metadata.note !== null
          ? cleanOfficeClipboardText(metadata.note)
          : null,

    quotationId:
      metadata.quotationId ??
      null,

    toEmail:
      metadata.toEmail ??
      null,

    toMobile:
      metadata.toMobile ??
      null,

    toName:
      metadata.toName ??
      null
  });
}

export async function logLeadAction({
  leadId,
  type,
  title,
  description = "",
  metadata = {},
  user,
  ...extraFields
}) {
  if (!leadId || !type || !title) {
    throw new Error("logLeadAction: missing required fields");
  }

  const payload = cleanUndefined({
    type,
    title,
    description: cleanOfficeClipboardText(description),

    // keeps top-level fields from logFollowUp.js if passed
    ...extraFields,

    createdByUid: user?.uid || null,
    createdByEmail: getUserEmail(user) || null,
    createdByName: getUserName(user),

    // important: now this keeps follow-up metadata also
    metadata: normalizeMetadata(metadata),

    createdAt: serverTimestamp()
  });

  const ref = await addDoc(
    collection(db, "leads", leadId, "timeline"),
    payload
  );

  // Mirror lead timeline activity into the manager/team daily activity stream.
  // This is intentionally best-effort so tracking can never block core Lead work.
  try {
    const normalizedType = String(type || "lead_activity").trim().toLowerCase();
    // The current Lead Follow-up flow already writes a structured Work Task
    // activity event, so avoid double-counting the same follow-up in daily totals.
    if (normalizedType === "follow_up" && metadata?.followUpId) {
      return ref.id;
    }
    const classification = classifyOperationalActivity({
      taskType: `lead_${normalizedType}`,
      timelineType: type,
      title,
      note: description,
      metadata,
      action: metadata?.action,
      revision: metadata?.revision
    });
    const workUnitKey = getOperationalWorkUnitKey({
      taskType: classification.activityType,
      leadId,
      title,
      note: description,
      action: metadata?.action,
      revision: metadata?.revision,
      quotationId: metadata?.quotationId,
      vendorRequestId: metadata?.vendorRequestId,
      vendorId: metadata?.vendorId,
      vendorName: metadata?.vendorName,
      paymentId: metadata?.paymentId
    }, classification);

    await recordDailyActivity({
      activityType: classification.trackable ? classification.activityType : `lead_${normalizedType}`,
      activityTypeLabel: classification.trackable ? classification.activityTypeLabel : title,
      activityGroup: classification.trackable ? classification.activityGroup : "lead",
      title,
      lead: {
        id: leadId,
        leadId,
        leadCode: metadata?.leadCode || extraFields?.leadCode || "",
        travelAgentId: metadata?.travelAgentId || extraFields?.travelAgentId || "",
        travelAgentName: metadata?.travelAgentName || extraFields?.travelAgentName || "",
        destinationName: metadata?.destinationName || extraFields?.destinationName || ""
      },
      eventType: `lead_${normalizedType}`,
      note: description || title,
      status: metadata?.status || "logged",
      user,
      extra: {
        leadTimelineId: ref.id,
        leadTimelineType: type,
        timelineAction: metadata?.action || "",
        revision: metadata?.revision ?? null,
        quotationId: metadata?.quotationId || "",
        vendorRequestId: metadata?.vendorRequestId || "",
        vendorId: metadata?.vendorId || "",
        vendorName: metadata?.vendorName || "",
        paymentId: metadata?.paymentId || "",
        paymentDirection: metadata?.paymentDirection || "",
        activityStatus: metadata?.status || "",
        workUnitKey,
        operationalActivityType: classification.trackable ? classification.activityType : "",
        activityKind: "lead_timeline"
      }
    });
  } catch (trackingError) {
    console.warn("Lead action saved, but daily activity tracking failed:", trackingError);
  }

  return ref.id;
}