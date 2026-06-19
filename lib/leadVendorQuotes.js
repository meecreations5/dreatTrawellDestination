// lib/leadVendorQuotes.js

import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  serverTimestamp,
  writeBatch
} from "firebase/firestore";

import { db } from "@/lib/firebase";

import {
  logLeadAction,
  LEAD_TIMELINE_TYPES
} from "@/lib/logLeadAction";

import {
  LEAD_STAGES,
  getLeadStageMeta,
  isTerminalLeadStage,
  normalizeLeadStage
} from "@/lib/leadStages";

import { VENDOR_REQUEST_STATUS } from "@/lib/vendorConstants";

/* =========================
   LOCAL QUOTE STATUS
========================= */

const VENDOR_QUOTE_STATUS = {
  RECEIVED: "received",
  REVISED: "revised",
  SELECTED: "selected"
};

/* =========================
   HELPERS
========================= */

function cleanString(value = "") {
  return String(value || "").trim();
}

function getUserUid(user) {
  return (
    cleanString(user?.uid) ||
    cleanString(user?.id) ||
    cleanString(user?.email)
  );
}

function getUserName(user) {
  return (
    cleanString(user?.name) ||
    cleanString(user?.displayName) ||
    cleanString(user?.fullName) ||
    cleanString(user?.employeeName) ||
    cleanString(user?.email) ||
    "System"
  );
}

function getUserEmail(user) {
  return (
    cleanString(user?.email) ||
    cleanString(user?.workEmail) ||
    cleanString(user?.officialEmail)
  );
}

function getReceivedQuoteStatus(revision) {
  return Number(revision || 1) > 1
    ? VENDOR_QUOTE_STATUS.REVISED
    : VENDOR_QUOTE_STATUS.RECEIVED;
}

function getReceivedRequestStatus(latestRevision, fallbackStatus = "") {
  const revision = Number(latestRevision || 0);

  if (revision > 1) {
    return (
      VENDOR_REQUEST_STATUS.REVISED_QUOTE_RECEIVED ||
      "revised_quote_received"
    );
  }

  if (revision === 1) {
    return VENDOR_REQUEST_STATUS.QUOTE_RECEIVED || "quote_received";
  }

  return fallbackStatus || VENDOR_REQUEST_STATUS.SENT || "sent";
}

function getQuotePrice(quote = {}) {
  return Number(
    quote.vendorCost ||
      quote.price ||
      quote.amount ||
      0
  );
}

function getQuoteCurrency(quote = {}) {
  return cleanString(quote.currency) || "INR";
}

/* =========================
   CLEAR PREVIOUS FINAL
========================= */

async function clearExistingFinalSelection({
  batch,
  leadId,
  currentRequestPath = "",
  currentQuotePath = "",
  userUid,
  userName,
  userEmail
}) {
  const vendorRequestsSnap = await getDocs(
    collection(db, "leads", leadId, "vendorRequests")
  );

  for (const vendorRequestDoc of vendorRequestsSnap.docs) {
    const requestData = vendorRequestDoc.data();
    const requestPath = vendorRequestDoc.ref.path;

    /*
      Clear request selection except current request.
      Current request will be updated as selected after this.
    */
    if (requestPath !== currentRequestPath) {
      batch.update(vendorRequestDoc.ref, {
        selected: false,
        selectedQuoteId: "",
        selectedQuoteRevision: null,
        selectedVendorCost: null,
        selectedVendorCurrency: "",

        status: getReceivedRequestStatus(
          requestData?.latestRevision,
          requestData?.status
        ),

        selectedAt: null,
        selectedByUid: "",
        selectedByName: "",
        selectedByEmail: "",

        updatedAt: serverTimestamp()
      });
    }

    const quotesSnap = await getDocs(
      collection(
        db,
        "leads",
        leadId,
        "vendorRequests",
        vendorRequestDoc.id,
        "vendorQuotes"
      )
    );

    quotesSnap.docs.forEach(quoteDoc => {
      if (quoteDoc.ref.path === currentQuotePath) return;

      const quoteData = quoteDoc.data();
      const revision = Number(quoteData?.revision || 1);

      batch.update(quoteDoc.ref, {
        selected: false,
        isFinal: false,
        status: getReceivedQuoteStatus(revision),

        unselectedAt: serverTimestamp(),
        unselectedByUid: userUid,
        unselectedByName: userName,
        unselectedByEmail: userEmail,

        updatedAt: serverTimestamp()
      });
    });
  }
}

