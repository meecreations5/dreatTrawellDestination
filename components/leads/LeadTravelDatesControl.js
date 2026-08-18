"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Loader2, Save } from "lucide-react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";

import { db } from "@/lib/firebase";
import { logLeadAction, LEAD_TIMELINE_TYPES } from "@/lib/logLeadAction";
import {
  buildLeadTravelPayload,
  formatDateInputValue,
  formatLeadTravelRange,
  getLeadTravelEndDate,
  getLeadTravelStartDate
} from "@/lib/leadTravelDates";

export default function LeadTravelDatesControl({ lead, user, disabled = false }) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setStartDate(formatDateInputValue(getLeadTravelStartDate(lead)));
    setEndDate(formatDateInputValue(getLeadTravelEndDate(lead)));
    setMessage("");
  }, [lead?.id, lead?.travelStartDate, lead?.travelEndDate, lead?.travelDate, lead?.travelMonth]);

  const currentLabel = useMemo(() => formatLeadTravelRange(lead || {}), [lead]);

  const save = async () => {
    if (!lead?.id || saving || disabled) return;

    if (endDate && startDate && endDate < startDate) {
      setMessage("Return date cannot be before the travel start date.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const payload = buildLeadTravelPayload({
        travelStartDate: startDate,
        travelEndDate: endDate,
        source: "lead_manual"
      });

      await updateDoc(doc(db, "leads", lead.id), {
        ...payload,
        travelDateUpdatedAt: serverTimestamp(),
        travelDateUpdatedByUid: user?.uid || "",
        travelDateUpdatedByName: user?.displayName || user?.name || user?.email || "",
        updatedAt: serverTimestamp()
      });

      await logLeadAction({
        leadId: lead.id,
        type: LEAD_TIMELINE_TYPES.REMARK,
        title: "Travel date updated",
        description: startDate
          ? `Travel ${startDate}${endDate ? ` to ${endDate}` : ""}`
          : "Travel date cleared",
        metadata: {
          action: "travel_date_updated",
          ...payload
        },
        user
      });

      setMessage("Travel date saved.");
    } catch (error) {
      console.error("Travel date update failed:", error);
      setMessage(error?.message || "Unable to save travel date.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <CalendarDays className="h-4 w-4 text-blue-600" />
            Travel Date
          </div>
          <p className="mt-1 text-xs text-slate-500">{currentLabel}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs font-medium text-slate-600">
          <span>Travel Start</span>
          <input
            type="date"
            value={startDate}
            disabled={disabled || saving}
            onChange={event => setStartDate(event.target.value)}
            className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
          />
        </label>

        <label className="space-y-1 text-xs font-medium text-slate-600">
          <span>Travel End (optional)</span>
          <input
            type="date"
            value={endDate}
            min={startDate || undefined}
            disabled={disabled || saving}
            onChange={event => setEndDate(event.target.value)}
            className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className={`text-xs ${message.includes("Unable") || message.includes("cannot") ? "text-red-600" : "text-emerald-600"}`}>
          {message}
        </p>

        <button
          type="button"
          onClick={save}
          disabled={disabled || saving}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save Travel Date
        </button>
      </div>
    </section>
  );
}
