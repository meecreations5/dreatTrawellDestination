// lib/leadVendorPayments.js

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc
} from "firebase/firestore";

import { db } from "@/lib/firebase";

import {
  logLeadAction,
  LEAD_TIMELINE_TYPES
} from "@/lib/logLeadAction";

import {
  PAYMENT_COLLECTIONS,
  PAYMENT_DIRECTION,
  PAYEE_TYPES,
  VENDOR_PAYMENT_TYPES,
  VENDOR_PAYMENT_STATUS,
  VENDOR_PAYMENT_SUMMARY_STATUS,
  DEFAULT_CURRENCY,
  normalizePaymentMode,
  normalizeVendorPaymentStatus,
  requiresTransactionRef,
  requiresBankName,
  getSignedAmountForVendorPayment,
  calculateBalance,
  calculateVendorPaymentStatus
} from "@/lib/paymentConstants";

/* =========================
   HELPERS
========================= */

function cleanString(value = "") {
  return String(value || "").trim();
}

function cleanNumber(value, fallback = 0) {
  const number = Number(value);

  if (!Number.isFinite(number)) return fallback;

  return number;
}

function cleanNullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;

  const number = Number(value);

  if (!Number.isFinite(number)) return null;

  return number;
}

function getUserUid(user) {
  return cleanString(user?.uid || user?.id || user?.email);
}

function getUserName(user) {
  return cleanString(
    user?.displayName ||
      user?.name ||
      user?.fullName ||
      user?.email ||
      "System User"
  );
}

function getUserEmail(user) {
  return cleanString(
    user?.email ||
      user?.workEmail ||
      user?.officialEmail
  );
}

function toTimestamp(value) {
  if (!value) return serverTimestamp();

  if (value?.toDate) return value;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return Timestamp.fromDate(value);
  }

  const parsed = new Date(value);

  if (!Number.isNaN(parsed.getTime())) {
    return Timestamp.fromDate(parsed);
  }

  return serverTimestamp();
}

