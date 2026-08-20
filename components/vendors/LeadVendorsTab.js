"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";

import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  FileText,
  IndianRupee,
  Mail,
  MessageCircle,
  Plus,
  RefreshCw
} from "lucide-react";

import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import LeadVendorRequestForm from "@/components/vendors/LeadVendorRequestForm";

/* =========================
   HELPERS
========================= */

function getVendorRequestCode(request = {}) {
  return (
    cleanString(request?.vendorLeadReference) ||
    cleanString(request?.emailVendorReference) ||
    cleanString(request?.vendorRequestCode) ||
    cleanString(request?.vendorRefCode) ||
    (request?.id
      ? `VR-${String(request.id).slice(-6).toUpperCase()}`
      : "—")
  );
}

function cleanString(value = "") {
  return String(value || "").trim();
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

function getTimeValue(value) {
  const date = toDate(value);
  return date ? date.getTime() : 0;
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

function getQuoteCount(request) {
  return Number(
    request?.latestRevision ||
    request?.quoteCount ||
    request?.vendorQuoteCount ||
    0
  );
}

function getLatestCost(request) {
  return Number(
    request?.selectedVendorCost ||
    request?.latestVendorCost ||
    request?.latestCost ||
    0
  );
}

function isSelectedRequest(request) {
  return Boolean(
    request?.selected ||
    request?.status === "selected" ||
    request?.selectedQuoteId
  );
}

function getStatusLabel(status = "") {
  const value = cleanString(status);

  const labels = {
    draft: "Draft",
    sent: "Sent",
    follow_up_pending: "Follow-up Pending",
    quote_received: "Quote Received",
    revision_requested: "Revision Requested",
    revised_quote_received: "Revised Quote Received",
    selected: "Selected",
    rejected: "Rejected",
    cancelled: "Cancelled"
  };

  return labels[value] || value || "Sent";
}

function getStatusTone(status = "") {
  const value = cleanString(status);

  if (value === "selected") {
    return "border-green-200 bg-green-100 text-green-800";
  }

  if (
    value === "quote_received" ||
    value === "revised_quote_received"
  ) {
    return "border-purple-200 bg-purple-50 text-purple-700";
  }

  if (value === "follow_up_pending") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (value === "rejected" || value === "cancelled") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-blue-200 bg-blue-50 text-blue-700";
}

function getEmailTone(status) {
  if (status === "sent") {
    return "text-green-700 bg-green-50 border-green-100";
  }

  if (status === "failed") {
    return "text-red-700 bg-red-50 border-red-100";
  }

  if (status === "missing_email") {
    return "text-amber-700 bg-amber-50 border-amber-100";
  }

  return "text-gray-600 bg-gray-50 border-gray-100";
}

function getWhatsappTone(status) {
  if (status === "opened") {
    return "text-green-700 bg-green-50 border-green-100";
  }

  if (status === "prepared") {
    return "text-blue-700 bg-blue-50 border-blue-100";
  }

  if (status === "missing_number") {
    return "text-amber-700 bg-amber-50 border-amber-100";
  }

  return "text-gray-600 bg-gray-50 border-gray-100";
}

/* =========================
   MINI COMPONENTS
========================= */

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusTone(status)}`}
    >
      {getStatusLabel(status)}
    </span>
  );
}

function StatCard({ label, value, icon: Icon, tone = "blue" }) {
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
      <div className="flex items-center gap-2">
        {Icon && <Icon size={16} />}
        <p className="text-xs font-semibold">{label}</p>
      </div>

      <p className="text-xl font-bold mt-1 text-gray-950">
        {value}
      </p>
    </div>
  );
}

function ChannelBadge({ type, status }) {
  const isEmail = type === "email";
  const Icon = isEmail ? Mail : MessageCircle;

  const tone = isEmail
    ? getEmailTone(status)
    : getWhatsappTone(status);

  const label =
    status === "sent"
      ? "Email sent"
      : status === "failed"
        ? "Email failed"
        : status === "missing_email"
          ? "Email missing"
          : status === "opened"
            ? "WhatsApp opened"
            : status === "prepared"
              ? "WhatsApp prepared"
              : status === "missing_number"
                ? "Number missing"
                : isEmail
                  ? "Email not sent"
                  : "WhatsApp not sent";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${tone}`}
    >
      <Icon size={13} />
      {label}
    </span>
  );
}

/* =========================
   VENDOR REQUEST CARD
========================= */

