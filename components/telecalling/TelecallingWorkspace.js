"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { handoffStatus, isTelecallingHandoff } from "@/lib/handoffCore.mjs";
import { PhoneCall, Search, UserRoundCheck, Clock3, CheckCircle2, Loader2, AlertCircle, ExternalLink, MessageCircle, Copy } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { canAccess, canAccessAdminModule, resolveUserRole } from "@/lib/rolePermissions";
import { TELECALL_OUTCOMES, getTelecallOutcome, isAgentUnassigned, isAgentContactable } from "@/lib/telecallingCore.mjs";
import { recordTelecall, handoffTelecalledAgent } from "@/lib/telecallingService";
import VoiceNoteTextarea from "@/components/engagement/VoiceNoteTextarea";
import { appendVoiceNote } from "@/lib/engagementVoiceText";
import {
  buildTelecallerHandoverMessage,
  buildTelecallerHandoverWhatsAppUrl,
  canPrepareHandoverWhatsApp
} from "@/lib/telecallingWhatsApp.mjs";

const nameOf = agent => agent.agencyName || agent.name || agent.agentName || "Unnamed travel agent";
const displayDate = time => {
  if (!time) return "Never";
  const value = time?.toDate?.() || new Date(time);
  return Number.isFinite(value.getTime()) ? value.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
};
const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100";
const buttonClass = "inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50";