function toDate(value) {
  if (!value) return null;
  if (value?.toDate) return value.toDate();
  if (value instanceof Date) return value;

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getPaymentDateValue(payment = {}) {
  return (
    payment.paymentDate ||
    payment.paidAt ||
    payment.createdAt ||
    payment.updatedAt ||
    null
  );
}

function sortByLatestDate(a, b) {
  const dateA = toDate(getPaymentDateValue(a))?.getTime() || 0;
  const dateB = toDate(getPaymentDateValue(b))?.getTime() || 0;

  return dateB - dateA;
}

function getLeadVendorPayableAmount(lead = {}) {
  return cleanNumber(
    lead.finalSelectedVendorCost ??
      lead.finalVendorCost ??
      lead.latestSelectedVendorCost ??
      lead.latestVendorCost ??
      lead.selectedVendorCost ??
      lead.vendorCost ??
      0,
    0
  );
}

function getLeadReceivableAmount(lead = {}) {
  return cleanNumber(
    lead.totalReceivableAmount ??
      lead.finalCustomerQuoteAmount ??
      lead.finalQuotationAmount ??
      lead.latestCustomerQuoteAmount ??
      lead.latestQuotationAmount ??
      lead.customerQuoteAmount ??
      lead.customerQuotedAmount ??
      0,
    0
  );
}

function getLeadCustomerReceivedAmount(lead = {}) {
  return cleanNumber(
    lead.totalPaymentReceived ??
      lead.customerPaymentReceived ??
      lead.paymentReceived ??
      0,
    0
  );
}

function getDefaultVendorName(lead = {}) {
  return cleanString(
    lead.finalSelectedVendorName ||
      lead.finalVendorName ||
      lead.latestSelectedVendorName ||
      lead.selectedVendorName ||
      lead.vendorName
  );
}

function getDefaultVendorId(lead = {}) {
  return cleanString(
    lead.finalVendorId ||
      lead.latestVendorId ||
      lead.selectedVendorId ||
      lead.vendorId
  );
}

function getDefaultVendorQuoteId(lead = {}) {
  return cleanString(
    lead.finalSelectedVendorQuoteId ||
      lead.finalVendorQuoteId ||
      lead.latestSelectedVendorQuoteId ||
      lead.selectedVendorQuoteId
  );
}

function getDefaultVendorRequestId(lead = {}) {
  return cleanString(
    lead.finalSelectedVendorRequestId ||
      lead.finalVendorRequestId ||
      lead.latestSelectedVendorRequestId ||
      lead.selectedVendorRequestId
  );
}

function validateVendorPaymentForm(form = {}) {
  const amount = cleanNumber(form.amount, 0);
  const paymentMode = normalizePaymentMode(form.paymentMode);
  const transactionRef = cleanString(form.transactionRef);
  const bankName = cleanString(form.bankName);

  if (amount <= 0) {
    throw new Error("Vendor payment amount must be greater than zero.");
  }

  if (requiresTransactionRef(paymentMode) && !transactionRef) {
    throw new Error("Transaction reference / UTR number is required.");
  }

  if (requiresBankName(paymentMode) && !bankName) {
    throw new Error("Bank name is required for this payment mode.");
  }

  return true;
}

function getVendorPaymentTitle(status, amount, currency) {
  if (status === VENDOR_PAYMENT_STATUS.PAID) {
    return `Vendor payment paid - ${currency} ${amount.toLocaleString("en-IN")}`;
  }

  if (status === VENDOR_PAYMENT_STATUS.PENDING) {
    return `Vendor payment planned - ${currency} ${amount.toLocaleString("en-IN")}`;
  }

  if (status === VENDOR_PAYMENT_STATUS.CANCELLED) {
    return `Vendor payment cancelled - ${currency} ${amount.toLocaleString("en-IN")}`;
  }

  return `Vendor payment added - ${currency} ${amount.toLocaleString("en-IN")}`;
}

function buildVendorPaymentSummary({
  lead,
  vendorPayments
}) {
  const totalVendorPayableAmount = getLeadVendorPayableAmount(lead);

  const paidVendorPayments = vendorPayments.filter(
    payment => payment.status === VENDOR_PAYMENT_STATUS.PAID
  );

  const totalVendorPaid = paidVendorPayments.reduce((sum, payment) => {
    return sum + getSignedAmountForVendorPayment(payment);
  }, 0);

  const vendorPaymentBalance = calculateBalance(
    totalVendorPayableAmount,
    totalVendorPaid
  );

  const vendorPaymentStatus = calculateVendorPaymentStatus(
    totalVendorPayableAmount,
    totalVendorPaid
  );

  const latestPayment =
    [...paidVendorPayments].sort(sortByLatestDate)[0] || null;

  const totalReceivableAmount = getLeadReceivableAmount(lead);
  const totalPaymentReceived = getLeadCustomerReceivedAmount(lead);

  const expectedGrossProfit =
    totalReceivableAmount > 0 || totalVendorPayableAmount > 0
      ? Number((totalReceivableAmount - totalVendorPayableAmount).toFixed(2))
      : null;

  const actualGrossProfit =
    totalPaymentReceived > 0 || totalVendorPaid > 0
      ? Number((totalPaymentReceived - totalVendorPaid).toFixed(2))
      : null;

  const pendingProfit =
    expectedGrossProfit !== null && actualGrossProfit !== null
      ? Number((expectedGrossProfit - actualGrossProfit).toFixed(2))
      : null;

  return {
    totalVendorPayableAmount,
    totalVendorPaid: Number(totalVendorPaid.toFixed(2)),
    vendorPaymentBalance: Number(vendorPaymentBalance.toFixed(2)),
    vendorPaymentStatus,

    latestVendorPaymentId:
      latestPayment?.id || latestPayment?.paymentId || "",
    latestVendorPaymentAt: latestPayment
      ? getPaymentDateValue(latestPayment)
      : null,
    latestVendorPaymentAmount: latestPayment
      ? cleanNumber(latestPayment.amount, 0)
      : null,
    latestVendorPaymentMode: latestPayment?.paymentMode || "",

    totalReceivableAmount,
    totalPaymentReceived,

    expectedGrossProfit,
    actualGrossProfit,
    pendingProfit
  };
}

/* =========================
   RECALCULATE SUMMARY
========================= */

export async function recalculateVendorPaymentSummary({
  leadId
}) {
  const cleanLeadId = cleanString(leadId);

  if (!cleanLeadId) {
    throw new Error("Lead ID is required to recalculate vendor payments.");
  }

  const leadRef = doc(db, "leads", cleanLeadId);
  const leadSnap = await getDoc(leadRef);

  if (!leadSnap.exists()) {
    throw new Error("Lead not found.");
  }

  const lead = {
    id: leadSnap.id,
    ...leadSnap.data()
  };

  const paymentsRef = collection(
    db,
    "leads",
    cleanLeadId,
    PAYMENT_COLLECTIONS.VENDOR_PAYMENTS
  );

  const paymentsSnap = await getDocs(paymentsRef);

  const vendorPayments = paymentsSnap.docs.map(paymentDoc => ({
    id: paymentDoc.id,
    paymentId: paymentDoc.id,
    ...paymentDoc.data()
  }));

  const summary = buildVendorPaymentSummary({
    lead,
    vendorPayments
  });

  await updateDoc(leadRef, {
    ...summary,

    updatedAt: serverTimestamp(),
    vendorPaymentSummaryUpdatedAt: serverTimestamp()
  });

  return {
    leadId: cleanLeadId,
    vendorPayments,
    ...summary
  };
}

/* =========================
   CREATE VENDOR PAYMENT
========================= */

export async function createVendorPayment({
  leadId,
  form = {},
  user
}) {
  const cleanLeadId = cleanString(leadId);

  if (!cleanLeadId) {
    throw new Error("Lead ID is required.");
  }

  if (!user) {
    throw new Error("User is required.");
  }

  validateVendorPaymentForm(form);

  const leadRef = doc(db, "leads", cleanLeadId);
  const leadSnap = await getDoc(leadRef);

  if (!leadSnap.exists()) {
    throw new Error("Lead not found.");
  }

  const lead = {
    id: leadSnap.id,
    ...leadSnap.data()
  };

  const amount = cleanNumber(form.amount, 0);
  const currency = cleanString(form.currency) || DEFAULT_CURRENCY;
  const paymentMode = normalizePaymentMode(form.paymentMode);
  const status = normalizeVendorPaymentStatus(form.status);

  const userUid = getUserUid(user);
  const userName = getUserName(user);
  const userEmail = getUserEmail(user);

  const vendorId =
    cleanString(form.vendorId) ||
    getDefaultVendorId(lead);

  const vendorName =
    cleanString(form.vendorName) ||
    getDefaultVendorName(lead);

  const vendorRequestId =
    cleanString(form.vendorRequestId) ||
    getDefaultVendorRequestId(lead);

  const vendorQuoteId =
    cleanString(form.vendorQuoteId) ||
    getDefaultVendorQuoteId(lead);

  const paymentPayload = {
    leadId: cleanLeadId,
    leadCode: cleanString(lead.leadCode),

    paymentDirection: PAYMENT_DIRECTION.OUTBOUND,

    payeeType: cleanString(form.payeeType) || PAYEE_TYPES.VENDOR,

    vendorId,
    vendorName,
    vendorRequestId,
    vendorQuoteId,

    paymentType:
      cleanString(form.paymentType) ||
      VENDOR_PAYMENT_TYPES.ADVANCE,

    amount,
    currency,

    paymentMode,
    paymentDate: toTimestamp(form.paymentDate),

    transactionRef: cleanString(form.transactionRef),
    bankName: cleanString(form.bankName),

    paymentProofUrl: cleanString(form.paymentProofUrl),
    paymentProofFileName: cleanString(form.paymentProofFileName),

    status,

    remark: cleanString(form.remark),

    createdByUid: userUid,
    createdByName: userName,
    createdByEmail: userEmail,

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),

    ...(status === VENDOR_PAYMENT_STATUS.PAID
      ? {
          paidAt: serverTimestamp(),
          paidByUid: userUid,
          paidByName: userName,
          paidByEmail: userEmail
        }
      : {})
  };

  const paymentRef = await addDoc(
    collection(
      db,
      "leads",
      cleanLeadId,
      PAYMENT_COLLECTIONS.VENDOR_PAYMENTS
    ),
    paymentPayload
  );

  const summary = await recalculateVendorPaymentSummary({
    leadId: cleanLeadId
  });

  await updateDoc(leadRef, {
    latestVendorPaymentEntryId: paymentRef.id,
    latestVendorPaymentEntryAmount: amount,
    latestVendorPaymentEntryMode: paymentMode,
    latestVendorPaymentEntryStatus: status,
    latestVendorPaymentEntryAt: paymentPayload.paymentDate,

    lastActivityAt: serverTimestamp(),
    lastActivityType:
      status === VENDOR_PAYMENT_STATUS.PAID
        ? "vendor_payment_paid"
        : status === VENDOR_PAYMENT_STATUS.PENDING
          ? "vendor_payment_planned"
          : "vendor_payment_added",
    lastActivitySummary: getVendorPaymentTitle(
      status,
      amount,
      currency
    ),

    updatedAt: serverTimestamp()
  });

  await logLeadAction({
    leadId: cleanLeadId,
    type: LEAD_TIMELINE_TYPES.PAYMENT || "payment",
    title: getVendorPaymentTitle(status, amount, currency),
    description:
      cleanString(form.remark) ||
      `Vendor payment ${status === VENDOR_PAYMENT_STATUS.PAID ? "paid" : "added"} for ${
        vendorName || "vendor"
      }.`,
    metadata: {
      action: "vendor_payment_created",

      leadId: cleanLeadId,
      paymentId: paymentRef.id,

      paymentDirection: PAYMENT_DIRECTION.OUTBOUND,

      vendorId,
      vendorName,
      vendorRequestId,
      vendorQuoteId,

      amount,
      currency,
      paymentMode,
      paymentType: paymentPayload.paymentType,
      status,

      transactionRef: paymentPayload.transactionRef,
      bankName: paymentPayload.bankName,

      paymentProofUrl: paymentPayload.paymentProofUrl,
      paymentProofFileName: paymentPayload.paymentProofFileName,

      summary
    },
    user
  });

  return {
    id: paymentRef.id,
    paymentId: paymentRef.id,
    ...paymentPayload,
    summary
  };
}

