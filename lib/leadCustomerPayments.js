// lib/leadCustomerPayments.js

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
  LEAD_STAGES,
  getLeadStageMeta,
  isTerminalLeadStage,
  normalizeLeadStage
} from "@/lib/leadStages";

import {
  PAYMENT_COLLECTIONS,
  PAYMENT_DIRECTION,
  PAYER_TYPES,
  CUSTOMER_PAYMENT_TYPES,
  CUSTOMER_PAYMENT_STATUS,
  CUSTOMER_PAYMENT_SUMMARY_STATUS,
  PAYMENT_MODES,
  DEFAULT_CURRENCY,
  normalizePaymentMode,
  normalizeCustomerPaymentStatus,
  requiresTransactionRef,
  requiresBankName,
  getSignedAmountForCustomerPayment,
  calculateBalance,
  calculateCustomerPaymentStatus
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

function getLeadReceivableAmount(lead = {}) {
  return cleanNumber(
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

function getPaymentDateValue(payment = {}) {
  return (
    payment.paymentDate ||
    payment.verifiedAt ||
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

function getCustomerPaymentTitle(status, amount, currency) {
  if (status === CUSTOMER_PAYMENT_STATUS.VERIFIED) {
    return `Payment received - ${currency} ${amount.toLocaleString("en-IN")}`;
  }

  if (status === CUSTOMER_PAYMENT_STATUS.PENDING_VERIFICATION) {
    return `Payment added for verification - ${currency} ${amount.toLocaleString("en-IN")}`;
  }

  return `Customer payment added - ${currency} ${amount.toLocaleString("en-IN")}`;
}

function validateCustomerPaymentForm(form = {}) {
  const amount = cleanNumber(form.amount, 0);
  const paymentMode = normalizePaymentMode(form.paymentMode);
  const transactionRef = cleanString(form.transactionRef);
  const bankName = cleanString(form.bankName);

  if (amount <= 0) {
    throw new Error("Payment amount must be greater than zero.");
  }

  if (requiresTransactionRef(paymentMode) && !transactionRef) {
    throw new Error("Transaction reference / UTR number is required.");
  }

  if (requiresBankName(paymentMode) && !bankName) {
    throw new Error("Bank name is required for this payment mode.");
  }

  return true;
}

function shouldMoveLeadToPaymentPending(stage) {
  const normalizedStage = normalizeLeadStage(stage);

  if (isTerminalLeadStage(normalizedStage)) return false;

  return normalizedStage !== LEAD_STAGES.PAYMENT_PENDING;
}

function shouldMoveLeadToConverted(stage) {
  const normalizedStage = normalizeLeadStage(stage);

  if (normalizedStage === LEAD_STAGES.LOST) return false;
  if (normalizedStage === LEAD_STAGES.CONVERTED) return false;

  return !isTerminalLeadStage(normalizedStage);
}

function buildPaymentSummary({
  lead,
  payments
}) {
  const totalReceivableAmount = getLeadReceivableAmount(lead);

  const verifiedPayments = payments.filter(
    payment => payment.status === CUSTOMER_PAYMENT_STATUS.VERIFIED
  );

  const totalPaymentReceived = verifiedPayments.reduce((sum, payment) => {
    return sum + getSignedAmountForCustomerPayment(payment);
  }, 0);

  const paymentBalance = calculateBalance(
    totalReceivableAmount,
    totalPaymentReceived
  );

  const customerPaymentStatus = calculateCustomerPaymentStatus(
    totalReceivableAmount,
    totalPaymentReceived
  );

  const latestPayment =
    [...verifiedPayments].sort(sortByLatestDate)[0] || null;

  const totalVendorPayableAmount = getLeadVendorPayableAmount(lead);
  const totalVendorPaid = cleanNumber(lead.totalVendorPaid, 0);

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
    totalReceivableAmount,
    totalPaymentReceived: Number(totalPaymentReceived.toFixed(2)),
    paymentBalance: Number(paymentBalance.toFixed(2)),
    customerPaymentStatus,

    latestCustomerPaymentId:
      latestPayment?.id || latestPayment?.paymentId || "",
    latestCustomerPaymentAt: latestPayment
      ? getPaymentDateValue(latestPayment)
      : null,
    latestCustomerPaymentAmount: latestPayment
      ? cleanNumber(latestPayment.amount, 0)
      : null,
    latestCustomerPaymentMode: latestPayment?.paymentMode || "",

    totalVendorPayableAmount,
    totalVendorPaid,
    expectedGrossProfit,
    actualGrossProfit,
    pendingProfit
  };
}

/* =========================
   RECALCULATE SUMMARY
========================= */

export async function recalculateCustomerPaymentSummary({
  leadId,
  user = null
}) {
  const cleanLeadId = cleanString(leadId);

  if (!cleanLeadId) {
    throw new Error("Lead ID is required to recalculate customer payments.");
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
    PAYMENT_COLLECTIONS.CUSTOMER_PAYMENTS
  );

  const paymentsSnap = await getDocs(paymentsRef);

  const payments = paymentsSnap.docs.map(paymentDoc => ({
    id: paymentDoc.id,
    paymentId: paymentDoc.id,
    ...paymentDoc.data()
  }));

  const summary = buildPaymentSummary({
    lead,
    payments
  });

  const currentStage = normalizeLeadStage(
    lead.stage || LEAD_STAGES.NEW_ENQUIRY
  );

  const currentStageMeta = getLeadStageMeta(currentStage);

  const leadUpdatePayload = {
    ...summary,

    updatedAt: serverTimestamp(),
    paymentSummaryUpdatedAt: serverTimestamp()
  };

  if (
    summary.customerPaymentStatus !== CUSTOMER_PAYMENT_SUMMARY_STATUS.UNPAID &&
    shouldMoveLeadToConverted(currentStage)
  ) {
    const convertedMeta = getLeadStageMeta(LEAD_STAGES.CONVERTED);

    leadUpdatePayload.previousStage = currentStage;
    leadUpdatePayload.previousStageLabel = currentStageMeta.label;

    leadUpdatePayload.stage = LEAD_STAGES.CONVERTED;
    leadUpdatePayload.stageLabel = convertedMeta.label;
    leadUpdatePayload.status = "converted";

    leadUpdatePayload.convertedAt = serverTimestamp();
    leadUpdatePayload.convertedByUid = getUserUid(user);
    leadUpdatePayload.convertedByName = getUserName(user);
  }

  await updateDoc(leadRef, leadUpdatePayload);

  return {
    leadId: cleanLeadId,
    payments,
    ...summary
  };
}

/* =========================
   CREATE CUSTOMER PAYMENT
========================= */

export async function createCustomerPayment({
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

  validateCustomerPaymentForm(form);

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
  const status = normalizeCustomerPaymentStatus(form.status);

  const userUid = getUserUid(user);
  const userName = getUserName(user);
  const userEmail = getUserEmail(user);

  const payerName =
    cleanString(form.payerName) ||
    cleanString(lead.travelAgentName) ||
    cleanString(lead.agencyName) ||
    cleanString(lead.customerName) ||
    cleanString(lead.travellerName) ||
    "";

  const paymentPayload = {
    leadId: cleanLeadId,
    leadCode: cleanString(lead.leadCode),

    paymentDirection: PAYMENT_DIRECTION.INBOUND,

    payerType: cleanString(form.payerType) || PAYER_TYPES.TRAVEL_AGENT,
    payerName,
    payerMobile: cleanString(form.payerMobile || lead.mobile),
    payerEmail: cleanString(form.payerEmail || lead.email),

    paymentType:
      cleanString(form.paymentType) ||
      CUSTOMER_PAYMENT_TYPES.ADVANCE,

    amount,
    currency,

    paymentMode,
    paymentDate: toTimestamp(form.paymentDate),

    transactionRef: cleanString(form.transactionRef),
    bankName: cleanString(form.bankName),

    receiptUrl: cleanString(form.receiptUrl),
    receiptFileName: cleanString(form.receiptFileName),

    status,

    quotationId: cleanString(
      form.quotationId ||
        lead.finalQuotationId ||
        lead.latestQuotationId
    ),
    quotationRevision:
      cleanNullableNumber(
        form.quotationRevision ||
          lead.finalQuotationRevision ||
          lead.latestQuotationRevision
      ),

    remark: cleanString(form.remark),

    createdByUid: userUid,
    createdByName: userName,
    createdByEmail: userEmail,

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),

    ...(status === CUSTOMER_PAYMENT_STATUS.VERIFIED
      ? {
          verifiedAt: serverTimestamp(),
          verifiedByUid: userUid,
          verifiedByName: userName,
          verifiedByEmail: userEmail
        }
      : {})
  };

  const paymentRef = await addDoc(
    collection(
      db,
      "leads",
      cleanLeadId,
      PAYMENT_COLLECTIONS.CUSTOMER_PAYMENTS
    ),
    paymentPayload
  );

  const currentStage = normalizeLeadStage(
    lead.stage || LEAD_STAGES.NEW_ENQUIRY
  );

  if (
    status === CUSTOMER_PAYMENT_STATUS.PENDING_VERIFICATION &&
    shouldMoveLeadToPaymentPending(currentStage)
  ) {
    const paymentPendingMeta = getLeadStageMeta(LEAD_STAGES.PAYMENT_PENDING);

    await updateDoc(leadRef, {
      previousStage: currentStage,
      previousStageLabel: getLeadStageMeta(currentStage).label,

      stage: LEAD_STAGES.PAYMENT_PENDING,
      stageLabel: paymentPendingMeta.label,
      status: "open",

      latestCustomerPaymentId: paymentRef.id,
      latestCustomerPaymentAmount: amount,
      latestCustomerPaymentMode: paymentMode,
      latestCustomerPaymentAt: paymentPayload.paymentDate,

      lastActivityAt: serverTimestamp(),
      lastActivityType: "customer_payment_added",
      lastActivitySummary: getCustomerPaymentTitle(
        status,
        amount,
        currency
      ),

      updatedAt: serverTimestamp()
    });
  }

  const summary = await recalculateCustomerPaymentSummary({
    leadId: cleanLeadId,
    user
  });

  await logLeadAction({
    leadId: cleanLeadId,
    type: LEAD_TIMELINE_TYPES.PAYMENT || "payment",
    title: getCustomerPaymentTitle(status, amount, currency),
    description:
      cleanString(form.remark) ||
      `Payment received from ${payerName || "travel agent / customer"}.`,
    metadata: {
      action: "customer_payment_created",

      leadId: cleanLeadId,
      paymentId: paymentRef.id,

      paymentDirection: PAYMENT_DIRECTION.INBOUND,

      amount,
      currency,
      paymentMode,
      paymentType: paymentPayload.paymentType,
      status,

      payerType: paymentPayload.payerType,
      payerName,

      transactionRef: paymentPayload.transactionRef,
      bankName: paymentPayload.bankName,

      receiptUrl: paymentPayload.receiptUrl,
      receiptFileName: paymentPayload.receiptFileName,

      quotationId: paymentPayload.quotationId,
      quotationRevision: paymentPayload.quotationRevision,

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
   UPDATE CUSTOMER PAYMENT STATUS
========================= */

export async function updateCustomerPaymentStatus({
  leadId,
  paymentId,
  status,
  remark = "",
  user
}) {
  const cleanLeadId = cleanString(leadId);
  const cleanPaymentId = cleanString(paymentId);

  if (!cleanLeadId) throw new Error("Lead ID is required.");
  if (!cleanPaymentId) throw new Error("Payment ID is required.");
  if (!user) throw new Error("User is required.");

  const safeStatus = normalizeCustomerPaymentStatus(status);

  const paymentRef = doc(
    db,
    "leads",
    cleanLeadId,
    PAYMENT_COLLECTIONS.CUSTOMER_PAYMENTS,
    cleanPaymentId
  );

  const paymentSnap = await getDoc(paymentRef);

  if (!paymentSnap.exists()) {
    throw new Error("Payment entry not found.");
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

  if (safeStatus === CUSTOMER_PAYMENT_STATUS.VERIFIED) {
    statusPayload.verifiedAt = serverTimestamp();
    statusPayload.verifiedByUid = userUid;
    statusPayload.verifiedByName = userName;
    statusPayload.verifiedByEmail = userEmail;
  }

  if (safeStatus === CUSTOMER_PAYMENT_STATUS.REJECTED) {
    statusPayload.rejectedAt = serverTimestamp();
    statusPayload.rejectedByUid = userUid;
    statusPayload.rejectedByName = userName;
    statusPayload.rejectedByEmail = userEmail;
  }

  if (safeStatus === CUSTOMER_PAYMENT_STATUS.CANCELLED) {
    statusPayload.cancelledAt = serverTimestamp();
    statusPayload.cancelledByUid = userUid;
    statusPayload.cancelledByName = userName;
    statusPayload.cancelledByEmail = userEmail;
  }

  await updateDoc(paymentRef, statusPayload);

  const summary = await recalculateCustomerPaymentSummary({
    leadId: cleanLeadId,
    user
  });

  const amount = cleanNumber(existingPayment.amount, 0);
  const currency = existingPayment.currency || DEFAULT_CURRENCY;

  await logLeadAction({
    leadId: cleanLeadId,
    type: LEAD_TIMELINE_TYPES.PAYMENT || "payment",
    title:
      safeStatus === CUSTOMER_PAYMENT_STATUS.VERIFIED
        ? `Payment verified - ${currency} ${amount.toLocaleString("en-IN")}`
        : safeStatus === CUSTOMER_PAYMENT_STATUS.REJECTED
          ? `Payment rejected - ${currency} ${amount.toLocaleString("en-IN")}`
          : safeStatus === CUSTOMER_PAYMENT_STATUS.CANCELLED
            ? `Payment cancelled - ${currency} ${amount.toLocaleString("en-IN")}`
            : `Payment status updated - ${currency} ${amount.toLocaleString("en-IN")}`,
    description: cleanString(remark) || "Customer payment status updated.",
    metadata: {
      action: "customer_payment_status_updated",

      leadId: cleanLeadId,
      paymentId: cleanPaymentId,

      previousStatus: existingPayment.status,
      status: safeStatus,

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

export async function verifyCustomerPayment({
  leadId,
  paymentId,
  remark = "",
  user
}) {
  return updateCustomerPaymentStatus({
    leadId,
    paymentId,
    status: CUSTOMER_PAYMENT_STATUS.VERIFIED,
    remark,
    user
  });
}

export async function rejectCustomerPayment({
  leadId,
  paymentId,
  remark = "",
  user
}) {
  return updateCustomerPaymentStatus({
    leadId,
    paymentId,
    status: CUSTOMER_PAYMENT_STATUS.REJECTED,
    remark,
    user
  });
}

export async function cancelCustomerPayment({
  leadId,
  paymentId,
  remark = "",
  user
}) {
  return updateCustomerPaymentStatus({
    leadId,
    paymentId,
    status: CUSTOMER_PAYMENT_STATUS.CANCELLED,
    remark,
    user
  });
}

/* =========================
   LIST CUSTOMER PAYMENTS
========================= */

export async function getCustomerPayments({ leadId }) {
  const cleanLeadId = cleanString(leadId);

  if (!cleanLeadId) return [];

  const paymentsRef = collection(
    db,
    "leads",
    cleanLeadId,
    PAYMENT_COLLECTIONS.CUSTOMER_PAYMENTS
  );

  const q = query(paymentsRef, orderBy("createdAt", "desc"));
  const snap = await getDocs(q);

  return snap.docs.map(paymentDoc => ({
    id: paymentDoc.id,
    paymentId: paymentDoc.id,
    ...paymentDoc.data()
  }));
}

export default createCustomerPayment;