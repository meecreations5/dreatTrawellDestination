// lib/markQuotationFinal.js

import {
  doc,
  getDoc,
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

function cleanNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export async function markQuotationFinal({
  leadId,
  quotationId,
  user
}) {
  if (!leadId) throw new Error("Lead ID is required");
  if (!quotationId) throw new Error("Quotation ID is required");
  if (!user) throw new Error("User is required");

  const quotationRef = doc(
    db,
    "leads",
    leadId,
    "quotations",
    quotationId
  );

  const quotationSnap = await getDoc(quotationRef);

  if (!quotationSnap.exists()) {
    throw new Error("Quotation not found");
  }

  const quotation = quotationSnap.data();

  const revision = quotation.revision || "";
  const quoteAmount = cleanNumber(
    quotation.customerQuotedAmount || quotation.totalPrice,
    null
  );
  const vendorCost = cleanNumber(quotation.vendorCost, null);
  const grossProfit = cleanNumber(quotation.grossProfit, null);
  const marginPercent = cleanNumber(quotation.marginPercent, null);

  await updateDoc(quotationRef, {
    status: "final",
    isDraft: false,
    isFinalQuotation: true,

    finalMarkedAt: serverTimestamp(),
    finalMarkedByUid: user?.uid || "",
    finalMarkedByName: getUserName(user),
    finalMarkedByEmail: user?.email || "",

    updatedAt: serverTimestamp()
  });

  await updateDoc(doc(db, "leads", leadId), {
    latestQuotationStatus: "final",

    finalQuotationId: quotationId,
    finalQuotationRevision: revision,
    finalQuotationAmount: quoteAmount,
    finalVendorCost: vendorCost,
    finalGrossProfit: grossProfit,
    finalMarginPercent: marginPercent,

    finalQuotationAt: serverTimestamp(),
    finalQuotationByUid: user?.uid || "",
    finalQuotationByName: getUserName(user),

    updatedAt: serverTimestamp()
  });

  await logLeadAction({
    leadId,
    type: LEAD_TIMELINE_TYPES.QUOTATION,
    title: `Final quotation marked - Rev ${revision || ""}`,
    description: "Quotation marked as final",
    metadata: {
      action: "final_quotation_marked",
      quotationId,
      revision,
      status: "final",
      isFinalQuotation: true,
      isDraft: false,

      totalAmount: quoteAmount,
      customerQuotedAmount: quoteAmount,
      vendorCost,
      grossProfit,
      marginPercent,
      pricingVisibleToCustomer: false,

      signatureUser: quotation.signatureUser || null
    },
    user
  });

  return {
    quotationId,
    revision,
    status: "final"
  };
}