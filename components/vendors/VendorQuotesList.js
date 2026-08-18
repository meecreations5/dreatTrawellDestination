"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query
} from "firebase/firestore";

import {
  Building2,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  FileText,
  IndianRupee,
  Loader2,
  Paperclip,
  Star,
  Trophy,
  X
} from "lucide-react";

import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";

import VendorStatusChip from "@/components/vendors/VendorStatusChip";

import {
  selectVendorQuote,
  revokeFinalVendorQuote
} from "@/lib/leadVendorQuotes";

/* =========================
   HELPERS
========================= */

function cleanString(value = "") {
  return String(value || "").trim();
}

function getLeadId(leadId, lead) {
  return leadId || lead?.id || lead?.leadId || "";
}

function getRequestId(vendorRequest) {
  return vendorRequest?.id || vendorRequest?.vendorRequestId || "";
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
  const amount = Number(value || 0);

  if (!Number.isFinite(amount) || amount <= 0) return "—";

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

function getQuotePrice(quote) {
  return Number(
    quote?.vendorCost ||
      quote?.price ||
      quote?.amount ||
      0
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

function isFinalQuote(quote) {
  return Boolean(
    quote?.selected ||
      quote?.isFinal ||
      quote?.status === "selected"
  );
}

/* =========================
   EMPTY STATE
========================= */

function EmptyQuotes({ vendorName }) {
  return (
    <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-8 text-center">
      <div className="h-14 w-14 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center mx-auto">
        <FileText size={25} />
      </div>

      <h3 className="text-base font-semibold text-gray-900 mt-4">
        No pricing received yet
      </h3>

      <p className="text-sm text-gray-500 mt-1">
        Add vendor pricing once you receive it from {vendorName || "vendor"}.
      </p>
    </div>
  );
}

/* =========================
   TEXT BLOCK
========================= */

function TextBlock({ label, value }) {
  if (!cleanString(value)) return null;

  return (
    <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
      <p className="text-xs font-semibold text-gray-500 mb-1">
        {label}
      </p>

      <p className="whitespace-pre-wrap text-sm text-gray-700 leading-6">
        {value}
      </p>
    </div>
  );
}

/* =========================
   STAT CARD
========================= */

function StatCard({ label, value, tone = "blue" }) {
  const toneClass =
    tone === "green"
      ? "bg-green-50 border-green-100 text-green-700"
      : tone === "purple"
        ? "bg-purple-50 border-purple-100 text-purple-700"
        : tone === "amber"
          ? "bg-amber-50 border-amber-100 text-amber-700"
          : "bg-blue-50 border-blue-100 text-blue-700";

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <p className="text-xs font-medium">
        {label}
      </p>

      <h3 className="text-xl font-semibold text-gray-950 mt-1">
        {value}
      </h3>
    </div>
  );
}

/* =========================
   FINAL STATUS BANNER
========================= */

function FinalStatusBanner({ finalQuote }) {
  if (!finalQuote) {
    return (
      <div className="mx-5 mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-sm font-semibold text-amber-900">
          No final vendor pricing selected yet
        </p>

        <p className="text-xs text-amber-700 mt-0.5">
          Mark one quote as final to enable customer quotation and margin calculation.
        </p>
      </div>
    );
  }

  const price = getQuotePrice(finalQuote);
  const currency = finalQuote.currency || "INR";

  return (
    <div className="mx-5 mt-5 rounded-2xl border border-green-200 bg-green-50 px-4 py-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-green-900">
            Final vendor pricing selected
          </p>

          <p className="text-xs text-green-700 mt-0.5">
            Rev {finalQuote.revision || 1} ·{" "}
            {formatMoney(price, currency)} ·{" "}
            {formatDateTime(getQuoteDate(finalQuote))}
          </p>
        </div>

        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800 w-fit">
          <Trophy size={13} />
          Final
        </span>
      </div>
    </div>
  );
}

/* =========================
   QUOTE CARD
========================= */

function QuoteCard({
  quote,
  selected = false,
  selecting = false,
  revoking = false,
  onSelect,
  onRevoke
}) {
  const price = getQuotePrice(quote);
  const currency = quote.currency || "INR";

  const referenceText =
    quote.referenceText ||
    quote.mailContent ||
    quote.vendorMailContent ||
    quote.pricingNote ||
    "";

  const referenceFileUrl =
    quote.referenceFileUrl ||
    quote.attachmentUrl ||
    quote.fileUrl ||
    quote.imageUrl ||
    "";

  const referenceFileName =
    quote.referenceFileName ||
    quote.attachmentName ||
    quote.fileName ||
    quote.imageName ||
    "Open reference";

  return (
    <div
      className={`
        rounded-2xl border shadow-sm overflow-hidden bg-white transition
        ${
          selected
            ? "border-green-300 ring-2 ring-green-50 bg-green-50/30"
            : "border-gray-100 hover:border-purple-200"
        }
      `}
    >
      <div className="p-5">
        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
          <div className="min-w-0 flex-1">
            {/* TOP META */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                Rev {quote.revision || 1}
              </span>

              <VendorStatusChip
                type="quote"
                value={selected ? "selected" : quote.status || "received"}
              />

              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
                <CalendarClock size={13} />
                {formatDateTime(getQuoteDate(quote))}
              </span>

              {selected && (
                <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800">
                  <Trophy size={13} />
                  Final Selected
                </span>
              )}
            </div>

            {/* PRICE */}
            <div className="mt-4 rounded-2xl bg-green-50 border border-green-100 p-4">
              <div className="flex items-center gap-2 text-green-700">
                <IndianRupee size={16} />

                <p className="text-xs font-semibold">
                  Vendor Pricing
                </p>
              </div>

              <h3 className="text-2xl font-bold text-green-950 mt-1">
                {formatMoney(price, currency)}
              </h3>

              <p className="text-xs text-green-700 mt-1">
                Received: {formatDateTime(getQuoteDate(quote))}
              </p>
            </div>

            {/* NOTES / FILES */}
            {(referenceText || referenceFileUrl || quote.internalRemark) && (
              <div className="mt-4 space-y-3">
                <TextBlock
                  label="Vendor Mail Content / Pricing Note"
                  value={referenceText}
                />

                {referenceFileUrl && (
                  <div className="rounded-xl bg-purple-50 border border-purple-100 p-3">
                    <div className="flex items-start gap-2">
                      <Paperclip
                        size={16}
                        className="text-purple-700 mt-0.5 shrink-0"
                      />

                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-purple-700">
                          Reference Attachment
                        </p>

                        <a
                          href={referenceFileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-sm font-medium text-purple-700 hover:underline break-all mt-1"
                        >
                          {referenceFileName}
                          <ExternalLink size={13} />
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                <TextBlock
                  label="Internal Remark"
                  value={quote.internalRemark}
                />
              </div>
            )}
          </div>

          {/* ACTION */}
          <div className="xl:w-48">
            {selected ? (
              <div className="space-y-2">
                <div className="rounded-xl bg-green-100 border border-green-200 px-3 py-3 text-center">
                  <CheckCircle2
                    size={20}
                    className="text-green-700 mx-auto"
                  />

                  <p className="text-xs font-semibold text-green-800 mt-1">
                    Final Selected
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onRevoke?.(quote)}
                  disabled={revoking}
                  className="
                    w-full inline-flex items-center justify-center gap-2
                    px-4 py-2.5 rounded-xl border border-red-200 bg-red-50
                    text-sm font-semibold text-red-700 hover:bg-red-100
                    disabled:opacity-60
                  "
                >
                  {revoking && (
                    <Loader2 size={16} className="animate-spin" />
                  )}

                  {revoking ? "Revoking..." : "Revoke Final"}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onSelect?.(quote)}
                disabled={selecting}
                className="
                  w-full inline-flex items-center justify-center gap-2
                  px-4 py-2.5 rounded-xl bg-green-600 text-white
                  text-sm font-semibold hover:bg-green-700
                  disabled:opacity-60
                "
              >
                {selecting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Star size={16} />
                )}

                {selecting ? "Selecting..." : "Select as Final Cost"}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-xs text-gray-500">
          Added by{" "}
          <span className="font-medium text-gray-700">
            {quote.receivedByName || quote.createdByName || "—"}
          </span>
        </p>

        <p className="text-xs text-gray-400 break-all">
          Quote ID: {quote.quoteId || quote.vendorQuoteId || quote.id}
        </p>
      </div>
    </div>
  );
}

/* =========================
   MAIN COMPONENT
========================= */

export default function VendorQuotesList({
  leadId,
  lead,
  vendorRequest,
  onSelected,
  onCancel,
  showClose = true
}) {
  const { user } = useAuth(true);

  const resolvedLeadId = getLeadId(leadId, lead);
  const vendorRequestId = getRequestId(vendorRequest);

  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectingQuoteId, setSelectingQuoteId] = useState("");
  const [revokingQuoteId, setRevokingQuoteId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!resolvedLeadId || !vendorRequestId) {
      setQuotes([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const q = query(
      collection(
        db,
        "leads",
        resolvedLeadId,
        "vendorRequests",
        vendorRequestId,
        "vendorQuotes"
      ),
      orderBy("revision", "desc")
    );

    const unsub = onSnapshot(
      q,
      snapshot => {
        const rows = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          vendorQuoteId: docSnap.id,
          ...docSnap.data()
        }));

        setQuotes(rows);
        setLoading(false);
      },
      err => {
        setError(err?.message || "Failed to load vendor quotes.");
        setLoading(false);
      }
    );

    return () => unsub();
  }, [resolvedLeadId, vendorRequestId]);

  const liveFinalQuote = useMemo(() => {
    /*
      Prefer live quote snapshot.
      If multiple old quotes were previously marked final by mistake,
      this chooses latest revision because query is revision desc.
    */
    return quotes.find(item => isFinalQuote(item)) || null;
  }, [quotes]);

  const selectedQuoteId = useMemo(() => {
    return (
      liveFinalQuote?.id ||
      liveFinalQuote?.vendorQuoteId ||
      ""
    );
  }, [liveFinalQuote]);

  const stats = useMemo(() => {
    const latestQuote = quotes[0] || null;

    return {
      total: quotes.length,
      latestRevision:
        latestQuote?.revision ||
        vendorRequest?.latestRevision ||
        0,
      latestCost:
        getQuotePrice(latestQuote) ||
        vendorRequest?.latestVendorCost ||
        null,
      finalCost: liveFinalQuote ? getQuotePrice(liveFinalQuote) : null,
      selected: Boolean(liveFinalQuote)
    };
  }, [quotes, vendorRequest, liveFinalQuote]);

  const handleSelect = async quote => {
    if (!resolvedLeadId || !vendorRequestId || !quote?.id) {
      setError("Missing lead, vendor request or quote details.");
      return;
    }

    const confirmed = window.confirm(
      `Select ${formatMoney(
        getQuotePrice(quote),
        quote.currency || "INR"
      )} as final vendor cost?`
    );

    if (!confirmed) return;

    setError("");
    setSelectingQuoteId(quote.id);

    try {
      const result = await selectVendorQuote({
        leadId: resolvedLeadId,
        vendorRequestId,
        vendorQuoteId: quote.id,
        user
      });

      onSelected?.(result);
    } catch (err) {
      setError(err?.message || "Failed to select final vendor pricing.");
    } finally {
      setSelectingQuoteId("");
    }
  };

  const handleRevoke = async quote => {
    if (!resolvedLeadId || !vendorRequestId || !quote?.id) {
      setError("Missing lead, vendor request or quote details.");
      return;
    }

    const confirmed = window.confirm(
      "Revoke final mark from this vendor pricing?"
    );

    if (!confirmed) return;

    setError("");
    setRevokingQuoteId(quote.id);

    try {
      const result = await revokeFinalVendorQuote({
        leadId: resolvedLeadId,
        vendorRequestId,
        vendorQuoteId: quote.id,
        user
      });

      onSelected?.(result);
    } catch (err) {
      setError(err?.message || "Failed to revoke final vendor pricing.");
    } finally {
      setRevokingQuoteId("");
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* STATS */}
      <div className="p-5 border-b border-gray-100 grid grid-cols-1 sm:grid-cols-4 gap-3">
        <StatCard
          label="Quotes Received"
          value={stats.total}
          tone="blue"
        />

        <StatCard
          label="Latest Revision"
          value={stats.latestRevision ? `Rev ${stats.latestRevision}` : "—"}
          tone="amber"
        />

        <StatCard
          label="Latest Price"
          value={formatMoney(stats.latestCost)}
          tone="purple"
        />

        <StatCard
          label="Final Price"
          value={stats.finalCost ? formatMoney(stats.finalCost) : "Not marked"}
          tone="green"
        />
      </div>

      <FinalStatusBanner finalQuote={liveFinalQuote} />

      {error && (
        <div className="mx-5 mt-5 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* LIST */}
      <div className="p-5">
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map(item => (
              <div
                key={item}
                className="h-40 bg-gray-100 rounded-2xl animate-pulse"
              />
            ))}
          </div>
        ) : quotes.length === 0 ? (
          <EmptyQuotes vendorName={vendorRequest?.vendorName} />
        ) : (
          <div className="space-y-4">
            {quotes.map(quote => (
              <QuoteCard
                key={quote.id}
                quote={quote}
                selected={
                  quote.id === selectedQuoteId ||
                  quote.vendorQuoteId === selectedQuoteId
                }
                selecting={selectingQuoteId === quote.id}
                revoking={revokingQuoteId === quote.id}
                onSelect={handleSelect}
                onRevoke={handleRevoke}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}