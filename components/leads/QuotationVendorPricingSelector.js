"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  orderBy,
  query
} from "firebase/firestore";
import {
  BadgeIndianRupee,
  Check,
  CheckCircle2,
  Layers3,
  Loader2,
  RefreshCcw,
  Star,
  Tags
} from "lucide-react";

import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { selectVendorQuote } from "@/lib/leadVendorQuotes";

function cleanString(value = "") {
  return String(value || "").trim();
}

function getLeadId(lead) {
  return cleanString(lead?.id || lead?.leadId);
}

function getNullableNumber(...values) {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function toDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === "object" && Number.isFinite(value?.seconds)) {
    return new Date(Number(value.seconds) * 1000);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value) {
  const date = toDate(value);
  if (!date) return "";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatMoney(value, currency = "INR") {
  const amount = getNullableNumber(value);
  if (amount === null) return "—";
  try {
    return amount.toLocaleString("en-IN", {
      style: "currency",
      currency: cleanString(currency) || "INR",
      maximumFractionDigits: 0
    });
  } catch {
    return `${cleanString(currency) || "INR"} ${amount.toLocaleString("en-IN")}`;
  }
}

function getQuoteAmount(quote = {}) {
  return getNullableNumber(
    quote.vendorCost,
    quote.selectedVendorCost,
    quote.price,
    quote.amount
  );
}

function isFinalVendorQuote(quote = {}, lead = {}) {
  const quoteId = cleanString(quote.id || quote.vendorQuoteId);
  const finalQuoteId = cleanString(
    lead?.selectedVendorQuoteId ||
      lead?.finalVendorQuoteId ||
      lead?.latestSelectedVendorQuoteId
  );

  return Boolean(
    quote.selected ||
      quote.isFinal ||
      quote.status === "selected" ||
      (quoteId && finalQuoteId && quoteId === finalQuoteId)
  );
}

function normalizeQuote({ quoteDoc, requestDoc, lead }) {
  const request = {
    id: requestDoc.id,
    vendorRequestId: requestDoc.id,
    ...requestDoc.data()
  };
  const quote = {
    id: quoteDoc.id,
    vendorQuoteId: quoteDoc.id,
    ...quoteDoc.data()
  };

  const amount = getQuoteAmount(quote);

  return {
    ...quote,
    id: quoteDoc.id,
    vendorQuoteId: quoteDoc.id,
    vendorRequestId: requestDoc.id,
    vendorId: cleanString(request.vendorId || request.vendor?.id),
    vendorName: cleanString(request.vendorName || request.vendor?.name || "Vendor"),
    vendorCode: cleanString(request.vendorCode),
    vendorType: cleanString(request.vendorType || request.vendor?.vendorType),
    vendorTypeLabel: cleanString(
      request.vendorTypeLabel ||
        request.vendor?.vendorTypeLabel ||
        request.vendorType
    ),
    serviceType: cleanString(
      request.serviceType ||
        request.vendorType ||
        request.vendor?.vendorType ||
        "other"
    ),
    serviceLabel: cleanString(
      request.serviceLabel ||
        request.vendorTypeLabel ||
        request.vendor?.vendorTypeLabel ||
        request.vendorType ||
        "Vendor Cost"
    ),
    currency: cleanString(quote.currency || request.currency || "INR") || "INR",
    amount,
    vendorCost: amount,
    revision: Number(quote.revision || 1),
    quoteDate: quote.quoteDate || quote.receivedAt || quote.updatedAt || quote.createdAt || null,
    referenceText: cleanString(
      quote.referenceText ||
        quote.mailContent ||
        quote.vendorMailContent ||
        quote.pricingNote
    ),
    referenceFileUrl: cleanString(
      quote.referenceFileUrl ||
        quote.attachmentUrl ||
        quote.fileUrl ||
        quote.imageUrl
    ),
    referenceFileName: cleanString(
      quote.referenceFileName ||
        quote.attachmentName ||
        quote.fileName ||
        quote.imageName
    ),
    vendorQuoteFinalized: isFinalVendorQuote(quote, lead)
  };
}

function ModeButton({ active, icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
        active
          ? "border-purple-300 bg-purple-50 text-purple-800 ring-2 ring-purple-100"
          : "border-gray-200 bg-white text-gray-600 hover:border-purple-200 hover:bg-purple-50/40"
      }`}
    >
      {Icon ? <Icon size={14} /> : null}
      {label}
    </button>
  );
}

function QuoteRow({ quote, checked, multi, onSelect }) {
  const amount = getQuoteAmount(quote);
  const service = cleanString(quote.serviceLabel || quote.vendorTypeLabel || quote.vendorType || "Vendor Cost");

  return (
    <button
      type="button"
      onClick={() => onSelect?.(quote)}
      disabled={amount === null}
      className={`w-full rounded-2xl border p-3 text-left transition ${
        checked
          ? "border-purple-300 bg-purple-50 ring-2 ring-purple-100"
          : "border-gray-100 bg-white hover:border-purple-200 hover:bg-purple-50/30"
      } disabled:cursor-not-allowed disabled:opacity-50`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-gray-950">
              {quote.vendorName || "Vendor"}
            </span>
            {quote.vendorCode ? (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
                {quote.vendorCode}
              </span>
            ) : null}
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
              {service}
            </span>
            <span className="rounded-full bg-gray-50 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
              Vendor Rev {quote.revision || 1}
            </span>
            {quote.vendorQuoteFinalized ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                <Star size={10} /> Final Vendor Price
              </span>
            ) : null}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
            <span className="font-bold text-gray-900">
              {formatMoney(amount, quote.currency)}
            </span>
            {quote.quoteDate ? <span>{formatDate(quote.quoteDate)}</span> : null}
          </div>
        </div>

        <span
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border ${
            multi ? "rounded-md" : "rounded-full"
          } ${
            checked
              ? "border-purple-600 bg-purple-600 text-white"
              : "border-gray-300 bg-white text-transparent"
          }`}
        >
          <Check size={14} />
        </span>
      </div>
    </button>
  );
}

