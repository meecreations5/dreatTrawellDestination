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

function getUserName(user) {
  return (
    user?.displayName ||
    user?.name ||
    user?.email ||
    "System User"
  );
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
    return sendVia.filter(Boolean);
  }

  if (typeof sendVia === "string") {
    return [sendVia].filter(Boolean);
  }

  return [];
}

function normalizeSignatureUser(signatureUser = {}) {
  return {
    uid: signatureUser?.uid || "",
    name: signatureUser?.name || "",
    email: signatureUser?.email || "",
    mobile: signatureUser?.mobile || "",
    role: signatureUser?.role || "",

    companyName: signatureUser?.companyName || "",
    companyLogoUrl: signatureUser?.companyLogoUrl || "",
    websiteUrl: signatureUser?.websiteUrl || "",
    emailAssetBaseUrl: signatureUser?.emailAssetBaseUrl || "",

    facebookUrl: signatureUser?.facebookUrl || "",
    instagramUrl: signatureUser?.instagramUrl || "",
    linkedinUrl: signatureUser?.linkedinUrl || "",
    youtubeUrl: signatureUser?.youtubeUrl || "",

    supportEmail: signatureUser?.supportEmail || "",
    supportMobile: signatureUser?.supportMobile || "",

    emailFooterLine: signatureUser?.emailFooterLine || "",
    quotationClosingLine: signatureUser?.quotationClosingLine || "",
    emailDisclaimer: signatureUser?.emailDisclaimer || "",
    whatsappFooterLine: signatureUser?.whatsappFooterLine || "",

    signatureHtml: signatureUser?.signatureHtml || "",
    signatureText: signatureUser?.signatureText || ""
  };
}

export async function createQuotationRevision({
  leadId,
  itineraryHtml,

  totalPrice,
  customerQuotedAmount,
  vendorCost,
  grossProfit,
  marginPercent,
  pricingVisibleToCustomer = false,

  note = "",
  sendVia = [],
  isFinalQuotation = false,
  signatureUser = null,

  // IMPORTANT:
  // When quotation is created and sent at same time from QuotationEditor,
  // pass skipTimelineLog: true to avoid duplicate timeline logs.
  skipTimelineLog = false,

  user
}) {
  if (!leadId) throw new Error("Lead ID is required");
  if (!user) throw new Error("User is required");

  const cleanSendVia = normalizeSendVia(sendVia);

  const quoteAmount = cleanNumber(
    customerQuotedAmount ?? totalPrice,
    0
  );

  const vendorAmount = cleanNullableNumber(vendorCost);

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

  const finalStatus = isFinalQuotation
    ? "final"
    : cleanSendVia.length
      ? "sent"
      : "draft";

  const isDraft = finalStatus === "draft";
  const signaturePayload = normalizeSignatureUser(signatureUser);

  const result = await runTransaction(db, async transaction => {
    const leadRef = doc(db, "leads", leadId);
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

    const quotationsRef = collection(
      db,
      "leads",
      leadId,
      "quotations"
    );

    const quotationRef = doc(quotationsRef);

    const quotationPayload = {
      leadId,
      leadCode: leadData.leadCode || "",

      quotationId: quotationRef.id,
      revision: nextRevision,

      status: finalStatus,
      isDraft,
      isFinalQuotation: Boolean(isFinalQuotation),

      itineraryHtml: itineraryHtml || "",

      totalPrice: quoteAmount,
      totalAmount: quoteAmount,
      customerQuotedAmount: quoteAmount,
      vendorCost: vendorAmount,
      grossProfit: profitAmount,
      marginPercent: margin,
      pricingVisibleToCustomer: Boolean(pricingVisibleToCustomer),

      note: note || "",

      sendVia: cleanSendVia,
      sentVia: cleanSendVia,

      signatureUser: signaturePayload,

      createdByUid: user?.uid || "",
      createdByName: getUserName(user),
      createdByEmail: user?.email || "",

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    transaction.set(quotationRef, quotationPayload);

    const leadUpdatePayload = {
      quotationRevision: nextRevision,
      latestQuotationRevision: nextRevision,
      latestQuotationId: quotationRef.id,

      latestQuotationAmount: quoteAmount,
      latestVendorCost: vendorAmount,
      latestGrossProfit: profitAmount,
      latestMarginPercent: margin,
      latestQuotationStatus: finalStatus,

      updatedAt: serverTimestamp()
    };

    if (!isDraft) {
      leadUpdatePayload.stage = "quoted";
    }

    if (isFinalQuotation) {
      leadUpdatePayload.finalQuotationId = quotationRef.id;
      leadUpdatePayload.finalQuotationRevision = nextRevision;
      leadUpdatePayload.finalQuotationAmount = quoteAmount;
      leadUpdatePayload.finalVendorCost = vendorAmount;
      leadUpdatePayload.finalGrossProfit = profitAmount;
      leadUpdatePayload.finalMarginPercent = margin;
      leadUpdatePayload.finalQuotationAt = serverTimestamp();
      leadUpdatePayload.finalQuotationByUid = user?.uid || "";
      leadUpdatePayload.finalQuotationByName = getUserName(user);
    }

    transaction.update(leadRef, leadUpdatePayload);

    return {
      quotationId: quotationRef.id,
      revision: nextRevision,
      status: finalStatus
    };
  });

  if (!skipTimelineLog) {
    await logLeadAction({
      leadId,
      type: LEAD_TIMELINE_TYPES.QUOTATION,
      title: isFinalQuotation
        ? `Final quotation created - Rev ${result.revision}`
        : `Quotation created - Rev ${result.revision}`,
      description: note || "Quotation revision created",
      metadata: {
        action: isFinalQuotation
          ? "final_quotation_marked"
          : "quotation_created",

        leadId,
        quotationId: result.quotationId,
        revision: result.revision,

        status: result.status,
        isDraft,
        isFinalQuotation: Boolean(isFinalQuotation),

        sendVia: cleanSendVia,
        sentVia: cleanSendVia,

        itineraryHtml: itineraryHtml || "",

        totalAmount: quoteAmount,
        customerQuotedAmount: quoteAmount,
        vendorCost: vendorAmount,
        grossProfit: profitAmount,
        marginPercent: margin,
        pricingVisibleToCustomer: false,

        signatureUser: signaturePayload
      },
      user
    });
  }

  return {
    quotationId: result.quotationId,
    revision: result.revision,
    status: result.status
  };
}