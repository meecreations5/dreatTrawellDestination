"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query
} from "firebase/firestore";

import {
  AlertTriangle,
  BadgeIndianRupee,
  CalendarClock,
  Copy,
  Download,
  Eye,
  Mail,
  MessageCircle,
  Loader2,
  Package,
  Pencil,
  Percent,
  ReceiptText,
  Repeat2,
  Send,
  Sparkles,
  TrendingUp,
  Trash2,
  Trophy,
  X
} from "lucide-react";

import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { canDeleteQuotationDraft, deleteQuotationDraft, isDraftQuotation } from "@/lib/deleteQuotationDraft";
import { canResendQuotation, resendQuotation } from "@/lib/resendQuotation";
import Card from "@/components/ui/Card";
import QuotationAssetSummary from "@/components/leads/QuotationAssetSummary";
import { generateQuotationPdf } from "@/lib/quotationPdf";

/* =========================
   HELPERS
========================= */

function cleanString(value = "") {
  return String(value || "").trim();
}

function getLeadId(lead) {
  return lead?.id || lead?.leadId || "";
}

function getLeadRecipient(lead = {}) {
  return {
    name: cleanString(
      lead?.spoc?.name ||
      lead?.customerName ||
      lead?.travellerName ||
      lead?.guestName ||
      lead?.contactName ||
      lead?.customer?.name
    ),
    email: cleanString(
      lead?.spoc?.email ||
      lead?.email ||
      lead?.customerEmail ||
      lead?.customer?.email
    ),
    mobile: cleanString(
      lead?.spoc?.mobile ||
      lead?.mobile ||
      lead?.phone ||
      lead?.contactNumber ||
      lead?.customerMobile ||
      lead?.customer?.mobile
    )
  };
}

