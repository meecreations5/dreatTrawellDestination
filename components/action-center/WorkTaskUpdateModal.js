"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CalendarClock, CheckCircle2, Loader2, X } from "lucide-react";
import { alignToWorkSchedule, DEFAULT_WORK_SCHEDULE } from "@/lib/workSchedule";
import { subscribeProductivitySettings } from "@/lib/engagementProductivitySettings";
import { rescheduleWorkTask, updateWorkTaskStatus } from "@/lib/workTaskService";

function toLocalInput(value) {
  const source = typeof value?.toDate === "function" ? value.toDate() : value;
  const date = source instanceof Date ? source : new Date(source || Date.now());
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}

export default function WorkTaskUpdateModal({ open, task, action, user, onClose }) {
  const [note, setNote] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [workSchedule, setWorkSchedule] = useState(DEFAULT_WORK_SCHEDULE);

  useEffect(() => {
    return subscribeProductivitySettings(
      settings => setWorkSchedule(settings.workSchedule || DEFAULT_WORK_SCHEDULE),
      () => setWorkSchedule(DEFAULT_WORK_SCHEDULE)
    );
  }, []);

  useEffect(() => {
    if (!open) return;
    setNote("");
    setError("");
    setDueAt(toLocalInput(task?.dueAt || new Date(Date.now() + 60 * 60000)));
  }, [open, task]);

  if (!open || !task) return null;

  const config = action === "waiting"
    ? { title: "Mark Waiting", helper: "Record exactly what you are waiting for.", button: "Save Waiting Status" }
    : action === "completed"
      ? { title: "Complete Activity", helper: "Add the final outcome so management can see what was completed.", button: "Mark Completed" }
      : action === "reschedule"
        ? { title: "Reschedule Activity", helper: "Move this follow-up to the next workable time.", button: "Reschedule" }
        : { title: "Update Activity", helper: "Record the latest task status.", button: "Save" };

  const save = async () => {
    setError("");
    if (action === "waiting" && !note.trim()) {
      setError("Please mention what you are waiting for.");
      return;
    }

    setSaving(true);
    try {
      if (action === "reschedule") {
        const selected = new Date(dueAt);
        if (!dueAt || Number.isNaN(selected.getTime())) throw new Error("Please choose a valid due date and time.");
        const aligned = alignToWorkSchedule(selected, workSchedule) || selected;
        await rescheduleWorkTask({ task, dueAt: aligned, note, user });
      } else {
        await updateWorkTaskStatus({ task, status: action, note, user });
      }
      onClose?.(true);
    } catch (err) {
      console.error("Task update failed:", err);
      setError(err?.message || "Unable to update activity.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-950/45 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-950">{config.title}</h2>
            <p className="mt-1 text-sm text-slate-500">{config.helper}</p>
          </div>
          <button type="button" disabled={saving} onClick={() => onClose?.()} className="text-slate-400 hover:text-slate-700 disabled:opacity-50"><X size={18} /></button>
        </div>

        <div className="space-y-4 p-5">
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
            <p className="text-sm font-semibold text-slate-900">{task.title || task.activityTypeLabel || "Work Activity"}</p>
            <p className="mt-0.5 text-xs text-slate-500">{task.leadCode || task.travelAgentName || task.agentName || "General activity"}</p>
          </div>

          {error ? <div className="flex items-start gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700"><AlertCircle size={16} className="mt-0.5 shrink-0" />{error}</div> : null}

          {action === "reschedule" ? (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">New Due Date & Time</label>
              <div className="relative mt-1.5">
                <CalendarClock size={16} className="pointer-events-none absolute left-3 top-3 text-slate-400" />
                <input type="datetime-local" value={dueAt} onChange={event => setDueAt(event.target.value)} className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-100" />
              </div>
            </div>
          ) : null}

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">{action === "waiting" ? "Waiting For" : "Status Note"}</label>
            <textarea rows={3} value={note} onChange={event => setNote(event.target.value)} placeholder={action === "waiting" ? "Example: Waiting for supplier to confirm hotel rate." : "Example: Revised quotation shared with the agent and next call fixed for tomorrow."} className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-100" />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4">
          <button type="button" disabled={saving} onClick={() => onClose?.()} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 disabled:opacity-50">Cancel</button>
          <button type="button" disabled={saving} onClick={save} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            {config.button}
          </button>
        </div>
      </div>
    </div>
  );
}
