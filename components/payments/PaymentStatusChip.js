"use client";

import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Ban,
  CheckCircle,
  CircleDollarSign,
  Clock3,
  XCircle
} from "lucide-react";

import {
  CUSTOMER_PAYMENT_STATUS,
  CUSTOMER_PAYMENT_SUMMARY_STATUS,
  VENDOR_PAYMENT_STATUS,
  VENDOR_PAYMENT_SUMMARY_STATUS,
  PAYMENT_DIRECTION,
  getCustomerPaymentStatusMeta,
  getVendorPaymentStatusMeta,
  getCustomerPaymentSummaryStatusMeta,
  getVendorPaymentSummaryStatusMeta,
  getPaymentDirectionMeta,
  getPaymentLedgerTypeMeta,
  getPaymentToneClass
} from "@/lib/paymentConstants";

/* =========================
   HELPERS
========================= */

function cleanString(value = "") {
  return String(value || "").trim();
}

function humanize(value = "") {
  return cleanString(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, char => char.toUpperCase());
}

function getChipMeta({ type, status }) {
  if (type === "customer") {
    return getCustomerPaymentStatusMeta(status);
  }

  if (type === "vendor") {
    return getVendorPaymentStatusMeta(status);
  }

  if (type === "customer_summary") {
    return getCustomerPaymentSummaryStatusMeta(status);
  }

  if (type === "vendor_summary") {
    return getVendorPaymentSummaryStatusMeta(status);
  }

  if (type === "direction") {
    return getPaymentDirectionMeta(status);
  }

  if (type === "ledger") {
    return getPaymentLedgerTypeMeta(status);
  }

  return null;
}

function getIcon({ type, status }) {
  const cleanStatus = cleanString(status);

  if (type === "direction") {
    if (cleanStatus === PAYMENT_DIRECTION.INBOUND) return ArrowDownCircle;
    if (cleanStatus === PAYMENT_DIRECTION.OUTBOUND) return ArrowUpCircle;
  }

  if (
    cleanStatus === CUSTOMER_PAYMENT_STATUS.VERIFIED ||
    cleanStatus === VENDOR_PAYMENT_STATUS.PAID ||
    cleanStatus === CUSTOMER_PAYMENT_SUMMARY_STATUS.FULLY_PAID ||
    cleanStatus === VENDOR_PAYMENT_SUMMARY_STATUS.FULLY_PAID
  ) {
    return CheckCircle;
  }

  if (
    cleanStatus === CUSTOMER_PAYMENT_STATUS.PENDING_VERIFICATION ||
    cleanStatus === VENDOR_PAYMENT_STATUS.PENDING ||
    cleanStatus === CUSTOMER_PAYMENT_SUMMARY_STATUS.PARTIAL_PAID ||
    cleanStatus === VENDOR_PAYMENT_SUMMARY_STATUS.PARTIAL_PAID
  ) {
    return Clock3;
  }

  if (
    cleanStatus === CUSTOMER_PAYMENT_STATUS.REJECTED ||
    cleanStatus === CUSTOMER_PAYMENT_SUMMARY_STATUS.UNPAID ||
    cleanStatus === VENDOR_PAYMENT_SUMMARY_STATUS.UNPAID
  ) {
    return XCircle;
  }

  if (
    cleanStatus === CUSTOMER_PAYMENT_STATUS.CANCELLED ||
    cleanStatus === VENDOR_PAYMENT_STATUS.CANCELLED
  ) {
    return Ban;
  }

  if (
    cleanStatus === CUSTOMER_PAYMENT_SUMMARY_STATUS.EXCESS_PAID ||
    cleanStatus === VENDOR_PAYMENT_SUMMARY_STATUS.EXCESS_PAID
  ) {
    return AlertTriangle;
  }

  return CircleDollarSign;
}

function getSizeClass(size) {
  if (size === "xs") {
    return "px-2 py-0.5 text-[11px] gap-1";
  }

  if (size === "lg") {
    return "px-3.5 py-1.5 text-sm gap-1.5";
  }

  return "px-2.5 py-1 text-xs gap-1";
}

function getIconSize(size) {
  if (size === "xs") return 11;
  if (size === "lg") return 15;
  return 13;
}

/* =========================
   MAIN COMPONENT
========================= */

export default function PaymentStatusChip({
  type = "customer",
  status = "",
  label = "",
  size = "sm",
  showIcon = true,
  className = ""
}) {
  const cleanStatus = cleanString(status);

  const meta = getChipMeta({
    type,
    status: cleanStatus
  });

  const finalLabel =
    cleanString(label) ||
    meta?.label ||
    humanize(cleanStatus) ||
    "Status";

  const toneClass = getPaymentToneClass(meta?.tone || "gray");
  const Icon = getIcon({ type, status: cleanStatus });

  return (
    <span
      className={`
        inline-flex items-center rounded-full border font-semibold
        ${getSizeClass(size)}
        ${toneClass}
        ${className}
      `}
    >
      {showIcon && Icon && <Icon size={getIconSize(size)} />}
      {finalLabel}
    </span>
  );
}

/* =========================
   QUICK WRAPPERS
========================= */

export function CustomerPaymentStatusChip(props) {
  return <PaymentStatusChip type="customer" {...props} />;
}

export function VendorPaymentStatusChip(props) {
  return <PaymentStatusChip type="vendor" {...props} />;
}

export function CustomerPaymentSummaryChip(props) {
  return <PaymentStatusChip type="customer_summary" {...props} />;
}

export function VendorPaymentSummaryChip(props) {
  return <PaymentStatusChip type="vendor_summary" {...props} />;
}

export function PaymentDirectionChip(props) {
  return <PaymentStatusChip type="direction" {...props} />;
}

export function PaymentLedgerChip(props) {
  return <PaymentStatusChip type="ledger" {...props} />;
}