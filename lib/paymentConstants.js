// lib/paymentConstants.js

/* =========================
   COLLECTIONS
========================= */

export const PAYMENT_COLLECTIONS = {
  CUSTOMER_PAYMENTS: "customerPayments",
  VENDOR_PAYMENTS: "vendorPayments"
};

export const PAYMENT_STORAGE_PATHS = {
  CUSTOMER_RECEIPTS: "lead-payments/customer-receipts",
  VENDOR_PROOFS: "lead-payments/vendor-proofs"
};

/* =========================
   PAYMENT DIRECTION
========================= */

export const PAYMENT_DIRECTION = {
  INBOUND: "inbound",
  OUTBOUND: "outbound"
};

export const PAYMENT_DIRECTION_OPTIONS = [
  {
    value: PAYMENT_DIRECTION.INBOUND,
    label: "Payment Received",
    description: "Money received from travel agent / customer",
    tone: "green"
  },
  {
    value: PAYMENT_DIRECTION.OUTBOUND,
    label: "Vendor Payment Sent",
    description: "Money paid to vendor",
    tone: "purple"
  }
];

/* =========================
   PAYER / PAYEE TYPES
========================= */

export const PAYER_TYPES = {
  TRAVEL_AGENT: "travel_agent",
  CUSTOMER: "customer",
  CORPORATE: "corporate",
  OTHER: "other"
};

export const PAYER_TYPE_OPTIONS = [
  {
    value: PAYER_TYPES.TRAVEL_AGENT,
    label: "Travel Agent"
  },
  {
    value: PAYER_TYPES.CUSTOMER,
    label: "Customer"
  },
  {
    value: PAYER_TYPES.CORPORATE,
    label: "Corporate"
  },
  {
    value: PAYER_TYPES.OTHER,
    label: "Other"
  }
];

export const PAYEE_TYPES = {
  VENDOR: "vendor",
  HOTEL: "hotel",
  TRANSPORT: "transport",
  ACTIVITY: "activity",
  GUIDE: "guide",
  OTHER: "other"
};

export const PAYEE_TYPE_OPTIONS = [
  {
    value: PAYEE_TYPES.VENDOR,
    label: "Vendor"
  },
  {
    value: PAYEE_TYPES.HOTEL,
    label: "Hotel"
  },
  {
    value: PAYEE_TYPES.TRANSPORT,
    label: "Transport"
  },
  {
    value: PAYEE_TYPES.ACTIVITY,
    label: "Activity Supplier"
  },
  {
    value: PAYEE_TYPES.GUIDE,
    label: "Guide"
  },
  {
    value: PAYEE_TYPES.OTHER,
    label: "Other"
  }
];

/* =========================
   CUSTOMER PAYMENT TYPES
========================= */

export const CUSTOMER_PAYMENT_TYPES = {
  ADVANCE: "advance",
  PART_PAYMENT: "part_payment",
  FULL_PAYMENT: "full_payment",
  BALANCE_PAYMENT: "balance_payment",
  REFUND_ADJUSTMENT: "refund_adjustment",
  DISCOUNT_ADJUSTMENT: "discount_adjustment",
  OTHER: "other"
};

export const CUSTOMER_PAYMENT_TYPE_OPTIONS = [
  {
    value: CUSTOMER_PAYMENT_TYPES.ADVANCE,
    label: "Advance Payment",
    description: "Initial booking advance received",
    tone: "blue"
  },
  {
    value: CUSTOMER_PAYMENT_TYPES.PART_PAYMENT,
    label: "Part Payment",
    description: "Partial payment received",
    tone: "amber"
  },
  {
    value: CUSTOMER_PAYMENT_TYPES.FULL_PAYMENT,
    label: "Full Payment",
    description: "Complete payment received",
    tone: "green"
  },
  {
    value: CUSTOMER_PAYMENT_TYPES.BALANCE_PAYMENT,
    label: "Balance Payment",
    description: "Remaining amount received",
    tone: "green"
  },
  {
    value: CUSTOMER_PAYMENT_TYPES.REFUND_ADJUSTMENT,
    label: "Refund Adjustment",
    description: "Refund or negative adjustment",
    tone: "red"
  },
  {
    value: CUSTOMER_PAYMENT_TYPES.DISCOUNT_ADJUSTMENT,
    label: "Discount Adjustment",
    description: "Discount adjusted against receivable",
    tone: "slate"
  },
  {
    value: CUSTOMER_PAYMENT_TYPES.OTHER,
    label: "Other",
    description: "Other payment entry",
    tone: "gray"
  }
];

