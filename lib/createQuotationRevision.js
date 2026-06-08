import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where
} from "firebase/firestore";

import { db } from "@/lib/firebase";

function getUserName(user) {
  return (
    user?.displayName ||
    user?.name ||
    user?.email ||
    "System User"
  );
}

export async function createQuotationRevision({
  leadId,
  itineraryHtml,
  totalPrice,
  customerQuotedAmount,
  vendorCost,
  grossProfit,
  pricingVisibleToCustomer = false,
  note = "",
  sendVia = [],
  isFinalQuotation = false,
  signatureUser = null,
  user
}) {
  if (!leadId) throw new Error("Lead ID is required");
  if (!user) throw new Error("User is required");

  const leadRef = doc(db, "leads", leadId);

  const quotationAmount = Number(customerQuotedAmount || totalPrice || 0);

  const vendorAmount =
    vendorCost === null ||
    vendorCost === undefined ||
    vendorCost === ""
      ? null
      : Number(vendorCost);

  const profitAmount =
    vendorAmount === null
      ? null
      : Number(
          grossProfit !== undefined && grossProfit !== null
            ? grossProfit
            : quotationAmount - vendorAmount
        );

  const result = await runTransaction(db, async transaction => {
    const leadSnap = await transaction.get(leadRef);

    if (!leadSnap.exists()) {
      throw new Error("Lead not found");
    }

    const leadData = leadSnap.data();
    const nextRevision = Number(leadData.quotationRevision || 0) + 1;

    const quotationRef = doc(collection(db, "lead_quotations"));

    const quotationPayload = {
      leadId,
      leadCode: leadData.leadCode || "",

      revision: nextRevision,
      status: isFinalQuotation ? "final" : "draft",

      itineraryHtml,

      // Internal only. These values are not sent in email or WhatsApp body.
      totalPrice: quotationAmount,
      customerQuotedAmount: quotationAmount,
      vendorCost: vendorAmount,
      grossProfit: profitAmount,
      pricingVisibleToCustomer: Boolean(pricingVisibleToCustomer),

      note: note || "",
      sendVia,

      isFinalQuotation: Boolean(isFinalQuotation),

      signatureUser: {
        uid: signatureUser?.uid || "",
        name: signatureUser?.name || "",
        email: signatureUser?.email || "",
        mobile: signatureUser?.mobile || "",
        role: signatureUser?.role || "",
        signatureHtml: signatureUser?.signatureHtml || "",
        signatureText: signatureUser?.signatureText || ""
      },

      createdByUid: user?.uid || "",
      createdByName: getUserName(user),
      createdByEmail: user?.email || "",

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    transaction.set(quotationRef, quotationPayload);

    const timelineRef = doc(collection(db, "lead_timeline"));

    transaction.set(timelineRef, {
      leadId,
      type: "quotation",
      title: isFinalQuotation
        ? `Final quotation created - Rev ${nextRevision}`
        : `Quotation created - Rev ${nextRevision}`,
      description: note || "",
      revision: nextRevision,
      quotationId: quotationRef.id,
      sendVia,
      isFinalQuotation: Boolean(isFinalQuotation),

      // Internal commercial values for timeline/internal reporting.
      customerQuotedAmount: quotationAmount,
      vendorCost: vendorAmount,
      grossProfit: profitAmount,
      pricingVisibleToCustomer: false,

      createdByUid: user?.uid || "",
      createdByName: getUserName(user),
      createdAt: serverTimestamp()
    });

    const leadUpdatePayload = {
      quotationRevision: nextRevision,
      latestQuotationId: quotationRef.id,
      latestQuotationAmount: quotationAmount,
      latestVendorCost: vendorAmount,
      latestGrossProfit: profitAmount,
      stage: "quoted",
      updatedAt: serverTimestamp()
    };

    if (isFinalQuotation) {
      leadUpdatePayload.finalQuotationId = quotationRef.id;
      leadUpdatePayload.finalQuotationRevision = nextRevision;
      leadUpdatePayload.finalQuotationAmount = quotationAmount;
      leadUpdatePayload.finalVendorCost = vendorAmount;
      leadUpdatePayload.finalGrossProfit = profitAmount;
      leadUpdatePayload.finalQuotationByUid = user?.uid || "";
      leadUpdatePayload.finalQuotationByName = getUserName(user);
      leadUpdatePayload.finalQuotationAt = serverTimestamp();
    }

    transaction.update(leadRef, leadUpdatePayload);

    return {
      revision: nextRevision,
      quotationId: quotationRef.id
    };
  });

  return result.revision;
}