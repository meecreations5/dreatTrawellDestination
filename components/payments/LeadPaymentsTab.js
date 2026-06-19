"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  BadgeIndianRupee,
  CircleDollarSign,
  Plus,
  ReceiptText,
  ShieldCheck,
  Wallet
} from "lucide-react";

import PaymentSummaryCard from "@/components/payments/PaymentSummaryCard";
import PaymentHistoryList from "@/components/payments/PaymentHistoryList";
import AddCustomerPaymentModal from "@/components/payments/AddCustomerPaymentModal";
import AddVendorPaymentModal from "@/components/payments/AddVendorPaymentModal";

import {
  CUSTOMER_PAYMENT_SUMMARY_STATUS,
  VENDOR_PAYMENT_SUMMARY_STATUS
} from "@/lib/paymentConstants";

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

function getNullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;

  const number = Number(value);

  if (!Number.isFinite(number)) return null;

  return number;
}

function getLeadId(lead) {
  return cleanString(lead?.id || lead?.leadId);
}

function getCurrency(lead = {}) {
  return (
    cleanString(
      lead.finalCustomerQuoteCurrency ||
        lead.latestCustomerQuoteCurrency ||
        lead.customerQuoteCurrency ||
        lead.finalSelectedVendorCurrency ||
        lead.latestSelectedVendorCurrency
    ) || "INR"
  );
}