/* =========================
   VENDOR PAYMENT TYPES
========================= */

export const VENDOR_PAYMENT_TYPES = {
  ADVANCE: "advance",
  PART_PAYMENT: "part_payment",
  FULL_PAYMENT: "full_payment",
  BALANCE_PAYMENT: "balance_payment",
  REFUND_RECEIVED: "refund_received",
  ADJUSTMENT: "adjustment",
  OTHER: "other"
};

export const VENDOR_PAYMENT_TYPE_OPTIONS = [
  {
    value: VENDOR_PAYMENT_TYPES.ADVANCE,
    label: "Vendor Advance",
    description: "Advance paid to vendor",
    tone: "blue"
  },
  {
    value: VENDOR_PAYMENT_TYPES.PART_PAYMENT,
    label: "Vendor Part Payment",
    description: "Partial payment sent to vendor",
    tone: "amber"
  },
  {
    value: VENDOR_PAYMENT_TYPES.FULL_PAYMENT,
    label: "Vendor Full Payment",
    description: "Full payment sent to vendor",
    tone: "green"
  },
  {
    value: VENDOR_PAYMENT_TYPES.BALANCE_PAYMENT,
    label: "Vendor Balance Payment",
    description: "Remaining payment sent to vendor",
    tone: "green"
  },
  {
    value: VENDOR_PAYMENT_TYPES.REFUND_RECEIVED,
    label: "Vendor Refund Received",
    description: "Refund received back from vendor",
    tone: "red"
  },
  {
    value: VENDOR_PAYMENT_TYPES.ADJUSTMENT,
    label: "Adjustment",
    description: "Vendor payable adjustment",
    tone: "slate"
  },
  {
    value: VENDOR_PAYMENT_TYPES.OTHER,
    label: "Other",
    description: "Other vendor payment entry",
    tone: "gray"
  }
];

/* =========================
   PAYMENT MODES
========================= */

export const PAYMENT_MODES = {
  CASH: "cash",
  BANK_TRANSFER: "bank_transfer",
  UPI: "upi",
  CHEQUE: "cheque",
  CARD: "card",
  OTHER: "other"
};

export const PAYMENT_MODE_OPTIONS = [
  {
    value: PAYMENT_MODES.CASH,
    label: "Cash",
    requiresTransactionRef: false,
    requiresBankName: false
  },
  {
    value: PAYMENT_MODES.BANK_TRANSFER,
    label: "Bank Transfer",
    requiresTransactionRef: true,
    requiresBankName: true
  },
  {
    value: PAYMENT_MODES.UPI,
    label: "UPI",
    requiresTransactionRef: true,
    requiresBankName: false
  },
  {
    value: PAYMENT_MODES.CHEQUE,
    label: "Cheque",
    requiresTransactionRef: true,
    requiresBankName: true
  },
  {
    value: PAYMENT_MODES.CARD,
    label: "Card",
    requiresTransactionRef: true,
    requiresBankName: false
  },
  {
    value: PAYMENT_MODES.OTHER,
    label: "Other",
    requiresTransactionRef: false,
    requiresBankName: false
  }
];

/* =========================
   CUSTOMER PAYMENT STATUS
========================= */

export const CUSTOMER_PAYMENT_STATUS = {
  PENDING_VERIFICATION: "pending_verification",
  VERIFIED: "verified",
  REJECTED: "rejected",
  CANCELLED: "cancelled"
};

