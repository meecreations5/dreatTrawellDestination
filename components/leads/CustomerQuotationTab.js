"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  orderBy,
  query
} from "firebase/firestore";

import {
  AlertTriangle,
  BadgeIndianRupee,
  Calculator,
  CheckCircle2,
  FileText,
  IndianRupee,
  Loader2,
  Percent,
  RefreshCcw,
  Sparkles,
  TrendingUp
} from "lucide-react";

import { db } from "@/lib/firebase";

/* =========================
   HELPERS
========================= */

function cleanString(value = "") {
  return String(value || "").trim();
}

function getNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function getNullableNumber(...values) {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;

    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }

  return null;
}

function getLeadId(lead) {
  return lead?.id || lead?.leadId || "";
}

function toDate(value) {
  if (!value) return null;
  if (value?.toDate) return value.toDate();
  if (value instanceof Date) return value;

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

function formatMoney(value, currency = "INR") {
  const amount = getNumber(value);

  if (!amount) return "—";

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
  const number = Number(value || 0);

  if (!Number.isFinite(number)) return "0%";

  return `${number.toFixed(2)}%`;
}

function getQuotePrice(quote) {
  return getNullableNumber(
    quote?.vendorCost,
    quote?.selectedVendorCost,
    quote?.price,
    quote?.amount
  );
}

function getQuoteDate(quote) {
  return (
    quote?.quoteDate ||
    quote?.receivedAt ||
    quote?.createdAt ||
    quote?.updatedAt
  );
}

function isFinalQuote(quote, lead) {
  const quoteId = cleanString(quote?.id || quote?.vendorQuoteId);

  const leadFinalQuoteId = cleanString(
    lead?.selectedVendorQuoteId ||
      lead?.finalVendorQuoteId ||
      lead?.latestSelectedVendorQuoteId
  );

  return Boolean(
    quote?.selected ||
      quote?.isFinal ||
      quote?.status === "selected" ||
      (quoteId && leadFinalQuoteId && quoteId === leadFinalQuoteId)
  );
}

function getInitialCustomerAmount(lead) {
  return (
    lead?.latestCustomerQuoteAmount ||
    lead?.finalCustomerQuoteAmount ||
    lead?.latestQuotationAmount ||
    lead?.finalQuotationAmount ||
    ""
  );
}

/* =========================
   MINI COMPONENTS
========================= */

function SourceCard({
  active,
  icon: Icon,
  title,
  description,
  badge,
  onClick
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        text-left rounded-2xl border p-4 transition
        ${
          active
            ? "border-purple-300 bg-purple-50 ring-2 ring-purple-100"
            : "border-gray-100 bg-white hover:border-purple-200 hover:bg-purple-50/40"
        }
      `}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="h-10 w-10 rounded-2xl bg-white border border-gray-100 flex items-center justify-center text-purple-700">
          {Icon && <Icon size={18} />}
        </div>

        {badge && (
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-600">
            {badge}
          </span>
        )}
      </div>

      <h3 className="mt-3 text-sm font-semibold text-gray-950">
        {title}
      </h3>

      <p className="mt-1 text-xs text-gray-500 leading-5">
        {description}
      </p>
    </button>
  );
}

function MetricCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = "blue"
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
            : "bg-blue-50 border-blue-100 text-blue-700";

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

      {helper && (
        <p className="mt-1 text-xs text-gray-500">
          {helper}
        </p>
      )}
    </div>
  );
}

/* =========================
   MAIN COMPONENT
========================= */

export default function CustomerQuotationTab({
  lead,
  onCreateQuotation
}) {
  const leadId = getLeadId(lead);

  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [vendorQuotes, setVendorQuotes] = useState([]);
  const [loadError, setLoadError] = useState("");

  const [pricingMode, setPricingMode] = useState("direct");
  const [selectedVendorQuoteId, setSelectedVendorQuoteId] = useState("");
  const [selectedVendorQuoteIds, setSelectedVendorQuoteIds] = useState([]);
  const [manualVendorCost, setManualVendorCost] = useState("");
  const [customerQuoteAmount, setCustomerQuoteAmount] = useState(
    getInitialCustomerAmount(lead)
  );

  const [initialized, setInitialized] = useState(false);

  const loadVendorQuotes = async () => {
    if (!leadId) return;

    setLoadingQuotes(true);
    setLoadError("");

    try {
      const vendorRequestsSnap = await getDocs(
        collection(db, "leads", leadId, "vendorRequests")
      );

      const allQuotes = [];

      for (const requestDoc of vendorRequestsSnap.docs) {
        const request = {
          id: requestDoc.id,
          vendorRequestId: requestDoc.id,
          ...requestDoc.data()
        };

        const vendorQuotesRef = collection(
          db,
          "leads",
          leadId,
          "vendorRequests",
          requestDoc.id,
          "vendorQuotes"
        );

        const quotesSnap = await getDocs(
          query(vendorQuotesRef, orderBy("revision", "desc"))
        );

        quotesSnap.docs.forEach(quoteDoc => {
          const quote = {
            id: quoteDoc.id,
            vendorQuoteId: quoteDoc.id,

            vendorRequestId: requestDoc.id,
            vendorId: request.vendorId || request.vendor?.id || "",
            vendorName: request.vendorName || request.vendor?.name || "",
            vendorCode: request.vendorCode || "",

            vendorType: request.vendorType || request.vendor?.vendorType || "",
            vendorTypeLabel:
              request.vendorTypeLabel ||
              request.vendor?.vendorTypeLabel ||
              request.vendorType ||
              "",

            serviceType:
              request.serviceType ||
              request.vendorType ||
              request.vendor?.vendorType ||
              "other",

            serviceLabel:
              request.serviceLabel ||
              request.vendorTypeLabel ||
              request.vendor?.vendorTypeLabel ||
              request.vendorType ||
              "Vendor Cost",

            requestStatus: request.status || "",
            ...quoteDoc.data()
          };

          allQuotes.push({
            ...quote,
            vendorQuoteFinalized: isFinalQuote(quote, lead)
          });
        });
      }

      allQuotes.sort((a, b) => {
        const aFinal = a.vendorQuoteFinalized ? 1 : 0;
        const bFinal = b.vendorQuoteFinalized ? 1 : 0;

        if (aFinal !== bFinal) return bFinal - aFinal;

        const aDate = toDate(getQuoteDate(a))?.getTime() || 0;
        const bDate = toDate(getQuoteDate(b))?.getTime() || 0;

        if (aDate !== bDate) return bDate - aDate;

        return Number(b.revision || 0) - Number(a.revision || 0);
      });

      setVendorQuotes(allQuotes);

      if (!initialized) {
        const finalQuote = allQuotes.find(item => item.vendorQuoteFinalized);

        if (finalQuote) {
          setPricingMode("vendor_quote");
          setSelectedVendorQuoteId(finalQuote.id);
        }

        setInitialized(true);
      }
    } catch (error) {
      setLoadError(error?.message || "Failed to load vendor pricing.");
    } finally {
      setLoadingQuotes(false);
    }
  };

  useEffect(() => {
    setInitialized(false);
    setCustomerQuoteAmount(getInitialCustomerAmount(lead));
    setSelectedVendorQuoteId("");
    setSelectedVendorQuoteIds([]);
    setManualVendorCost("");
  }, [leadId]);

  useEffect(() => {
    loadVendorQuotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId, initialized]);

  const toggleMultiVendorQuote = quoteId => {
    const cleanQuoteId = cleanString(quoteId);

    if (!cleanQuoteId) return;

    setSelectedVendorQuoteIds(prev => {
      if (prev.includes(cleanQuoteId)) {
        return prev.filter(id => id !== cleanQuoteId);
      }

      return [...prev, cleanQuoteId];
    });
  };

  const selectedVendorQuote = useMemo(() => {
    return (
      vendorQuotes.find(
        item =>
          item.id === selectedVendorQuoteId ||
          item.vendorQuoteId === selectedVendorQuoteId
      ) || null
    );
  }, [vendorQuotes, selectedVendorQuoteId]);

  const selectedVendorQuotes = useMemo(() => {
    return vendorQuotes
      .filter(item => {
        const quoteId = cleanString(item.id || item.vendorQuoteId);
        return selectedVendorQuoteIds.includes(quoteId);
      })
      .map(item => {
        const quoteId = cleanString(item.id || item.vendorQuoteId);
        const amount = getQuotePrice(item);

        return {
          vendorId: cleanString(item.vendorId),
          vendorName: cleanString(item.vendorName),
          vendorCode: cleanString(item.vendorCode),

          vendorRequestId: cleanString(item.vendorRequestId),
          vendorQuoteId: quoteId,

          serviceType: cleanString(
            item.serviceType ||
              item.vendorType ||
              "other"
          ),

          serviceLabel: cleanString(
            item.serviceLabel ||
              item.vendorTypeLabel ||
              item.vendorType ||
              "Vendor Cost"
          ),

          currency: cleanString(item.currency || "INR"),
          amount,

          revision: Number(item.revision || 1),

          referenceText: cleanString(item.referenceText),
          referenceFileUrl: cleanString(item.referenceFileUrl),
          referenceFileName: cleanString(item.referenceFileName)
        };
      })
      .filter(item => item.vendorQuoteId && item.amount !== null);
  }, [vendorQuotes, selectedVendorQuoteIds]);

  const hasVendorQuotes = vendorQuotes.length > 0;

  const multiVendorCurrency =
    selectedVendorQuotes[0]?.currency ||
    lead?.selectedVendorCurrency ||
    lead?.finalVendorCurrency ||
    "INR";

  const hasMixedCurrencies =
    selectedVendorQuotes.length > 1 &&
    selectedVendorQuotes.some(
      item => cleanString(item.currency || "INR") !== multiVendorCurrency
    );

  const totalMultiVendorCost = selectedVendorQuotes.reduce(
    (sum, item) => sum + getNumber(item.amount),
    0
  );

  const hasMultiVendorSelection = selectedVendorQuotes.length > 0;

  const selectedCurrency =
    pricingMode === "multi_vendor"
      ? multiVendorCurrency
      : selectedVendorQuote?.currency ||
        lead?.selectedVendorCurrency ||
        lead?.finalVendorCurrency ||
        "INR";

  const vendorCost =
    pricingMode === "vendor_quote"
      ? getQuotePrice(selectedVendorQuote)
      : pricingMode === "multi_vendor"
        ? hasMultiVendorSelection
          ? totalMultiVendorCost
          : null
        : pricingMode === "manual_cost"
          ? getNullableNumber(manualVendorCost)
          : null;

  const hasCost = vendorCost !== null && Number.isFinite(vendorCost);

  const sellingPrice = getNumber(customerQuoteAmount);

  const grossProfit =
    hasCost && sellingPrice > 0
      ? sellingPrice - vendorCost
      : null;

  const marginPercent =
    sellingPrice > 0 && grossProfit !== null
      ? (grossProfit / sellingPrice) * 100
      : null;

  const markupPercent =
    hasCost && vendorCost > 0 && grossProfit !== null
      ? (grossProfit / vendorCost) * 100
      : null;

  const profitTone =
    grossProfit === null
      ? "blue"
      : grossProfit > 0
        ? "green"
        : grossProfit < 0
          ? "red"
          : "amber";

  const requiresCost =
    pricingMode === "vendor_quote" ||
    pricingMode === "multi_vendor" ||
    pricingMode === "manual_cost";

  const canCreateQuotation =
    sellingPrice > 0 &&
    (
      pricingMode === "direct" ||
      (
        requiresCost &&
        hasCost &&
        grossProfit >= 0 &&
        !hasMixedCurrencies
      )
    );

  const selectedVendorName =
    pricingMode === "vendor_quote"
      ? cleanString(selectedVendorQuote?.vendorName)
      : pricingMode === "multi_vendor"
        ? "Multiple Vendors"
        : pricingMode === "manual_cost"
          ? "Manual Cost"
          : "";

  const pricingSnapshot = {
    quotationPricingMode: pricingMode,

    vendorCostingMode:
      pricingMode === "multi_vendor" ? "multi_vendor" : "single_vendor",

    vendorQuoteFinalized:
      pricingMode === "vendor_quote"
        ? Boolean(selectedVendorQuote?.vendorQuoteFinalized)
        : false,

    selectedVendorQuotes:
      pricingMode === "multi_vendor" ? selectedVendorQuotes : [],

    selectedVendorQuoteIds:
      pricingMode === "multi_vendor"
        ? selectedVendorQuotes.map(item => item.vendorQuoteId)
        : [],

    totalSelectedVendorCost:
      pricingMode === "multi_vendor" ? totalMultiVendorCost : null,

    selectedVendorCost: hasCost ? vendorCost : null,
    selectedVendorCurrency: selectedCurrency,
    selectedVendorName,

    selectedVendorQuoteId:
      pricingMode === "vendor_quote"
        ? cleanString(selectedVendorQuote?.id || selectedVendorQuote?.vendorQuoteId)
        : "",

    selectedVendorRequestId:
      pricingMode === "vendor_quote"
        ? cleanString(selectedVendorQuote?.vendorRequestId)
        : "",

    customerQuoteAmount: sellingPrice,
    customerQuoteCurrency: selectedCurrency,

    grossProfit,
    marginPercent,
    markupPercent
  };

  const createButtonLabel =
    pricingMode === "direct"
      ? "Create Direct Quote"
      : pricingMode === "manual_cost"
        ? "Create Quote with Manual Cost"
        : pricingMode === "multi_vendor"
          ? "Create Quote from Multi Vendor Cost"
          : selectedVendorQuote?.vendorQuoteFinalized
            ? "Create Quote from Final Cost"
            : "Create Quote from Vendor Pricing";

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="rounded-3xl border border-purple-100 bg-gradient-to-r from-purple-50 to-blue-50 p-5">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-purple-700">
              Customer Quotation
            </p>

            <h2 className="text-lg font-semibold text-gray-900 mt-1">
              Choose Pricing Source & Prepare Quote
            </h2>

            <p className="text-sm text-gray-500 mt-1">
              Create direct quote, use single vendor pricing, combine multiple vendor costs, or use manual costing.
            </p>
          </div>

          <button
            type="button"
            disabled={!canCreateQuotation}
            onClick={() => onCreateQuotation?.(pricingSnapshot)}
            className="
              inline-flex items-center justify-center gap-2
              rounded-xl bg-purple-600 px-4 py-2.5
              text-sm font-semibold text-white hover:bg-purple-700
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            <FileText size={16} />
            {createButtonLabel}
          </button>
        </div>
      </div>

      {/* SOURCE SELECTION */}
      <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              Pricing Source
            </h3>

            <p className="text-xs text-gray-500 mt-1">
              Select how this customer quotation should be priced.
            </p>
          </div>

          <button
            type="button"
            onClick={loadVendorQuotes}
            disabled={loadingQuotes}
            className="
              inline-flex items-center gap-2 rounded-xl border border-gray-200
              bg-white px-3 py-2 text-xs font-semibold text-gray-600
              hover:bg-gray-50 disabled:opacity-60
            "
          >
            {loadingQuotes ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCcw size={14} />
            )}
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
          <SourceCard
            active={pricingMode === "direct"}
            icon={Sparkles}
            title="Direct Quote"
            description="Send customer quotation without vendor cost. Profit/margin will not be calculated."
            badge="Always available"
            onClick={() => setPricingMode("direct")}
          />

          <SourceCard
            active={pricingMode === "vendor_quote"}
            icon={BadgeIndianRupee}
            title="Single Vendor Pricing"
            description="Use one received vendor quote as the cost base. Final selection is not required."
            badge={hasVendorQuotes ? `${vendorQuotes.length} quote(s)` : "No quotes"}
            onClick={() => setPricingMode("vendor_quote")}
          />

          <SourceCard
            active={pricingMode === "multi_vendor"}
            icon={BadgeIndianRupee}
            title="Multi Vendor Costing"
            description="Select multiple vendor quotes and use their total as internal package cost."
            badge={
              selectedVendorQuotes.length
                ? `${selectedVendorQuotes.length} selected`
                : "Package costing"
            }
            onClick={() => setPricingMode("multi_vendor")}
          />

          <SourceCard
            active={pricingMode === "manual_cost"}
            icon={Calculator}
            title="Manual Cost"
            description="Enter estimated internal cost manually and calculate profit/margin."
            badge="Manual"
            onClick={() => setPricingMode("manual_cost")}
          />
        </div>

        {loadError && (
          <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {loadError}
          </div>
        )}
      </div>

      {/* SINGLE VENDOR QUOTE SELECTION */}
      {pricingMode === "vendor_quote" && (
        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <BadgeIndianRupee size={18} className="text-purple-700 mt-0.5" />

            <div className="flex-1">
              <h3 className="text-sm font-semibold text-gray-900">
                Select Vendor Pricing
              </h3>

              <p className="text-xs text-gray-500 mt-1">
                You can use any received vendor pricing. Finalized pricing is highlighted.
              </p>
            </div>
          </div>

          {loadingQuotes ? (
            <div className="mt-4 rounded-2xl bg-gray-100 h-24 animate-pulse" />
          ) : vendorQuotes.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="text-amber-700 mt-0.5" />

                <div>
                  <p className="text-sm font-semibold text-amber-900">
                    No vendor pricing received yet.
                  </p>

                  <p className="text-xs text-amber-700 mt-1">
                    You can still use Direct Quote or Manual Cost mode.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {vendorQuotes.map(quote => {
                const quoteId = quote.id || quote.vendorQuoteId;
                const active = quoteId === selectedVendorQuoteId;
                const price = getQuotePrice(quote);

                return (
                  <button
                    key={`${quote.vendorRequestId}-${quoteId}`}
                    type="button"
                    onClick={() => setSelectedVendorQuoteId(quoteId)}
                    className={`
                      w-full rounded-2xl border p-4 text-left transition
                      ${
                        active
                          ? "border-purple-300 bg-purple-50 ring-2 ring-purple-100"
                          : "border-gray-100 bg-white hover:border-purple-200 hover:bg-purple-50/40"
                      }
                    `}
                  >
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-gray-900">
                            {quote.vendorName || "Vendor"}
                          </p>

                          {quote.vendorCode && (
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                              {quote.vendorCode}
                            </span>
                          )}

                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                            Rev {quote.revision || 1}
                          </span>

                          {quote.vendorQuoteFinalized && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">
                              <CheckCircle2 size={12} />
                              Final
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-gray-500 mt-1">
                          {quote.serviceLabel ||
                            quote.vendorTypeLabel ||
                            quote.vendorType ||
                            "Vendor Cost"}
                        </p>

                        <p className="text-xs text-gray-400 mt-1">
                          Received: {formatDateTime(getQuoteDate(quote))}
                        </p>
                      </div>

                      <div className="text-left md:text-right">
                        <p className="text-xs text-gray-500">
                          Vendor Cost
                        </p>

                        <p className="text-lg font-bold text-gray-950">
                          {formatMoney(price, quote.currency || "INR")}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MULTI VENDOR QUOTE SELECTION */}
      {pricingMode === "multi_vendor" && (
        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <BadgeIndianRupee size={18} className="text-purple-700 mt-0.5" />

            <div className="flex-1">
              <h3 className="text-sm font-semibold text-gray-900">
                Select Multiple Vendor Costs
              </h3>

              <p className="text-xs text-gray-500 mt-1">
                Select hotel, transport, activity, visa or other vendor prices. The system will calculate total vendor cost.
              </p>
            </div>
          </div>

          {loadingQuotes ? (
            <div className="mt-4 rounded-2xl bg-gray-100 h-24 animate-pulse" />
          ) : vendorQuotes.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="text-amber-700 mt-0.5" />

                <div>
                  <p className="text-sm font-semibold text-amber-900">
                    No vendor pricing received yet.
                  </p>

                  <p className="text-xs text-amber-700 mt-1">
                    Add vendor pricing first, or use Direct Quote / Manual Cost mode.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {vendorQuotes.map(quote => {
                const quoteId = quote.id || quote.vendorQuoteId;
                const checked = selectedVendorQuoteIds.includes(quoteId);
                const price = getQuotePrice(quote);

                return (
                  <button
                    key={`${quote.vendorRequestId}-${quoteId}`}
                    type="button"
                    onClick={() => toggleMultiVendorQuote(quoteId)}
                    className={`
                      w-full rounded-2xl border p-4 text-left transition
                      ${
                        checked
                          ? "border-purple-300 bg-purple-50 ring-2 ring-purple-100"
                          : "border-gray-100 bg-white hover:border-purple-200 hover:bg-purple-50/40"
                      }
                    `}
                  >
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`
                              flex h-5 w-5 items-center justify-center rounded-md border text-xs font-bold
                              ${
                                checked
                                  ? "border-purple-600 bg-purple-600 text-white"
                                  : "border-gray-300 bg-white text-transparent"
                              }
                            `}
                          >
                            ✓
                          </span>

                          <p className="text-sm font-semibold text-gray-900">
                            {quote.vendorName || "Vendor"}
                          </p>

                          {quote.vendorCode && (
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                              {quote.vendorCode}
                            </span>
                          )}

                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                            Rev {quote.revision || 1}
                          </span>

                          {quote.vendorQuoteFinalized && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">
                              <CheckCircle2 size={12} />
                              Final
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-gray-500 mt-1">
                          {quote.serviceLabel ||
                            quote.vendorTypeLabel ||
                            quote.vendorType ||
                            "Vendor Cost"}
                        </p>

                        <p className="text-xs text-gray-400 mt-1">
                          Received: {formatDateTime(getQuoteDate(quote))}
                        </p>
                      </div>

                      <div className="text-left md:text-right">
                        <p className="text-xs text-gray-500">
                          Cost
                        </p>

                        <p className="text-lg font-bold text-gray-950">
                          {formatMoney(price, quote.currency || "INR")}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {selectedVendorQuotes.length > 0 && (
            <div className="mt-4 rounded-2xl border border-purple-100 bg-purple-50 p-4">
              <p className="text-sm font-semibold text-purple-900">
                Selected Vendor Cost Summary
              </p>

              <div className="mt-3 space-y-2">
                {selectedVendorQuotes.map(item => (
                  <div
                    key={item.vendorQuoteId}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <div>
                      <p className="font-semibold text-gray-900">
                        {item.vendorName || "Vendor"}
                      </p>

                      <p className="text-xs text-gray-500">
                        {item.serviceLabel || item.serviceType || "Vendor Cost"}
                      </p>
                    </div>

                    <span className="font-semibold text-gray-950">
                      {formatMoney(item.amount, item.currency)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-3 border-t border-purple-100 pt-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-purple-900">
                  Total Vendor Cost
                </span>

                <span className="text-lg font-bold text-purple-900">
                  {formatMoney(totalMultiVendorCost, multiVendorCurrency)}
                </span>
              </div>

              {hasMixedCurrencies && (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  Multiple currencies selected. Please select same-currency quotes for now, or use Manual Cost with converted value.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MANUAL COST */}
      {pricingMode === "manual_cost" && (
        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
            Manual Internal Cost
          </label>

          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">
              ₹
            </span>

            <input
              type="number"
              min="0"
              value={manualVendorCost}
              onChange={event => setManualVendorCost(event.target.value)}
              placeholder="Enter internal/manual cost"
              className="
                w-full rounded-2xl border border-gray-200
                pl-9 pr-4 py-3 text-sm font-semibold
                focus:outline-none focus:ring-2 focus:ring-purple-500
              "
            />
          </div>

          <p className="text-xs text-gray-400 mt-1.5">
            This cost is internal only and will not be shown to the customer.
          </p>
        </div>
      )}

      {/* CALCULATOR */}
      <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* INPUT SIDE */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
                Cost Base
              </label>

              <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                <IndianRupee size={16} className="text-gray-500" />

                <span className="text-sm font-semibold text-gray-900">
                  {pricingMode === "direct"
                    ? "No vendor/internal cost selected"
                    : hasCost
                      ? formatMoney(vendorCost, selectedCurrency)
                      : "Cost not added"}
                </span>
              </div>

              {pricingMode === "direct" && (
                <p className="text-xs text-gray-400 mt-1.5">
                  Direct quote mode will not calculate gross profit or margin.
                </p>
              )}

              {pricingMode === "multi_vendor" && hasMultiVendorSelection && (
                <p className="text-xs text-purple-600 mt-1.5 font-medium">
                  {selectedVendorQuotes.length} vendor quote(s) selected for package cost.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
                Customer Selling Price *
              </label>

              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">
                  ₹
                </span>

                <input
                  type="number"
                  min="0"
                  value={customerQuoteAmount}
                  onChange={event =>
                    setCustomerQuoteAmount(event.target.value)
                  }
                  placeholder="Enter customer quotation amount"
                  className="
                    w-full rounded-2xl border border-gray-200
                    pl-9 pr-4 py-3 text-sm font-semibold
                    focus:outline-none focus:ring-2 focus:ring-purple-500
                  "
                />
              </div>

              <p className="text-xs text-gray-400 mt-1.5">
                Customer-facing quote amount. Internal cost/profit will not be shown to customer.
              </p>
            </div>
          </div>

          {/* PREVIEW SIDE */}
          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
            <div className="flex items-center gap-2">
              <Calculator size={17} className="text-purple-700" />

              <h3 className="text-sm font-semibold text-gray-900">
                Quote Preview
              </h3>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <MetricCard
                label="Selling Price"
                value={formatMoney(sellingPrice, selectedCurrency)}
                helper="Customer-facing amount"
                icon={IndianRupee}
                tone="blue"
              />

              <MetricCard
                label="Cost Base"
                value={
                  hasCost
                    ? formatMoney(vendorCost, selectedCurrency)
                    : "—"
                }
                helper={
                  pricingMode === "direct"
                    ? "Direct quote"
                    : pricingMode === "multi_vendor"
                      ? "Multi vendor total"
                      : "Internal only"
                }
                icon={BadgeIndianRupee}
                tone="purple"
              />

              <MetricCard
                label="Gross Profit"
                value={
                  grossProfit === null
                    ? "—"
                    : formatMoney(grossProfit, selectedCurrency)
                }
                helper={
                  grossProfit === null
                    ? "Cost not selected"
                    : "Selling price - cost"
                }
                icon={TrendingUp}
                tone={profitTone}
              />

              <MetricCard
                label="Margin"
                value={
                  marginPercent === null
                    ? "—"
                    : formatPercent(marginPercent)
                }
                helper={
                  marginPercent === null
                    ? "Cost not selected"
                    : "Profit / selling price"
                }
                icon={Percent}
                tone={profitTone}
              />
            </div>
          </div>
        </div>

        {/* VALIDATION MESSAGE */}
        {requiresCost && sellingPrice > 0 && !hasCost && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Please select or enter cost base for this pricing mode.
          </div>
        )}

        {pricingMode === "multi_vendor" && !hasMultiVendorSelection && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Please select at least one vendor quote for multi vendor costing.
          </div>
        )}

        {pricingMode === "multi_vendor" && hasMixedCurrencies && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Multi vendor costing currently supports same-currency quotes only. Please select same-currency vendor quotes or use Manual Cost with converted value.
          </div>
        )}

        {hasCost && sellingPrice > 0 && grossProfit < 0 && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Customer selling price is lower than cost. Increase selling price before creating quotation.
          </div>
        )}
      </div>
    </div>
  );
}