function getReceivableAmount(lead = {}) {
  return getNumber(
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

function getReceivedAmount(lead = {}) {
  return getNumber(lead.totalPaymentReceived, 0);
}

function getCustomerBalance(lead = {}) {
  if (
    lead.paymentBalance !== null &&
    lead.paymentBalance !== undefined &&
    lead.paymentBalance !== ""
  ) {
    return getNumber(lead.paymentBalance, 0);
  }

  return getReceivableAmount(lead) - getReceivedAmount(lead);
}

function getVendorPayableAmount(lead = {}) {
  return getNumber(
    lead.totalVendorPayableAmount ??
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

function getVendorPaidAmount(lead = {}) {
  return getNumber(lead.totalVendorPaid, 0);
}

function getVendorBalance(lead = {}) {
  if (
    lead.vendorPaymentBalance !== null &&
    lead.vendorPaymentBalance !== undefined &&
    lead.vendorPaymentBalance !== ""
  ) {
    return getNumber(lead.vendorPaymentBalance, 0);
  }

  return getVendorPayableAmount(lead) - getVendorPaidAmount(lead);
}

function formatMoney(value, currency = "INR") {
  const amount = getNullableNumber(value);

  if (amount === null) return "—";

  try {
    return amount.toLocaleString("en-IN", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: 0
    });
  } catch {
    return `${currency || "INR"} ${amount.toLocaleString("en-IN")}`;
  }
}

function getCustomerPaymentStatusText(status = "") {
  if (status === CUSTOMER_PAYMENT_SUMMARY_STATUS.FULLY_PAID) {
    return "Fully received";
  }

  if (status === CUSTOMER_PAYMENT_SUMMARY_STATUS.PARTIAL_PAID) {
    return "Part received";
  }

  if (status === CUSTOMER_PAYMENT_SUMMARY_STATUS.EXCESS_PAID) {
    return "Excess received";
  }

  return "Not received";
}

function getVendorPaymentStatusText(status = "") {
  if (status === VENDOR_PAYMENT_SUMMARY_STATUS.FULLY_PAID) {
    return "Fully paid";
  }

  if (status === VENDOR_PAYMENT_SUMMARY_STATUS.PARTIAL_PAID) {
    return "Part paid";
  }

  if (status === VENDOR_PAYMENT_SUMMARY_STATUS.EXCESS_PAID) {
    return "Excess paid";
  }

  return "Not paid";
}

/* =========================
   SMALL COMPONENTS
========================= */

function ActionCard({
  icon: Icon,
  title,
  description,
  buttonLabel,
  onClick,
  tone = "green",
  disabled = false,
  disabledText = ""
}) {
  const toneClass =
    tone === "purple"
      ? "from-purple-50 to-blue-50 border-purple-100 text-purple-700"
      : tone === "amber"
        ? "from-amber-50 to-orange-50 border-amber-100 text-amber-700"
        : "from-green-50 to-emerald-50 border-green-100 text-green-700";

  const buttonClass =
    tone === "purple"
      ? "bg-purple-600 hover:bg-purple-700"
      : tone === "amber"
        ? "bg-amber-600 hover:bg-amber-700"
        : "bg-green-600 hover:bg-green-700";

  return (
    <div className={`rounded-3xl border bg-gradient-to-r p-5 ${toneClass}`}>
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm">
          {Icon && <Icon size={21} />}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-gray-950">
            {title}
          </h3>

          <p className="mt-1 text-sm text-gray-600">
            {description}
          </p>

          {disabled && disabledText && (
            <p className="mt-2 text-xs font-medium text-amber-700">
              {disabledText}
            </p>
          )}

          <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className={`
              mt-4 inline-flex items-center gap-2 rounded-2xl px-4 py-2.5
              text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50
              ${buttonClass}
            `}
          >
            <Plus size={15} />
            {buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  subValue = "",
  tone = "gray"
}) {
  const toneClass =
    tone === "green"
      ? "bg-green-50 border-green-100 text-green-700"
      : tone === "purple"
        ? "bg-purple-50 border-purple-100 text-purple-700"
        : tone === "amber"
          ? "bg-amber-50 border-amber-100 text-amber-700"
          : tone === "red"
            ? "bg-red-50 border-red-100 text-red-700"
            : "bg-gray-50 border-gray-100 text-gray-600";

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <div className="flex items-center gap-2">
        {Icon && <Icon size={16} />}

        <p className="text-xs font-semibold uppercase tracking-wide">
          {label}
        </p>
      </div>

      <p className="mt-2 text-lg font-bold text-gray-950">
        {value}
      </p>

      {subValue && (
        <p className="mt-1 text-xs text-gray-500">
          {subValue}
        </p>
      )}
    </div>
  );
}

function WarningBox({ children }) {
  return (
    <div className="flex items-start gap-2 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <AlertTriangle size={17} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

/* =========================
   MAIN COMPONENT
========================= */

export default function LeadPaymentsTab({
  lead,
  className = ""
}) {
  const leadId = getLeadId(lead);

  const [customerPaymentOpen, setCustomerPaymentOpen] = useState(false);
  const [vendorPaymentOpen, setVendorPaymentOpen] = useState(false);

  const paymentSnapshot = useMemo(() => {
    const currency = getCurrency(lead);

    const totalReceivableAmount = getReceivableAmount(lead);
    const totalPaymentReceived = getReceivedAmount(lead);
    const customerBalance = getCustomerBalance(lead);

    const totalVendorPayableAmount = getVendorPayableAmount(lead);
    const totalVendorPaid = getVendorPaidAmount(lead);
    const vendorBalance = getVendorBalance(lead);

    const customerPaymentStatus =
      lead?.customerPaymentStatus ||
      CUSTOMER_PAYMENT_SUMMARY_STATUS.UNPAID;

    const vendorPaymentStatus =
      lead?.vendorPaymentStatus ||
      VENDOR_PAYMENT_SUMMARY_STATUS.UNPAID;

    const expectedProfit =
      lead?.expectedGrossProfit !== null &&
      lead?.expectedGrossProfit !== undefined
        ? getNullableNumber(lead.expectedGrossProfit)
        : totalReceivableAmount || totalVendorPayableAmount
          ? totalReceivableAmount - totalVendorPayableAmount
          : null;

    const actualProfit =
      lead?.actualGrossProfit !== null &&
      lead?.actualGrossProfit !== undefined
        ? getNullableNumber(lead.actualGrossProfit)
        : totalPaymentReceived || totalVendorPaid
          ? totalPaymentReceived - totalVendorPaid
          : null;

    return {
      currency,

      totalReceivableAmount,
      totalPaymentReceived,
      customerBalance,
      customerPaymentStatus,

      totalVendorPayableAmount,
      totalVendorPaid,
      vendorBalance,
      vendorPaymentStatus,

      expectedProfit,
      actualProfit
    };
  }, [lead]);

  const hasQuoteAmount = paymentSnapshot.totalReceivableAmount > 0;
  const hasVendorCost = paymentSnapshot.totalVendorPayableAmount > 0;

  const customerBalanceTone =
    paymentSnapshot.customerBalance <= 0
      ? "green"
      : paymentSnapshot.totalPaymentReceived > 0
        ? "amber"
        : "red";

  const vendorBalanceTone =
    paymentSnapshot.vendorBalance <= 0
      ? "green"
      : paymentSnapshot.totalVendorPaid > 0
        ? "amber"
        : "red";

  if (!leadId) {
    return (
      <div className="rounded-3xl border border-red-100 bg-red-50 p-5 text-sm text-red-700">
        Lead ID is missing. Payment module cannot be loaded.
      </div>
    );
  }

  return (
    <div className={`space-y-5 ${className}`}>
      {/* HEADER */}
      <section className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 px-5 py-5 text-white">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-blue-100">
                <Wallet size={20} />

                <p className="text-xs font-semibold uppercase tracking-wide">
                  Payment Module
                </p>
              </div>

              <h2 className="mt-1 text-xl font-bold">
                Receivable & Vendor Payable
              </h2>

              <p className="mt-1 max-w-2xl text-sm text-slate-300">
                Track payment received from travel agent or customer, then record
                payment sent to vendor. Supports cash, bank transfer, partial and full payments.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setCustomerPaymentOpen(true)}
                className="
                  inline-flex items-center justify-center gap-2 rounded-2xl bg-green-500
                  px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-600
                "
              >
                <ArrowDownCircle size={16} />
                Add Received
              </button>

              <button
                type="button"
                onClick={() => setVendorPaymentOpen(true)}
                className="
                  inline-flex items-center justify-center gap-2 rounded-2xl bg-purple-500
                  px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-600
                "
              >
                <ArrowUpCircle size={16} />
                Add Vendor Paid
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 bg-gray-50 p-4 md:grid-cols-4">
          <MiniStat
            icon={ReceiptText}
            label="Quote Value"
            value={formatMoney(
              paymentSnapshot.totalReceivableAmount,
              paymentSnapshot.currency
            )}
            subValue="Receivable from travel agent / customer"
            tone="green"
          />

          <MiniStat
            icon={BadgeIndianRupee}
            label="Vendor Cost"
            value={formatMoney(
              paymentSnapshot.totalVendorPayableAmount,
              paymentSnapshot.currency
            )}
            subValue="Payable to vendor"
            tone="purple"
          />

          <MiniStat
            icon={CircleDollarSign}
            label="Expected Profit"
            value={formatMoney(
              paymentSnapshot.expectedProfit,
              paymentSnapshot.currency
            )}
            subValue="Quote minus vendor cost"
            tone={
              paymentSnapshot.expectedProfit !== null &&
              paymentSnapshot.expectedProfit < 0
                ? "red"
                : "green"
            }
          />

          <MiniStat
            icon={ShieldCheck}
            label="Actual Profit"
            value={formatMoney(
              paymentSnapshot.actualProfit,
              paymentSnapshot.currency
            )}
            subValue="Received minus vendor paid"
            tone={
              paymentSnapshot.actualProfit !== null &&
              paymentSnapshot.actualProfit < 0
                ? "red"
                : "green"
            }
          />
        </div>
      </section>

      {!hasQuoteAmount && (
        <WarningBox>
          Customer quotation amount is not available yet. You can still add a
          payment, but receivable and balance calculation will become accurate
          once final/latest quotation amount is available.
        </WarningBox>
      )}

      {!hasVendorCost && (
        <WarningBox>
          Vendor cost is not available yet. You can still add vendor payment
          manually, but vendor payable and profit calculation will become more
          accurate once selected/final vendor cost is available.
        </WarningBox>
      )}

      {/* QUICK ACTIONS */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ActionCard
          icon={ArrowDownCircle}
          title="Payment Received"
          description={`Received: ${formatMoney(
            paymentSnapshot.totalPaymentReceived,
            paymentSnapshot.currency
          )}. Balance: ${formatMoney(
            paymentSnapshot.customerBalance,
            paymentSnapshot.currency
          )}. Status: ${getCustomerPaymentStatusText(
            paymentSnapshot.customerPaymentStatus
          )}.`}
          buttonLabel="Add Customer / Agent Payment"
          tone="green"
          onClick={() => setCustomerPaymentOpen(true)}
        />

        <ActionCard
          icon={ArrowUpCircle}
          title="Vendor Payment Sent"
          description={`Paid: ${formatMoney(
            paymentSnapshot.totalVendorPaid,
            paymentSnapshot.currency
          )}. Balance: ${formatMoney(
            paymentSnapshot.vendorBalance,
            paymentSnapshot.currency
          )}. Status: ${getVendorPaymentStatusText(
            paymentSnapshot.vendorPaymentStatus
          )}.`}
          buttonLabel="Add Vendor Payment"
          tone="purple"
          onClick={() => setVendorPaymentOpen(true)}
        />
      </section>

      {/* SUMMARY */}
      <PaymentSummaryCard lead={lead} />

      {/* LEDGER */}
      <PaymentHistoryList lead={lead} />

      {/* MODALS */}
      <AddCustomerPaymentModal
        open={customerPaymentOpen}
        lead={lead}
        onClose={() => setCustomerPaymentOpen(false)}
        onSaved={() => setCustomerPaymentOpen(false)}
      />

      <AddVendorPaymentModal
        open={vendorPaymentOpen}
        lead={lead}
        onClose={() => setVendorPaymentOpen(false)}
        onSaved={() => setVendorPaymentOpen(false)}
      />
    </div>
  );
}