function toDate(value) {
  if (!value) return null;
  if (value?.toDate) return value.toDate();
  if (value instanceof Date) return value;

  if (typeof value === "object" && typeof value.seconds === "number") {
    const date = new Date(value.seconds * 1000);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateTime(value) {
  const date = toDate(value);

  if (!date) return "—";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getNumber(value) {
  if (value === null || value === undefined || value === "") return null;

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatMoney(value, currency = "INR") {
  const amount = getNumber(value);

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
  const number = getNumber(value);

  if (number === null) return "—";

  return `${number.toFixed(1)}%`;
}

function normalizeSelectedVendorQuotes(value = []) {
  if (!Array.isArray(value)) return [];

  return value
    .map(item => ({
      vendorId: cleanString(item?.vendorId),
      vendorName: cleanString(item?.vendorName),
      vendorCode: cleanString(item?.vendorCode),

      vendorRequestId: cleanString(item?.vendorRequestId),
      vendorQuoteId: cleanString(item?.vendorQuoteId),

      serviceType: cleanString(item?.serviceType || "other"),
      serviceLabel: cleanString(item?.serviceLabel || "Vendor Cost"),

      currency: cleanString(item?.currency || "INR"),
      amount: getNumber(item?.amount),
      revision: Number(item?.revision || 1),

      referenceText: cleanString(item?.referenceText),
      referenceFileUrl: cleanString(item?.referenceFileUrl),
      referenceFileName: cleanString(item?.referenceFileName)
    }))
    .filter(item => item.vendorQuoteId && item.amount !== null);
}

function getQuotationAmount(quotation) {
  return getNumber(
    quotation?.customerQuoteAmount ??
      quotation?.customerQuotedAmount ??
      quotation?.totalAmount ??
      quotation?.totalPrice ??
      quotation?.latestQuotationAmount
  );
}

function getVendorCost(quotation) {
  return getNumber(
    quotation?.totalSelectedVendorCost ??
      quotation?.selectedVendorCost ??
      quotation?.vendorCost ??
      quotation?.latestTotalSelectedVendorCost ??
      quotation?.latestVendorCost
  );
}

function getGrossProfit(quotation) {
  const savedProfit = getNumber(quotation?.grossProfit);

  if (savedProfit !== null) return savedProfit;

  const quoteAmount = getQuotationAmount(quotation);
  const vendorCost = getVendorCost(quotation);

  if (quoteAmount === null || vendorCost === null) return null;

  return quoteAmount - vendorCost;
}

function getMarginPercent(quotation) {
  const savedMargin = getNumber(quotation?.marginPercent);

  if (savedMargin !== null) return savedMargin;

  const quoteAmount = getQuotationAmount(quotation);
  const profit = getGrossProfit(quotation);

  if (!quoteAmount || profit === null) return null;

  return (profit / quoteAmount) * 100;
}

function normalizeSentVia(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.map(item => cleanString(item)).filter(Boolean);
  }

  if (typeof value === "string") {
    return [cleanString(value)].filter(Boolean);
  }

  return [];
}

function getStatusLabel(status, isDraft, isFinalQuotation) {
  if (isFinalQuotation || status === "final") return "Final";
  if (isDraft || status === "draft") return "Draft";
  if (status === "sent") return "Sent";

  return status ? status.replace(/_/g, " ") : "Saved";
}

function getPricingModeLabel(mode = "") {
  const value = cleanString(mode);

  const labels = {
    direct: "Direct Quote",
    vendor_quote: "Vendor Quote",
    vendor_final: "Final Vendor Cost",
    vendor_draft: "Vendor Pricing",
    manual_cost: "Manual Cost",
    multi_vendor: "Multi Vendor Costing"
  };

  return labels[value] || "Direct Quote";
}

function getPricingModeTone(mode = "") {
  const value = cleanString(mode);

  if (value === "vendor_final") return "green";

  if (
    value === "vendor_quote" ||
    value === "vendor_draft" ||
    value === "multi_vendor"
  ) {
    return "purple";
  }

  if (value === "manual_cost") return "amber";

  return "blue";
}

function getCreatedBy(quotation) {
  return (
    cleanString(
      quotation?.createdByName ||
        quotation?.sentByName ||
        quotation?.draftSavedByName ||
        quotation?.updatedByName
    ) || "—"
  );
}

function getCreatedAt(quotation) {
  return (
    quotation?.sentAt ||
    quotation?.draftSavedAt ||
    quotation?.createdAt ||
    quotation?.updatedAt
  );
}

function getVendorCostingMode(quotation) {
  return cleanString(quotation?.vendorCostingMode) === "multi_vendor"
    ? "multi_vendor"
    : "single_vendor";
}

function getSelectedVendorQuotes(quotation) {
  return normalizeSelectedVendorQuotes(
    quotation?.selectedVendorQuotes ||
      quotation?.pricingSnapshot?.selectedVendorQuotes ||
      []
  );
}

function getQuotationAssetCount(quotation = {}) {
  const metadata = quotation?.metadata || {};

  const directAssets =
    quotation?.sharedAssets ||
    quotation?.quotationAssets ||
    quotation?.latestQuotationSharedAssets ||
    quotation?.finalQuotationSharedAssets ||
    metadata.sharedAssets ||
    metadata.quotationAssets ||
    metadata.latestQuotationSharedAssets ||
    metadata.finalQuotationSharedAssets ||
    [];

  if (Array.isArray(directAssets) && directAssets.length) {
    return directAssets.length;
  }

  const savedCount = getNumber(
    quotation?.assetShareCount ??
      quotation?.latestQuotationAssetShareCount ??
      quotation?.finalQuotationAssetShareCount ??
      metadata.assetShareCount ??
      metadata.latestQuotationAssetShareCount
  );

  if (savedCount !== null && savedCount > 0) {
    return savedCount;
  }

  const hasAssetLinks = Boolean(
    cleanString(
      quotation?.assetLinksText ||
        quotation?.latestQuotationAssetLinksText ||
        quotation?.finalQuotationAssetLinksText ||
        metadata.assetLinksText ||
        metadata.latestQuotationAssetLinksText ||
        quotation?.assetLinksHtml ||
        quotation?.latestQuotationAssetLinksHtml ||
        metadata.assetLinksHtml
    )
  );

  return hasAssetLinks ? 1 : 0;
}

function createRevisionSeed(quotation) {
  const selectedVendorQuotes = getSelectedVendorQuotes(quotation);

  const selectedVendorQuoteIds = Array.isArray(quotation?.selectedVendorQuoteIds)
    ? quotation.selectedVendorQuoteIds
    : selectedVendorQuotes.map(item => item.vendorQuoteId);

  const vendorCostingMode =
    quotation?.vendorCostingMode ||
    (selectedVendorQuotes.length ? "multi_vendor" : "single_vendor");

  return {
    ...quotation,

    id: "",
    quotationId: "",
    revision: null,

    status: "draft",
    isDraft: true,
    isFinalQuotation: false,

    sourceQuotationId: quotation?.id || quotation?.quotationId || "",

    sharedAssets: quotation?.sharedAssets || quotation?.quotationAssets || [],
    quotationAssets: quotation?.quotationAssets || quotation?.sharedAssets || [],
    sharedAssetIds: quotation?.sharedAssetIds || [],
    sharedAssetTitles: quotation?.sharedAssetTitles || [],
    assetShareCount: quotation?.assetShareCount || 0,
    hasSharedAssets: Boolean(quotation?.hasSharedAssets),
    assetLinksText: quotation?.assetLinksText || "",
    assetLinksHtml: quotation?.assetLinksHtml || "",

    pricingSnapshot: {
      quotationPricingMode: quotation?.quotationPricingMode || "direct",

      vendorCostingMode,
      vendorQuoteFinalized: Boolean(quotation?.vendorQuoteFinalized),

      selectedVendorQuotes,
      selectedVendorQuoteIds,

      totalSelectedVendorCost:
        quotation?.totalSelectedVendorCost ??
        quotation?.selectedVendorCost ??
        quotation?.vendorCost ??
        null,

      selectedVendorCost:
        quotation?.selectedVendorCost ??
        quotation?.vendorCost ??
        quotation?.totalSelectedVendorCost ??
        null,

      selectedVendorCurrency:
        quotation?.selectedVendorCurrency ||
        quotation?.customerQuoteCurrency ||
        "INR",

      selectedVendorName: quotation?.selectedVendorName || "",
      selectedVendorQuoteId: quotation?.selectedVendorQuoteId || "",
      selectedVendorRequestId: quotation?.selectedVendorRequestId || "",

      customerQuoteAmount:
        quotation?.customerQuoteAmount ??
        quotation?.customerQuotedAmount ??
        quotation?.totalAmount ??
        quotation?.totalPrice ??
        "",

      customerQuoteCurrency: quotation?.customerQuoteCurrency || "INR",

      grossProfit: quotation?.grossProfit ?? null,
      marginPercent: quotation?.marginPercent ?? null,
      markupPercent: quotation?.markupPercent ?? null
    }
  };
}

/* =========================
   SMALL COMPONENTS
========================= */

function StatusBadge({ status, isDraft, isFinalQuotation }) {
  const label = getStatusLabel(status, isDraft, isFinalQuotation);

  const tone =
    label === "Final"
      ? "bg-green-100 text-green-700 border-green-200"
      : label === "Sent"
        ? "bg-blue-100 text-blue-700 border-blue-200"
        : label === "Draft"
          ? "bg-amber-100 text-amber-700 border-amber-200"
          : "bg-gray-100 text-gray-700 border-gray-200";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${tone}`}
    >
      {label === "Final" && <Trophy size={12} />}
      {label === "Sent" && <Send size={12} />}
      {label === "Draft" && <Pencil size={12} />}
      {label}
    </span>
  );
}

function PricingModeBadge({ mode, vendorQuoteFinalized, vendorCostingMode }) {
  const isMultiVendor = vendorCostingMode === "multi_vendor";

  const label = isMultiVendor
    ? "Multi Vendor Costing"
    : vendorQuoteFinalized
      ? "Final Vendor Cost"
      : getPricingModeLabel(mode);

  const tone = isMultiVendor
    ? "purple"
    : vendorQuoteFinalized
      ? "green"
      : getPricingModeTone(mode);

  const toneClass =
    tone === "green"
      ? "bg-green-50 text-green-700 border-green-100"
      : tone === "purple"
        ? "bg-purple-50 text-purple-700 border-purple-100"
        : tone === "amber"
          ? "bg-amber-50 text-amber-700 border-amber-100"
          : "bg-blue-50 text-blue-700 border-blue-100";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${toneClass}`}
    >
      <Sparkles size={12} />
      {label}
    </span>
  );
}

function ChannelBadges({ sentVia }) {
  const channels = normalizeSentVia(sentVia);

  if (!channels.length) {
    return (
      <span className="text-xs text-gray-400">
        Not sent yet
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {channels.includes("email") && (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
          <Mail size={11} />
          Email
        </span>
      )}

      {channels.includes("whatsapp") && (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-700">
          <MessageCircle size={11} />
          WhatsApp
        </span>
      )}
    </div>
  );
}

function Metric({ icon: Icon, label, value, tone = "gray" }) {
  const toneClass =
    tone === "green"
      ? "bg-green-50 border-green-100 text-green-700"
      : tone === "purple"
        ? "bg-purple-50 border-purple-100 text-purple-700"
        : tone === "amber"
          ? "bg-amber-50 border-amber-100 text-amber-700"
          : tone === "red"
            ? "bg-red-50 border-red-100 text-red-700"
            : tone === "blue"
              ? "bg-blue-50 border-blue-100 text-blue-700"
              : "bg-gray-50 border-gray-100 text-gray-600";

  return (
    <div className={`rounded-2xl border p-3 ${toneClass}`}>
      <div className="flex items-center gap-1.5">
        {Icon && <Icon size={14} />}
        <p className="text-[11px] font-semibold uppercase tracking-wide">
          {label}
        </p>
      </div>

      <p className="mt-1 text-sm font-bold text-gray-950">
        {value}
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-gray-400 ">
        <ReceiptText size={25} />
      </div>

      <h3 className="mt-4 text-base font-semibold text-gray-900">
        No quotation revisions yet
      </h3>

      <p className="mt-1 text-sm text-gray-500">
        Once you save or send quotations, all revisions will appear here.
      </p>
    </div>
  );
}

function MultiVendorCostingBlock({ quotation }) {
  const selectedVendorQuotes = getSelectedVendorQuotes(quotation);

  if (!selectedVendorQuotes.length) return null;

  const currency =
    quotation?.selectedVendorCurrency ||
    quotation?.customerQuoteCurrency ||
    selectedVendorQuotes[0]?.currency ||
    "INR";

  const totalCost =
    quotation?.totalSelectedVendorCost ??
    quotation?.selectedVendorCost ??
    quotation?.vendorCost ??
    selectedVendorQuotes.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

  return (
    <div className="mb-5 rounded-2xl border border-purple-100 bg-purple-50 p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-purple-900">
            Multi Vendor Costing
          </p>

          <p className="text-xs text-purple-700">
            {selectedVendorQuotes.length} vendor quote(s) combined for this quotation.
          </p>
        </div>

        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-purple-700">
          Total: {formatMoney(totalCost, currency)}
        </span>
      </div>

      <div className="mt-3 space-y-2">
        {selectedVendorQuotes.map(item => (
          <div
            key={item.vendorQuoteId}
            className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm"
          >
            <div className="min-w-0">
              <p className="font-semibold text-gray-900">
                {item.vendorName || "Vendor"}
              </p>

              <p className="text-xs text-gray-500">
                {item.serviceLabel || item.serviceType || "Vendor Cost"}
                {item.revision ? ` · Rev ${item.revision}` : ""}
                {item.vendorCode ? ` · ${item.vendorCode}` : ""}
              </p>
            </div>

            <p className="shrink-0 font-bold text-gray-950">
              {formatMoney(item.amount, item.currency || currency)}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-purple-100 pt-3">
        <span className="text-sm font-semibold text-purple-900">
          Total Selected Vendor Cost
        </span>

        <span className="text-base font-bold text-purple-900">
          {formatMoney(totalCost, currency)}
        </span>
      </div>
    </div>
  );
}

/* =========================
   DETAILS MODAL
========================= */

function QuotationDetailsModal({
  quotation,
  onClose,
  onDeleteDraft,
  onResend,
  onGeneratePdf,
  canDeleteDraft = false,
  canResend = false,
  deleting = false,
  resending = false
}) {
  if (!quotation) return null;

  const draftState = isDraftQuotation(quotation);
  const amount = getQuotationAmount(quotation);
  const vendorCost = getVendorCost(quotation);
  const profit = getGrossProfit(quotation);
  const margin = getMarginPercent(quotation);
  const currency =
    quotation?.customerQuoteCurrency ||
    quotation?.selectedVendorCurrency ||
    "INR";

  const selectedVendorQuotes = getSelectedVendorQuotes(quotation);
  const vendorCostingMode = getVendorCostingMode(quotation);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 bg-gray-50 px-5 py-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                status={quotation.status}
                isDraft={draftState}
                isFinalQuotation={quotation.isFinalQuotation}
              />

              <PricingModeBadge
                mode={quotation.quotationPricingMode}
                vendorQuoteFinalized={quotation.vendorQuoteFinalized}
                vendorCostingMode={vendorCostingMode}
              />

              {getQuotationAssetCount(quotation) > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                  <Package size={12} />
                  {getQuotationAssetCount(quotation)} Assets
                </span>
              )}
            </div>

            <h2 className="mt-2 text-lg font-semibold text-gray-900">
              Quotation Rev {quotation.revision || "—"}
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              Created by {getCreatedBy(quotation)} ·{" "}
              {formatDateTime(getCreatedAt(quotation))}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => onGeneratePdf?.(quotation)}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
            >
              <Download size={14} />
              Generate PDF
            </button>

            {canResend && (
              <button
                type="button"
                onClick={() => onResend?.(quotation)}
                disabled={resending}
                className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {resending ? <Loader2 size={14} className="animate-spin" /> : <Repeat2 size={14} />}
                Resend Quote
              </button>
            )}

            {canDeleteDraft && draftState && (
              <button
                type="button"
                onClick={() => onDeleteDraft?.(quotation)}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Delete Draft
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Close quotation details"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 hover:text-gray-900"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-4">
            <Metric
              icon={ReceiptText}
              label="Customer Quote"
              value={formatMoney(amount, currency)}
              tone="blue"
            />

            <Metric
              icon={BadgeIndianRupee}
              label={
                vendorCostingMode === "multi_vendor"
                  ? "Total Vendor Cost"
                  : "Vendor Cost"
              }
              value={vendorCost === null ? "—" : formatMoney(vendorCost, currency)}
              tone="purple"
            />

            <Metric
              icon={TrendingUp}
              label="Gross Profit"
              value={profit === null ? "—" : formatMoney(profit, currency)}
              tone={profit !== null && profit < 0 ? "red" : "green"}
            />

            <Metric
              icon={Percent}
              label="Margin"
              value={formatPercent(margin)}
              tone={profit !== null && profit < 0 ? "red" : "green"}
            />
          </div>

          {(quotation.selectedVendorName ||
            quotation.selectedVendorQuoteId ||
            quotation.selectedVendorRequestId ||
            selectedVendorQuotes.length > 0) && (
            <div className="mb-5 rounded-2xl border border-green-100 bg-green-50 p-4">
              <p className="text-sm font-semibold text-green-900">
                Vendor Pricing Source
              </p>

              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <p className="text-xs text-green-700">Vendor</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {vendorCostingMode === "multi_vendor"
                      ? "Multiple Vendors"
                      : quotation.selectedVendorName || "—"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-green-700">Vendor Quote ID</p>
                  <p className="break-all text-sm font-semibold text-gray-900">
                    {vendorCostingMode === "multi_vendor"
                      ? `${selectedVendorQuotes.length} quote(s) selected`
                      : quotation.selectedVendorQuoteId || "—"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-green-700">Finalized</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {quotation.vendorQuoteFinalized ? "Yes" : "No"}
                  </p>
                </div>
              </div>
            </div>
          )}

          <MultiVendorCostingBlock quotation={quotation} />

          <QuotationAssetSummary quotation={quotation} />

          <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-5">
            <p className="mb-3 text-sm font-semibold text-gray-900">
              Customer Visible Quotation
            </p>

            {quotation.itineraryHtml ? (
              <div
                className="quotation-history-preview overflow-x-auto text-sm text-gray-800"
                dangerouslySetInnerHTML={{
                  __html: quotation.itineraryHtml
                }}
              />
            ) : (
              <p className="text-sm text-gray-400">
                No quotation content saved.
              </p>
            )}
          </div>

          {quotation.note && (
            <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                Internal Note
              </p>

              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">
                {quotation.note}
              </p>
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        .quotation-history-preview table {
          border-collapse: collapse;
          max-width: 100%;
          margin: 8px 0;
        }

        .quotation-history-preview td,
        .quotation-history-preview th {
          border: 1px solid #d1d5db;
          padding: 6px 8px;
          vertical-align: top;
        }

        .quotation-history-preview ul,
        .quotation-history-preview ol {
          padding-left: 24px;
          margin: 8px 0;
        }

        .quotation-history-preview li {
          margin: 4px 0;
        }
      `}</style>
    </div>
  );
}

/* =========================
   QUOTATION CARD
========================= */

function QuotationCard({
  quotation,
  onView,
  onEditDraft,
  onCreateRevision,
  onDeleteDraft,
  onResend,
  onGeneratePdf,
  canDeleteDraft = false,
  canResend = false,
  deleting = false,
  resending = false
}) {
  const amount = getQuotationAmount(quotation);
  const vendorCost = getVendorCost(quotation);
  const profit = getGrossProfit(quotation);
  const margin = getMarginPercent(quotation);
  const currency =
    quotation?.customerQuoteCurrency ||
    quotation?.selectedVendorCurrency ||
    "INR";

  const isDraft = isDraftQuotation(quotation);

  const selectedVendorQuotes = getSelectedVendorQuotes(quotation);
  const vendorCostingMode = getVendorCostingMode(quotation);
  const assetCount = getQuotationAssetCount(quotation);

  return (
    <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white  transition hover:border-blue-200">
      <div className="border-b border-gray-100 bg-gradient-to-r from-gray-50 to-blue-50 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700 ">
                Rev {quotation.revision || "—"}
              </span>

              <StatusBadge
                status={quotation.status}
                isDraft={isDraft}
                isFinalQuotation={quotation.isFinalQuotation}
              />

              <PricingModeBadge
                mode={quotation.quotationPricingMode}
                vendorQuoteFinalized={quotation.vendorQuoteFinalized}
                vendorCostingMode={vendorCostingMode}
              />

              {vendorCostingMode === "multi_vendor" && selectedVendorQuotes.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-purple-100 bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700">
                  {selectedVendorQuotes.length} vendors
                </span>
              )}

              {assetCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                  <Package size={12} />
                  {assetCount} Assets
                </span>
              )}
            </div>

            <h3 className="mt-3 text-base font-semibold text-gray-900">
              {quotation.isFinalQuotation
                ? "Final Quotation"
                : isDraft
                  ? "Draft Quotation"
                  : "Customer Quotation"}
            </h3>

            <p className="mt-1 text-xs text-gray-500">
              Created by {getCreatedBy(quotation)} ·{" "}
              {formatDateTime(getCreatedAt(quotation))}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onGeneratePdf?.(quotation)}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
            >
              <Download size={14} />
              PDF
            </button>

            <button
              type="button"
              onClick={() => onView?.(quotation)}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              <Eye size={14} />
              View
            </button>

            {isDraft ? (
              <>
                <button
                  type="button"
                  onClick={() => onEditDraft?.(quotation)}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  <Pencil size={14} />
                  Edit Draft
                </button>

                {canDeleteDraft && (
                  <button
                    type="button"
                    onClick={() => onDeleteDraft?.(quotation)}
                    disabled={deleting}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    Delete Draft
                  </button>
                )}
              </>
            ) : (
              <>
                {canResend && (
                  <button
                    type="button"
                    onClick={() => onResend?.(quotation)}
                    disabled={resending}
                    className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {resending ? <Loader2 size={14} className="animate-spin" /> : <Repeat2 size={14} />}
                    Resend Quote
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onCreateRevision?.(createRevisionSeed(quotation))}
                  className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-3 py-2 text-xs font-semibold text-white hover:bg-purple-700"
                >
                  <Copy size={14} />
                  Create Revision
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={ReceiptText}
          label="Customer Quote"
          value={formatMoney(amount, currency)}
          tone="blue"
        />

        <Metric
          icon={BadgeIndianRupee}
          label={
            vendorCostingMode === "multi_vendor"
              ? "Total Vendor Cost"
              : "Vendor Cost"
          }
          value={vendorCost === null ? "—" : formatMoney(vendorCost, currency)}
          tone="purple"
        />

        <Metric
          icon={TrendingUp}
          label="Gross Profit"
          value={profit === null ? "—" : formatMoney(profit, currency)}
          tone={profit !== null && profit < 0 ? "red" : "green"}
        />

        <Metric
          icon={Percent}
          label="Margin"
          value={formatPercent(margin)}
          tone={profit !== null && profit < 0 ? "red" : "green"}
        />
      </div>

      <div className="px-4 pb-4">
        <QuotationAssetSummary quotation={quotation} compact />
      </div>

      <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <ChannelBadges sentVia={quotation.sentVia || quotation.sendVia} />

          <div className="flex items-center gap-2 text-xs text-gray-500">
            <CalendarClock size={13} />
            {formatDateTime(getCreatedAt(quotation))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================
   MAIN COMPONENT
========================= */

export default function QuotationHistory({
  lead,
  onEditDraft,
  onCreateRevision
}) {
  const leadId = getLeadId(lead);
  const { user } = useAuth();

  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedQuotation, setSelectedQuotation] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletingId, setDeletingId] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [resendTarget, setResendTarget] = useState(null);
  const [resendingId, setResendingId] = useState("");
  const [resendError, setResendError] = useState("");
  const [resendSuccess, setResendSuccess] = useState("");
  const [resendChannels, setResendChannels] = useState({
    email: false,
    whatsapp: false
  });

  useEffect(() => {
    if (!leadId) {
      setQuotations([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError("");

    const q = query(
      collection(db, "leads", leadId, "quotations"),
      orderBy("revision", "desc")
    );

    const unsub = onSnapshot(
      q,
      snapshot => {
        const rows = snapshot.docs
          .map(docSnap => ({
            id: docSnap.id,
            quotationId: docSnap.id,
            ...docSnap.data()
          }))
          .filter(item => item.isDeleted !== true && item.deleted !== true);

        setQuotations(rows);
        setLoading(false);
      },
      error => {
        setLoadError(error?.message || "Failed to load quotation history.");
        setLoading(false);
      }
    );

    return () => unsub();
  }, [leadId]);

  const handleGeneratePdf = async quotation => {
    const result = await generateQuotationPdf({ quotation, lead });
    if (!result?.ok && result?.reason === "popup_blocked") {
      alert("Please allow pop-ups for this CRM to generate the quotation PDF.");
    }
  };

  const handleDeleteDraft = async () => {
    if (!deleteTarget || !leadId || !user) return;

    const quotationId = deleteTarget.id || deleteTarget.quotationId;
    setDeletingId(quotationId);
    setDeleteError("");

    try {
      await deleteQuotationDraft({
        leadId,
        quotationId,
        user
      });
      setDeleteTarget(null);
      if (selectedQuotation?.id === quotationId || selectedQuotation?.quotationId === quotationId) {
        setSelectedQuotation(null);
      }
    } catch (error) {
      setDeleteError(error?.message || "Unable to delete draft quotation.");
    } finally {
      setDeletingId("");
    }
  };

  const openResend = quotation => {
    const recipient = getLeadRecipient(lead);
    const sentVia = normalizeSentVia(quotation?.sentVia || quotation?.sendVia);
    const emailOriginallyUsed = sentVia.includes("email");
    const whatsappOriginallyUsed = sentVia.includes("whatsapp");

    setResendChannels({
      email: Boolean(recipient.email && (emailOriginallyUsed || !whatsappOriginallyUsed)),
      whatsapp: Boolean(recipient.mobile && whatsappOriginallyUsed)
    });
    setResendError("");
    setResendSuccess("");
    setResendTarget(quotation);
  };

  const handleResend = async () => {
    if (!resendTarget || !leadId || !user) return;

    const quotationId = resendTarget.id || resendTarget.quotationId;
    const channels = Object.entries(resendChannels)
      .filter(([, enabled]) => enabled)
      .map(([channel]) => channel);

    setResendingId(quotationId);
    setResendError("");
    setResendSuccess("");

    try {
      const result = await resendQuotation({
        lead,
        leadId,
        quotationId,
        channels,
        user
      });

      setResendSuccess(
        `Quotation${result?.revision ? ` Rev ${result.revision}` : ""} resent via ${result.channels.join(" & ")}.`
      );
      setResendTarget(null);
    } catch (error) {
      setResendError(error?.message || "Unable to resend quotation.");
    } finally {
      setResendingId("");
    }
  };

  const stats = useMemo(() => {
    const total = quotations.length;

    const draft = quotations.filter(isDraftQuotation).length;

    const sent = quotations.filter(
      item => item?.status === "sent"
    ).length;

    const finalQuote = quotations.filter(
      item => item?.isFinalQuotation || item?.status === "final"
    ).length;

    const assets = quotations.reduce((sum, item) => {
      return sum + Number(getQuotationAssetCount(item) || 0);
    }, 0);

    return {
      total,
      draft,
      sent,
      finalQuote,
      assets
    };
  }, [quotations]);

  return (
    <Card className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
            Quotation History
          </p>

          <h3 className="mt-1 text-lg font-semibold text-gray-900">
            All Quotation Revisions
          </h3>

          <p className="mt-1 text-sm text-gray-500">
            Track drafts, sent quotes, final quotations, pricing mode, vendor cost,
            profit, margin and shared assets for this lead.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-5">
          <div className="rounded-2xl bg-gray-50 px-3 py-2">
            <p className="text-lg font-bold text-gray-900">{stats.total}</p>
            <p className="text-[11px] text-gray-500">Total</p>
          </div>

          <div className="rounded-2xl bg-amber-50 px-3 py-2">
            <p className="text-lg font-bold text-amber-700">{stats.draft}</p>
            <p className="text-[11px] text-amber-700">Draft</p>
          </div>

          <div className="rounded-2xl bg-blue-50 px-3 py-2">
            <p className="text-lg font-bold text-blue-700">{stats.sent}</p>
            <p className="text-[11px] text-blue-700">Sent</p>
          </div>

          <div className="rounded-2xl bg-green-50 px-3 py-2">
            <p className="text-lg font-bold text-green-700">{stats.finalQuote}</p>
            <p className="text-[11px] text-green-700">Final</p>
          </div>

          <div className="rounded-2xl bg-indigo-50 px-3 py-2">
            <p className="text-lg font-bold text-indigo-700">{stats.assets}</p>
            <p className="text-[11px] text-indigo-700">Assets</p>
          </div>
        </div>
      </div>

      {loadError && (
        <div className="flex items-start gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle size={17} className="mt-0.5 shrink-0" />
          <span>{loadError}</span>
        </div>
      )}

      {deleteError && (
        <div className="flex items-start gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle size={17} className="mt-0.5 shrink-0" />
          <span>{deleteError}</span>
        </div>
      )}

      {resendError && (
        <div className="flex items-start gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle size={17} className="mt-0.5 shrink-0" />
          <span>{resendError}</span>
        </div>
      )}

      {resendSuccess && (
        <div className="rounded-2xl border border-green-100 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          {resendSuccess}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(item => (
            <div
              key={item}
              className="h-40 animate-pulse rounded-3xl bg-gray-100"
            />
          ))}
        </div>
      ) : quotations.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-4">
          {quotations.map(quotation => (
            <QuotationCard
              key={quotation.id || quotation.quotationId}
              quotation={quotation}
              onView={setSelectedQuotation}
              onEditDraft={onEditDraft}
              onCreateRevision={onCreateRevision}
              onDeleteDraft={setDeleteTarget}
              onResend={openResend}
              onGeneratePdf={handleGeneratePdf}
              canDeleteDraft={canDeleteQuotationDraft(quotation, user)}
              canResend={canResendQuotation(quotation)}
              deleting={deletingId === (quotation.id || quotation.quotationId)}
              resending={resendingId === (quotation.id || quotation.quotationId)}
            />
          ))}
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-red-50 p-3 text-red-600">
                <Trash2 size={20} />
              </div>
              <div>
                <h4 className="text-base font-semibold text-gray-900">Delete draft quotation?</h4>
                <p className="mt-1 text-sm text-gray-500">
                  Rev {deleteTarget.revision || "—"} will be removed from normal quotation history. This is a soft delete and does not delete the lead or travel agent.
                </p>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setDeleteTarget(null); setDeleteError(""); }}
                disabled={Boolean(deletingId)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Keep Draft
              </button>
              <button
                type="button"
                onClick={handleDeleteDraft}
                disabled={Boolean(deletingId)}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deletingId ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                Delete Draft
              </button>
            </div>
          </div>
        </div>
      )}

      {resendTarget && (() => {
        const recipient = getLeadRecipient(lead);
        const anySelected = resendChannels.email || resendChannels.whatsapp;
        const quotationId = resendTarget.id || resendTarget.quotationId;
        const isResending = resendingId === quotationId;

        return (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 p-4">
            <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-blue-50 p-3 text-blue-600">
                  <Repeat2 size={20} />
                </div>
                <div>
                  <h4 className="text-base font-semibold text-gray-900">Resend quotation?</h4>
                  <p className="mt-1 text-sm text-gray-500">
                    This sends the exact saved Rev {resendTarget.revision || "—"}. It does not create a new revision or change pricing/content.
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <label className={`flex items-start gap-3 rounded-2xl border p-4 ${recipient.email ? "border-gray-200" : "border-gray-100 bg-gray-50 opacity-60"}`}>
                  <input
                    type="checkbox"
                    checked={resendChannels.email}
                    disabled={!recipient.email || isResending}
                    onChange={event => setResendChannels(current => ({ ...current, email: event.target.checked }))}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600"
                  />
                  <div>
                    <p className="flex items-center gap-2 text-sm font-semibold text-gray-900"><Mail size={14} /> Email</p>
                    <p className="mt-0.5 text-xs text-gray-500">{recipient.email || "No recipient email on lead"}</p>
                  </div>
                </label>

                <label className={`flex items-start gap-3 rounded-2xl border p-4 ${recipient.mobile ? "border-gray-200" : "border-gray-100 bg-gray-50 opacity-60"}`}>
                  <input
                    type="checkbox"
                    checked={resendChannels.whatsapp}
                    disabled={!recipient.mobile || isResending}
                    onChange={event => setResendChannels(current => ({ ...current, whatsapp: event.target.checked }))}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-green-600"
                  />
                  <div>
                    <p className="flex items-center gap-2 text-sm font-semibold text-gray-900"><MessageCircle size={14} /> WhatsApp</p>
                    <p className="mt-0.5 text-xs text-gray-500">{recipient.mobile || "No recipient mobile on lead"}</p>
                  </div>
                </label>
              </div>

              {resendError && (
                <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {resendError}
                </div>
              )}

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setResendTarget(null); setResendError(""); }}
                  disabled={isResending}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={!anySelected || isResending}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isResending ? <Loader2 size={15} className="animate-spin" /> : <Repeat2 size={15} />}
                  Resend Quote
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <QuotationDetailsModal
        quotation={selectedQuotation}
        onClose={() => setSelectedQuotation(null)}
        onDeleteDraft={setDeleteTarget}
        onResend={openResend}
        onGeneratePdf={handleGeneratePdf}
        canDeleteDraft={canDeleteQuotationDraft(selectedQuotation || {}, user)}
        canResend={canResendQuotation(selectedQuotation || {})}
        deleting={Boolean(selectedQuotation && deletingId === (selectedQuotation.id || selectedQuotation.quotationId))}
        resending={Boolean(selectedQuotation && resendingId === (selectedQuotation.id || selectedQuotation.quotationId))}
      />
    </Card>
  );
}