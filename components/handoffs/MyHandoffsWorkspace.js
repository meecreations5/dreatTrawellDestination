"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BellRing, CheckCheck, Clock3, PhoneCall, Loader2, AlertCircle, UserCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { resolveUserRole } from "@/lib/rolePermissions";
import { FIRST_CONTACT_OUTCOMES, asMillis, handoffStatus, isHandoffOverdue, isHandoffUnread } from "@/lib/handoffCore.mjs";
import { acceptAssignedHandoff, recordHandoffFirstContact, subscribeMyHandoffs } from "@/lib/handoffService";

function readableDate(value) {
  const time = asMillis(value);
  return time ? new Date(time).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }) : "Not set";
}
const input = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100";
const action = "inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50";

export default function MyHandoffsWorkspace() {
  const { user, loading: authLoading } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(timer); }, []);
  const [form, setForm] = useState({ outcome: "", summary: "" });
  const eligible = user?.active !== false && ["employee", "operation_executive"].includes(resolveUserRole(user));
  useEffect(() => {
    if (authLoading) return;
    if (!eligible || !user?.uid) { setLoading(false); return; }
    setLoading(true);
    return subscribeMyHandoffs(user, rows => { setRecords(rows); setLoading(false); }, err => {
      setError(`Could not load handovers: ${err?.message || "Permission denied."} Please check Firebase read rules.`);
      setLoading(false);
    });
  }, [authLoading, eligible, user?.uid, user?.role]);
  const active = useMemo(() => records.filter(row => handoffStatus(row) !== "contacted"), [records]);
  const newCount = records.filter(isHandoffUnread).length;
  const overdueCount = records.filter(isHandoffOverdue).length;
  const contacted = records.filter(row => handoffStatus(row) === "contacted").length;
  const selected = records.find(row => row.id === selectedId) || active[0] || records[0];
  const accept = async row => {
    setBusyId(row.id); setError(""); setSuccess("");
    try { await acceptAssignedHandoff({ handoffId: row.id, user }); setSuccess(`${row.agentName} handover accepted. Please make your introduction call.`); }
    catch (err) { setError(err.message || "Could not accept the handover."); }
    finally { setBusyId(""); }
  };
  const saveFirstContact = async e => {
    e.preventDefault();
    if (!selected || busyId) return;
    setBusyId(selected.id); setError(""); setSuccess("");
    try {
      const result = await recordHandoffFirstContact({ handoffId: selected.id, user, ...form });
      setSuccess(result.contacted ? "Connected call saved. First contact completed." : "Call attempt saved. This handover remains open until you connect with the agent.");
      setForm({ outcome: "", summary: "" });
    } catch (err) { setError(err.message || "Could not save first contact."); }
    finally { setBusyId(""); }
  };
  if (authLoading || loading) return <div className="p-8 text-sm text-slate-600">Loading your handovers...</div>;
  if (!eligible) return <div className="p-8 text-sm text-rose-700">My Handoffs is only for assigned Relationship / Lead Executives.</div>;
  return <main className="mx-auto max-w-6xl space-y-5 px-4 pb-16 pt-7 sm:px-6">
    <div><p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Relationship Activation</p><h1 className="mt-1 text-2xl font-bold text-slate-950">My Agent Handovers</h1><p className="mt-1 text-sm text-slate-600">New agent assignments arrive here automatically. Accept the handover and record your first connected call.</p></div>
    <div className="grid grid-cols-3 gap-3">
      {[{ icon:BellRing, label:"New", count:newCount }, { icon:Clock3, label:"Overdue", count:overdueCount }, { icon:CheckCheck, label:"Contacted", count:contacted }].map(({ icon:Icon,label,count }) => <div key={label} className="rounded-2xl border border-blue-100 bg-white p-3 shadow-sm"><Icon size={18} className="text-blue-700"/><p className="mt-2 text-2xl font-bold text-slate-900">{count}</p><p className="text-xs text-slate-500">{label}</p></div>)}
    </div>
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle className="mr-2 inline" size={15}/>{error}</p>}
    {success && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{success}</p>}
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">Assigned to me · {records.length}</h2>
        {!records.length ? <p className="p-6 text-sm text-slate-500">No telecaller handovers are assigned to you yet.</p> : records.map(row => {
          const status = handoffStatus(row);
          return <button type="button" key={row.id} onClick={() => { setSelectedId(row.id); setError(""); setSuccess(""); setForm({ outcome:"", summary:"" }); }} className={`w-full border-b border-slate-100 p-4 text-left hover:bg-blue-50 ${selected?.id === row.id ? "bg-blue-50" : ""}`}>
            <div className="flex items-start justify-between gap-3"><div className="font-semibold text-slate-900">{row.agentName || "Travel agent"}</div><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${status === "contacted" ? "bg-emerald-100 text-emerald-800" : isHandoffOverdue(row, new Date(now)) ? "bg-rose-100 text-rose-800" : status === "accepted" ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"}`}>{isHandoffOverdue(row, new Date(now)) ? "Overdue" : status === "contacted" ? "Contacted" : status === "accepted" ? "Accepted" : "New assignment"}</span></div>
            <p className="mt-1 text-xs text-slate-600">Assigned by {row.assignedByName || "Telecalling Team"} · {readableDate(row.createdAt)}</p>
            <p className="mt-1 text-xs text-slate-500">Contact due: {readableDate(row.firstContactDueAt)}</p>
          </button>;
        })}
      </section>
      <aside className="self-start space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-16">
        {selected ? <>
          <div><h2 className="text-lg font-semibold text-slate-950">{selected.agentName}</h2><p className="mt-1 text-xs text-slate-500">Assigned by {selected.assignedByName} · {readableDate(selected.createdAt)}</p></div>
          <div className="rounded-xl border border-slate-100 p-3 text-sm text-slate-700"><b>Agent contact</b><p className="mt-1">{selected.contactName || "Primary contact not recorded"}</p>{selected.contactPhone && <p className="mt-1"><a className="font-semibold text-blue-700 underline" href={`tel:${String(selected.contactPhone).replace(/[^0-9+]/g, "")}`}>{selected.contactPhone}</a></p>}{selected.contactEmail && <p className="mt-1">{selected.contactEmail}</p>}</div>
          <div className="rounded-xl bg-blue-50 p-3 text-sm text-blue-950"><b>Telecaller notes</b><p className="mt-1 whitespace-pre-wrap">{selected.lastCallSummary || "No call notes captured"}</p><p className="mt-1 text-xs">Handover: {selected.assignmentReason}</p></div>
          <p className="text-sm text-slate-700"><b>First contact due:</b> {readableDate(selected.firstContactDueAt)}</p>
          {handoffStatus(selected) === "assigned" && <button className={`${action} w-full`} disabled={busyId === selected.id} onClick={() => accept(selected)}>{busyId === selected.id ? <Loader2 className="animate-spin" size={16}/> : <UserCheck size={16}/>} Accept handover</button>}
          {handoffStatus(selected) === "accepted" && <form className="space-y-3 border-t border-slate-100 pt-3" onSubmit={saveFirstContact}>
            <div className="text-sm font-semibold text-slate-900"><PhoneCall size={17} className="mr-2 inline text-blue-700"/>Record first contact</div>
            <label className="block text-xs font-medium text-slate-600">Call outcome<select className={`${input} mt-1`} required value={form.outcome} onChange={e => setForm(p => ({ ...p, outcome:e.target.value }))}><option value="">Choose outcome</option>{FIRST_CONTACT_OUTCOMES.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
            <label className="block text-xs font-medium text-slate-600">Conversation / attempt notes<textarea className={`${input} mt-1`} required rows={4} value={form.summary} onChange={e => setForm(p => ({ ...p, summary:e.target.value }))} placeholder="Share what happened during the introduction call"/></label>
            <button type="submit" className={`${action} w-full`} disabled={busyId === selected.id}>{busyId === selected.id ? <Loader2 className="animate-spin" size={16}/> : <PhoneCall size={16}/>} Save first contact</button>
            <p className="text-xs text-slate-500">Only a connected call changes status to Contacted. Busy/no answer remains open and is recorded in Engagement.</p>
          </form>}
          {handoffStatus(selected) === "contacted" && <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">First contact completed on {readableDate(selected.firstContactAt)}. This agent is now in regular Relationship Management.</div>}
          <Link href={`/travel-agents/${encodeURIComponent(selected.agentId)}`} className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:underline">Open travel agent record</Link>
        </> : <p className="text-sm text-slate-500">Select an assignment to see the details.</p>}
      </aside>
    </div>
  </main>;
}
