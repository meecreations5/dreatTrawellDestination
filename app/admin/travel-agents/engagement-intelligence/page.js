"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, getDocs } from "firebase/firestore";
import {
  Activity, ArrowLeft, ArrowUpRight, CalendarDays, ChevronDown, ChevronRight,
  Download, Mail, MessageCircle, PhoneCall, RefreshCcw, Search, Target, Users
} from "lucide-react";
import AdminGuard from "@/components/AdminGuard";
import { db } from "@/lib/firebase";
import { COMMUNICATION_PURPOSES } from "@/lib/engagementIntelligenceTaxonomy";
import { buildTravelAgentEngagementIntelligence, ENGAGEMENT_GRADES } from "@/lib/travelAgentEngagementIntelligence";

const gradeStyles = {
  "A+": "bg-blue-100 text-blue-800 border-blue-300",
  A: "bg-cyan-50 text-cyan-800 border-cyan-200",
  B: "bg-slate-100 text-slate-700 border-slate-200",
  C: "bg-slate-50 text-slate-500 border-slate-200"
};
const gradeOrder = { "A+": 4, A: 3, B: 2, C: 1 };
const formatNumber = value => Number(value || 0).toLocaleString("en-IN");
const dateLabel = value => value instanceof Date
  ? value.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
  : "—";
const csvCell = value => {
  const raw = String(value ?? "");
  const safe = /^\s*[=+@-]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
};
const businessLabel = (row, leadsAvailable) => !leadsAvailable ? "Not available"
  : row.won > 0 ? "Converted in 30d"
    : row.leads > 0 ? "Enquiry received"
      : "No enquiry in 30d";

function Summary({ label, value, helper, icon: Icon }) {
  return <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
    <div className="flex items-start justify-between gap-2">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        <p className="mt-2 text-2xl font-bold text-slate-900">{value === null ? "—" : formatNumber(value)}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">{helper}</p>
      </div>
      <span className="rounded-xl bg-blue-50 p-2.5 text-blue-700"><Icon className="h-5 w-5" /></span>
    </div>
  </div>;
}

function ScoreDetail({ row, leadsAvailable }) {
  const scores = [
    ["Connected calls / completed meetings", row.scoreBreakdown.connectedConversations, 25],
    ["Confirmed two-way WhatsApp / email", row.scoreBreakdown.twoWayMessages, 25],
    ["Meaningful discussion days", row.scoreBreakdown.meaningfulDiscussions, 20],
    ["Weeks with real two-way engagement", row.scoreBreakdown.consistency, 15],
    ["Positive business-interest days", row.scoreBreakdown.positiveResponse, 10],
    ["Recency of last connection", row.scoreBreakdown.recency, 5]
  ];
  const purposes = [...COMMUNICATION_PURPOSES, { value: "unclassified", label: "Not categorised (legacy / unspecified)" }];
  return <div className="grid gap-5 border-t border-slate-100 bg-slate-50 p-5 xl:grid-cols-3">
    <div>
      <h3 className="text-sm font-bold text-slate-900">Score explanation · {row.score}/100</h3>
      <div className="mt-3 space-y-3">
        {scores.map(([label, score, max]) => <div key={label}>
          <div className="mb-1 flex justify-between gap-2 text-xs text-slate-600"><span>{label}</span><span className="font-semibold">{score}/{max}</span></div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-blue-600" style={{ width: `${score / max * 100}%` }} /></div>
        </div>)}
      </div>
    </div>
    <div>
      <h3 className="text-sm font-bold text-slate-900">Engagement evidence</h3>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
        {[
          ["Call attempts", row.callAttempts], ["Connected calls", row.connectedCalls],
          ["Unconnected calls", row.notConnectedCalls], ["Unknown call outcome", row.unknownCallOutcomes],
          ["WhatsApp outbound", row.whatsappOutbound], ["Email outbound", row.emailOutbound],
          ["Incoming WA / email", row.whatsappInbound + row.emailInbound], ["Documented reply events", row.replyEvents],
          ["Different reply days", row.replyDays], ["Two-way contact days", row.activeDays],
          ["Active contact weeks", row.activeWeeks], ["Completed meetings", row.meetingsCompleted]
        ].map(([name, value]) => <div className="rounded-lg border border-slate-200 bg-white p-2" key={name}>
          <dt className="text-slate-500">{name}</dt><dd className="mt-1 font-bold text-slate-900">{formatNumber(value)}</dd>
        </div>)}
      </dl>
    </div>
    <div>
      <h3 className="text-sm font-bold text-slate-900">Communication content</h3>
      <div className="mt-3 space-y-2">
        {purposes.filter(p => row.contentCounts[p.value] > 0).map(p => <div key={p.value} className="flex justify-between gap-4 border-b border-slate-200 pb-1 text-xs">
          <span className="text-slate-600">{p.label}</span><span className="font-bold text-slate-900">{row.contentCounts[p.value]}</span>
        </div>)}
        {!Object.values(row.contentCounts).some(Boolean) && <p className="text-xs text-slate-500">No engagement content logged during this period.</p>}
      </div>
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 text-xs">
        <p className="mb-1 text-slate-500">Master status: {row.masterStatus.replaceAll("_", " ")}</p>
        <p className="font-semibold text-slate-800">Suggested next action</p>
        <p className="mt-1 text-slate-600">{row.nextAction}</p>
        <p className="mt-2 text-slate-500">Last real connection: {dateLabel(row.lastConnectedAt)}</p>
        {leadsAvailable && <p className="mt-1 text-slate-500">Enquiries: {row.leads} · Won: {row.won} (30d)</p>}
      </div>
      <Link href={`/engagements/travel-agent/${encodeURIComponent(row.id)}`} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:underline">
        Open agent engagement profile <ArrowUpRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  </div>;
}