/* =========================
   UPDATE VENDOR PAYMENT STATUS
========================= */

export async function updateVendorPaymentStatus({
  leadId,
  paymentId,
  status,
  remark = "",
  user
}) {
  const cleanLeadId = cleanString(leadId);
  const cleanPaymentId = cleanString(paymentId);

  if (!cleanLeadId) throw new Error("Lead ID is required.");
  if (!cleanPaymentId) throw new Error("Vendor payment ID is required.");
  if (!user) throw new Error("User is required.");

  const safeStatus = normalizeVendorPaymentStatus(status);

  const paymentRef = doc(
    db,
    "leads",
    cleanLeadId,
    PAYMENT_COLLECTIONS.VENDOR_PAYMENTS,
    cleanPaymentId
  );

  const paymentSnap = await getDoc(paymentRef);

  if (!paymentSnap.exists()) {
    throw new Error("Vendor payment entry not found.");
  }

  const existingPayment = {
    id: paymentSnap.id,
    paymentId: paymentSnap.id,
    ...paymentSnap.data()
  };

  const userUid = getUserUid(user);
  const userName = getUserName(user);
  const userEmail = getUserEmail(user);

  const statusPayload = {
    status: safeStatus,
    statusRemark: cleanString(remark),

    updatedAt: serverTimestamp(),
    updatedByUid: userUid,
    updatedByName: userName,
    updatedByEmail: userEmail
  };

  if (safeStatus === VENDOR_PAYMENT_STATUS.PAID) {
    statusPayload.paidAt = serverTimestamp();
    statusPayload.paidByUid = userUid;
    statusPayload.paidByName = userName;
    statusPayload.paidByEmail = userEmail;
  }

  if (safeStatus === VENDOR_PAYMENT_STATUS.CANCELLED) {
    statusPayload.cancelledAt = serverTimestamp();
    statusPayload.cancelledByUid = userUid;
    statusPayload.cancelledByName = userName;
    statusPayload.cancelledByEmail = userEmail;
  }

  await updateDoc(paymentRef, statusPayload);

  const summary = await recalculateVendorPaymentSummary({
    leadId: cleanLeadId
  });

  const amount = cleanNumber(existingPayment.amount, 0);
  const currency = existingPayment.currency || DEFAULT_CURRENCY;

  await logLeadAction({
    leadId: cleanLeadId,
    type: LEAD_TIMELINE_TYPES.PAYMENT || "payment",
    title:
      safeStatus === VENDOR_PAYMENT_STATUS.PAID
        ? `Vendor payment marked paid - ${currency} ${amount.toLocaleString("en-IN")}`
        : safeStatus === VENDOR_PAYMENT_STATUS.CANCELLED
          ? `Vendor payment cancelled - ${currency} ${amount.toLocaleString("en-IN")}`
          : `Vendor payment status updated - ${currency} ${amount.toLocaleString("en-IN")}`,
    description: cleanString(remark) || "Vendor payment status updated.",
    metadata: {
      action: "vendor_payment_status_updated",

      leadId: cleanLeadId,
      paymentId: cleanPaymentId,

      previousStatus: existingPayment.status,
      status: safeStatus,

      vendorId: existingPayment.vendorId || "",
      vendorName: existingPayment.vendorName || "",
      vendorRequestId: existingPayment.vendorRequestId || "",
      vendorQuoteId: existingPayment.vendorQuoteId || "",

      amount,
      currency,

      summary
    },
    user
  });

  return {
    paymentId: cleanPaymentId,
    status: safeStatus,
    summary
  };
}

export async function markVendorPaymentPaid({
  leadId,
  paymentId,
  remark = "",
  user
}) {
  return updateVendorPaymentStatus({
    leadId,
    paymentId,
    status: VENDOR_PAYMENT_STATUS.PAID,
    remark,
    user
  });
}

export async function cancelVendorPayment({
  leadId,
  paymentId,
  remark = "",
  user
}) {
  return updateVendorPaymentStatus({
    leadId,
    paymentId,
    status: VENDOR_PAYMENT_STATUS.CANCELLED,
    remark,
    user
  });
}

/* =========================
   LIST VENDOR PAYMENTS
========================= */

export async function getVendorPayments({ leadId }) {
  const cleanLeadId = cleanString(leadId);

  if (!cleanLeadId) return [];

  const paymentsRef = collection(
    db,
    "leads",
    cleanLeadId,
    PAYMENT_COLLECTIONS.VENDOR_PAYMENTS
  );

  const q = query(paymentsRef, orderBy("createdAt", "desc"));
  const snap = await getDocs(q);

  return snap.docs.map(paymentDoc => ({
    id: paymentDoc.id,
    paymentId: paymentDoc.id,
    ...paymentDoc.data()
  }));
}

export default createVendorPayment;