"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CalendarClock, Loader2, Plus, X } from "lucide-react";
import { alignToWorkSchedule, DEFAULT_WORK_SCHEDULE } from "@/lib/workSchedule";
import { subscribeProductivitySettings } from "@/lib/engagementProductivitySettings";
import {
  WORK_TASK_PRIORITIES,
  WORK_TASK_TYPES,
  createWorkTask
} from "@/lib/workTaskService";
import { findDirectoryMember } from "@/lib/teamDirectory";

function toLocalInput(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}

function defaultDueAt() {
  const candidate = new Date(Date.now() + 60 * 60000);
  const aligned = alignToWorkSchedule(candidate, DEFAULT_WORK_SCHEDULE) || candidate;
  return toLocalInput(aligned);
}

function leadLabel(lead = {}) {
  const code = lead.leadCode || lead.code || "Lead";
  const agent = lead.travelAgentName || lead.agentName || lead.agencyName || "Travel Agent";
  const destination = lead.destinationName || lead.destination || "";
  return `${code} · ${agent}${destination ? ` · ${destination}` : ""}`;
}

export default function WorkTaskModal({
  open,
  onClose,
  onSaved,
  user,
  leads = [],
  directory = [],
  adminMode = false
}) {
  const [activityType, setActivityType] = useState("lead_follow_up");
  const [leadId, setLeadId] = useState("");
  const [dueAt, setDueAt] = useState(defaultDueAt);
  const [priority, setPriority] = useState("normal");
  const [note, setNote] = useState("");
  const [assignedKey, setAssignedKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [workSchedule, setWorkSchedule] = useState(DEFAULT_WORK_SCHEDULE);

  const meta = useMemo(
    () => WORK_TASK_TYPES.find(item => item.value === activityType) || WORK_TASK_TYPES[0],
    [activityType]
  );

  const selectedLead = useMemo(
    () => leads.find(item => item.id === leadId) || null,
    [leadId, leads]
  );

  useEffect(() => {
    return subscribeProductivitySettings(
      settings => setWorkSchedule(settings.workSchedule || DEFAULT_WORK_SCHEDULE),
      () => setWorkSchedule(DEFAULT_WORK_SCHEDULE)
    );
  }, []);

  const ownMember = useMemo(() => {
    if (!user) return null;
    return (
      findDirectoryMember(directory, user.uid || "") ||
      findDirectoryMember(directory, user.email || "") ||
      null
    );
  }, [directory, user]);

  if (!open) return null;

  const resetAndClose = () => {
    if (saving) return;
    setError("");
    onClose?.();
  };

  const save = async () => {
    setError("");

    if (meta.group === "lead" && !selectedLead) {
      setError("Please select the related lead for this lead activity.");
      return;
    }

    const dueDate = new Date(dueAt);
    if (!dueAt || Number.isNaN(dueDate.getTime())) {
      setError("Please select a valid due date and time.");
      return;
    }

    const alignedDue = alignToWorkSchedule(dueDate, workSchedule) || dueDate;
    const assignedMember = adminMode
      ? findDirectoryMember(directory, assignedKey) || ownMember
      : ownMember;

    setSaving(true);
    try {
      await createWorkTask({
        activityType,
        lead: selectedLead,
        dueAt: alignedDue,
        priority,
        note,
        assignedMember,
        user
      });
      onSaved?.();
      onClose?.();
    } catch (err) {
      console.error("Work task create failed:", err);
      setError(err?.message || "Unable to create work task.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-950/45 p-4">
      <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <Plus size={19} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-950">Add Follow-up / Work Activity</h2>
              <p className="mt-1 text-sm text-slate-500">Assign the next action with a clear due time and status.</p>
            </div>
          </div>
          <button type="button" onClick={resetAndClose} className="text-slate-400 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {error ? (
            <div className="flex items-start gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Activity</label>
            <select value={activityType} onChange={event => setActivityType(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-100">
              <optgroup label="Lead Activity">
                {WORK_TASK_TYPES.filter(item => item.group === "lead" && item.capture !== "automatic" && !item.hidden).map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
              </optgroup>
              <optgroup label="On-ground Activity">
                {WORK_TASK_TYPES.filter(item => item.group === "on_ground" && item.capture !== "automatic" && !item.hidden).map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
              </optgroup>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Related Lead {meta.group === "lead" ? <span className="text-rose-500">*</span> : <span className="font-normal normal-case text-slate-400">(optional)</span>}</label>
            <select value={leadId} onChange={event => setLeadId(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-100">
              <option value="">{meta.group === "lead" ? "Select lead" : "General / no lead"}</option>
              {leads.map(lead => <option key={lead.id} value={lead.id}>{leadLabel(lead)}</option>)}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Due Date & Time</label>
              <div className="relative mt-1.5">
                <CalendarClock size={16} className="pointer-events-none absolute left-3 top-3 text-slate-400" />
                <input type="datetime-local" value={dueAt} onChange={event => setDueAt(event.target.value)} className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-100" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Priority</label>
              <select value={priority} onChange={event => setPriority(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-100">
                {WORK_TASK_PRIORITIES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
          </div>

          {adminMode ? (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assign To</label>
              <select value={assignedKey} onChange={event => setAssignedKey(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-100">
                <option value="">Myself</option>
                {directory.filter(member => member.active !== false).map(member => <option key={member.key} value={member.key}>{member.label || member.name}</option>)}
              </select>
            </div>
          ) : null}

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Instruction / Note</label>
            <textarea rows={3} value={note} onChange={event => setNote(event.target.value)} placeholder="Example: Rework hotel option, confirm supplier rate and share revised quote before 4 PM." className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-100" />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4">
          <button type="button" disabled={saving} onClick={resetAndClose} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 disabled:opacity-50">Cancel</button>
          <button type="button" disabled={saving} onClick={save} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Add Activity
          </button>
        </div>
      </div>
    </div>
  );
}
