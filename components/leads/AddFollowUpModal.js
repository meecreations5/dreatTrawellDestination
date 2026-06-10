"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Loader2,
  MessageSquareText,
  Phone,
  Send,
  Users,
  X
} from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { logFollowUp } from "@/lib/logFollowUp";

const channels = [
  {
    value: "call",
    label: "Call",
    icon: Phone
  },
  {
    value: "whatsapp",
    label: "WhatsApp",
    icon: MessageSquareText
  },
  {
    value: "meeting",
    label: "Meeting",
    icon: Users
  },
  {
    value: "email",
    label: "Email",
    icon: Send
  }
];

const outcomes = [
  { value: "connected", label: "Connected" },
  { value: "no_response", label: "No Response" },
  { value: "follow_up_required", label: "Follow-up Required" },
  { value: "quotation_requested", label: "Quotation Requested" },
  { value: "not_interested", label: "Not Interested" }
];

function toDatetimeLocal(value) {
  if (!value) return "";

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);

  return localDate.toISOString().slice(0, 16);
}

function getQuickDate(hoursFromNow = 2) {
  const date = new Date();
  date.setHours(date.getHours() + hoursFromNow);
  date.setMinutes(0, 0, 0);

  return toDatetimeLocal(date);
}

function getTodayEvening() {
  const date = new Date();
  date.setHours(18, 0, 0, 0);

  return toDatetimeLocal(date);
}

function getTomorrowMorning() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(10, 0, 0, 0);

  return toDatetimeLocal(date);
}

function formatPreviewDate(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export default function AddFollowUpModal({ leadId, onClose }) {
  const { user } = useAuth();

  const [channel, setChannel] = useState("call");
  const [outcome, setOutcome] = useState("connected");
  const [summary, setSummary] = useState("");
  const [nextFollowUpAt, setNextFollowUpAt] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedChannel = useMemo(() => {
    return channels.find(item => item.value === channel) || channels[0];
  }, [channel]);

  const selectedOutcome = useMemo(() => {
    return outcomes.find(item => item.value === outcome) || outcomes[0];
  }, [outcome]);

  const save = async () => {
    setError("");
    setSuccess("");

    if (!summary.trim()) {
      setError("Conversation summary is required.");
      return;
    }

    const followUpDate = nextFollowUpAt
      ? new Date(nextFollowUpAt)
      : null;

    if (
      nextFollowUpAt &&
      Number.isNaN(followUpDate?.getTime())
    ) {
      setError("Please select a valid next follow-up date and time.");
      return;
    }

    setSaving(true);

    try {
      await logFollowUp({
        leadId,
        channel,
        outcome,
        summary: summary.trim(),
        nextFollowUpAt: followUpDate,
        user
      });

      setSuccess("Follow-up logged successfully.");

      setTimeout(() => {
        onClose?.(true);
      }, 500);
    } catch (err) {
      console.error("Follow-up log failed:", err);
      setError(err?.message || "Failed to log follow-up.");
    } finally {
      setSaving(false);
    }
  };

  const ChannelIcon = selectedChannel.icon;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
        {/* HEADER */}
        <div className="p-5 border-b border-gray-100 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
              <ChannelIcon size={20} />
            </div>

            <div>
              <h2 className="text-base font-semibold text-gray-900">
                Log Follow-Up
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Record the latest conversation and schedule the next action.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onClose?.()}
            disabled={saving}
            className="text-gray-400 hover:text-gray-700 disabled:opacity-60"
          >
            <X size={18} />
          </button>
        </div>

        {/* BODY */}
        <div className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-100 text-red-700 rounded-lg px-3 py-2 text-sm flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-100 text-green-700 rounded-lg px-3 py-2 text-sm flex items-start gap-2">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* CHANNEL */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-500">
              Follow-up Channel
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {channels.map(item => {
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
                      border rounded-xl px-3 py-2 text-sm
                      flex items-center justify-center gap-2 transition
                      disabled:opacity-60
                      ${
                        active
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                      }
                    `}
                  >
                    <Icon size={15} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* OUTCOME */}
          <div className="space-y-1.5">
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
                w-full border border-gray-200 rounded-lg
                px-3 py-2 text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-100
                disabled:bg-gray-50 disabled:text-gray-400
              "
            >
              {outcomes.map(item => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          {/* SUMMARY */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500">
              Conversation Summary <span className="text-red-500">*</span>
            </label>

            <textarea
              rows={4}
              value={summary}
              disabled={saving}
              onChange={e => {
                setSummary(e.target.value);
                setError("");
              }}
              placeholder="Example: Spoke with agent. Client is interested in 4N Maldives package, wants revised quote with water villa and vegetarian meals."
              className="
                w-full border border-gray-200 rounded-lg
                px-3 py-2 text-sm resize-none
                focus:outline-none focus:ring-2 focus:ring-blue-100
                disabled:bg-gray-50 disabled:text-gray-400
              "
            />

            <p className="text-[11px] text-gray-400">
              Add clear notes so team members can understand the latest status.
            </p>
          </div>

          {/* NEXT FOLLOW-UP */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500">
              Next Follow-up / Next Action
            </label>

            <div className="relative">
              <Clock3
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                type="datetime-local"
                value={nextFollowUpAt}
                disabled={saving}
                onChange={e => {
                  setNextFollowUpAt(e.target.value);
                  setError("");
                }}
                className="
                  w-full border border-gray-200 rounded-lg
                  pl-9 pr-3 py-2 text-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-100
                  disabled:bg-gray-50 disabled:text-gray-400
                "
              />
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                disabled={saving}
                onClick={() => setNextFollowUpAt(getQuickDate(2))}
                className="text-xs px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 disabled:opacity-60"
              >
                After 2 hours
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={() => setNextFollowUpAt(getTodayEvening())}
                className="text-xs px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 disabled:opacity-60"
              >
                Today 6 PM
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={() => setNextFollowUpAt(getTomorrowMorning())}
                className="text-xs px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 disabled:opacity-60"
              >
                Tomorrow 10 AM
              </button>

              {nextFollowUpAt && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setNextFollowUpAt("")}
                  className="text-xs px-3 py-1.5 rounded-full bg-gray-50 text-gray-600 border border-gray-200 disabled:opacity-60"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* PREVIEW */}
          <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
            <div className="flex items-start gap-2">
              <CalendarClock size={16} className="text-blue-600 mt-0.5" />

              <div>
                <p className="text-xs text-gray-500">
                  Follow-up Preview
                </p>

                <p className="text-sm font-medium text-gray-900 mt-1">
                  {selectedChannel.label} · {selectedOutcome.label}
                </p>

                <p className="text-xs text-gray-500 mt-1">
                  {nextFollowUpAt
                    ? `Next action: ${formatPreviewDate(nextFollowUpAt)}`
                    : "No next action scheduled"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="p-5 border-t border-gray-100 flex gap-3">
          <button
            type="button"
            onClick={() => onClose?.()}
            disabled={saving}
            className="
              flex-1 border border-gray-200 rounded-lg
              py-2 text-sm hover:bg-gray-50
              disabled:opacity-60
            "
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="
              flex-1 bg-blue-600 text-white rounded-lg
              py-2 text-sm font-medium hover:bg-blue-700
              disabled:opacity-60
              inline-flex items-center justify-center gap-2
            "
          >
            {saving && <Loader2 size={15} className="animate-spin" />}
            {saving ? "Saving..." : "Save Follow-Up"}
          </button>
        </div>
      </div>
    </div>
  );
}