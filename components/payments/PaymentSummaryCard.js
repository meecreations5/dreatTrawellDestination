"use client";

import {
  ArrowDownCircle,
  ArrowUpCircle,
  BadgeIndianRupee,
  CircleDollarSign,
  Percent,
  ReceiptText,
  TrendingUp,
  Wallet
} from "lucide-react";

import {
  CUSTOMER_PAYMENT_SUMMARY_STATUS,
  VENDOR_PAYMENT_SUMMARY_STATUS,
  calculateBalance,
  calculateCustomerPaymentStatus,
  calculateVendorPaymentStatus
} from "@/lib/paymentConstants";

import {
  CustomerPaymentSummaryChip,
  VendorPaymentSummaryChip
} from "@/components/payments/PaymentStatusChip";

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

function formatPercent(value) {
  const number = getNullableNumber(value);

  if (number === null) return "—";

  return `${number.toFixed(1)}%`;
}

function getCustomerQuoteAmount(lead = {}) {
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

function getCurrency(lead = {}) {
  return (
    cleanString(
      lead.finalCustomerQuoteCurrency ||
        lead.latestCustomerQuoteCurrency ||
        lead.customerQuoteCurrency ||
        lead.selectedVendorCurrency ||
        lead.latestSelectedVendorCurrency
    ) || "INR"
  );
}

function calculateMarginPercent(profit, receivable) {
  const profitNumber = getNullableNumber(profit);
  const receivableNumber = getNullableNumber(receivable);

  if (profitNumber === null || !receivableNumber) return null;

  return (profitNumber / receivableNumber) * 100;
}

/* =========================
   SMALL COMPONENTS
========================= */

function SummaryMetric({
  icon: Icon,
  label,
  value,
  subValue = "",
  tone = "gray"
}) {
  const toneClass =
    tone === "green"
      ? "bg-green-50 border-green-100 text-green-700"
      : tone === "blue"
        ? "bg-blue-50 border-blue-100 text-blue-700"
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

      <p className="mt-2 text-xl font-bold text-gray-950">
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

function ProgressBar({ received = 0, total = 0, type = "customer" }) {
  const safeTotal = getNumber(total, 0);
  const safeReceived = getNumber(received, 0);

  const percentage =
    safeTotal > 0
      ? Math.min(100, Math.max(0, (safeReceived / safeTotal) * 100))
      : 0;

  const barClass =
    type === "vendor"
      ? "bg-purple-600"
      : "bg-green-600";

  return (
    <div>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          {percentage.toFixed(0)}% completed
        </span>

        <span>
          {safeReceived.toLocaleString("en-IN")} /{" "}
          {safeTotal.toLocaleString("en-IN")}
        </span>
      </div>

      <div className="mt-2 h-2.5 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${barClass}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

/* =========================
   MAIN COMPONENT
========================= */

export default function PaymentSummaryCard({
  lead,
  className = ""
}) {
  const currency = getCurrency(lead);

  const totalReceivableAmount = getCustomerQuoteAmount(lead);
  const totalPaymentReceived = getNumber(
    lead?.totalPaymentReceived,
    0
  );

  const paymentBalance =
    lead?.paymentBalance !== undefined
      ? getNumber(lead.paymentBalance, 0)
      : calculateBalance(totalReceivableAmount, totalPaymentReceived);

  const customerPaymentStatus =
    lead?.customerPaymentStatus ||
    calculateCustomerPaymentStatus(
      totalReceivableAmount,
      totalPaymentReceived
    );

  const totalVendorPayableAmount = getVendorPayableAmount(lead);
  const totalVendorPaid = getNumber(lead?.totalVendorPaid, 0);

  const vendorPaymentBalance =
    lead?.vendorPaymentBalance !== undefined
      ? getNumber(lead.vendorPaymentBalance, 0)
      : calculateBalance(totalVendorPayableAmount, totalVendorPaid);

  const vendorPaymentStatus =
    lead?.vendorPaymentStatus ||
    calculateVendorPaymentStatus(
      totalVendorPayableAmount,
      totalVendorPaid
    );

  const expectedGrossProfit =
    lead?.expectedGrossProfit !== undefined &&
    lead?.expectedGrossProfit !== null
      ? getNullableNumber(lead.expectedGrossProfit)
      : totalReceivableAmount || totalVendorPayableAmount
        ? totalReceivableAmount - totalVendorPayableAmount
        : null;

  const actualGrossProfit =
    lead?.actualGrossProfit !== undefined &&
    lead?.actualGrossProfit !== null
      ? getNullableNumber(lead.actualGrossProfit)
      : totalPaymentReceived || totalVendorPaid
        ? totalPaymentReceived - totalVendorPaid
        : null;

  const pendingProfit =
    lead?.pendingProfit !== undefined &&
    lead?.pendingProfit !== null
      ? getNullableNumber(lead.pendingProfit)
      : expectedGrossProfit !== null && actualGrossProfit !== null
        ? expectedGrossProfit - actualGrossProfit
        : null;

  const expectedMargin = calculateMarginPercent(
    expectedGrossProfit,
    totalReceivableAmount
  );

  const actualMargin = calculateMarginPercent(
    actualGrossProfit,
    totalPaymentReceived
  );

  const customerBalanceTone =
    customerPaymentStatus === CUSTOMER_PAYMENT_SUMMARY_STATUS.FULLY_PAID
      ? "green"
      : customerPaymentStatus === CUSTOMER_PAYMENT_SUMMARY_STATUS.EXCESS_PAID
        ? "purple"
        : customerPaymentStatus === CUSTOMER_PAYMENT_SUMMARY_STATUS.PARTIAL_PAID
          ? "amber"
          : "red";

  const vendorBalanceTone =
    vendorPaymentStatus === VENDOR_PAYMENT_SUMMARY_STATUS.FULLY_PAID
      ? "green"
      : vendorPaymentStatus === VENDOR_PAYMENT_SUMMARY_STATUS.EXCESS_PAID
        ? "purple"
        : vendorPaymentStatus === VENDOR_PAYMENT_SUMMARY_STATUS.PARTIAL_PAID
          ? "amber"
          : "red";

  return (
    <div className={`space-y-5 ${className}`}>
      {/* CUSTOMER RECEIVABLE */}
      <section className="rounded-3xl border border-green-100 bg-white overflow-hidden shadow-sm">
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-5 py-4 border-b border-green-100">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <ArrowDownCircle size={18} className="text-green-700" />

                <h3 className="font-semibold text-gray-950">
                  Payment Received from Travel Agent / Customer
                </h3>
              </div>

              <p className="mt-1 text-sm text-gray-500">
                Track cash, bank transfer, UPI, cheque and part/full payments received.
              </p>
            </div>

            <CustomerPaymentSummaryChip
              status={customerPaymentStatus}
              size="lg"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-5">
          <SummaryMetric
            icon={ReceiptText}
            label="Total Receivable"
            value={formatMoney(totalReceivableAmount, currency)}
            subValue="Final / latest customer quote"
            tone="blue"
          />

          <SummaryMetric
            icon={Wallet}
            label="Received"
            value={formatMoney(totalPaymentReceived, currency)}
            subValue="Verified customer payments"
            tone="green"
          />

          <SummaryMetric
            icon={CircleDollarSign}
            label="Balance"
            value={formatMoney(paymentBalance, currency)}
            subValue={
              paymentBalance > 0
                ? "Pending from travel agent / customer"
                : paymentBalance < 0
                  ? "Excess received"
                  : "No balance pending"
            }
            tone={customerBalanceTone}
          />
        </div>

        <div className="px-5 pb-5">
          <ProgressBar
            received={totalPaymentReceived}
            total={totalReceivableAmount}
            type="customer"
          />
        </div>
      </section>

      {/* VENDOR PAYABLE */}
      <section className="rounded-3xl border border-purple-100 bg-white overflow-hidden shadow-sm">
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 px-5 py-4 border-b border-purple-100">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <ArrowUpCircle size={18} className="text-purple-700" />

                <h3 className="font-semibold text-gray-950">
                  Payment Sent to Vendor
                </h3>
              </div>

              <p className="mt-1 text-sm text-gray-500">
                Track vendor advance, part payment, balance and full payment.
              </p>
            </div>

            <VendorPaymentSummaryChip
              status={vendorPaymentStatus}
              size="lg"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-5">
          <SummaryMetric
            icon={BadgeIndianRupee}
            label="Vendor Payable"
            value={formatMoney(totalVendorPayableAmount, currency)}
            subValue="Final / selected vendor cost"
            tone="purple"
          />

          <SummaryMetric
            icon={Wallet}
            label="Paid to Vendor"
            value={formatMoney(totalVendorPaid, currency)}
            subValue="Paid vendor entries"
            tone="green"
          />

          <SummaryMetric
            icon={CircleDollarSign}
            label="Vendor Balance"
            value={formatMoney(vendorPaymentBalance, currency)}
            subValue={
              vendorPaymentBalance > 0
                ? "Pending to vendor"
                : vendorPaymentBalance < 0
                  ? "Excess paid"
                  : "No vendor balance"
            }
            tone={vendorBalanceTone}
          />
        </div>

        <div className="px-5 pb-5">
          <ProgressBar
            received={totalVendorPaid}
            total={totalVendorPayableAmount}
            type="vendor"
          />
        </div>
      </section>

      {/* PROFIT SUMMARY */}
      <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <TrendingUp size={18} className="text-gray-700" />

          <h3 className="font-semibold text-gray-950">
            Profit Snapshot
          </h3>
        </div>

        <p className="mt-1 text-sm text-gray-500">
          Compare expected profit from quotation vs actual cash movement.
        </p>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <SummaryMetric
            icon={TrendingUp}
            label="Expected Profit"
            value={formatMoney(expectedGrossProfit, currency)}
            subValue={`Expected margin: ${formatPercent(expectedMargin)}`}
            tone={
              expectedGrossProfit !== null && expectedGrossProfit < 0
                ? "red"
                : "green"
            }
          />

          <SummaryMetric
            icon={TrendingUp}
            label="Actual Profit"
            value={formatMoney(actualGrossProfit, currency)}
            subValue={`Actual margin: ${formatPercent(actualMargin)}`}
            tone={
              actualGrossProfit !== null && actualGrossProfit < 0
                ? "red"
                : "green"
            }
          />

          <SummaryMetric
            icon={CircleDollarSign}
            label="Pending Profit"
            value={formatMoney(pendingProfit, currency)}
            subValue="Expected profit not yet realized"
            tone="amber"
          />

          <SummaryMetric
            icon={Percent}
            label="Expected Margin"
            value={formatPercent(expectedMargin)}
            subValue="Based on quotation value"
            tone="blue"
          />
        </div>
      </section>
    </div>
  );
}