export const CUSTOMER_PAYMENT_STATUS_OPTIONS = [
  {
    value: CUSTOMER_PAYMENT_STATUS.PENDING_VERIFICATION,
    label: "Pending Verification",
    tone: "amber",
    description: "Payment entered but not verified yet"
  },
  {
    value: CUSTOMER_PAYMENT_STATUS.VERIFIED,
    label: "Verified",
    tone: "green",
    description: "Payment verified and counted as received"
  },
  {
    value: CUSTOMER_PAYMENT_STATUS.REJECTED,
    label: "Rejected",
    tone: "red",
    description: "Payment rejected after review"
  },
  {
    value: CUSTOMER_PAYMENT_STATUS.CANCELLED,
    label: "Cancelled",
    tone: "gray",
    description: "Payment entry cancelled"
  }
];

/* =========================
   VENDOR PAYMENT STATUS
========================= */

export const VENDOR_PAYMENT_STATUS = {
  PENDING: "pending",
  PAID: "paid",
  CANCELLED: "cancelled"
};

export const VENDOR_PAYMENT_STATUS_OPTIONS = [
  {
    value: VENDOR_PAYMENT_STATUS.PENDING,
    label: "Pending",
    tone: "amber",
    description: "Vendor payment planned but not paid yet"
  },
  {
    value: VENDOR_PAYMENT_STATUS.PAID,
    label: "Paid",
    tone: "green",
    description: "Vendor payment completed"
  },
  {
    value: VENDOR_PAYMENT_STATUS.CANCELLED,
    label: "Cancelled",
    tone: "gray",
    description: "Vendor payment entry cancelled"
  }
];

/* =========================
   SUMMARY STATUS
========================= */

export const CUSTOMER_PAYMENT_SUMMARY_STATUS = {
  UNPAID: "unpaid",
  PARTIAL_PAID: "partial_paid",
  FULLY_PAID: "fully_paid",
  EXCESS_PAID: "excess_paid"
};

export const CUSTOMER_PAYMENT_SUMMARY_STATUS_OPTIONS = [
  {
    value: CUSTOMER_PAYMENT_SUMMARY_STATUS.UNPAID,
    label: "Unpaid",
    tone: "red"
  },
  {
    value: CUSTOMER_PAYMENT_SUMMARY_STATUS.PARTIAL_PAID,
    label: "Partial Paid",
    tone: "amber"
  },
  {
    value: CUSTOMER_PAYMENT_SUMMARY_STATUS.FULLY_PAID,
    label: "Fully Paid",
    tone: "green"
  },
  {
    value: CUSTOMER_PAYMENT_SUMMARY_STATUS.EXCESS_PAID,
    label: "Excess Paid",
    tone: "purple"
  }
];

export const VENDOR_PAYMENT_SUMMARY_STATUS = {
  UNPAID: "unpaid",
  PARTIAL_PAID: "partial_paid",
  FULLY_PAID: "fully_paid",
  EXCESS_PAID: "excess_paid"
};

export const VENDOR_PAYMENT_SUMMARY_STATUS_OPTIONS = [
  {
    value: VENDOR_PAYMENT_SUMMARY_STATUS.UNPAID,
    label: "Vendor Unpaid",
    tone: "red"
  },
  {
    value: VENDOR_PAYMENT_SUMMARY_STATUS.PARTIAL_PAID,
    label: "Vendor Partial Paid",
    tone: "amber"
  },
  {
    value: VENDOR_PAYMENT_SUMMARY_STATUS.FULLY_PAID,
    label: "Vendor Fully Paid",
    tone: "green"
  },
  {
    value: VENDOR_PAYMENT_SUMMARY_STATUS.EXCESS_PAID,
    label: "Vendor Excess Paid",
    tone: "purple"
  }
];

/* =========================
   LEDGER TYPES
========================= */

export const PAYMENT_LEDGER_TYPES = {
  CUSTOMER_PAYMENT_RECEIVED: "customer_payment_received",
  CUSTOMER_PAYMENT_VERIFIED: "customer_payment_verified",
  CUSTOMER_PAYMENT_REJECTED: "customer_payment_rejected",
  VENDOR_PAYMENT_CREATED: "vendor_payment_created",
  VENDOR_PAYMENT_PAID: "vendor_payment_paid",
  VENDOR_PAYMENT_CANCELLED: "vendor_payment_cancelled"
};

