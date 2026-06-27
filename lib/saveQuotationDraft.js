// lib/saveQuotationDraft.js

import {
  collection,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  updateDoc
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

function normalizeStringArray(value = []) {
  if (!Array.isArray(value)) return [];

  return value.map(item => cleanString(item)).filter(Boolean);
}

function normalizeSelectedVendorQuotes(value = []) {
  if (!Array.isArray(value)) return [];

  return value
    .map(item => ({
      vendorId: cleanString(item?.vendorId),
      vendorName: cleanString(item?.vendorName),
      vendorCode: cleanString(item?.vendorCode),

      vendorRequestId: cleanString(item?.vendorRequestId),
      vendorQuoteId: cleanString(item?.vendorQuoteId),

      serviceType: cleanString(item?.serviceType || "other"),
      serviceLabel: cleanString(item?.serviceLabel || "Vendor Cost"),

      currency: cleanString(item?.currency || "INR"),
      amount: cleanNullableNumber(item?.amount),
      revision: cleanNumber(item?.revision, 1),

      referenceText: cleanString(item?.referenceText),
      referenceFileUrl: cleanString(item?.referenceFileUrl),
      referenceFileName: cleanString(item?.referenceFileName)
    }))
    .filter(item => item.vendorQuoteId && item.amount !== null);
}

function getSafePricingMode(value = "") {
  const mode = cleanString(value);

  const allowedModes = [
    "direct",
    "vendor_quote",
    "vendor_final",
    "vendor_draft",
    "manual_cost",
    "multi_vendor"
  ];

  if (allowedModes.includes(mode)) return mode;

  return "direct";
}

function getSafeVendorCostingMode(value = "") {
  return cleanString(value) === "multi_vendor"
    ? "multi_vendor"
    : "single_vendor";
}

function shouldMoveLeadToQuotePending(leadStage) {
  const normalizedStage = normalizeLeadStage(leadStage);

  if (isTerminalLeadStage(normalizedStage)) return false;

  return normalizedStage !== LEAD_STAGES.QUOTE_SENT;
}

function normalizeSignatureUser(signatureUser = {}) {
  if (!signatureUser) return null;

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

  vendorCostingMode,
  selectedVendorQuotes,
  selectedVendorQuoteIds,
  totalSelectedVendorCost,

  profitAmount,
  margin,
  pricingVisibleToCustomer
}) {
  const safePricingMode = getSafePricingMode(quotationPricingMode);

  const safeVendorCostingMode =
    getSafeVendorCostingMode(vendorCostingMode);

  const safeCustomerCurrency =
    cleanString(customerQuoteCurrency) ||
    cleanString(selectedVendorCurrency) ||
    "INR";

  const safeVendorCurrency =
    cleanString(selectedVendorCurrency) ||
    safeCustomerCurrency ||
    "INR";

  const safeSelectedVendorQuotes =
    normalizeSelectedVendorQuotes(selectedVendorQuotes);

  const explicitQuoteIds = normalizeStringArray(selectedVendorQuoteIds);

  const safeSelectedVendorQuoteIds = explicitQuoteIds.length
    ? explicitQuoteIds
    : safeSelectedVendorQuotes.map(item => item.vendorQuoteId);

  const safeTotalSelectedVendorCost =
    safeVendorCostingMode === "multi_vendor"
      ? cleanNullableNumber(totalSelectedVendorCost ?? vendorAmount)
      : null;

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

    vendorCostingMode: safeVendorCostingMode,
    selectedVendorQuotes: safeSelectedVendorQuotes,
    selectedVendorQuoteIds: safeSelectedVendorQuoteIds,
    totalSelectedVendorCost: safeTotalSelectedVendorCost,

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

    latestVendorCostingMode:
      commercialPayload.vendorCostingMode || "single_vendor",
    latestSelectedVendorQuotes:
      commercialPayload.selectedVendorQuotes || [],
    latestSelectedVendorQuoteIds:
      commercialPayload.selectedVendorQuoteIds || [],
    latestTotalSelectedVendorCost:
      commercialPayload.totalSelectedVendorCost ?? null,

    latestGrossProfit: commercialPayload.grossProfit,
    latestMarginPercent: commercialPayload.marginPercent,

    latestQuotationPricingMode:
      commercialPayload.quotationPricingMode || "direct",
    latestVendorQuoteFinalized: Boolean(
      commercialPayload.vendorQuoteFinalized
    )
  };
}

