"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Loader2,
  Trash2,
  X
} from "lucide-react";

import { updateNextAction } from "@/lib/updateNextAction";
import { useAuth } from "@/hooks/useAuth";

const actionTypes = [
  { value: "", label: "No next action" },
  { value: "follow_up", label: "Follow-up" },
  { value: "call", label: "Call" },
  { value: "meeting", label: "Meeting" },
  { value: "quotation", label: "Quotation" },
  { value: "payment", label: "Payment Follow-up" },
  { value: "document", label: "Document Follow-up" },
  { value: "other", label: "Other" }
];

function toDate(value) {
  if (!value) return null;
  if (value?.toDate) return value.toDate();
  if (value instanceof Date) return value;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toDatetimeLocal(value) {
  const date = toDate(value);
  if (!date) return "";

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

function getTomorrowMorning() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(10, 0, 0, 0);

  return toDatetimeLocal(date);
}

function getTodayEvening() {
  const date = new Date();
  date.setHours(18, 0, 0, 0);

  return toDatetimeLocal(date);
}

function getActionLabel(type) {
  return actionTypes.find(item => item.value === type)?.label || "Next Action";
}

export default function NextActionModal({ lead, onClose }) {
  const { user } = useAuth();

  const [type, setType] = useState(lead?.nextActionType || "");
  const [date, setDate] = useState(toDatetimeLocal(lead?.nextActionDueAt));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedLabel = useMemo(() => getActionLabel(type), [type]);

  const clearNextAction = async () => {
    setError("");
    setSuccess("");

    try {
      setSaving(true);

      await updateNextAction({
        leadId: lead.id,
        nextActionType: null,
        nextActionDueAt: null,
        user
      });

      setSuccess("Next action cleared.");

      setTimeout(() => {
        onClose?.(true);
      }, 500);
    } catch (err) {
      console.error("Clear next action failed:", err);
      setError(err?.message || "Failed to clear next action.");
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    setError("");
    setSuccess("");

    if (type && !date) {
      setError("Please select next action date and time.");
      return;
    }

    const dueDate = type ? new Date(date) : null;

    if (type && Number.isNaN(dueDate.getTime())) {
      setError("Invalid date and time selected.");
      return;
    }

    try {
      setSaving(true);

      await updateNextAction({
        leadId: lead.id,
        nextActionType: type || null,
        nextActionDueAt: dueDate,
        user
      });

      setSuccess("Next action updated successfully.");

      setTimeout(() => {
        onClose?.(true);
      }, 500);
    } catch (err) {
      console.error("Next action update failed:", err);
      setError(err?.message || "Failed to update next action.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        {/* HEADER */}
        <div className="p-5 border-b border-gray-100 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
              <CalendarClock size={20} />
            </div>

            <div>
              <h2 className="text-base font-semibold text-gray-900">
                Update Next Action
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Schedule the next follow-up, quotation or action for this lead.
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

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500">
              Action Type
            </label>

            <select
              className="
                w-full border border-gray-200 rounded-lg
                px-3 py-2 text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-100
                disabled:bg-gray-50 disabled:text-gray-400
              "
              value={type}
              disabled={saving}
              onChange={e => {
                setType(e.target.value);
                setError("");

                if (!e.target.value) {
                  setDate("");
                } else if (!date) {
                  setDate(getQuickDate(2));
                }
              }}
            >
              {actionTypes.map(item => (
                <option key={item.value || "none"} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          {type && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500">
                  Due Date & Time <span className="text-red-500">*</span>
                </label>

                <div className="relative">
                  <Clock3
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <input
                    type="datetime-local"
                    className="
                      w-full border border-gray-200 rounded-lg
                      pl-9 pr-3 py-2 text-sm
                      focus:outline-none focus:ring-2 focus:ring-blue-100
                      disabled:bg-gray-50 disabled:text-gray-400
                    "
                    value={date}
                    disabled={saving}
                    onChange={e => {
                      setDate(e.target.value);
                      setError("");
                    }}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setDate(getQuickDate(2))}
                  className="text-xs px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 disabled:opacity-60"
                >
                  After 2 hours
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setDate(getTodayEvening())}
                  className="text-xs px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 disabled:opacity-60"
                >
                  Today 6 PM
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setDate(getTomorrowMorning())}
                  className="text-xs px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 disabled:opacity-60"
                >
                  Tomorrow 10 AM
                </button>
              </div>
            </>
          )}

          {type && (
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
              <p className="text-xs text-gray-500">
                Selected Action
              </p>
              <p className="text-sm font-medium text-gray-900 mt-1">
                {selectedLabel}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {date ? new Date(date).toLocaleString("en-IN") : "No due time selected"}
              </p>
            </div>
          )}
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

          {lead?.nextActionDueAt || lead?.nextActionType ? (
            <button
              type="button"
              onClick={clearNextAction}
              disabled={saving}
              className="
                px-3 border border-red-100 text-red-600
                rounded-lg py-2 text-sm hover:bg-red-50
                disabled:opacity-60
                inline-flex items-center justify-center gap-1.5
              "
            >
              <Trash2 size={15} />
              Clear
            </button>
          ) : null}

          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="
              flex-1 bg-blue-600 text-white rounded-lg
              py-2 text-sm font-medium hover:bg-blue-700
              disabled:opacity-60
              inline-flex items-center justify-center gap-2
            "
          >
            {saving && <Loader2 size={15} className="animate-spin" />}
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}