export default function TelecallingWorkspace() {
  const { user, loading: authLoading } = useAuth();
  const [agents, setAgents] = useState([]);
  const [executives, setExecutives] = useState([]);
  const [myHandovers, setMyHandovers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [handoffNotice, setHandoffNotice] = useState("");
  const [copyNotice, setCopyNotice] = useState("");
  const [search, setSearch] = useState("");
  const [view, setView] = useState("queue");
  const [activeId, setActiveId] = useState("");
  const [saving, setSaving] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [form, setForm] = useState({ spocIndex: "0", outcome: "", summary: "", followUpAt: "", assigneeUid: "", reason: "" });
  const mayCall = canAccess(user, "telecalling.call");
  const mayAssign = canAccess(user, "telecalling.assign");
  const mayView = canAccess(user, "telecalling.view");
  const maySeeAdminAgentDetail = canAccessAdminModule(user, "travel_agents");
  const isTelecaller = resolveUserRole(user) === "telecaller";

  useEffect(() => {
    if (authLoading || !mayView) return;
    const offAgents = onSnapshot(collection(db, "travelAgents"), snapshot => {
      setAgents(snapshot.docs.map(row => ({ id: row.id, ...row.data() })).filter(row => !row.deleted && !row.isDeleted));
      setLoading(false);
    }, err => { setError(err.message || "Travel Agent data unavailable."); setLoading(false); });
    // Only active team members eligible for commercial handover are queried.
    const offUsers = onSnapshot(query(collection(db, "users"), where("role", "in", ["employee", "operation_executive"])), snapshot => {
      setExecutives(snapshot.docs.map(row => ({ ...row.data(), id: row.id }))
        .filter(row => row.active !== false)
        .sort((a,b) => String(a.name || a.email).localeCompare(String(b.name || b.email))));
    }, err => setError(`Team directory: ${err.message || "Could not load team members."}`));
    return () => { offAgents(); offUsers(); };
  }, [authLoading, mayView]);

  useEffect(() => {
    if (authLoading || !isTelecaller || !user?.uid) return;
    // Only the telecaller-created audit records are visible to this user.
    return onSnapshot(query(collection(db, "travelAgentAssignments"), where("assignedByUid", "==", user.uid)), snap => {
      setMyHandovers(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(isTelecallingHandoff));
    }, err => console.warn("Telecaller handover status unavailable:", err?.message || err));
  }, [authLoading, isTelecaller, user?.uid]);

  const queue = useMemo(() => agents.filter(a => isAgentUnassigned(a) && isAgentContactable(a)), [agents]);
  const handed = useMemo(() => agents.filter(a =>
    !isAgentUnassigned(a) && !!a.telecallerHandoffByUid &&
    (!isTelecaller || a.telecallerHandoffByUid === user?.uid)
  ), [agents, isTelecaller, user?.uid]);
  const source = view === "handed" ? handed : queue;
  const filtered = useMemo(() => source.filter(a => [nameOf(a), a.agentCode, a.city, a.spocs?.[0]?.name, a.spocs?.[0]?.mobile].some(v => String(v || "").toLowerCase().includes(search.trim().toLowerCase())))
    .sort((a,b) => {
      const dateA = a.telecallerLastCallAt?.toMillis?.() || 0;
      const dateB = b.telecallerLastCallAt?.toMillis?.() || 0;
      return dateA - dateB || nameOf(a).localeCompare(nameOf(b));
    }), [source, search]);
  const agent = agents.find(item => item.id === activeId);
  const selectedSpoc = agent?.spocs?.[Number(form.spocIndex)] || agent?.spocs?.find(spoc => spoc.isPrimary) || agent?.spocs?.[0] || {};
  const handoverPhone = selectedSpoc.whatsapp || selectedSpoc.mobile || selectedSpoc.phone ||
    agent?.whatsappNumber || agent?.mobile || agent?.phone || agent?.contactNumber || "";
  const canPrepareMessage = view === "handed" && agent && canPrepareHandoverWhatsApp(agent) &&
    (!isTelecaller || agent.telecallerHandoffByUid === user?.uid);
  const handoverMessage = canPrepareMessage ? buildTelecallerHandoverMessage({
    contactName: selectedSpoc.name || selectedSpoc.contactName || "Travel Partner",
    managerName: agent.assignedToName
  }) : "";
  const whatsappUrl = canPrepareMessage ? buildTelecallerHandoverWhatsAppUrl({ mobile: handoverPhone, message: handoverMessage }) : "";
  const qualified = queue.filter(a => a.telecallerQualification === "qualified").length;
  const untouched = queue.filter(a => !a.telecallerLastCallAt).length;
  const dueNow = queue.filter(a => a.telecallerFollowUpAt && (a.telecallerFollowUpAt.toMillis?.() || new Date(a.telecallerFollowUpAt).getTime()) <= Date.now()).length;

  const chooseAgent = id => {
    setActiveId(id);
    setError("");
    setHandoffNotice("");
    setCopyNotice("");
    const row = agents.find(item => item.id === id);
    const primary = row?.spocs?.findIndex(spoc => spoc.isPrimary) ?? -1;
    setForm({ spocIndex: String(Math.max(primary, 0)), outcome: "", summary: "", followUpAt: "", assigneeUid: "", reason: "" });
  };

  const saveCall = async event => {
    event.preventDefault(); if (!agent || saving || voiceBusy) return;
    setSaving(true); setError("");
    try {
      await recordTelecall({ agentId: agent.id, spocIndex: Number(form.spocIndex), outcome: form.outcome, summary: form.summary, followUpAt: form.followUpAt, user });
      setForm(prev => ({ ...prev, outcome: "", summary: "", followUpAt: "" }));
    } catch (err) { setError(err.message || "Call could not be saved."); }
    finally { setSaving(false); }
  };
  const handoff = async event => {
    event.preventDefault(); if (!agent || saving) return;
    if (!window.confirm(`Assign ${nameOf(agent)} to the selected team member? This changes the relationship owner.`)) return;
    setSaving(true); setError("");
    try {
      await handoffTelecalledAgent({ agentId: agent.id, assigneeUid: form.assigneeUid, reason: form.reason, user });
      setView("handed");
      setHandoffNotice("Agent assigned successfully. The executive now has a new notification in My Handoffs. Review the separate WhatsApp introduction for the travel agent.");
      setCopyNotice("");
    } catch (err) { setError(err.message || "Could not assign travel agent."); }
    finally { setSaving(false); }
  };

  const copyMessage = async () => {
    if (!handoverMessage) return;
    try {
      await navigator.clipboard.writeText(handoverMessage);
      setCopyNotice("Message copied. Paste it into your WhatsApp conversation.");
    } catch {
      setCopyNotice("Copy unavailable. Select and copy the message from the preview below.");
    }
  };

  if (authLoading) return <div className="p-8 text-sm text-slate-500">Loading workspace...</div>;
  if (!mayView) return <div className="p-8 text-sm text-red-700">Telecalling access is not enabled for this role.</div>;
  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 pb-16 pt-5 sm:px-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-blue-700">Relationship Activation</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-950">Telecalling Workspace</h1>
        <p className="mt-1 text-sm text-slate-600">Call unassigned travel agents, record real connection outcomes, then hand interested partners to a Relationship / Lead Executive.</p>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          { label:"Awaiting contact / handover", value:queue.length, icon:PhoneCall },
          { label:"Never called", value:untouched, icon:Clock3 },
          { label:"Interested - ready to hand over", value:qualified, icon:UserRoundCheck },
          { label:"Handed over", value:handed.length, icon:CheckCircle2 },
          { label:"Follow-ups due", value:dueNow, icon:Clock3 }
        ].map(k => <div key={k.label} className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm"><k.icon size={18} className="text-blue-700"/><div className="mt-2 text-2xl font-bold text-slate-900">{k.value}</div><p className="mt-1 text-xs text-slate-500">{k.label}</p></div>)}
      </div>

      {error && <div role="alert" className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"><AlertCircle size={17}/>{error}</div>}
      {handoffNotice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{handoffNotice}</div>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-2">
              <button onClick={()=>{setView("queue");setActiveId("");}} className={`rounded-lg px-3 py-2 text-sm font-semibold ${view==="queue"?"bg-blue-700 text-white":"bg-slate-100 text-slate-700"}`}>Call queue</button>
              <button onClick={()=>{setView("handed");setActiveId("");}} className={`rounded-lg px-3 py-2 text-sm font-semibold ${view==="handed"?"bg-blue-700 text-white":"bg-slate-100 text-slate-700"}`}>Handed over</button>
            </div>
            <label className="relative"><Search size={16} className="absolute left-3 top-3 text-slate-400"/><input aria-label="Search travel agents" className={`${inputClass} pl-9`} placeholder="Search agent, city or phone" value={search} onChange={e=>setSearch(e.target.value)} /></label>
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            {loading ? <div className="p-8 text-sm text-slate-500">Loading agents...</div> : !filtered.length ? <div className="p-8 text-sm text-slate-500">No matching agents.</div> : filtered.map(item => {
              const spoc = item.spocs?.find(s=>s.isPrimary) || item.spocs?.[0] || {};
              return <button key={item.id} onClick={()=>chooseAgent(item.id)} className={`block w-full border-b border-slate-100 p-4 text-left transition hover:bg-blue-50 ${activeId === item.id ? "bg-blue-50" : "bg-white"}`}>
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold text-slate-900">{nameOf(item)}</p><p className="mt-1 text-xs text-slate-500">{spoc.name || "No SPOC"} · {spoc.mobile || "Phone missing"} · {item.city || "—"}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${item.telecallerQualification === "qualified" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{view === "handed" ? "Assigned" : item.telecallerQualification === "qualified" ? "Interested" : "Unassigned"}</span></div>
                <p className="mt-2 text-xs text-slate-500">{item.telecallerLastOutcome ? `Last call: ${getTelecallOutcome(item.telecallerLastOutcome)?.label || item.telecallerLastOutcome}` : "Not contacted"} · {displayDate(item.telecallerLastCallAt)}{item.telecallerFollowUpAt ? ` · Follow-up: ${displayDate(item.telecallerFollowUpAt)}` : ""}</p>
                {view === "handed" && <p className="mt-1 text-xs font-medium text-blue-700">Assigned to {item.assignedToName || item.assignedToEmail || "team member"}{isTelecaller && (() => { const related = myHandovers.find(h => h.agentId === item.id); return related ? ` · ${handoffStatus(related) === "contacted" ? "First contact completed" : handoffStatus(related) === "accepted" ? "Accepted by executive" : "New assignment sent"}` : ""; })()}</p>}
              </button>;
            })}
          </div>
        </section>

        <aside className="self-start rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:sticky xl:top-24">
          {!agent ? <div className="py-10 text-center text-sm text-slate-500">Select a travel agent to log a call or hand over the relationship.</div> : <div className="space-y-5">
            <div><h2 className="font-semibold text-slate-900">{nameOf(agent)}</h2><p className="text-xs text-slate-500">{agent.agentCode || "Travel agent"}</p>{agent.spocs?.length > 0 && <p className="mt-2 text-sm text-slate-700">{agent.spocs[Number(form.spocIndex)]?.name || "Contact"}: <a className="font-semibold text-blue-700" href={`tel:${String(agent.spocs[Number(form.spocIndex)]?.mobile || "").replace(/[^0-9+]/g, "")}`}>{agent.spocs[Number(form.spocIndex)]?.mobile || "No phone"}</a></p>}
              {maySeeAdminAgentDetail && <Link href={`/admin/travel-agents/${agent.id}`} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-700">Agent record <ExternalLink size={13}/></Link>}
            </div>
            {view === "handed" ? <div className="space-y-4">
              <div className="rounded-xl bg-blue-50 p-3 text-sm text-blue-900">Assigned to <b>{agent.assignedToName || "team member"}</b>. The Relationship Executive will handle ongoing enquiries and follow-ups.</div>
              {canPrepareMessage ? <section className="space-y-3 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3" aria-label="WhatsApp handover message">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900"><MessageCircle size={17}/> WhatsApp relationship handover</div>
                <p className="text-xs text-slate-600">Review the message and choose the correct contact before opening WhatsApp.</p>
                {agent.spocs?.length > 1 && <label className="block text-xs font-medium text-slate-600">Send to contact<select className={`${inputClass} mt-1`} value={form.spocIndex} onChange={e => { setForm(prev => ({ ...prev, spocIndex: e.target.value })); setCopyNotice(""); }}>
                  {agent.spocs.map((spoc, i) => <option key={i} value={String(i)}>{spoc.name || `Contact ${i + 1}`} - {spoc.whatsapp || spoc.mobile || spoc.phone || "Number missing"}</option>)}
                </select></label>}
                <p className="text-xs text-slate-600">WhatsApp: {handoverPhone || "Number missing"}</p>
                <div className="whitespace-pre-wrap rounded-lg border border-emerald-100 bg-white p-3 text-xs leading-5 text-slate-800">{handoverMessage}</div>
                {whatsappUrl ? <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className={`${buttonClass} w-full`}><MessageCircle size={16}/> Open WhatsApp to send</a> : <p role="alert" className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">Valid WhatsApp number missing. Update the contact before sending.</p>}
                <button type="button" onClick={copyMessage} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Copy size={15}/> Copy message</button>
                {copyNotice && <p role="status" className="text-xs text-slate-600">{copyNotice}</p>}
                <p className="text-xs text-slate-500">This opens a prefilled WhatsApp chat. Press Send in WhatsApp. Opening the chat does not mean the message was sent.</p>
              </section> : <p className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs text-amber-900">WhatsApp handover is unavailable: confirm the assignment, the Relationship Manager's name and the agent's WhatsApp preference.</p>}
            </div> : <>
              {mayCall && <form onSubmit={saveCall} className="space-y-3 border-t border-slate-100 pt-4">
                <h3 className="text-sm font-semibold text-slate-900">Record call</h3>
                {agent.spocs?.length > 1 && <label className="block text-xs font-medium text-slate-600">Contact person<select className={`${inputClass} mt-1`} value={form.spocIndex} onChange={e=>setForm({...form,spocIndex:e.target.value})}>{agent.spocs.map((s,i)=><option key={i} value={String(i)}>{s.name || `Contact ${i+1}`}</option>)}</select></label>}
                <label className="block text-xs font-medium text-slate-600">Call outcome<select required className={`${inputClass} mt-1`} value={form.outcome} onChange={e=>setForm({...form,outcome:e.target.value})}><option value="">Select outcome</option>{TELECALL_OUTCOMES.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
                <div><label className="block text-xs font-medium text-slate-600">Discussion summary (English, Hindi or Marathi voice supported)</label>
                  <VoiceNoteTextarea value={form.summary} disabled={saving}
                    onChange={text=>setForm(prev=>({...prev,summary:text}))}
                    onAppend={text=>setForm(prev=>({...prev,summary:appendVoiceNote(prev.summary,text)}))}
                    onBusyChange={setVoiceBusy}
                    placeholder="What did the agent say? Destination interest, requirements, objections..." />
                </div>
                <label className="block text-xs font-medium text-slate-600">Follow-up date (optional)<input type="datetime-local" className={`${inputClass} mt-1`} value={form.followUpAt} onChange={e=>setForm({...form,followUpAt:e.target.value})}/></label>
                <button disabled={saving || voiceBusy} className={`${buttonClass} w-full`} type="submit">{saving?<Loader2 size={16} className="animate-spin"/>:<PhoneCall size={16}/>} Save call</button>
              </form>}
              {mayAssign && <form onSubmit={handoff} className="space-y-3 border-t border-slate-100 pt-4"><h3 className="text-sm font-semibold text-slate-900">Handover to team</h3><p className="text-xs text-slate-500">Available after a successful connected call with an interested agent. Existing assignments cannot be overwritten here.</p><label className="block text-xs font-medium text-slate-600">Relationship / Lead Executive<select className={`${inputClass} mt-1`} required value={form.assigneeUid} onChange={e=>setForm({...form,assigneeUid:e.target.value})}><option value="">Select team member</option>{executives.map(u=><option key={u.id} value={u.id}>{u.name || u.displayName || u.email}</option>)}</select></label><label className="block text-xs font-medium text-slate-600">Handover note<input className={`${inputClass} mt-1`} required value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})} placeholder="Interested in Dubai, follow up next week" /></label><button disabled={saving || agent.telecallerQualification !== "qualified" || !executives.length} className={`${buttonClass} w-full`} type="submit"><UserRoundCheck size={16}/> Assign qualified agent</button></form>}
            </>}
          </div>}
        </aside>
      </div>
    </main>
  );
}
