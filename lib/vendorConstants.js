// lib/vendorConstants.js

/* =========================
   VENDOR MASTER
========================= */

export const VENDOR_TYPES = {
  DMC: "dmc",
  HOTEL: "hotel",
  TRANSPORT: "transport",
  ACTIVITY: "activity",
  VISA: "visa",
  INSURANCE: "insurance",
  FLIGHT: "flight",
  OTHER: "other"
};

export const VENDOR_TYPE_OPTIONS = [
  { value: VENDOR_TYPES.DMC, label: "DMC / Destination Partner" },
  { value: VENDOR_TYPES.HOTEL, label: "Hotel / Resort" },
  { value: VENDOR_TYPES.TRANSPORT, label: "Transport Partner" },
  { value: VENDOR_TYPES.ACTIVITY, label: "Activity Partner" },
  { value: VENDOR_TYPES.VISA, label: "Visa Partner" },
  { value: VENDOR_TYPES.INSURANCE, label: "Insurance Partner" },
  { value: VENDOR_TYPES.FLIGHT, label: "Flight Partner" },
  { value: VENDOR_TYPES.OTHER, label: "Other" }
];

export const VENDOR_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  BLACKLISTED: "blacklisted"
};

export const VENDOR_STATUS_OPTIONS = [
  { value: VENDOR_STATUS.ACTIVE, label: "Active", tone: "green" },
  { value: VENDOR_STATUS.INACTIVE, label: "Inactive", tone: "gray" },
  { value: VENDOR_STATUS.BLACKLISTED, label: "Blacklisted", tone: "red" }
];

/* =========================
   LEAD VENDOR REQUEST
========================= */

export const VENDOR_REQUEST_STATUS = {
  DRAFT: "draft",
  SENT: "sent",
  FOLLOW_UP_PENDING: "follow_up_pending",
  QUOTE_RECEIVED: "quote_received",
  REVISION_REQUESTED: "revision_requested",
  REVISED_QUOTE_RECEIVED: "revised_quote_received",
  SELECTED: "selected",
  REJECTED: "rejected",
  CANCELLED: "cancelled"
};

export const VENDOR_REQUEST_STATUS_OPTIONS = [
  { value: VENDOR_REQUEST_STATUS.DRAFT, label: "Draft", tone: "gray" },
  { value: VENDOR_REQUEST_STATUS.SENT, label: "Sent to vendor", tone: "blue" },
  {
    value: VENDOR_REQUEST_STATUS.QUOTE_RECEIVED,
    label: "Quote received",
    tone: "green"
  },
  {
    value: VENDOR_REQUEST_STATUS.REVISION_REQUESTED,
    label: "Revision requested",
    tone: "orange"
  },
  {
    value: VENDOR_REQUEST_STATUS.REVISED_QUOTE_RECEIVED,
    label: "Revised quote received",
    tone: "purple"
  },
  {
    value: VENDOR_REQUEST_STATUS.FOLLOW_UP_PENDING,
    label: "Follow-up pending",
    tone: "amber"
  },
  { value: VENDOR_REQUEST_STATUS.SELECTED, label: "Selected", tone: "green" },
  { value: VENDOR_REQUEST_STATUS.REJECTED, label: "Rejected", tone: "red" },
  { value: VENDOR_REQUEST_STATUS.CANCELLED, label: "Cancelled", tone: "gray" }
];

/* =========================
   VENDOR QUOTE REVISION
========================= */

export const VENDOR_QUOTE_STATUS = {
  RECEIVED: "received",
  REVISED: "revised",
  SHORTLISTED: "shortlisted",
  SELECTED: "selected",
  REJECTED: "rejected"
};

export const VENDOR_QUOTE_STATUS_OPTIONS = [
  { value: VENDOR_QUOTE_STATUS.RECEIVED, label: "Received", tone: "blue" },
  { value: VENDOR_QUOTE_STATUS.REVISED, label: "Revised", tone: "purple" },
  {
    value: VENDOR_QUOTE_STATUS.SHORTLISTED,
    label: "Shortlisted",
    tone: "amber"
  },
  { value: VENDOR_QUOTE_STATUS.SELECTED, label: "Selected", tone: "green" },
  { value: VENDOR_QUOTE_STATUS.REJECTED, label: "Rejected", tone: "red" }
];

