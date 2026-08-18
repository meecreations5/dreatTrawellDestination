// lib/logLeadAction.js

import {
  addDoc,
  collection,
  serverTimestamp
} from "firebase/firestore";

import { db } from "./firebase";

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
      metadata.notes ??
      metadata.note ??
      null,

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
    description,

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

  return ref.id;
}