export const PAYMENT_LEDGER_TYPE_OPTIONS = [
  {
    value: PAYMENT_LEDGER_TYPES.CUSTOMER_PAYMENT_RECEIVED,
    label: "Customer Payment Received",
    tone: "green"
  },
  {
    value: PAYMENT_LEDGER_TYPES.CUSTOMER_PAYMENT_VERIFIED,
    label: "Customer Payment Verified",
    tone: "green"
  },
  {
    value: PAYMENT_LEDGER_TYPES.CUSTOMER_PAYMENT_REJECTED,
    label: "Customer Payment Rejected",
    tone: "red"
  },
  {
    value: PAYMENT_LEDGER_TYPES.VENDOR_PAYMENT_CREATED,
    label: "Vendor Payment Created",
    tone: "purple"
  },
  {
    value: PAYMENT_LEDGER_TYPES.VENDOR_PAYMENT_PAID,
    label: "Vendor Payment Paid",
    tone: "green"
  },
  {
    value: PAYMENT_LEDGER_TYPES.VENDOR_PAYMENT_CANCELLED,
    label: "Vendor Payment Cancelled",
    tone: "gray"
  }
];

/* =========================
   DEFAULTS
========================= */

export const DEFAULT_CURRENCY = "INR";

export const DEFAULT_CUSTOMER_PAYMENT_FORM = {
  payerType: PAYER_TYPES.TRAVEL_AGENT,
  payerName: "",
  payerMobile: "",
  payerEmail: "",

  paymentType: CUSTOMER_PAYMENT_TYPES.ADVANCE,
  amount: "",
  currency: DEFAULT_CURRENCY,

  paymentMode: PAYMENT_MODES.BANK_TRANSFER,
  paymentDate: "",
  transactionRef: "",
  bankName: "",

  receiptUrl: "",
  receiptFileName: "",

  status: CUSTOMER_PAYMENT_STATUS.VERIFIED,

  remark: ""
};

export const DEFAULT_VENDOR_PAYMENT_FORM = {
  payeeType: PAYEE_TYPES.VENDOR,

  vendorId: "",
  vendorName: "",
  vendorRequestId: "",
  vendorQuoteId: "",

  paymentType: VENDOR_PAYMENT_TYPES.ADVANCE,
  amount: "",
  currency: DEFAULT_CURRENCY,

  paymentMode: PAYMENT_MODES.BANK_TRANSFER,
  paymentDate: "",
  transactionRef: "",
  bankName: "",

  paymentProofUrl: "",
  paymentProofFileName: "",

  status: VENDOR_PAYMENT_STATUS.PAID,

  remark: ""
};

/* =========================
   HELPERS
========================= */

function cleanString(value = "") {
  return String(value || "").trim();
}

function getNumber(value, fallback = 0) {
  const number = Number(value);

  if (!Number.isFinite(number)) return fallback;

  return number;
}

function findOption(options = [], value = "") {
  const cleanValue = cleanString(value);

  return (
    options.find(item => item.value === cleanValue) ||
    options[0] ||
    null
  );
}

export function getOptionLabel(options = [], value = "", fallback = "—") {
  const option = findOption(options, value);

  return option?.label || fallback;
}

export function getOptionTone(options = [], value = "", fallback = "gray") {
  const option = findOption(options, value);

  return option?.tone || fallback;
}

export function getPaymentModeMeta(value) {
  return findOption(PAYMENT_MODE_OPTIONS, value);
}

export function getPaymentModeLabel(value) {
  return getOptionLabel(PAYMENT_MODE_OPTIONS, value, "Payment Mode");
}

export function getCustomerPaymentTypeMeta(value) {
  return findOption(CUSTOMER_PAYMENT_TYPE_OPTIONS, value);
}

export function getCustomerPaymentTypeLabel(value) {
  return getOptionLabel(
    CUSTOMER_PAYMENT_TYPE_OPTIONS,
    value,
    "Payment"
  );
}

export function getVendorPaymentTypeMeta(value) {
  return findOption(VENDOR_PAYMENT_TYPE_OPTIONS, value);
}

