// lib/createQuotationRevision.js

import {
  collection,
  doc,
  runTransaction,
  serverTimestamp
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

/* =========================
   HELPERS
========================= */

function getUserName(user) {
  return (
    user?.displayName ||
    user?.name ||
    user?.fullName ||
    user?.email ||
    "System User"
  );
}

function getUserEmail(user) {
  return (
    user?.email ||
    user?.workEmail ||
    user?.officialEmail ||
    ""
  );
}

function getUserUid(user) {
  return (
    user?.uid ||
    user?.id ||
    user?.email ||
    ""
  );
}

function cleanString(value = "") {
  return String(value || "").trim();
}

function cleanNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function cleanNullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeSendVia(sendVia) {
  if (!sendVia) return [];

  if (Array.isArray(sendVia)) {
    return sendVia.map(item => cleanString(item)).filter(Boolean);
  }

  if (typeof sendVia === "string") {
    return [cleanString(sendVia)].filter(Boolean);
  }

  return [];
}

function getSafePricingMode(value = "") {
  const mode = cleanString(value);

  const allowedModes = [
    "direct",
    "vendor_quote",
    "vendor_final",
    "vendor_draft",
    "manual_cost"
  ];

  if (allowedModes.includes(mode)) return mode;

  return "direct";
}

function normalizeSignatureUser(signatureUser = {}) {
  return {
    uid: cleanString(signatureUser?.uid || signatureUser?.id),
    name: cleanString(
      signatureUser?.name ||
        signatureUser?.displayName ||
        signatureUser?.fullName
    ),
    email: cleanString(
      signatureUser?.email ||
        signatureUser?.workEmail ||
        signatureUser?.officialEmail
    ),
    mobile: cleanString(
      signatureUser?.mobile ||
        signatureUser?.phone ||
        signatureUser?.phoneNumber
    ),
    role: cleanString(
      signatureUser?.role ||
        signatureUser?.designation ||
        signatureUser?.jobTitle
    ),

    companyName: cleanString(signatureUser?.companyName),
    companyLogoUrl: cleanString(signatureUser?.companyLogoUrl),
    websiteUrl: cleanString(signatureUser?.websiteUrl),
    emailAssetBaseUrl: cleanString(signatureUser?.emailAssetBaseUrl),

    facebookUrl: cleanString(signatureUser?.facebookUrl),
    instagramUrl: cleanString(signatureUser?.instagramUrl),
    linkedinUrl: cleanString(signatureUser?.linkedinUrl),
    youtubeUrl: cleanString(signatureUser?.youtubeUrl),

    supportEmail: cleanString(signatureUser?.supportEmail),
    supportMobile: cleanString(signatureUser?.supportMobile),

    emailFooterLine: cleanString(signatureUser?.emailFooterLine),
    quotationClosingLine: cleanString(signatureUser?.quotationClosingLine),
    emailDisclaimer: cleanString(signatureUser?.emailDisclaimer),
    whatsappFooterLine: cleanString(signatureUser?.whatsappFooterLine),

    signatureHtml: signatureUser?.signatureHtml || "",
    signatureText: signatureUser?.signatureText || ""
  };
}

function shouldMoveLeadToQuoteSent(stage) {
  const normalizedStage = normalizeLeadStage(stage);

  if (isTerminalLeadStage(normalizedStage)) return false;

  return normalizedStage !== LEAD_STAGES.QUOTE_SENT;
}

function buildCommercialPayload({
  quoteAmount,
  customerQuoteCurrency,

  vendorAmount,
  selectedVendorCurrency,
  selectedVendorName,
  selectedVendorQuoteId,
  selectedVendorRequestId,

  quotationPricingMode,
  vendorQuoteFinalized,

  profitAmount,
  margin,
  pricingVisibleToCustomer
}) {
  const safePricingMode = getSafePricingMode(quotationPricingMode);

  const safeCustomerCurrency =
    cleanString(customerQuoteCurrency) ||
    cleanString(selectedVendorCurrency) ||
    "INR";

  const safeVendorCurrency =
    cleanString(selectedVendorCurrency) ||
    safeCustomerCurrency ||
    "INR";

  return {
    totalPrice: quoteAmount,
    totalAmount: quoteAmount,

    customerQuotedAmount: quoteAmount,
    customerQuoteAmount: quoteAmount,
    customerQuoteCurrency: safeCustomerCurrency,

    vendorCost: vendorAmount,
    selectedVendorCost: vendorAmount,
    selectedVendorCurrency: safeVendorCurrency,
    selectedVendorName: cleanString(selectedVendorName),
    selectedVendorQuoteId: cleanString(selectedVendorQuoteId),
    selectedVendorRequestId: cleanString(selectedVendorRequestId),

    quotationPricingMode: safePricingMode,
    vendorQuoteFinalized: Boolean(vendorQuoteFinalized),

    grossProfit: profitAmount,
    marginPercent: margin,

    pricingVisibleToCustomer: Boolean(pricingVisibleToCustomer)
  };
}

function buildLeadCommercialPayload(commercialPayload) {
  return {
    latestQuotationAmount: commercialPayload.customerQuoteAmount,
    latestCustomerQuoteAmount: commercialPayload.customerQuoteAmount,
    latestCustomerQuoteCurrency:
      commercialPayload.customerQuoteCurrency || "INR",

    latestVendorCost: commercialPayload.vendorCost,
    latestSelectedVendorCost: commercialPayload.selectedVendorCost,
    latestSelectedVendorCurrency:
      commercialPayload.selectedVendorCurrency || "INR",
    latestSelectedVendorName: commercialPayload.selectedVendorName || "",
    latestSelectedVendorQuoteId:
      commercialPayload.selectedVendorQuoteId || "",
    latestSelectedVendorRequestId:
      commercialPayload.selectedVendorRequestId || "",

    latestGrossProfit: commercialPayload.grossProfit,
    latestMarginPercent: commercialPayload.marginPercent,

    latestQuotationPricingMode:
      commercialPayload.quotationPricingMode || "direct",
    latestVendorQuoteFinalized: Boolean(
      commercialPayload.vendorQuoteFinalized
    )
  };
}

function buildFinalCommercialPayload(commercialPayload) {
  return {
    finalQuotationAmount: commercialPayload.customerQuoteAmount,
    finalCustomerQuoteAmount: commercialPayload.customerQuoteAmount,
    finalCustomerQuoteCurrency:
      commercialPayload.customerQuoteCurrency || "INR",

    finalVendorCost: commercialPayload.vendorCost,
    finalSelectedVendorCost: commercialPayload.selectedVendorCost,
    finalSelectedVendorCurrency:
      commercialPayload.selectedVendorCurrency || "INR",
    finalSelectedVendorName: commercialPayload.selectedVendorName || "",
    finalSelectedVendorQuoteId:
      commercialPayload.selectedVendorQuoteId || "",
    finalSelectedVendorRequestId:
      commercialPayload.selectedVendorRequestId || "",

    finalGrossProfit: commercialPayload.grossProfit,
    finalMarginPercent: commercialPayload.marginPercent,

    finalQuotationPricingMode:
      commercialPayload.quotationPricingMode || "direct",
    finalVendorQuoteFinalized: Boolean(
      commercialPayload.vendorQuoteFinalized
    )
  };
}

function getLastActivityType({ isDraft, isFinalQuotation }) {
  if (isDraft) return "quotation_draft_created";
  if (isFinalQuotation) return "final_quotation_created";
  return "quotation_sent";
}

function getLastActivitySummary({ isDraft, isFinalQuotation, revision }) {
  if (isDraft) return `Quotation draft created - Rev ${revision}`;
  if (isFinalQuotation) return `Final quotation created - Rev ${revision}`;
  return `Quotation sent - Rev ${revision}`;
}

function getTimelineTitle({ isDraft, isFinalQuotation, revision }) {
  if (isDraft) return `Quotation draft created - Rev ${revision}`;
  if (isFinalQuotation) return `Final quotation created - Rev ${revision}`;
  return `Quotation sent - Rev ${revision}`;
}

function getTimelineAction({ isDraft, isFinalQuotation }) {
  if (isDraft) return "draft_saved";
  if (isFinalQuotation) return "final_quotation_marked";
  return "quotation_created";
}

/* =========================
   CREATE QUOTATION REVISION
========================= */

export async function createQuotationRevision({
  leadId,
  itineraryHtml,

  totalPrice = null,
  totalAmount = null,
  customerQuotedAmount = null,
  customerQuoteAmount = null,
  customerQuoteCurrency = "INR",

  vendorCost = null,
  selectedVendorCost = null,
  selectedVendorCurrency = "INR",
  selectedVendorName = "",
  selectedVendorQuoteId = "",
  selectedVendorRequestId = "",

  quotationPricingMode = "direct",
  vendorQuoteFinalized = false,

  grossProfit = null,
  marginPercent = null,
  pricingVisibleToCustomer = false,

  note = "",
  sendVia = [],
  isFinalQuotation = false,
  signatureUser = null,

  // When quotation is created and sent from QuotationEditor,
  // pass skipTimelineLog: true to avoid duplicate timeline logs.
  skipTimelineLog = false,

  user
}) {
  const cleanLeadId = cleanString(leadId);

  if (!cleanLeadId) throw new Error("Lead ID is required");
  if (!user) throw new Error("User is required");

  const userUid = getUserUid(user);
  const userName = getUserName(user);
  const userEmail = getUserEmail(user);

  const cleanSendVia = normalizeSendVia(sendVia);

  const quoteAmount = cleanNumber(
    customerQuoteAmount ??
      customerQuotedAmount ??
      totalAmount ??
      totalPrice,
    0
  );

  const vendorAmount = cleanNullableNumber(
    selectedVendorCost ?? vendorCost
  );

  const profitAmount =
    grossProfit === null ||
    grossProfit === undefined ||
    grossProfit === ""
      ? vendorAmount === null
        ? null
        : quoteAmount - vendorAmount
      : cleanNullableNumber(grossProfit);

  const margin =
    marginPercent === null ||
    marginPercent === undefined ||
    marginPercent === ""
      ? quoteAmount > 0 && profitAmount !== null
        ? Number(((profitAmount / quoteAmount) * 100).toFixed(2))
        : null
      : cleanNullableNumber(marginPercent);

  const safePricingMode = getSafePricingMode(quotationPricingMode);

  const finalStatus = isFinalQuotation
    ? "final"
    : cleanSendVia.length
      ? "sent"
      : "draft";

  const isDraft = finalStatus === "draft";

  const signaturePayload = normalizeSignatureUser(signatureUser || {});

  const quoteSentMeta = getLeadStageMeta(LEAD_STAGES.QUOTE_SENT);

  const commercialPayload = buildCommercialPayload({
    quoteAmount,
    customerQuoteCurrency,

    vendorAmount,
    selectedVendorCurrency,
    selectedVendorName,
    selectedVendorQuoteId,
    selectedVendorRequestId,

    quotationPricingMode: safePricingMode,
    vendorQuoteFinalized,

    profitAmount,
    margin,
    pricingVisibleToCustomer
  });

  const leadCommercialPayload =
    buildLeadCommercialPayload(commercialPayload);

  const result = await runTransaction(db, async transaction => {
    const leadRef = doc(db, "leads", cleanLeadId);
    const leadSnap = await transaction.get(leadRef);

    if (!leadSnap.exists()) {
      throw new Error("Lead not found");
    }

    const leadData = leadSnap.data();

    const currentRevision = Number(
      leadData.quotationRevision ||
        leadData.latestQuotationRevision ||
        0
    );

    const nextRevision = currentRevision + 1;

    const currentStage = normalizeLeadStage(
      leadData.stage || LEAD_STAGES.NEW_ENQUIRY
    );

    const currentStageMeta = getLeadStageMeta(currentStage);

    const moveToQuoteSent =
      !isDraft && shouldMoveLeadToQuoteSent(currentStage);

    const quotationsRef = collection(
      db,
      "leads",
      cleanLeadId,
      "quotations"
    );

    const quotationRef = doc(quotationsRef);

    const quotationPayload = {
      leadId: cleanLeadId,
      leadCode: leadData.leadCode || "",

      quotationId: quotationRef.id,
      revision: nextRevision,

      status: finalStatus,
      isDraft,
      isFinalQuotation: Boolean(isFinalQuotation),

      itineraryHtml: itineraryHtml || "",

      ...commercialPayload,

      note: cleanString(note),

      sendVia: cleanSendVia,
      sentVia: cleanSendVia,

      signatureUser: signaturePayload,

      createdByUid: userUid,
      createdByName: userName,
      createdByEmail: userEmail,

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),

      ...(isDraft
        ? {
            draftSavedAt: serverTimestamp(),
            draftSavedByUid: userUid,
            draftSavedByName: userName
          }
        : {
            sentAt: serverTimestamp(),
            sentByUid: userUid,
            sentByName: userName,
            sentByEmail: userEmail
          })
    };

    transaction.set(quotationRef, quotationPayload);

    const leadUpdatePayload = {
      quotationRevision: nextRevision,
      latestQuotationRevision: nextRevision,
      latestQuotationId: quotationRef.id,

      ...leadCommercialPayload,

      latestQuotationStatus: finalStatus,

      lastActivityAt: serverTimestamp(),
      lastActivityType: getLastActivityType({
        isDraft,
        isFinalQuotation
      }),
      lastActivitySummary: getLastActivitySummary({
        isDraft,
        isFinalQuotation,
        revision: nextRevision
      }),

      updatedAt: serverTimestamp()
    };

    if (isDraft) {
      leadUpdatePayload.latestDraftQuotationId = quotationRef.id;
      leadUpdatePayload.latestDraftQuotationRevision = nextRevision;
      leadUpdatePayload.latestQuotationDraftAt = serverTimestamp();
      leadUpdatePayload.latestQuotationDraftByUid = userUid;
      leadUpdatePayload.latestQuotationDraftByName = userName;
    }

    if (!isDraft) {
      leadUpdatePayload.latestQuotationSentAt = serverTimestamp();
      leadUpdatePayload.latestQuotationSentByUid = userUid;
      leadUpdatePayload.latestQuotationSentByName = userName;
    }

    if (moveToQuoteSent) {
      leadUpdatePayload.previousStage = currentStage;
      leadUpdatePayload.previousStageLabel = currentStageMeta.label;

      leadUpdatePayload.stage = LEAD_STAGES.QUOTE_SENT;
      leadUpdatePayload.stageLabel = quoteSentMeta.label;
      leadUpdatePayload.status = "open";
    }

    if (isFinalQuotation) {
      leadUpdatePayload.finalQuotationId = quotationRef.id;
      leadUpdatePayload.finalQuotationRevision = nextRevision;
      leadUpdatePayload.finalQuotationStatus = finalStatus;

      Object.assign(
        leadUpdatePayload,
        buildFinalCommercialPayload(commercialPayload)
      );

      leadUpdatePayload.finalQuotationAt = serverTimestamp();
      leadUpdatePayload.finalQuotationByUid = userUid;
      leadUpdatePayload.finalQuotationByName = userName;
    }

    transaction.update(leadRef, leadUpdatePayload);

    return {
      quotationId: quotationRef.id,
      revision: nextRevision,
      status: finalStatus,

      oldStage: currentStage,
      oldStageLabel: currentStageMeta.label,
      newStage: moveToQuoteSent
        ? LEAD_STAGES.QUOTE_SENT
        : currentStage,
      newStageLabel: moveToQuoteSent
        ? quoteSentMeta.label
        : currentStageMeta.label
    };
  });

  if (!skipTimelineLog) {
    await logLeadAction({
      leadId: cleanLeadId,
      type: LEAD_TIMELINE_TYPES.QUOTATION,
      title: getTimelineTitle({
        isDraft,
        isFinalQuotation,
        revision: result.revision
      }),
      description:
        cleanString(note) ||
        (isDraft
          ? "Quotation draft created"
          : isFinalQuotation
            ? "Final quotation created"
            : "Quotation sent"),
      metadata: {
        action: getTimelineAction({
          isDraft,
          isFinalQuotation
        }),

        leadId: cleanLeadId,
        quotationId: result.quotationId,
        revision: result.revision,

        status: result.status,
        isDraft,
        isFinalQuotation: Boolean(isFinalQuotation),

        sendVia: cleanSendVia,
        sentVia: cleanSendVia,

        itineraryHtml: itineraryHtml || "",

        ...commercialPayload,

        pricingVisibleToCustomer: false,

        oldStage: result.oldStage,
        oldStageLabel: result.oldStageLabel,
        newStage: result.newStage,
        newStageLabel: result.newStageLabel,

        signatureUser: signaturePayload
      },
      user
    });
  }

  return {
    quotationId: result.quotationId,
    id: result.quotationId,
    revision: result.revision,
    status: result.status,

    ...commercialPayload
  };
}

export default createQuotationRevision;