/* =========================
   SAVE QUOTATION DRAFT
========================= */

export async function saveQuotationDraft({
  leadId,
  quotationId = "",
  revision = null,

  itineraryHtml = "",
  quotationData = null,

  totalPrice = null,
  totalAmount = null,
  customerQuotedAmount = 0,
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

  vendorCostingMode = "single_vendor",
  selectedVendorQuotes = [],
  selectedVendorQuoteIds = [],
  totalSelectedVendorCost = null,

  grossProfit = null,
  marginPercent = null,
  pricingVisibleToCustomer = false,

  note = "",
  signatureUser = null,
  user
}) {
  const cleanLeadId = cleanString(leadId);
  const cleanQuotationId = cleanString(quotationId);

  if (!cleanLeadId) throw new Error("Lead ID is required");
  if (!user) throw new Error("User is required");

  const userUid = getUserUid(user);
  const userName = getUserName(user);
  const userEmail = getUserEmail(user);

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

  const commercialPayload = buildCommercialPayload({
    quoteAmount,
    customerQuoteCurrency,

    vendorAmount,
    selectedVendorCurrency,
    selectedVendorName,
    selectedVendorQuoteId,
    selectedVendorRequestId,

    quotationPricingMode,
    vendorQuoteFinalized,

    vendorCostingMode,
    selectedVendorQuotes,
    selectedVendorQuoteIds,
    totalSelectedVendorCost,

    profitAmount,
    margin,
    pricingVisibleToCustomer
  });

  const leadCommercialPayload =
    buildLeadCommercialPayload(commercialPayload);

  const signaturePayload = normalizeSignatureUser(signatureUser);

  const quotePendingMeta = getLeadStageMeta(LEAD_STAGES.QUOTE_PENDING);

  /* =========================
     UPDATE EXISTING DRAFT
  ========================== */

  if (cleanQuotationId) {
    const quotationRef = doc(
      db,
      "leads",
      cleanLeadId,
      "quotations",
      cleanQuotationId
    );

    const leadRef = doc(db, "leads", cleanLeadId);

    const leadSnap = await getDoc(leadRef);

    if (!leadSnap.exists()) {
      throw new Error("Lead not found");
    }

    const leadData = leadSnap.data();
    const currentStage = normalizeLeadStage(
      leadData.stage || LEAD_STAGES.NEW_ENQUIRY
    );

    const moveToQuotePending =
      shouldMoveLeadToQuotePending(currentStage);

    const existingQuotationSnap = await getDoc(quotationRef);

    if (!existingQuotationSnap.exists()) {
      throw new Error("Draft quotation not found");
    }

    const existingQuotation = existingQuotationSnap.data();

    const finalRevision =
      Number(revision || existingQuotation?.revision || 0) || null;

    await updateDoc(quotationRef, {
      leadId: cleanLeadId,
      leadCode: leadData.leadCode || "",

      quotationId: cleanQuotationId,
      revision: finalRevision,

      itineraryHtml,
      quotationData: quotationData || null,

      status: "draft",
      isDraft: true,
      isFinalQuotation: false,

      ...commercialPayload,

      note: cleanString(note),

      sendVia: [],
      sentVia: [],

      signatureUser: signaturePayload,

      updatedAt: serverTimestamp(),
      draftSavedAt: serverTimestamp(),
      updatedByUid: userUid,
      updatedByName: userName,
      updatedByEmail: userEmail
    });

    const leadUpdatePayload = {
      latestQuotationId: cleanQuotationId,
      latestQuotationRevision: finalRevision,

      latestDraftQuotationId: cleanQuotationId,
      latestDraftQuotationRevision: finalRevision,
      latestQuotationStatus: "draft",

      ...leadCommercialPayload,

      latestQuotationDraftAt: serverTimestamp(),
      latestQuotationDraftByUid: userUid,
      latestQuotationDraftByName: userName,

      lastActivityAt: serverTimestamp(),
      lastActivityType: "quotation_draft_updated",
      lastActivitySummary: `Quotation draft updated${
        finalRevision ? ` - Rev ${finalRevision}` : ""
      }`,

      updatedAt: serverTimestamp()
    };

    if (moveToQuotePending) {
      leadUpdatePayload.previousStage = currentStage;
      leadUpdatePayload.previousStageLabel =
        getLeadStageMeta(currentStage).label;

      leadUpdatePayload.stage = LEAD_STAGES.QUOTE_PENDING;
      leadUpdatePayload.stageLabel = quotePendingMeta.label;
      leadUpdatePayload.status = "open";
    }

    await updateDoc(leadRef, leadUpdatePayload);

    await logLeadAction({
      leadId: cleanLeadId,
      type: LEAD_TIMELINE_TYPES.QUOTATION,
      title: `Quotation draft updated${
        finalRevision ? ` - Rev ${finalRevision}` : ""
      }`,
      description: cleanString(note) || "Quotation draft updated",
      metadata: {
        action: "draft_updated",

        leadId: cleanLeadId,
        quotationId: cleanQuotationId,
        revision: finalRevision,

        status: "draft",
        isDraft: true,
        isFinalQuotation: false,

        itineraryHtml,
        quotationData: quotationData || null,

        ...commercialPayload,

        pricingVisibleToCustomer: false,

        signatureUser: signaturePayload
      },
      user
    });

    return {
      quotationId: cleanQuotationId,
      id: cleanQuotationId,
      revision: finalRevision,
      status: "draft",

      ...commercialPayload
    };
  }

  /* =========================
     CREATE NEW DRAFT REVISION
  ========================== */

  const leadRef = doc(db, "leads", cleanLeadId);

  const result = await runTransaction(db, async transaction => {
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

    const moveToQuotePending =
      shouldMoveLeadToQuotePending(currentStage);

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

      status: "draft",
      isDraft: true,
      isFinalQuotation: false,

      itineraryHtml,
      quotationData: quotationData || null,

      ...commercialPayload,

      note: cleanString(note),

      sendVia: [],
      sentVia: [],

      signatureUser: signaturePayload,

      createdByUid: userUid,
      createdByName: userName,
      createdByEmail: userEmail,

      updatedByUid: userUid,
      updatedByName: userName,
      updatedByEmail: userEmail,

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      draftSavedAt: serverTimestamp()
    };

    transaction.set(quotationRef, quotationPayload);

    const leadUpdatePayload = {
      quotationRevision: nextRevision,

      latestQuotationId: quotationRef.id,
      latestQuotationRevision: nextRevision,

      latestDraftQuotationId: quotationRef.id,
      latestDraftQuotationRevision: nextRevision,
      latestQuotationStatus: "draft",

      ...leadCommercialPayload,

      latestQuotationDraftAt: serverTimestamp(),
      latestQuotationDraftByUid: userUid,
      latestQuotationDraftByName: userName,

      lastActivityAt: serverTimestamp(),
      lastActivityType: "quotation_draft_saved",
      lastActivitySummary: `Quotation draft saved - Rev ${nextRevision}`,

      updatedAt: serverTimestamp()
    };

    if (moveToQuotePending) {
      leadUpdatePayload.previousStage = currentStage;
      leadUpdatePayload.previousStageLabel = currentStageMeta.label;

      leadUpdatePayload.stage = LEAD_STAGES.QUOTE_PENDING;
      leadUpdatePayload.stageLabel = quotePendingMeta.label;
      leadUpdatePayload.status = "open";
    }

    transaction.update(leadRef, leadUpdatePayload);

    return {
      quotationId: quotationRef.id,
      id: quotationRef.id,
      revision: nextRevision,
      status: "draft"
    };
  });

  await logLeadAction({
    leadId: cleanLeadId,
    type: LEAD_TIMELINE_TYPES.QUOTATION,
    title: `Quotation draft saved - Rev ${result.revision}`,
    description: cleanString(note) || "Quotation draft saved",
    metadata: {
      action: "draft_saved",

      leadId: cleanLeadId,
      quotationId: result.quotationId,
      revision: result.revision,

      status: "draft",
      isDraft: true,
      isFinalQuotation: false,

      itineraryHtml,
      quotationData: quotationData || null,

      ...commercialPayload,

      pricingVisibleToCustomer: false,

      signatureUser: signaturePayload
    },
    user
  });

  return {
    ...result,
    ...commercialPayload
  };
}

export default saveQuotationDraft;