export function getVendorPaymentTypeLabel(value) {
  return getOptionLabel(
    VENDOR_PAYMENT_TYPE_OPTIONS,
    value,
    "Vendor Payment"
  );
}

export function getCustomerPaymentStatusMeta(value) {
  return findOption(CUSTOMER_PAYMENT_STATUS_OPTIONS, value);
}

export function getCustomerPaymentStatusLabel(value) {
  return getOptionLabel(
    CUSTOMER_PAYMENT_STATUS_OPTIONS,
    value,
    "Status"
  );
}

export function getVendorPaymentStatusMeta(value) {
  return findOption(VENDOR_PAYMENT_STATUS_OPTIONS, value);
}

export function getVendorPaymentStatusLabel(value) {
  return getOptionLabel(
    VENDOR_PAYMENT_STATUS_OPTIONS,
    value,
    "Status"
  );
}

export function getCustomerPaymentSummaryStatusMeta(value) {
  return findOption(CUSTOMER_PAYMENT_SUMMARY_STATUS_OPTIONS, value);
}

export function getVendorPaymentSummaryStatusMeta(value) {
  return findOption(VENDOR_PAYMENT_SUMMARY_STATUS_OPTIONS, value);
}

export function getPaymentDirectionMeta(value) {
  return findOption(PAYMENT_DIRECTION_OPTIONS, value);
}

export function getPaymentLedgerTypeMeta(value) {
  return findOption(PAYMENT_LEDGER_TYPE_OPTIONS, value);
}

export function normalizePaymentMode(value) {
  const cleanValue = cleanString(value);

  if (PAYMENT_MODE_OPTIONS.some(item => item.value === cleanValue)) {
    return cleanValue;
  }

  return PAYMENT_MODES.BANK_TRANSFER;
}

export function normalizeCustomerPaymentStatus(value) {
  const cleanValue = cleanString(value);

  if (
    CUSTOMER_PAYMENT_STATUS_OPTIONS.some(
      item => item.value === cleanValue
    )
  ) {
    return cleanValue;
  }

  return CUSTOMER_PAYMENT_STATUS.VERIFIED;
}

export function normalizeVendorPaymentStatus(value) {
  const cleanValue = cleanString(value);

  if (
    VENDOR_PAYMENT_STATUS_OPTIONS.some(
      item => item.value === cleanValue
    )
  ) {
    return cleanValue;
  }

  return VENDOR_PAYMENT_STATUS.PAID;
}

export function isVerifiedCustomerPayment(payment) {
  return payment?.status === CUSTOMER_PAYMENT_STATUS.VERIFIED;
}

export function isRejectedCustomerPayment(payment) {
  return payment?.status === CUSTOMER_PAYMENT_STATUS.REJECTED;
}

export function isPaidVendorPayment(payment) {
  return payment?.status === VENDOR_PAYMENT_STATUS.PAID;
}

export function isCancelledVendorPayment(payment) {
  return payment?.status === VENDOR_PAYMENT_STATUS.CANCELLED;
}

export function isCashPayment(paymentMode) {
  return cleanString(paymentMode) === PAYMENT_MODES.CASH;
}

export function isBankTransferPayment(paymentMode) {
  return cleanString(paymentMode) === PAYMENT_MODES.BANK_TRANSFER;
}

export function requiresTransactionRef(paymentMode) {
  const meta = getPaymentModeMeta(paymentMode);

  return Boolean(meta?.requiresTransactionRef);
}

export function requiresBankName(paymentMode) {
  const meta = getPaymentModeMeta(paymentMode);

  return Boolean(meta?.requiresBankName);
}

export function calculateBalance(totalAmount, paidAmount) {
  const total = getNumber(totalAmount, 0);
  const paid = getNumber(paidAmount, 0);

  return Number((total - paid).toFixed(2));
}

