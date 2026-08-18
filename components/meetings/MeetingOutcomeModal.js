"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, X } from "lucide-react";
import { completeMeeting } from "@/lib/meetingService";
import { MEETING_OUTCOMES } from "@/lib/meetings";
import { TRAVEL_AGENT_POTENTIAL_OPTIONS } from "@/lib/travelAgentPotential";

const inputClass = "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

export default function MeetingOutcomeModal({ open, meeting, user, onClose, onSaved }) {
  const [outcome, setOutcome] = useState("");
  const [mom, setMom] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [nextFollowUpAt, setNextFollowUpAt] = useState("");
  const [potentialUpdate, setPotentialUpdate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!open || !meeting) return null;

  const handleComplete = async () => {
    setError("");
    setSaving(true);
    try {
      await completeMeeting({ meetingId: meeting.id, outcome, mom, nextAction, nextFollowUpAt, potentialUpdate, user });
      onSaved?.();
      onClose?.();
    } catch (err) {
      setError(err?.message || "Unable to complete meeting.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1001] flex items-center justify-center bg-slate-950/45 p-4">
      <div className="w-full max-w-xl rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 p-5">
          <div><h2 className="text-lg font-semibold text-slate-950">Complete Meeting</h2><p className="mt-1 text-xs text-slate-500">{meeting.travelAgentName} • MOM is required and will become an engagement entry.</p></div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="space-y-4 p-5">
          {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
          <div><label className="mb-1 block text-xs font-semibold text-slate-600">Outcome *</label><select value={outcome} onChange={e => setOutcome(e.target.value)} className={inputClass}><option value="">Select outcome</option>{MEETING_OUTCOMES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
          <div><label className="mb-1 block text-xs font-semibold text-slate-600">Meeting Notes / MOM *</label><textarea rows={5} value={mom} onChange={e => setMom(e.target.value)} placeholder="Discussion summary, decisions, requirements..." className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></div>
          <div className="grid gap-4 md:grid-cols-2">
            <div><label className="mb-1 block text-xs font-semibold text-slate-600">Next Action</label><input value={nextAction} onChange={e => setNextAction(e.target.value)} placeholder="Send quote / call back" className={inputClass} /></div>
            <div><label className="mb-1 block text-xs font-semibold text-slate-600">Next Follow-up</label><input type="datetime-local" value={nextFollowUpAt} onChange={e => setNextFollowUpAt(e.target.value)} className={inputClass} /></div>
          </div>
          <div><label className="mb-1 block text-xs font-semibold text-slate-600">Update Travel Agent Potential</label><select value={potentialUpdate} onChange={e => setPotentialUpdate(e.target.value)} className={inputClass}><option value="">Keep current potential</option>{TRAVEL_AGENT_POTENTIAL_OPTIONS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 p-5">
          <button type="button" onClick={onClose} className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-600">Cancel</button>
          <button type="button" onClick={handleComplete} disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">{saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}{saving ? "Completing..." : "Complete Meeting"}</button>
        </div>
      </div>
    </div>
  );
}
