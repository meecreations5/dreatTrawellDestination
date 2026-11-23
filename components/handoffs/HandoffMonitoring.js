"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { resolveUserRole } from "@/lib/rolePermissions";
import { asMillis, handoffStatus, isHandoffOverdue, isTelecallingHandoff } from "@/lib/handoffCore.mjs";
import { saveHandoffSettings, subscribeHandoffSettings } from "@/lib/handoffService";

const formatTime = value => asMillis(value) ? new Date(asMillis(value)).toLocaleString("en-IN", { timeZone:"Asia/Kolkata", dateStyle:"medium", timeStyle:"short" }) : "Not set";

export default function HandoffMonitoring() {
  const { user, loading } = useAuth();
  const [rows, setRows] = useState([]);
  const [hours, setHours] = useState(4);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(timer); }, []);
  const role = resolveUserRole(user);
  const managerView = user?.active !== false && ["admin", "super_admin", "manager"].includes(role);
  const canEdit = user?.active !== false && ["admin", "super_admin"].includes(role);
  useEffect(() => {
    if (loading || !managerView) return;
    const unsubAssignments = onSnapshot(query(collection(db, "travelAgentAssignments"), where("source", "==", "telecalling")), snap => {
      setRows(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(isTelecallingHandoff)
        .sort((a,b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)));
    }, err => setError(`Cannot read team handovers: ${err?.message || "Check Firestore rules."}`));
    const unsubSettings = subscribeHandoffSettings(value => setHours(value.firstContactHours), err => {
      setError(`Contact deadline settings unavailable; using default: ${err?.message || "check rules"}`);
    });
    return () => { unsubAssignments(); unsubSettings(); };
  }, [loading, managerView]);
  const overdue = useMemo(() => rows.filter(row => isHandoffOverdue(row, new Date(now))), [rows]);
  if (!managerView) return null;
  const save = async e => {
    e.preventDefault(); setSaving(true); setError(""); setNotice("");
    try { const value = await saveHandoffSettings(user, { firstContactHours: hours }); setHours(value.firstContactHours); setNotice("The deadline is updated for future handovers; existing due dates remain unchanged."); }
    catch (err) { setError(err.message || "Could not save the deadline."); }
    finally { setSaving(false); }
  };
  return <section className="mx-auto max-w-7xl space-y-3 px-4 pt-6 sm:px-6">
    <div className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold text-slate-900">Manager Handover Monitoring</h2><p className="mt-1 text-sm text-slate-600">Live handovers, first-contact deadlines and unattended assignments.</p></div><div className="rounded-xl bg-amber-50 px-4 py-2 text-center"><div className="text-2xl font-bold text-amber-800">{overdue.length}</div><div className="text-xs text-amber-700">Overdue</div></div></div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600"><span className="rounded-full bg-slate-100 px-3 py-1">{rows.length} total handovers</span><span className="rounded-full bg-amber-50 px-3 py-1">{rows.filter(r => handoffStatus(r) === "assigned").length} awaiting acceptance</span><span className="rounded-full bg-blue-50 px-3 py-1">{rows.filter(r => handoffStatus(r) === "accepted").length} awaiting first connected call</span><span className="rounded-full bg-emerald-50 px-3 py-1">{rows.filter(r => handoffStatus(r) === "contacted").length} contacted</span></div>
      {canEdit && <form onSubmit={save} className="mt-4 flex flex-wrap items-end gap-2"><label className="text-xs font-medium text-slate-600">First-contact SLA (calendar hours, 1–48)<input type="number" min="1" max="48" step="1" value={hours} onChange={e=>setHours(e.target.value)} className="mt-1 block w-32 rounded-lg border border-slate-200 p-2 text-sm" /></label><button type="submit" disabled={saving} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving..." : "Save deadline"}</button></form>}
      {notice && <p role="status" className="mt-2 text-sm text-emerald-700">{notice}</p>}
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
      {overdue.length > 0 ? <div className="mt-4 space-y-2"><h3 className="text-sm font-semibold text-rose-800">Needs management attention</h3>{overdue.slice(0, 30).map(row => <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm"><div><b>{row.agentName || "Travel agent"}</b> · Assigned to {row.assignedToName || "Executive"}<div className="text-xs text-rose-700">Due {formatTime(row.firstContactDueAt)} · {handoffStatus(row) === "assigned" ? "Not accepted" : "Not contacted"}</div></div><Link href={`/admin/travel-agents/${encodeURIComponent(row.agentId)}`} className="font-semibold text-blue-700 underline">Agent record</Link></div>)}</div> : <p className="mt-3 text-sm text-emerald-800">No overdue first-contact handovers.</p>}
      <p className="mt-3 text-xs text-slate-500">Overdue alerts appear here when a manager opens the CRM. This version does not send background push, email or WhatsApp escalation messages.</p>
    </div>
  </section>;
}