export function calculateCustomerPaymentStatus(totalAmount, paidAmount) {
  const total = getNumber(totalAmount, 0);
  const paid = getNumber(paidAmount, 0);

  if (total <= 0 && paid <= 0) {
    return CUSTOMER_PAYMENT_SUMMARY_STATUS.UNPAID;
  }

  if (paid <= 0) {
    return CUSTOMER_PAYMENT_SUMMARY_STATUS.UNPAID;
  }

  if (paid > total) {
    return CUSTOMER_PAYMENT_SUMMARY_STATUS.EXCESS_PAID;
  }

  if (paid >= total) {
    return CUSTOMER_PAYMENT_SUMMARY_STATUS.FULLY_PAID;
  }

  return CUSTOMER_PAYMENT_SUMMARY_STATUS.PARTIAL_PAID;
}

export function calculateVendorPaymentStatus(totalAmount, paidAmount) {
  const total = getNumber(totalAmount, 0);
  const paid = getNumber(paidAmount, 0);

  if (total <= 0 && paid <= 0) {
    return VENDOR_PAYMENT_SUMMARY_STATUS.UNPAID;
  }

  if (paid <= 0) {
    return VENDOR_PAYMENT_SUMMARY_STATUS.UNPAID;
  }

  if (paid > total) {
    return VENDOR_PAYMENT_SUMMARY_STATUS.EXCESS_PAID;
  }

  if (paid >= total) {
    return VENDOR_PAYMENT_SUMMARY_STATUS.FULLY_PAID;
  }

  return VENDOR_PAYMENT_SUMMARY_STATUS.PARTIAL_PAID;
}

export function getSignedAmountForCustomerPayment(payment) {
  const amount = getNumber(payment?.amount, 0);
  const type = cleanString(payment?.paymentType);

  if (type === CUSTOMER_PAYMENT_TYPES.REFUND_ADJUSTMENT) {
    return -Math.abs(amount);
  }

  return amount;
}

export function getSignedAmountForVendorPayment(payment) {
  const amount = getNumber(payment?.amount, 0);
  const type = cleanString(payment?.paymentType);

  if (type === VENDOR_PAYMENT_TYPES.REFUND_RECEIVED) {
    return -Math.abs(amount);
  }

  return amount;
}

export function getPaymentToneClass(tone = "gray") {
  const cleanTone = cleanString(tone);

  const toneMap = {
    green: "bg-green-50 text-green-700 border-green-100",
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    purple: "bg-purple-50 text-purple-700 border-purple-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    red: "bg-red-50 text-red-700 border-red-100",
    slate: "bg-slate-50 text-slate-700 border-slate-100",
    gray: "bg-gray-50 text-gray-700 border-gray-100"
  };

  return toneMap[cleanTone] || toneMap.gray;
}

export default {
  PAYMENT_COLLECTIONS,
  PAYMENT_STORAGE_PATHS,

  PAYMENT_DIRECTION,
  PAYMENT_DIRECTION_OPTIONS,

  PAYER_TYPES,
  PAYER_TYPE_OPTIONS,

  PAYEE_TYPES,
  PAYEE_TYPE_OPTIONS,

  CUSTOMER_PAYMENT_TYPES,
  CUSTOMER_PAYMENT_TYPE_OPTIONS,

  VENDOR_PAYMENT_TYPES,
  VENDOR_PAYMENT_TYPE_OPTIONS,

  PAYMENT_MODES,
  PAYMENT_MODE_OPTIONS,

  CUSTOMER_PAYMENT_STATUS,
  CUSTOMER_PAYMENT_STATUS_OPTIONS,

  VENDOR_PAYMENT_STATUS,
  VENDOR_PAYMENT_STATUS_OPTIONS,

  CUSTOMER_PAYMENT_SUMMARY_STATUS,
  CUSTOMER_PAYMENT_SUMMARY_STATUS_OPTIONS,

  VENDOR_PAYMENT_SUMMARY_STATUS,
  VENDOR_PAYMENT_SUMMARY_STATUS_OPTIONS,

  PAYMENT_LEDGER_TYPES,
  PAYMENT_LEDGER_TYPE_OPTIONS,

  DEFAULT_CURRENCY,
  DEFAULT_CUSTOMER_PAYMENT_FORM,
  DEFAULT_VENDOR_PAYMENT_FORM
};