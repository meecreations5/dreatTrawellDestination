"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  Loader2,
  MessageCircle,
  Phone,
  RefreshCw,
  Send,
  X
} from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import  logVendorFollowUp  from "@/lib/leadVendorRequests";

/* =========================
   OPTIONS
========================= */

const CHANNEL_OPTIONS = [
  { value: "call", label: "Call", icon: Phone },
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { value: "email", label: "Email", icon: Send }
];

const OUTCOME_OPTIONS = [
  {
    value: "quote_expected",
    label: "Quote expected"
  },
  {
    value: "follow_up_required",
    label: "Follow-up required"
  },
  {
    value: "no_response",
    label: "No response"
  },
  {
    value: "quote_received",
    label: "Quote received"
  },
  {
    value: "not_interested",
    label: "Vendor not available"
  }
];

/* =========================
   HELPERS
========================= */

function formatDateForInput(value) {
  if (!value) return "";

  const date = value?.toDate ? value.toDate() : new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const pad = number => String(number).padStart(2, "0");

  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());

  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function getDefaultNextFollowUp() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(11, 0, 0, 0);

  return formatDateForInput(date);
}

function getRequestId(request) {
  return request?.id || request?.vendorRequestId || "";
}

/* =========================
   COMPONENT
========================= */

export default function VendorFollowUpModal({
  open,
  lead,
  vendorRequest,
  onClose,
  onSaved
}) {
  const { user } = useAuth(true);

  const [channel, setChannel] = useState("call");
  const [outcome, setOutcome] = useState("follow_up_required");
  const [summary, setSummary] = useState("");
  const [nextFollowUpAt, setNextFollowUpAt] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const leadId = lead?.id || lead?.leadId || "";
  const vendorRequestId = getRequestId(vendorRequest);

  const vendorName = vendorRequest?.vendorName || "Vendor";

  const shouldShowNextFollowUp = useMemo(() => {
    return ["quote_expected", "follow_up_required", "no_response"].includes(
      outcome
    );
  }, [outcome]);

  useEffect(() => {
    if (!open) return;

    setChannel("call");
    setOutcome("follow_up_required");
    setSummary("");
    setNextFollowUpAt(getDefaultNextFollowUp());
    setError("");
    setSaving(false);
  }, [open, vendorRequestId]);

  if (!open) return null;

  const handleSubmit = async e => {
    e.preventDefault();

    setError("");

    if (!leadId) {
      setError("Lead data is missing.");
      return;
    }

    if (!vendorRequestId) {
      setError("Vendor request is missing.");
      return;
    }

    if (!summary.trim()) {
      setError("Follow-up summary is required.");
      return;
    }

    try {
      setSaving(true);

      const result = await logVendorFollowUp({
        leadId,
        vendorRequestId,

        channel,
        outcome,
        summary: summary.trim(),

        nextFollowUpAt: shouldShowNextFollowUp
          ? nextFollowUpAt || null
          : null,

        user
      });

      onSaved?.(result);
      onClose?.();
    } catch (err) {
      console.error("Vendor follow-up failed:", err);
      setError(err?.message || "Failed to save vendor follow-up.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden"
      >
        {/* HEADER */}
        <div className="p-5 border-b border-gray-100 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
              <RefreshCw size={16} />
              Vendor Follow-up
            </div>

            <h2 className="text-lg font-semibold text-gray-900 mt-1">
              {vendorName}
            </h2>

            <p className="text-sm text-gray-500 mt-1">
              Record call, WhatsApp or email follow-up with this vendor.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="
              h-9 w-9 rounded-xl border border-gray-200
              flex items-center justify-center text-gray-500
              hover:bg-gray-50 hover:text-gray-900
              disabled:opacity-60
            "
          >
            <X size={17} />
          </button>
        </div>

        {/* BODY */}
        <div className="p-5 space-y-5">
          {/* CHANNEL */}
          <div>
            <label className="text-xs font-medium text-gray-500">
              Follow-up Channel
            </label>

            <div className="grid grid-cols-3 gap-2 mt-2">
              {CHANNEL_OPTIONS.map(item => {
                const Icon = item.icon;
                const active = channel === item.value;

                return (
                  <button
                    key={item.value}
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      setChannel(item.value);
                      setError("");
                    }}
                    className={`
                      rounded-xl border px-3 py-3
                      text-sm font-medium flex flex-col items-center gap-2
                      disabled:opacity-60
                      ${
                        active
                          ? "border-blue-200 bg-blue-50 text-blue-700"
                          : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                      }
                    `}
                  >
                    <Icon size={17} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* OUTCOME */}
          <div>
            <label className="text-xs font-medium text-gray-500">
              Outcome
            </label>

            <select
              value={outcome}
              disabled={saving}
              onChange={e => {
                setOutcome(e.target.value);
                setError("");
              }}
              className="
                mt-1 w-full rounded-xl border border-gray-200 bg-white
                px-3 py-2.5 text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-100
                disabled:bg-gray-50 disabled:text-gray-400
              "
            >
              {OUTCOME_OPTIONS.map(item => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          {/* SUMMARY */}
          <div>
            <label className="text-xs font-medium text-gray-500">
              Follow-up Summary <span className="text-red-500">*</span>
            </label>

            <textarea
              rows={5}
              value={summary}
              disabled={saving}
              onChange={e => {
                setSummary(e.target.value);
                setError("");
              }}
              placeholder="Example: Vendor confirmed quote will be shared by evening."
              className="
                mt-1 w-full rounded-xl border border-gray-200
                px-3 py-2.5 text-sm resize-none
                focus:outline-none focus:ring-2 focus:ring-blue-100
                disabled:bg-gray-50 disabled:text-gray-400
              "
            />
          </div>

          {/* NEXT FOLLOW-UP */}
          {shouldShowNextFollowUp && (
            <div>
              <label className="text-xs font-medium text-gray-500">
                Next Vendor Follow-up
              </label>

              <div className="relative mt-1">
                <CalendarClock
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  type="datetime-local"
                  value={nextFollowUpAt}
                  disabled={saving}
                  onChange={e => setNextFollowUpAt(e.target.value)}
                  className="
                    w-full rounded-xl border border-gray-200
                    pl-9 pr-3 py-2.5 text-sm
                    focus:outline-none focus:ring-2 focus:ring-blue-100
                    disabled:bg-gray-50 disabled:text-gray-400
                  "
                />
              </div>

              <p className="text-xs text-gray-400 mt-1">
                This helps your team track vendor quote follow-up.
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="p-5 border-t border-gray-100 flex flex-col sm:flex-row gap-3 sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="
              px-4 py-2 rounded-xl border border-gray-200
              text-sm text-gray-700 hover:bg-gray-50
              disabled:opacity-60
            "
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={saving}
            className="
              px-5 py-2 rounded-xl bg-blue-600 text-white
              text-sm font-medium hover:bg-blue-700
              disabled:opacity-60
              inline-flex items-center justify-center gap-2
            "
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <RefreshCw size={16} />
            )}

            {saving ? "Saving..." : "Save Follow-up"}
          </button>
        </div>
      </form>
    </div>
  );
}