export default function QuotationVendorPricingSelector({
  lead,
  mode = "direct",
  selectedVendorQuoteId = "",
  selectedVendorQuoteIds = [],
  currentVendorName = "",
  currentVendorCost = null,
  currentVendorCurrency = "INR",
  vendorQuoteFinalized = false,
  onModeChange,
  onUseDirect,
  onUseManual,
  onUseSingleQuote,
  onUseMultiQuotes,
  onFinalizedQuote
}) {
  const { user } = useAuth();
  const leadId = getLeadId(lead);

  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [finalizingId, setFinalizingId] = useState("");
  const [success, setSuccess] = useState("");

  const loadQuotes = useCallback(async () => {
    if (!leadId) {
      setQuotes([]);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const requestSnap = await getDocs(
        collection(db, "leads", leadId, "vendorRequests")
      );
      const rows = [];

      for (const requestDoc of requestSnap.docs) {
        const quotesRef = collection(
          db,
          "leads",
          leadId,
          "vendorRequests",
          requestDoc.id,
          "vendorQuotes"
        );

        let quoteSnap;
        try {
          quoteSnap = await getDocs(query(quotesRef, orderBy("revision", "desc")));
        } catch {
          quoteSnap = await getDocs(quotesRef);
        }

        quoteSnap.docs.forEach(quoteDoc => {
          const normalized = normalizeQuote({ quoteDoc, requestDoc, lead });
          if (normalized.amount !== null) rows.push(normalized);
        });
      }

      rows.sort((a, b) => {
        const aFinal = a.vendorQuoteFinalized ? 1 : 0;
        const bFinal = b.vendorQuoteFinalized ? 1 : 0;
        if (aFinal !== bFinal) return bFinal - aFinal;

        const aDate = toDate(a.quoteDate)?.getTime() || 0;
        const bDate = toDate(b.quoteDate)?.getTime() || 0;
        if (aDate !== bDate) return bDate - aDate;

        return Number(b.revision || 0) - Number(a.revision || 0);
      });

      setQuotes(rows);
    } catch (loadError) {
      setError(loadError?.message || "Unable to load vendor prices.");
    } finally {
      setLoading(false);
    }
  }, [leadId, lead]);

  useEffect(() => {
    loadQuotes();
  }, [loadQuotes]);

  const cleanSelectedIds = useMemo(
    () => (Array.isArray(selectedVendorQuoteIds) ? selectedVendorQuoteIds : [])
      .map(cleanString)
      .filter(Boolean),
    [selectedVendorQuoteIds]
  );

  const selectedSingleQuote = useMemo(
    () => quotes.find(item => cleanString(item.id) === cleanString(selectedVendorQuoteId)) || null,
    [quotes, selectedVendorQuoteId]
  );

  const selectedMultiQuotes = useMemo(
    () => quotes.filter(item => cleanSelectedIds.includes(cleanString(item.id))),
    [quotes, cleanSelectedIds]
  );

  const multiCurrency = selectedMultiQuotes[0]?.currency || "INR";
  const mixedCurrencies = selectedMultiQuotes.length > 1 && selectedMultiQuotes.some(
    item => cleanString(item.currency || "INR") !== cleanString(multiCurrency)
  );
  const multiTotal = selectedMultiQuotes.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );

  const handleMultiSelect = quote => {
    const quoteId = cleanString(quote?.id || quote?.vendorQuoteId);
    if (!quoteId) return;

    const alreadySelected = cleanSelectedIds.includes(quoteId);
    let nextIds;

    if (alreadySelected) {
      nextIds = cleanSelectedIds.filter(id => id !== quoteId);
    } else {
      const sameRequestIds = quotes
        .filter(item => cleanString(item.vendorRequestId) === cleanString(quote.vendorRequestId))
        .map(item => cleanString(item.id));
      nextIds = cleanSelectedIds.filter(id => !sameRequestIds.includes(id));
      nextIds.push(quoteId);
    }

    const nextQuotes = quotes.filter(item => nextIds.includes(cleanString(item.id)));
    const nextCurrency = nextQuotes[0]?.currency || "INR";
    const nextMixed = nextQuotes.length > 1 && nextQuotes.some(
      item => cleanString(item.currency || "INR") !== cleanString(nextCurrency)
    );

    if (nextMixed) {
      setError("Multi-vendor costing supports the same currency only. Choose prices in one currency or use Manual Cost.");
      return;
    }

    setError("");
    onUseMultiQuotes?.(nextQuotes);
  };

  const handleMarkFinal = async () => {
    if (!selectedSingleQuote || !user || !leadId) return;
    const quoteId = cleanString(selectedSingleQuote.id || selectedSingleQuote.vendorQuoteId);
    const requestId = cleanString(selectedSingleQuote.vendorRequestId);
    if (!quoteId || !requestId) return;

    setFinalizingId(quoteId);
    setError("");
    setSuccess("");

    try {
      await selectVendorQuote({
        leadId,
        vendorRequestId: requestId,
        vendorQuoteId: quoteId,
        user
      });

      const updatedQuote = {
        ...selectedSingleQuote,
        selected: true,
        isFinal: true,
        status: "selected",
        vendorQuoteFinalized: true
      };

      onFinalizedQuote?.(updatedQuote);
      setSuccess("Selected vendor price marked as Final Vendor Price.");
      await loadQuotes();
    } catch (finalizeError) {
      setError(finalizeError?.message || "Unable to mark vendor price as final.");
    } finally {
      setFinalizingId("");
    }
  };

  return (
    <div className="rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50/60 to-white p-4 space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BadgeIndianRupee size={17} className="text-purple-700" />
            <p className="text-sm font-semibold text-gray-900">Vendor Price Selection</p>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Select any received vendor price for this quotation. Final vendor pricing is highlighted but is not required just to prepare a quote.
          </p>
        </div>

        <button
          type="button"
          onClick={loadQuotes}
          disabled={loading}
          className="inline-flex w-fit items-center gap-2 rounded-xl border border-purple-200 bg-white px-3 py-2 text-xs font-semibold text-purple-700 hover:bg-purple-50 disabled:opacity-60"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCcw size={13} />}
          Refresh Prices
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <ModeButton
          active={mode === "direct"}
          icon={CheckCircle2}
          label="No Cost"
          onClick={() => {
            onModeChange?.("direct");
            onUseDirect?.();
          }}
        />
        <ModeButton
          active={mode === "vendor_quote"}
          icon={Tags}
          label="Single Vendor"
          onClick={() => onModeChange?.("vendor_quote")}
        />
        <ModeButton
          active={mode === "multi_vendor"}
          icon={Layers3}
          label="Multi Vendor"
          onClick={() => onModeChange?.("multi_vendor")}
        />
        <ModeButton
          active={mode === "manual_cost"}
          icon={BadgeIndianRupee}
          label="Manual Cost"
          onClick={() => {
            onModeChange?.("manual_cost");
            onUseManual?.();
          }}
        />
      </div>

      {(currentVendorName || currentVendorCost !== null) && mode !== "direct" ? (
        <div className="rounded-xl border border-green-100 bg-green-50 px-3 py-2 text-xs text-green-800">
          <span className="font-semibold">Current cost base:</span>{" "}
          {currentVendorName || (mode === "multi_vendor" ? "Multiple Vendors" : "Internal Cost")}{" · "}
          {formatMoney(currentVendorCost, currentVendorCurrency)}
          {vendorQuoteFinalized ? " · Final Vendor Price" : ""}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-xl border border-green-100 bg-green-50 px-3 py-2 text-xs text-green-700">
          {success}
        </div>
      ) : null}

      {(mode === "vendor_quote" || mode === "multi_vendor") && (
        <div className="space-y-2">
          {loading ? (
            <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-4 text-xs text-gray-500">
              <Loader2 size={14} className="animate-spin" /> Loading vendor prices…
            </div>
          ) : quotes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-white px-3 py-4 text-xs text-gray-500">
              No vendor pricing has been added to this lead yet. Add vendor pricing in Vendor Costing, then click Refresh Prices.
            </div>
          ) : (
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {quotes.map(quote => {
                const quoteId = cleanString(quote.id || quote.vendorQuoteId);
                const checked = mode === "multi_vendor"
                  ? cleanSelectedIds.includes(quoteId)
                  : cleanString(selectedVendorQuoteId) === quoteId;

                return (
                  <QuoteRow
                    key={`${quote.vendorRequestId}-${quoteId}`}
                    quote={quote}
                    checked={checked}
                    multi={mode === "multi_vendor"}
                    onSelect={item => {
                      if (mode === "multi_vendor") {
                        handleMultiSelect(item);
                      } else {
                        setError("");
                        onUseSingleQuote?.(item);
                      }
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {mode === "multi_vendor" && selectedMultiQuotes.length > 0 ? (
        <div className="rounded-xl border border-purple-100 bg-white px-3 py-3 text-xs">
          <div className="flex items-center justify-between gap-3">
            <span className="font-semibold text-gray-700">
              {selectedMultiQuotes.length} vendor price(s) selected
            </span>
            <span className="font-bold text-purple-800">
              {formatMoney(multiTotal, multiCurrency)}
            </span>
          </div>
          {mixedCurrencies ? (
            <p className="mt-1 text-red-600">Mixed currencies are not supported.</p>
          ) : null}
        </div>
      ) : null}

      {mode === "vendor_quote" && selectedSingleQuote && !selectedSingleQuote.vendorQuoteFinalized ? (
        <button
          type="button"
          onClick={handleMarkFinal}
          disabled={Boolean(finalizingId)}
          className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-60"
        >
          {finalizingId ? <Loader2 size={13} className="animate-spin" /> : <Star size={13} />}
          Mark Selected Vendor Price as Final
        </button>
      ) : null}
    </div>
  );
}