export default function TravelAgentEngagementIntelligencePage() {
  const [agents, setAgents] = useState([]);
  const [engagements, setEngagements] = useState([]);
  const [leads, setLeads] = useState([]);
  const [leadsAvailable, setLeadsAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [asOf, setAsOf] = useState(null);
  const [owner, setOwner] = useState("all");
  const [grade, setGrade] = useState("all");
  const [search, setSearch] = useState("");
  const [focusNoEnquiry, setFocusNoEnquiry] = useState(false);
  const [sortBy, setSortBy] = useState("score");
  const [expandedId, setExpandedId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const results = await Promise.allSettled([
        getDocs(collection(db, "travelAgents")),
        getDocs(collection(db, "engagements")),
        getDocs(collection(db, "leads"))
      ]);
      if (results[0].status === "rejected") throw results[0].reason;
      if (results[1].status === "rejected") throw results[1].reason;
      const docs = result => result.docs.map(item => ({ id: item.id, ...item.data() }));
      setAgents(docs(results[0].value));
      setEngagements(docs(results[1].value));
      const canReadLeads = results[2].status === "fulfilled";
      setLeadsAvailable(canReadLeads);
      setLeads(canReadLeads ? docs(results[2].value) : []);
      setAsOf(new Date());
    } catch (err) {
      console.error("Engagement Intelligence load failed", err);
      setError(err?.message || "Unable to load engagement information.");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const report = useMemo(() => buildTravelAgentEngagementIntelligence({
    travelAgents: agents, engagements, leads, leadsAvailable, now: asOf
  }), [agents, engagements, leads, asOf]);
  const owners = useMemo(() => [...new Set(report.rows.map(row => row.assignedTo).filter(value => value !== "—"))]
    .sort((a, b) => a.localeCompare(b)), [report.rows]);
  const ownerRows = useMemo(() => report.rows.filter(row => owner === "all" || row.assignedTo === owner), [report.rows, owner]);
  const gradeCounts = useMemo(() => Object.fromEntries(ENGAGEMENT_GRADES.map(item =>
    [item.value, ownerRows.filter(row => row.grade === item.value).length]
  )), [ownerRows]);
  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return ownerRows.filter(row => grade === "all" || row.grade === grade)
      .filter(row => !focusNoEnquiry || leadsAvailable && row.highEngagementNoEnquiry)
      .filter(row => !query || [row.agencyName, row.agentCode, row.city, row.assignedTo]
        .some(value => String(value || "").toLowerCase().includes(query)))
      .sort((a, b) => sortBy === "recent"
        ? ((b.lastConnectedAt?.getTime() || 0) - (a.lastConnectedAt?.getTime() || 0)) || b.score - a.score
        : sortBy === "communications"
          ? (b.whatsappOutbound + b.emailOutbound) - (a.whatsappOutbound + a.emailOutbound) || b.score - a.score
          : b.score - a.score || gradeOrder[b.grade] - gradeOrder[a.grade] || a.agencyName.localeCompare(b.agencyName));
  }, [ownerRows, grade, focusNoEnquiry, search, sortBy, leadsAvailable]);

  const download = () => {
    const fields = [
      ["Agent Code", r => r.agentCode], ["Travel Agent", r => r.agencyName], ["City", r => r.city],
      ["Relationship Executive", r => r.assignedTo], ["Engagement Grade", r => r.grade],
      ["Engagement Score", r => r.score], ["Call Attempts", r => r.callAttempts],
      ["Calls Connected", r => r.connectedCalls], ["Calls Not Connected", r => r.notConnectedCalls],
      ["Unknown Call Outcomes", r => r.unknownCallOutcomes],
      ["WhatsApp Outbound Logged", r => r.whatsappOutbound], ["Email Outbound Logged", r => r.emailOutbound],
      ["WhatsApp Inbound", r => r.whatsappInbound], ["Email Inbound", r => r.emailInbound],
      ["Documented Reply Events", r => r.replyEvents], ["Reply Days", r => r.replyDays],
      ["Meaningful Discussion Days", r => r.meaningfulDiscussions], ["Connected Days", r => r.activeDays],
      ["Connected Weeks", r => r.activeWeeks], ["Completed Meetings", r => r.meetingsCompleted],
      ["Last Two-Way Contact", r => dateLabel(r.lastConnectedAt)], ["Last Logged Activity", r => dateLabel(r.lastActivityAt)],
      ["Leads in 30 Days", r => leadsAvailable ? r.leads : "Unavailable"],
      ["Won in 30 Days", r => leadsAvailable ? r.won : "Unavailable"],
      ["Action", r => r.nextAction],
      ...[...COMMUNICATION_PURPOSES, { value: "unclassified", label: "Unclassified" }]
        .map(p => [p.label, r => r.contentCounts[p.value]])
    ];
    const lines = [fields.map(([name]) => csvCell(name)).join(","), ...filteredRows.map(row =>
      fields.map(([, get]) => csvCell(get(row))).join(","))];
    const blob = new Blob([`\uFEFF${lines.join("\r\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `dreamtrawell-agent-engagement-30d-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  return <AdminGuard permission="travel_agents.view">
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6 xl:p-8">
      <div className="mx-auto max-w-[1700px] space-y-6">
        <header className="flex flex-col justify-between gap-4 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 via-cyan-50/50 to-white p-5 shadow-sm lg:flex-row lg:items-center">
          <div>
            <Link href="/admin/travel-agents/activity-report" className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:text-blue-800"><ArrowLeft className="h-4 w-4" /> Activation &amp; Conversion</Link>
            <h1 className="mt-3 text-2xl font-bold text-slate-950 sm:text-3xl">Agent Engagement Intelligence</h1>
            <p className="mt-1 text-sm text-slate-600">Grade each travel agent from actual conversations, documented replies, communication content and relationship consistency.</p>
            <p className="mt-2 inline-flex items-center gap-2 text-xs text-slate-500"><CalendarDays className="h-3.5 w-3.5" /> Rolling 30 days ending {dateLabel(asOf)}</p>
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={loading} onClick={load} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50"><RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh</button>
            <button type="button" disabled={loading || !filteredRows.length} onClick={download} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"><Download className="h-4 w-4" /> Export CSV</button>
          </div>
        </header>

        {!!error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>}
        {!leadsAvailable && !loading && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Lead data could not be loaded for this role. Engagement grades are still shown, but enquiry, conversion and “high engagement without enquiry” indicators are disabled. Ask an admin to verify the lead-read permissions.</p>}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Summary icon={Users} label="Agents" value={ownerRows.length} helper="Eligible travel agent records" />
          <Summary icon={PhoneCall} label="Connected calls" value={ownerRows.reduce((n, r) => n + r.connectedCalls, 0)} helper="Confirmed successful connections" />
          <Summary icon={Mail} label="Communications logged" value={ownerRows.reduce((n, r) => n + r.emailOutbound + r.whatsappOutbound, 0)} helper="Email / WhatsApp outbound, not verified deliveries" />
          <Summary icon={MessageCircle} label="Replies documented" value={ownerRows.reduce((n, r) => n + r.replyEvents, 0)} helper="Inbound or explicitly recorded replies" />
          <Summary icon={Target} label="Engaged without enquiry" value={leadsAvailable ? ownerRows.filter(r => r.highEngagementNoEnquiry).length : null} helper={leadsAvailable ? "A+/A relationships to convert" : "Lead data unavailable"} />
        </div>

        <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
          <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
            <div><h2 className="font-bold text-slate-900">Engagement grades</h2><p className="mt-1 text-xs text-slate-500">Scores reflect genuine two-way contact; sending more messages without replies does not increase the score.</p></div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setGrade("all")} className={`rounded-xl border px-4 py-2 text-xs font-bold ${grade === "all" ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50"}`}>All {ownerRows.length}</button>
              {ENGAGEMENT_GRADES.map(item => <button type="button" key={item.value} onClick={() => setGrade(item.value)} className={`rounded-xl border px-4 py-2 text-xs font-bold ${grade === item.value ? "border-blue-600 bg-blue-600 text-white" : gradeStyles[item.value]}`}>{item.value} {gradeCounts[item.value]}</button>)}
            </div>
          </div>
          <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 md:grid-cols-4">
            <label className="text-xs font-medium text-slate-600">Executive
              <select value={owner} onChange={e => setOwner(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="all">All executives</option>{owners.map(value => <option key={value}>{value}</option>)}</select>
            </label>
            <label className="text-xs font-medium text-slate-600">Sort by
              <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="score">Highest engagement score</option><option value="recent">Most recent contact</option><option value="communications">Most communications sent</option></select>
            </label>
            <label className="relative text-xs font-medium text-slate-600">Search agent
              <Search className="absolute bottom-3 left-3 h-4 w-4 text-slate-400" />
              <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Agency, city, agent code" className="mt-1 w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-sm" />
            </label>
            <label className="flex items-end gap-2 pb-2 text-sm font-medium text-slate-700">
              <input type="checkbox" disabled={!leadsAvailable} checked={focusNoEnquiry} onChange={e => setFocusNoEnquiry(e.target.checked)} className="h-4 w-4 rounded border-slate-300" /> A+/A without enquiries
            </label>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-2 border-b border-slate-100 p-4 sm:flex-row sm:items-center"><h2 className="font-bold text-slate-900">Travel Agent Engagement Report</h2><p className="text-xs text-slate-500">{filteredRows.length} agents · Select a row to see its evidence and content mix</p></div>
          <div className="overflow-x-auto">
            <table className="min-w-[1320px] w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500"><tr>
                <th className="px-4 py-3">Travel Agent / Owner</th><th className="px-3 py-3">Grade</th><th className="px-3 py-3 text-right">Score</th>
                <th className="px-3 py-3 text-right">Connected / Attempts</th><th className="px-3 py-3 text-right">WhatsApp / Email Out</th>
                <th className="px-3 py-3 text-right">Replies</th><th className="px-3 py-3 text-right">Discussions</th>
                <th className="px-3 py-3 text-right">Active Weeks</th><th className="px-3 py-3">Last Contact</th>
                <th className="px-3 py-3">Business Status</th><th className="px-3 py-3">Recommended Action</th><th className="px-3 py-3"></th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? <tr><td colSpan={12} className="p-10 text-center text-slate-500">Loading agent engagement data…</td></tr> :
                  filteredRows.length === 0 ? <tr><td colSpan={12} className="p-10 text-center text-slate-500">No agents match these filters.</td></tr> :
                    filteredRows.map(row => <tr key={row.id} className="group">
                      <td colSpan={12} className="p-0">
                        <button type="button" onClick={() => setExpandedId(prev => prev === row.id ? "" : row.id)} aria-expanded={expandedId === row.id} className="grid w-full grid-cols-[225px_70px_65px_105px_130px_65px_85px_85px_106px_135px_minmax(175px,1fr)_25px] items-center gap-0 py-3 text-left hover:bg-blue-50/60">
                          <span className="min-w-0 px-4"><span className="block truncate font-bold text-slate-900">{row.agencyName}</span><span className="mt-0.5 block truncate text-[11px] text-slate-500">{row.agentCode || "No code"} · {row.assignedTo}</span></span>
                          <span className="px-2"><span className={`inline-flex rounded-full border px-2 py-1 font-bold ${gradeStyles[row.grade]}`}>{row.grade}</span></span>
                          <span className="px-3 text-right font-bold text-slate-900">{row.score}</span>
                          <span className="px-3 text-right">{row.connectedCalls} / {row.callAttempts}</span>
                          <span className="px-3 text-right">{row.whatsappOutbound} / {row.emailOutbound}</span>
                          <span className="px-3 text-right">{row.replyEvents}</span>
                          <span className="px-3 text-right">{row.meaningfulDiscussions}</span>
                          <span className="px-3 text-right">{row.activeWeeks}</span>
                          <span className="px-3 text-slate-600">{dateLabel(row.lastConnectedAt)}</span>
                          <span className="px-3 text-slate-600">{businessLabel(row, leadsAvailable)}</span>
                          <span className="px-3 text-slate-600">{row.nextAction}</span>
                          <span className="pr-3 text-slate-500">{expandedId === row.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</span>
                        </button>
                        {expandedId === row.id && <ScoreDetail row={row} leadsAvailable={leadsAvailable} />}
                      </td>
                    </tr>)}
              </tbody>
            </table>
          </div>
        </section>
        <div className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-xs leading-5 text-slate-600">
          <strong>Measurement rules:</strong> Rolling 30-day engagement score (25 connected call/meeting, 25 documented messaging replies, 20 meaningful discussion, 15 weeks of two-way contact, 10 positive response, 5 recency).
          Repeat outbound promotions do not earn score points. Different replies on the same channel/day count as one reply day toward the score, although all documented events are shown.
          Scheduled meetings are not completed meetings. Historic messages without recorded replies are not treated as replies. Engagement grade does not change Travel Agent master status or booking priority automatically.
          <span className="mt-1 block">Coverage: {report.summary.ignoredUndated} undated and {report.summary.unmatchedEngagements} unmatched engagement records omitted from this 30-day report. Email and WhatsApp numbers are logged communications, not independently verified deliveries.</span>
        </div>
      </div>
    </main>
  </AdminGuard>;
}