/* =========================
   PAYMENT STATUS
========================= */

export const PAYMENT_STATUS = {
  PENDING: "pending",
  PARTIAL: "partial",
  PAID: "paid",
  OVERDUE: "overdue"
};

export const PAYMENT_STATUS_OPTIONS = [
  { value: PAYMENT_STATUS.PENDING, label: "Pending", tone: "amber" },
  { value: PAYMENT_STATUS.PARTIAL, label: "Partial", tone: "blue" },
  { value: PAYMENT_STATUS.PAID, label: "Paid", tone: "green" },
  { value: PAYMENT_STATUS.OVERDUE, label: "Overdue", tone: "red" }
];


/* =========================
   VENDOR DOCUMENT TYPES
========================= */

export const VENDOR_DOCUMENT_TYPES = {
  AGREEMENT: "agreement",
  GST_CERTIFICATE: "gst_certificate",
  PAN_CARD: "pan_card",
  BANK_PROOF: "bank_proof",
  AUTHORIZATION_LETTER: "authorization_letter",
  RATE_CONTRACT: "rate_contract",
  OTHER: "other"
};

export const VENDOR_DOCUMENT_TYPE_OPTIONS = [
  {
    value: VENDOR_DOCUMENT_TYPES.AGREEMENT,
    label: "Vendor Agreement"
  },
  {
    value: VENDOR_DOCUMENT_TYPES.GST_CERTIFICATE,
    label: "GST Certificate"
  },
  {
    value: VENDOR_DOCUMENT_TYPES.PAN_CARD,
    label: "PAN Card"
  },
  {
    value: VENDOR_DOCUMENT_TYPES.BANK_PROOF,
    label: "Bank Proof / Cancelled Cheque"
  },
  {
    value: VENDOR_DOCUMENT_TYPES.AUTHORIZATION_LETTER,
    label: "Authorization Letter"
  },
  {
    value: VENDOR_DOCUMENT_TYPES.RATE_CONTRACT,
    label: "Rate Contract"
  },
  {
    value: VENDOR_DOCUMENT_TYPES.OTHER,
    label: "Other"
  }
];

export function getVendorDocumentTypeLabel(type = "") {
  return (
    VENDOR_DOCUMENT_TYPE_OPTIONS.find(item => item.value === type)?.label ||
    String(type || "Other").replaceAll("_", " ")
  );
}

/* =========================
   HELPERS
========================= */

export function getVendorTypeLabel(type = "") {
  return (
    VENDOR_TYPE_OPTIONS.find(item => item.value === type)?.label ||
    String(type || "Unknown").replaceAll("_", " ")
  );
}

export function getVendorStatusMeta(status = "") {
  return (
    VENDOR_STATUS_OPTIONS.find(item => item.value === status) || {
      value: status || VENDOR_STATUS.INACTIVE,
      label: String(status || "Inactive").replaceAll("_", " "),
      tone: "gray"
    }
  );
}

export function getVendorRequestStatusMeta(status = "") {
  return (
    VENDOR_REQUEST_STATUS_OPTIONS.find(item => item.value === status) || {
      value: status || VENDOR_REQUEST_STATUS.DRAFT,
      label: String(status || "Draft").replaceAll("_", " "),
      tone: "gray"
    }
  );
}

export function getVendorQuoteStatusMeta(status = "") {
  return (
    VENDOR_QUOTE_STATUS_OPTIONS.find(item => item.value === status) || {
      value: status || VENDOR_QUOTE_STATUS.RECEIVED,
      label: String(status || "Received").replaceAll("_", " "),
      tone: "gray"
    }
  );
}

export function getPaymentStatusMeta(status = "") {
  return (
    PAYMENT_STATUS_OPTIONS.find(item => item.value === status) || {
      value: status || PAYMENT_STATUS.PENDING,
      label: String(status || "Pending").replaceAll("_", " "),
      tone: "gray"
    }
  );
}