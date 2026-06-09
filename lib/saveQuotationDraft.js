// lib/saveQuotationDraft.js

import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  updateDoc
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

export async function saveQuotationDraft({
  leadId,
  quotationId = "",
  revision = null,

  itineraryHtml = "",
  customerQuotedAmount = 0,
  vendorCost = null,
  grossProfit = null,
  marginPercent = null,

  note = "",
  signatureUser = null,
  user
}) {
  if (!leadId) throw new Error("Lead ID is required");
  if (!user) throw new Error("User is required");

  const quoteAmount = cleanNumber(customerQuotedAmount, 0);

  const vendorAmount =
    vendorCost === null ||
    vendorCost === undefined ||
    vendorCost === ""
      ? null
      : cleanNumber(vendorCost, 0);

  const profitAmount =
    grossProfit === null ||
    grossProfit === undefined ||
    grossProfit === ""
      ? vendorAmount === null
        ? null
        : quoteAmount - vendorAmount
      : cleanNumber(grossProfit, 0);

  const margin =
    marginPercent === null ||
    marginPercent === undefined ||
    marginPercent === ""
      ? quoteAmount > 0 && profitAmount !== null
        ? Number(((profitAmount / quoteAmount) * 100).toFixed(2))
        : null
      : cleanNumber(marginPercent, 0);

  // UPDATE EXISTING DRAFT
  if (quotationId) {
    const quotationRef = doc(
      db,
      "leads",
      leadId,
      "quotations",
      quotationId
    );

    await updateDoc(quotationRef, {
      itineraryHtml,

      status: "draft",
      isDraft: true,
      isFinalQuotation: false,

      totalPrice: quoteAmount,
      customerQuotedAmount: quoteAmount,
      vendorCost: vendorAmount,
      grossProfit: profitAmount,
      marginPercent: margin,
      pricingVisibleToCustomer: false,

      note: note || "",

      sendVia: [],
      sentVia: [],

      signatureUser: signatureUser || null,

      updatedAt: serverTimestamp(),
      updatedByUid: user?.uid || "",
      updatedByName: getUserName(user),
      updatedByEmail: user?.email || ""
    });

    await logLeadAction({
      leadId,
      type: LEAD_TIMELINE_TYPES.QUOTATION,
      title: `Quotation draft updated - Rev ${revision || ""}`,
      description: note || "Quotation draft updated",
      metadata: {
        quotationId,
        revision,
        status: "draft",
        isDraft: true,
        customerQuotedAmount: quoteAmount,
        vendorCost: vendorAmount,
        grossProfit: profitAmount,
        marginPercent: margin
      },
      user
    });

    return {
      quotationId,
      revision,
      status: "draft"
    };
  }

  // CREATE NEW DRAFT REVISION
  const leadRef = doc(db, "leads", leadId);

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

    const quotationsRef = collection(
      db,
      "leads",
      leadId,
      "quotations"
    );

    const quotationRef = doc(quotationsRef);

    transaction.set(quotationRef, {
      leadId,
      leadCode: leadData.leadCode || "",

      quotationId: quotationRef.id,
      revision: nextRevision,

      status: "draft",
      isDraft: true,
      isFinalQuotation: false,

      itineraryHtml,

      totalPrice: quoteAmount,
      customerQuotedAmount: quoteAmount,
      vendorCost: vendorAmount,
      grossProfit: profitAmount,
      marginPercent: margin,
      pricingVisibleToCustomer: false,

      note: note || "",

      sendVia: [],
      sentVia: [],

      signatureUser: signatureUser || null,

      createdByUid: user?.uid || "",
      createdByName: getUserName(user),
      createdByEmail: user?.email || "",

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    transaction.update(leadRef, {
      quotationRevision: nextRevision,
      latestDraftQuotationId: quotationRef.id,
      latestDraftQuotationRevision: nextRevision,
      latestQuotationStatus: "draft",
      updatedAt: serverTimestamp()
    });

    return {
      quotationId: quotationRef.id,
      revision: nextRevision,
      status: "draft"
    };
  });

  await logLeadAction({
    leadId,
    type: LEAD_TIMELINE_TYPES.QUOTATION,
    title: `Quotation draft saved - Rev ${result.revision}`,
    description: note || "Quotation draft saved",
    metadata: {
      quotationId: result.quotationId,
      revision: result.revision,
      status: "draft",
      isDraft: true,
      customerQuotedAmount: quoteAmount,
      vendorCost: vendorAmount,
      grossProfit: profitAmount,
      marginPercent: margin
    },
    user
  });

  return result;
}