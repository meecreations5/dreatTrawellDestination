// lib/markQuotationFinal.js

import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  writeBatch
} from "firebase/firestore";

import { db } from "@/lib/firebase";

import {
  logLeadAction,
  LEAD_TIMELINE_TYPES
} from "@/lib/logLeadAction";
import { canAccessRecord } from "@/lib/rolePermissions";

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

  const leadRef = doc(db, "leads", leadId);
  const leadSnap = await getDoc(leadRef);
  if (!leadSnap.exists()) throw new Error("Lead not found");
  const lead = { id: leadSnap.id, ...leadSnap.data() };

  if (!canAccessRecord(user, "quotations.edit", lead, "lead")) {
    throw new Error("You do not have permission to finalize this quotation.");
  }

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
    quotation.customerQuoteAmount ??
      quotation.customerQuotedAmount ??
      quotation.totalAmount ??
      quotation.totalPrice,
    null
  );
  const vendorCost = cleanNumber(
    quotation.totalSelectedVendorCost ??
      quotation.selectedVendorCost ??
      quotation.vendorCost,
    null
  );
  const grossProfit = cleanNumber(quotation.grossProfit, null);
  const marginPercent = cleanNumber(quotation.marginPercent, null);

  const quotationsSnap = await getDocs(
    collection(db, "leads", leadId, "quotations")
  );
  const batch = writeBatch(db);

  quotationsSnap.docs.forEach(item => {
    if (item.id === quotationId) return;

    const data = item.data() || {};
    const isOlderFinal =
      data.isFinalQuotation === true || data.status === "final";

    if (!isOlderFinal) return;

    const wasSent = Boolean(
      data.sentAt ||
        (Array.isArray(data.sentVia) && data.sentVia.length) ||
        (Array.isArray(data.sendVia) && data.sendVia.length)
    );

    batch.update(item.ref, {
      isFinalQuotation: false,
      isDraft: false,
      status: wasSent ? "sent" : "superseded",
      previousFinalSupersededAt: serverTimestamp(),
      previousFinalSupersededByQuotationId: quotationId,
      previousFinalSupersededByUid: user?.uid || "",
      previousFinalSupersededByName: getUserName(user),
      updatedAt: serverTimestamp()
    });
  });

  batch.update(quotationRef, {
    status: "final",
    isDraft: false,
    isFinalQuotation: true,

    finalMarkedAt: serverTimestamp(),
    finalMarkedByUid: user?.uid || "",
    finalMarkedByName: getUserName(user),
    finalMarkedByEmail: user?.email || "",

    updatedAt: serverTimestamp()
  });

  batch.update(leadRef, {
    latestQuotationStatus: "final",

    finalQuotationId: quotationId,
    finalQuotationRevision: revision,
    finalQuotationAmount: quoteAmount,
    finalCustomerQuoteAmount: quoteAmount,
    finalCustomerQuoteCurrency:
      quotation.customerQuoteCurrency || quotation.selectedVendorCurrency || "INR",

    finalVendorCost: vendorCost,
    finalSelectedVendorCost: vendorCost,
    finalSelectedVendorCurrency: quotation.selectedVendorCurrency || "INR",
    finalSelectedVendorName: quotation.selectedVendorName || "",
    finalSelectedVendorQuoteId: quotation.selectedVendorQuoteId || "",
    finalSelectedVendorRequestId: quotation.selectedVendorRequestId || "",
    finalVendorCostingMode: quotation.vendorCostingMode || "single_vendor",
    finalSelectedVendorQuotes: Array.isArray(quotation.selectedVendorQuotes)
      ? quotation.selectedVendorQuotes
      : [],
    finalSelectedVendorQuoteIds: Array.isArray(quotation.selectedVendorQuoteIds)
      ? quotation.selectedVendorQuoteIds
      : [],
    finalTotalSelectedVendorCost:
      quotation.totalSelectedVendorCost ?? vendorCost,

    finalGrossProfit: grossProfit,
    finalMarginPercent: marginPercent,

    finalQuotationAt: serverTimestamp(),
    finalQuotationByUid: user?.uid || "",
    finalQuotationByName: getUserName(user),

    updatedAt: serverTimestamp()
  });

  await batch.commit();

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