/* =========================
   SAVE VENDOR PRICING
========================= */

export async function saveVendorQuote({
  leadId,
  vendorRequestId,
  form,
  user
}) {
  if (!leadId) {
    throw new Error("Lead ID is required.");
  }

  if (!vendorRequestId) {
    throw new Error("Vendor request ID is required.");
  }

  if (!user) {
    throw new Error("User session is required.");
  }

  const vendorCost = Number(
    form?.vendorCost ||
    form?.price ||
    form?.amount ||
    0
  );

  if (!vendorCost || vendorCost <= 0) {
    throw new Error("Vendor price is required.");
  }

  const currency = cleanString(form?.currency) || "INR";

  const referenceText = cleanString(
    form?.referenceText ||
    form?.mailContent ||
    form?.vendorMailContent ||
    form?.pricingNote
  );

  const referenceFileUrl = cleanString(
    form?.referenceFileUrl ||
    form?.attachmentUrl ||
    form?.fileUrl ||
    form?.imageUrl
  );

  const referenceFileName = cleanString(
    form?.referenceFileName ||
    form?.attachmentName ||
    form?.fileName ||
    form?.imageName
  );

  const internalRemark = cleanString(
    form?.internalRemark ||
    form?.remark ||
    form?.notes
  );

  const markAsFinal = Boolean(
    form?.markAsFinal ||
    form?.isFinal ||
    form?.selected
  );

  const leadRef = doc(db, "leads", leadId);

  const requestRef = doc(
    db,
    "leads",
    leadId,
    "vendorRequests",
    vendorRequestId
  );

  const quoteRef = doc(
    collection(
      db,
      "leads",
      leadId,
      "vendorRequests",
      vendorRequestId,
      "vendorQuotes"
    )
  );

  const [leadSnap, requestSnap] = await Promise.all([
    getDoc(leadRef),
    getDoc(requestRef)
  ]);

  if (!leadSnap.exists()) {
    throw new Error("Lead not found.");
  }

  if (!requestSnap.exists()) {
    throw new Error("Vendor request not found.");
  }

  const lead = {
    id: leadSnap.id,
    ...leadSnap.data()
  };

  const request = {
    id: requestSnap.id,
    ...requestSnap.data()
  };

  const userUid = getUserUid(user);
  const userName = getUserName(user);
  const userEmail = getUserEmail(user);

  const revision = Number(request.latestRevision || 0) + 1;

  const quoteStatus = markAsFinal
    ? VENDOR_QUOTE_STATUS.SELECTED
    : getReceivedQuoteStatus(revision);

  const requestStatus = markAsFinal
    ? VENDOR_REQUEST_STATUS.SELECTED || "selected"
    : getReceivedRequestStatus(revision);

  const batch = writeBatch(db);

  if (markAsFinal) {
    await clearExistingFinalSelection({
      batch,
      leadId,
      currentRequestPath: requestRef.path,
      currentQuotePath: quoteRef.path,
      userUid,
      userName,
      userEmail
    });
  }

  batch.set(quoteRef, {
    leadId,
    vendorRequestId,

    vendorId: request.vendorId || "",
    vendorCode: request.vendorCode || "",
    vendorName: request.vendorName || "",
    vendorType: request.vendorType || "",

    revision,

    currency,
    vendorCost,
    price: vendorCost,

    referenceText,
    referenceFileUrl,
    referenceFileName,

    internalRemark,

    status: quoteStatus,
    selected: markAsFinal,
    isFinal: markAsFinal,

    quoteDate: serverTimestamp(),
    receivedAt: serverTimestamp(),

    selectedAt: markAsFinal ? serverTimestamp() : null,
    selectedByUid: markAsFinal ? userUid : "",
    selectedByName: markAsFinal ? userName : "",
    selectedByEmail: markAsFinal ? userEmail : "",

    createdByUid: userUid,
    createdByName: userName,
    createdByEmail: userEmail,

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  const requestUpdate = {
    status: requestStatus,

    latestQuoteId: quoteRef.id,
    latestRevision: revision,
    latestVendorCost: vendorCost,
    latestCurrency: currency,
    latestQuoteStatus: quoteStatus,

    latestReferenceText: referenceText,
    latestReferenceFileUrl: referenceFileUrl,
    latestReferenceFileName: referenceFileName,

    quoteReceivedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  if (markAsFinal) {
    requestUpdate.selected = true;
    requestUpdate.selectedQuoteId = quoteRef.id;
    requestUpdate.selectedQuoteRevision = revision;
    requestUpdate.selectedVendorCost = vendorCost;
    requestUpdate.selectedVendorCurrency = currency;
    requestUpdate.selectedAt = serverTimestamp();
    requestUpdate.selectedByUid = userUid;
    requestUpdate.selectedByName = userName;
    requestUpdate.selectedByEmail = userEmail;
  }

  batch.update(requestRef, requestUpdate);

  const currentStage = normalizeLeadStage(
    lead.stage || LEAD_STAGES.NEW_ENQUIRY
  );

  const currentStageMeta = getLeadStageMeta(currentStage);

  const nextStage = isTerminalLeadStage(currentStage)
    ? currentStage
    : LEAD_STAGES.QUOTE_PENDING;

  const nextStageMeta = getLeadStageMeta(nextStage);

  const leadUpdate = {
    vendorQuoteCount: increment(1),

    latestVendorRequestId: vendorRequestId,
    latestVendorQuoteId: quoteRef.id,
    latestVendorQuoteRevision: revision,

    latestVendorId: request.vendorId || "",
    latestVendorName: request.vendorName || "",
    latestVendorCost: vendorCost,
    latestVendorCurrency: currency,
    latestVendorQuoteStatus: quoteStatus,

    lastVendorQuoteAt: serverTimestamp(),
    lastVendorQuoteVendorId: request.vendorId || "",
    lastVendorQuoteVendorName: request.vendorName || "",
    lastVendorQuoteCost: vendorCost,

    lastActivityAt: serverTimestamp(),
    lastActivityType: markAsFinal
      ? "vendor_quote_finalized"
      : "vendor_quote_received",
    lastActivitySummary: markAsFinal
      ? `Final vendor pricing marked: ${request.vendorName || "Vendor"}`
      : `Vendor pricing received: ${request.vendorName || "Vendor"}`,

    updatedAt: serverTimestamp()
  };

  if (markAsFinal) {
    leadUpdate.selectedVendorRequestId = vendorRequestId;
    leadUpdate.selectedVendorQuoteId = quoteRef.id;
    leadUpdate.selectedVendorId = request.vendorId || "";
    leadUpdate.selectedVendorName = request.vendorName || "";
    leadUpdate.selectedVendorCost = vendorCost;
    leadUpdate.selectedVendorCurrency = currency;
    leadUpdate.selectedVendorQuoteRevision = revision;
    leadUpdate.selectedVendorQuoteAt = serverTimestamp();
  }

  if (!isTerminalLeadStage(currentStage)) {
    leadUpdate.previousStage = currentStage;
    leadUpdate.previousStageLabel = currentStageMeta.label;
    leadUpdate.stage = nextStage;
    leadUpdate.stageLabel = nextStageMeta.label;
    leadUpdate.status = "open";
  }

  batch.update(leadRef, leadUpdate);

  await batch.commit();

  await logLeadAction({
    leadId,
    type: markAsFinal
      ? LEAD_TIMELINE_TYPES?.VENDOR_SELECTED || "vendor_selected"
      : LEAD_TIMELINE_TYPES?.VENDOR_QUOTE || "vendor_quote",
    title: markAsFinal
      ? `Final vendor pricing marked - ${request.vendorName || "Vendor"}`
      : `Vendor pricing received - ${request.vendorName || "Vendor"}`,
    description: `${currency} ${vendorCost.toLocaleString("en-IN")}`,
    metadata: {
      action: markAsFinal
        ? "vendor_quote_finalized"
        : "vendor_quote_received",

      leadId,
      vendorRequestId,
      vendorQuoteId: quoteRef.id,

      vendorId: request.vendorId || "",
      vendorName: request.vendorName || "",
      vendorType: request.vendorType || "",

      currency,
      vendorCost,

      referenceText,
      referenceFileUrl,
      referenceFileName,
      internalRemark,

      selected: markAsFinal,
      isFinal: markAsFinal,

      createdByUid: userUid,
      createdByName: userName,
      createdByEmail: userEmail
    },
    user
  });

  return {
    vendorQuoteId: quoteRef.id,
    vendorRequestId,

    vendorCost,
    currency,

    referenceText,
    referenceFileUrl,
    referenceFileName,

    selected: markAsFinal,
    isFinal: markAsFinal
  };
}

/* =========================
   MARK EXISTING QUOTE FINAL
========================= */

export async function selectVendorQuote({
  leadId,
  vendorRequestId,
  vendorQuoteId,
  user
}) {
  if (!leadId) {
    throw new Error("Lead ID is required.");
  }

  if (!vendorRequestId) {
    throw new Error("Vendor request ID is required.");
  }

  if (!vendorQuoteId) {
    throw new Error("Vendor quote ID is required.");
  }

  if (!user) {
    throw new Error("User session is required.");
  }

  const leadRef = doc(db, "leads", leadId);

  const requestRef = doc(
    db,
    "leads",
    leadId,
    "vendorRequests",
    vendorRequestId
  );

  const quoteRef = doc(
    db,
    "leads",
    leadId,
    "vendorRequests",
    vendorRequestId,
    "vendorQuotes",
    vendorQuoteId
  );

  const [leadSnap, requestSnap, quoteSnap] = await Promise.all([
    getDoc(leadRef),
    getDoc(requestRef),
    getDoc(quoteRef)
  ]);

  if (!leadSnap.exists()) {
    throw new Error("Lead not found.");
  }

  if (!requestSnap.exists()) {
    throw new Error("Vendor request not found.");
  }

  if (!quoteSnap.exists()) {
    throw new Error("Vendor quote not found.");
  }

  const request = {
    id: requestSnap.id,
    ...requestSnap.data()
  };

  const quote = {
    id: quoteSnap.id,
    ...quoteSnap.data()
  };

  const vendorCost = getQuotePrice(quote);

  if (!vendorCost || vendorCost <= 0) {
    throw new Error("Vendor price is missing in this quote.");
  }

  const currency = getQuoteCurrency(quote);

  const userUid = getUserUid(user);
  const userName = getUserName(user);
  const userEmail = getUserEmail(user);

  const batch = writeBatch(db);

  await clearExistingFinalSelection({
    batch,
    leadId,
    currentRequestPath: requestRef.path,
    currentQuotePath: quoteRef.path,
    userUid,
    userName,
    userEmail
  });

  batch.update(quoteRef, {
    status: VENDOR_QUOTE_STATUS.SELECTED,

    selected: true,
    isFinal: true,

    selectedAt: serverTimestamp(),
    selectedByUid: userUid,
    selectedByName: userName,
    selectedByEmail: userEmail,

    updatedAt: serverTimestamp()
  });

  batch.update(requestRef, {
    status: VENDOR_REQUEST_STATUS.SELECTED || "selected",

    selected: true,
    selectedQuoteId: vendorQuoteId,
    selectedQuoteRevision: quote.revision || request.latestRevision || 1,
    selectedVendorCost: vendorCost,
    selectedVendorCurrency: currency,

    latestQuoteId: vendorQuoteId,
    latestVendorCost: vendorCost,
    latestCurrency: currency,
    latestQuoteStatus: VENDOR_QUOTE_STATUS.SELECTED,

    selectedAt: serverTimestamp(),
    selectedByUid: userUid,
    selectedByName: userName,
    selectedByEmail: userEmail,

    updatedAt: serverTimestamp()
  });

  batch.update(leadRef, {
    selectedVendorRequestId: vendorRequestId,
    selectedVendorQuoteId: vendorQuoteId,
    selectedVendorId: request.vendorId || "",
    selectedVendorName: request.vendorName || "",
    selectedVendorCost: vendorCost,
    selectedVendorCurrency: currency,
    selectedVendorQuoteRevision:
      quote.revision || request.latestRevision || 1,
    selectedVendorQuoteAt: serverTimestamp(),

    latestVendorRequestId: vendorRequestId,
    latestVendorQuoteId: vendorQuoteId,
    latestVendorId: request.vendorId || "",
    latestVendorName: request.vendorName || "",
    latestVendorCost: vendorCost,
    latestVendorCurrency: currency,
    latestVendorQuoteStatus: VENDOR_QUOTE_STATUS.SELECTED,

    lastActivityAt: serverTimestamp(),
    lastActivityType: "vendor_quote_finalized",
    lastActivitySummary: `Final vendor pricing marked: ${
      request.vendorName || "Vendor"
    }`,

    updatedAt: serverTimestamp()
  });

  await batch.commit();

  await logLeadAction({
    leadId,
    type: LEAD_TIMELINE_TYPES?.VENDOR_SELECTED || "vendor_selected",
    title: `Final vendor pricing marked - ${request.vendorName || "Vendor"}`,
    description: `${currency} ${vendorCost.toLocaleString("en-IN")}`,
    metadata: {
      action: "vendor_quote_finalized",

      leadId,
      vendorRequestId,
      vendorQuoteId,

      vendorId: request.vendorId || "",
      vendorName: request.vendorName || "",

      currency,
      vendorCost,

      selected: true,
      isFinal: true,

      selectedByUid: userUid,
      selectedByName: userName,
      selectedByEmail: userEmail
    },
    user
  });

  return {
    vendorQuoteId,
    vendorRequestId,
    vendorCost,
    currency,
    selected: true,
    isFinal: true
  };
}

export async function revokeFinalVendorQuote({
  leadId,
  vendorRequestId,
  vendorQuoteId,
  user
}) {
  if (!leadId) {
    throw new Error("Lead ID is required.");
  }

  if (!vendorRequestId) {
    throw new Error("Vendor request ID is required.");
  }

  if (!vendorQuoteId) {
    throw new Error("Vendor quote ID is required.");
  }

  if (!user) {
    throw new Error("User session is required.");
  }

  const leadRef = doc(db, "leads", leadId);

  const requestRef = doc(
    db,
    "leads",
    leadId,
    "vendorRequests",
    vendorRequestId
  );

  const quoteRef = doc(
    db,
    "leads",
    leadId,
    "vendorRequests",
    vendorRequestId,
    "vendorQuotes",
    vendorQuoteId
  );

  const [leadSnap, requestSnap, quoteSnap] = await Promise.all([
    getDoc(leadRef),
    getDoc(requestRef),
    getDoc(quoteRef)
  ]);

  if (!leadSnap.exists()) {
    throw new Error("Lead not found.");
  }

  if (!requestSnap.exists()) {
    throw new Error("Vendor request not found.");
  }

  if (!quoteSnap.exists()) {
    throw new Error("Vendor quote not found.");
  }

  const lead = {
    id: leadSnap.id,
    ...leadSnap.data()
  };

  const request = {
    id: requestSnap.id,
    ...requestSnap.data()
  };

  const quote = {
    id: quoteSnap.id,
    ...quoteSnap.data()
  };

  const vendorCost = getQuotePrice(quote);
  const currency = getQuoteCurrency(quote);

  const userUid = getUserUid(user);
  const userName = getUserName(user);
  const userEmail = getUserEmail(user);

  const normalQuoteStatus = getReceivedQuoteStatus(
    quote.revision || request.latestRevision || 1
  );

  const normalRequestStatus = getReceivedRequestStatus(
    request.latestRevision,
    request.status
  );

  const batch = writeBatch(db);

  batch.update(quoteRef, {
    selected: false,
    isFinal: false,
    status: normalQuoteStatus,

    finalRevokedAt: serverTimestamp(),
    finalRevokedByUid: userUid,
    finalRevokedByName: userName,
    finalRevokedByEmail: userEmail,

    updatedAt: serverTimestamp()
  });

  const requestUpdate = {
    selected: false,
    selectedQuoteId: "",
    selectedQuoteRevision: null,
    selectedVendorCost: null,
    selectedVendorCurrency: "",

    status: normalRequestStatus,

    selectedAt: null,
    selectedByUid: "",
    selectedByName: "",
    selectedByEmail: "",

    finalRevokedAt: serverTimestamp(),
    finalRevokedByUid: userUid,
    finalRevokedByName: userName,
    finalRevokedByEmail: userEmail,

    updatedAt: serverTimestamp()
  };

  if (request.latestQuoteId === vendorQuoteId) {
    requestUpdate.latestQuoteStatus = normalQuoteStatus;
  }

  batch.update(requestRef, requestUpdate);

  const leadUpdate = {
    lastActivityAt: serverTimestamp(),
    lastActivityType: "vendor_quote_final_revoked",
    lastActivitySummary: `Final vendor pricing revoked: ${
      request.vendorName || "Vendor"
    }`,

    updatedAt: serverTimestamp()
  };

  if (lead.selectedVendorQuoteId === vendorQuoteId) {
    leadUpdate.selectedVendorRequestId = "";
    leadUpdate.selectedVendorQuoteId = "";
    leadUpdate.selectedVendorId = "";
    leadUpdate.selectedVendorName = "";
    leadUpdate.selectedVendorCost = null;
    leadUpdate.selectedVendorCurrency = "";
    leadUpdate.selectedVendorQuoteRevision = null;
    leadUpdate.selectedVendorQuoteAt = null;
  }

  if (lead.latestVendorQuoteId === vendorQuoteId) {
    leadUpdate.latestVendorQuoteStatus = normalQuoteStatus;
  }

  batch.update(leadRef, leadUpdate);

  await batch.commit();

  await logLeadAction({
    leadId,
    type: LEAD_TIMELINE_TYPES?.VENDOR_SELECTED || "vendor_selected",
    title: `Final vendor pricing revoked - ${request.vendorName || "Vendor"}`,
    description: `${currency} ${vendorCost.toLocaleString("en-IN")}`,
    metadata: {
      action: "vendor_quote_final_revoked",

      leadId,
      vendorRequestId,
      vendorQuoteId,

      vendorId: request.vendorId || "",
      vendorName: request.vendorName || "",

      currency,
      vendorCost,

      selected: false,
      isFinal: false,

      revokedByUid: userUid,
      revokedByName: userName,
      revokedByEmail: userEmail
    },
    user
  });

  return {
    vendorQuoteId,
    vendorRequestId,
    revoked: true,
    selected: false,
    isFinal: false
  };
}