function VendorRequestCard({
  request,
  onAddQuote,
  onViewQuotes,
  onFollowUp
}) {
  const quoteCount = getQuoteCount(request);
  const latestCost = getLatestCost(request);
  const selected = isSelectedRequest(request);

  const vendorName =
    request?.vendorName ||
    request?.vendorCode ||
    "Vendor";

  const vendorRequestCode = getVendorRequestCode(request);

  const currency =
    request?.selectedVendorCurrency ||
    request?.latestCurrency ||
    request?.latestVendorCurrency ||
    "INR";

  return (
    <div
      className={`
        rounded-2xl border bg-white shadow-sm overflow-hidden transition
        ${selected
          ? "border-green-200 ring-2 ring-green-50"
          : "border-gray-100 hover:border-purple-200"
        }
      `}
    >
      <div className="p-5">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="h-10 w-10 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center">
                <Building2 size={18} />
              </div>

              <div className="min-w-0">
                <h3 className="text-base font-semibold text-gray-900 truncate">
                  {vendorName}
                </h3>

                <div className="space-y-1">
                  <p className="text-xs text-gray-500">
                    Request sent{" "}
                    {formatDateTime(request?.sentAt || request?.createdAt)}
                  </p>

                  <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                    <FileText size={13} />
                    Vendor Ref:
                    <span className="font-bold text-slate-950">
                      {vendorRequestCode}
                    </span>
                  </div>
                </div>
              </div>

              <StatusBadge status={request?.status || "sent"} />

              {selected && (
                <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800">
                  <CheckCircle2 size={13} />
                  Final Vendor
                </span>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <ChannelBadge
                type="email"
                status={request?.emailStatus}
              />

              <ChannelBadge
                type="whatsapp"
                status={request?.whatsappStatus}
              />
            </div>

            {request?.emailError && (
              <div className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
                {request.emailError}
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl bg-blue-50 border border-blue-100 p-3">
                <p className="text-xs font-semibold text-blue-700">
                  Quotes Received
                </p>

                <p className="text-lg font-bold text-blue-950 mt-1">
                  {quoteCount}
                </p>
              </div>

              <div className="rounded-xl bg-purple-50 border border-purple-100 p-3">
                <p className="text-xs font-semibold text-purple-700">
                  Latest Price
                </p>

                <p className="text-lg font-bold text-purple-950 mt-1">
                  {formatMoney(latestCost, currency)}
                </p>
              </div>

              <div className="rounded-xl bg-green-50 border border-green-100 p-3">
                <p className="text-xs font-semibold text-green-700">
                  Final Price
                </p>

                <p className="text-lg font-bold text-green-950 mt-1">
                  {selected
                    ? formatMoney(
                      request?.selectedVendorCost || latestCost,
                      currency
                    )
                    : "Not marked"}
                </p>
              </div>
            </div>

            {request?.nextFollowUpAt && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-100 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">
                <Clock size={13} />
                Next vendor follow-up:{" "}
                {formatDateTime(request.nextFollowUpAt)}
              </div>
            )}
          </div>

          <div className="lg:w-44 flex lg:flex-col gap-2">
            <button
              type="button"
              onClick={() => onFollowUp?.(request)}
              className="flex-1 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
            >
              Follow Up
            </button>

            <button
              type="button"
              onClick={() => onAddQuote?.(request)}
              className="flex-1 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-100"
            >
              Add Pricing
            </button>

            <button
              type="button"
              onClick={() => onViewQuotes?.(request)}
              className="flex-1 rounded-xl border border-purple-200 bg-purple-50 px-3 py-2 text-xs font-semibold text-purple-700 hover:bg-purple-100"
            >
              View Quotes ({quoteCount})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================
   MAIN COMPONENT
========================= */

export default function LeadVendorsTab({
  lead,
  onAddQuote,
  onViewQuotes,
  onFollowUp
}) {
  const leadId = getLeadId(lead);

  const [vendorRequests, setVendorRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [requestFormOpen, setRequestFormOpen] = useState(false);
  const [loadError, setLoadError] = useState("");


  const { user } = useAuth();

  useEffect(() => {
    if (!leadId) {
      setVendorRequests([]);
      setLoadingRequests(false);
      return;
    }

    setLoadingRequests(true);
    setLoadError("");

    const unsub = onSnapshot(
      collection(db, "leads", leadId, "vendorRequests"),
      snapshot => {
        const rows = snapshot.docs
          .map(docSnap => ({
            id: docSnap.id,
            vendorRequestId: docSnap.id,
            ...docSnap.data()
          }))
          .sort((a, b) => {
            return (
              getTimeValue(b?.createdAt || b?.sentAt) -
              getTimeValue(a?.createdAt || a?.sentAt)
            );
          });

        setVendorRequests(rows);
        setLoadingRequests(false);
      },
      error => {
        setLoadError(
          error?.message || "Failed to load vendor requests."
        );
        setVendorRequests([]);
        setLoadingRequests(false);
      }
    );

    return () => unsub();
  }, [leadId]);

  const stats = useMemo(() => {
    const vendorsContacted = vendorRequests.length;

    const quotesReceived = vendorRequests.reduce((sum, request) => {
      return sum + getQuoteCount(request);
    }, 0);

    const finalRequest =
      vendorRequests.find(request => isSelectedRequest(request)) ||
      null;

    const finalCost =
      finalRequest?.selectedVendorCost ||
      finalRequest?.latestVendorCost ||
      lead?.selectedVendorCost ||
      null;

    const finalCurrency =
      finalRequest?.selectedVendorCurrency ||
      finalRequest?.latestCurrency ||
      lead?.selectedVendorCurrency ||
      "INR";

    return {
      vendorsContacted,
      quotesReceived,
      finalRequest,
      finalCost,
      finalCurrency
    };
  }, [vendorRequests, lead]);

  const nextBestAction = useMemo(() => {
    if (vendorRequests.length === 0) {
      return {
        tone: "purple",
        title: "Send vendor quotation request",
        description:
          "No vendor has been contacted yet. Send the requirement to one or more vendors."
      };
    }

    if (stats.quotesReceived === 0) {
      return {
        tone: "amber",
        title: "Follow up with vendor",
        description:
          "Vendor request has been sent but no pricing has been captured yet."
      };
    }

    if (!stats.finalRequest) {
      return {
        tone: "green",
        title: "Mark final vendor pricing",
        description:
          "Vendor pricing is received. Review quotes and mark one price as final."
      };
    }

    return {
      tone: "blue",
      title: "Final vendor pricing selected",
      description:
        "Vendor costing is finalized. You can now create or update customer quotation."
    };
  }, [vendorRequests, stats]);

  const nextActionToneClass =
    nextBestAction.tone === "green"
      ? "bg-green-50 border-green-100"
      : nextBestAction.tone === "amber"
        ? "bg-amber-50 border-amber-100"
        : nextBestAction.tone === "blue"
          ? "bg-blue-50 border-blue-100"
          : "bg-purple-50 border-purple-100";

  return (
    <div className="space-y-4">
      {/* TOP HEADER */}
      <div className="rounded-2xl border border-purple-100 bg-gradient-to-r from-purple-50 to-blue-50 p-5">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-purple-700">
              Vendor Pricing
            </p>

            <h2 className="text-lg font-semibold text-gray-900 mt-1">
              Vendor Quote Requests & Pricing
            </h2>

            <p className="text-sm text-gray-500 mt-1">
              Send one request per vendor, capture multiple pricing revisions,
              and mark one final costing.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setRequestFormOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-700"
          >
            <Plus size={16} />
            Send Vendor Request
          </button>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <StatCard
          label="Vendors Contacted"
          value={stats.vendorsContacted}
          icon={Building2}
          tone="blue"
        />

        <StatCard
          label="Quotes Received"
          value={stats.quotesReceived}
          icon={FileText}
          tone="purple"
        />

        <StatCard
          label="Final Price"
          value={
            stats.finalCost
              ? formatMoney(stats.finalCost, stats.finalCurrency)
              : "Not marked"
          }
          icon={IndianRupee}
          tone="green"
        />

        <StatCard
          label="Status"
          value={stats.finalRequest ? "Finalized" : "Pending"}
          icon={stats.finalRequest ? CheckCircle2 : AlertTriangle}
          tone={stats.finalRequest ? "green" : "amber"}
        />
      </div>

      {/* NEXT BEST ACTION */}
      <div className={`rounded-2xl border p-4 ${nextActionToneClass}`}>
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center">
            <RefreshCw size={17} className="text-gray-700" />
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-900">
              {nextBestAction.title}
            </p>

            <p className="text-xs text-gray-600 mt-1">
              {nextBestAction.description}
            </p>
          </div>
        </div>
      </div>

      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {/* LIST */}
      {loadingRequests ? (
        <div className="space-y-3">
          {[1, 2].map(item => (
            <div
              key={item}
              className="h-44 rounded-2xl bg-gray-100 animate-pulse"
            />
          ))}
        </div>
      ) : vendorRequests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center">
          <div className="h-14 w-14 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center mx-auto">
            <Building2 size={24} />
          </div>

          <h3 className="text-base font-semibold text-gray-900 mt-4">
            No vendor request sent yet
          </h3>

          <p className="text-sm text-gray-500 mt-1">
            Send quotation request to vendors. Same vendor cannot receive
            duplicate request for this lead.
          </p>

          <button
            type="button"
            onClick={() => setRequestFormOpen(true)}
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-700"
          >
            <Plus size={16} />
            Send Vendor Request
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {vendorRequests.map(request => (
            <VendorRequestCard
              key={request.id}
              request={request}
              onAddQuote={onAddQuote}
              onViewQuotes={onViewQuotes}
              onFollowUp={onFollowUp}
            />
          ))}
        </div>
      )}

      {requestFormOpen && (
        <LeadVendorRequestForm
          lead={lead}
          vendorRequests={vendorRequests}
          user={user}
          onClose={() => setRequestFormOpen(false)}
          onCreated={() => setRequestFormOpen(false)}
        />
      )}
    </div>
  );
}