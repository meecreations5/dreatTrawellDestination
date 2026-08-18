"use client";

import { useState } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { Loader2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { LEAD_CLOSING_POTENTIAL_OPTIONS, getLeadClosingPotentialMeta } from "@/lib/leadPotential";
import { logLeadAction, LEAD_TIMELINE_TYPES } from "@/lib/logLeadAction";

export function LeadPotentialBadge({ lead, compact = false }) {
  const meta = getLeadClosingPotentialMeta(lead);
  const classes = meta.tone === "rose"
    ? "bg-rose-50 text-rose-700 border-rose-100"
    : meta.tone === "amber"
      ? "bg-amber-50 text-amber-700 border-amber-100"
      : meta.tone === "red"
        ? "bg-red-50 text-red-700 border-red-100"
        : "bg-slate-100 text-slate-700 border-slate-200";
  return <span className={`inline-flex items-center rounded-full border font-semibold ${compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"} ${classes}`}>{meta.label}</span>;
}

export default function LeadPotentialControl({ lead, user, disabled = false }) {
  const meta = getLeadClosingPotentialMeta(lead);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const changePotential = async value => {
    if (!lead?.id || !value || value === meta.value || saving) return;
    setSaving(true);
    setError("");
    try {
      const next = LEAD_CLOSING_POTENTIAL_OPTIONS.find(item => item.value === value);
      await updateDoc(doc(db, "leads", lead.id), {
        closingPotential: value,
        closingPotentialLabel: next?.label || value,
        closingPotentialUpdatedAt: serverTimestamp(),
        closingPotentialUpdatedByUid: user?.uid || "",
        closingPotentialUpdatedByName: user?.name || user?.displayName || user?.email || "",
        updatedAt: serverTimestamp()
      });
      await logLeadAction({
        leadId: lead.id,
        type: LEAD_TIMELINE_TYPES.REMARK || "remark",
        title: "Closing Potential Updated",
        description: `Lead closing potential changed from ${meta.label} to ${next?.label || value}`,
        metadata: { action: "closing_potential_updated", from: meta.value, to: value },
        user
      });
    } catch (err) {
      setError(err?.message || "Unable to update closing potential.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Closing Potential</p><p className="mt-1 text-xs text-slate-500">Prioritise closing independently of the lead stage.</p></div>
        {saving ? <Loader2 size={16} className="animate-spin text-blue-600" /> : <LeadPotentialBadge lead={lead} />}
      </div>
      <select value={meta.value} disabled={disabled || saving} onChange={e => changePotential(e.target.value)} className="mt-3 h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-blue-400 disabled:bg-slate-50 disabled:text-slate-400">
        {LEAD_CLOSING_POTENTIAL_OPTIONS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
      {error ? <p className="mt-1 text-[11px] text-rose-600">{error}</p> : null}
    </div>
  );
}
