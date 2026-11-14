"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, getDocs } from "firebase/firestore";
import {
  ArrowLeft, BarChart3, Download, Handshake, Mail, MessageCircle,
  PhoneCall, RefreshCcw, Search, Target, Trophy, Users
} from "lucide-react";

import AdminGuard from "@/components/AdminGuard";
import { db } from "@/lib/firebase";
import {
  ACTIVATION_STAGES,
  buildTravelAgentActivationReport,
  toActivityDate
} from "@/lib/travelAgentActivationReport";

const stageColors = {
  no_outreach: "border-slate-200 bg-slate-100 text-slate-700",
  attempted: "border-amber-200 bg-amber-50 text-amber-700",
  contacted: "border-sky-200 bg-sky-50 text-sky-700",
  activated: "border-indigo-200 bg-indigo-50 text-indigo-700",
  lead_contributor: "border-purple-200 bg-purple-50 text-purple-700",
  closed_lost: "border-rose-200 bg-rose-50 text-rose-700",
  converted: "border-emerald-200 bg-emerald-50 text-emerald-700"
};

const normalizeSearch = value => String(value || "").trim().toLowerCase();
const formatNumber = value => Number(value || 0).toLocaleString("en-IN");
const formatDate = value => {
  const date = toActivityDate(value);
  return date ? date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
};
const csvCell = value => {
  // Prevent spreadsheet software from interpreting untrusted agency names as formulas.
  const raw = String(value ?? "");
  const safe = /^[\s]*[=+@-]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
};
const startOfDay = value => value ? new Date(`${value}T00:00:00`) : null;
const endOfDay = value => value ? new Date(`${value}T23:59:59.999`) : null;

function SummaryCard({ icon: Icon, label, value, helper }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{formatNumber(value)}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{helper}</p>
        </div>
        <div className="rounded-xl bg-slate-100 p-2.5 text-slate-700"><Icon className="h-5 w-5" /></div>
      </div>
    </div>
  );
}

function ActivationBadge({ stage }) {
  const meta = ACTIVATION_STAGES.find(item => item.key === stage) || ACTIVATION_STAGES[0];
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${stageColors[meta.key]}`}>
      {meta.label}
    </span>
  );
}

export default function TravelAgentActivityReportPage() {
  const [travelAgents, setTravelAgents] = useState([]);
  const [engagements, setEngagements] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [preset, setPreset] = useState("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [owner, setOwner] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [activityOnly, setActivityOnly] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // Same Firestore collections as the former Activity Report: no new master
      // fields, migration, or backfill is required for the activation funnel.
      const [agentsSnap, engagementsSnap, leadsSnap] = await Promise.all([
        getDocs(collection(db, "travelAgents")),
        getDocs(collection(db, "engagements")),
        getDocs(collection(db, "leads"))
      ]);
      setTravelAgents(agentsSnap.docs.map(item => ({ id: item.id, ...item.data() })));
      setEngagements(engagementsSnap.docs.map(item => ({ id: item.id, ...item.data() })));
      setLeads(leadsSnap.docs.map(item => ({ id: item.id, ...item.data() })));
    } catch (err) {
      console.error("Failed to load Travel Agent activation report:", err);
      setError(err?.message || "Could not load Travel Agent activity data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const dateRange = useMemo(() => {
    const now = new Date();
    if (preset === "month") return {
      from: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0),
      to: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    };
    if (preset === "30") {
      const from = new Date(now);
      from.setDate(from.getDate() - 29);
      from.setHours(0, 0, 0, 0);
      return { from, to: now };
    }
    if (preset === "custom") return { from: startOfDay(customFrom), to: endOfDay(customTo) };
    return { from: null, to: null };
  }, [preset, customFrom, customTo]);

  const report = useMemo(() => buildTravelAgentActivationReport({
    travelAgents,
    engagements,
    leads,
    fromDate: dateRange.from,
    toDate: dateRange.to
  }), [travelAgents, engagements, leads, dateRange]);

  const owners = useMemo(() => Array.from(new Set(
    report.rows.map(row => row.assignedTo).filter(name => name && name !== "—")
  )).sort((a, b) => a.localeCompare(b)), [report.rows]);

  // Owner selection scopes both the KPI cards and the activation-stage totals.
  // Stage/search filters only narrow the table (the funnel totals remain stable).
  const scopedRows = useMemo(() => report.rows.filter(row =>
    owner === "all" || row.assignedTo === owner
  ), [report.rows, owner]);

  const ownerSummary = useMemo(() => {
    const sum = field => scopedRows.reduce((total, row) => total + row[field], 0);
    return {
      validAgents: scopedRows.length,
      invalidAgents: owner === "all" ? report.summary.invalidAgents : null,
      agentsContacted: scopedRows.filter(row => row.engagements > 0).length,
      activatedAgents: scopedRows.filter(row => row.activatedEngagements > 0 || row.leads > 0 || row.won > 0 || row.lost > 0).length,
      leadContributors: scopedRows.filter(row => row.leads > 0).length,
      convertedPartners: scopedRows.filter(row => row.won > 0).length,
      engagements: sum("engagements"),
      notConnected: sum("notConnected"),
      email: sum("email"), whatsapp: sum("whatsapp"), leads: sum("leads"),
      won: sum("won"), lost: sum("lost"),
      stageCounts: Object.fromEntries(ACTIVATION_STAGES.map(stage => [
        stage.key, scopedRows.filter(row => row.activationStage === stage.key).length
      ]))
    };
  }, [scopedRows, owner, report.summary.invalidAgents]);

  const visibleRows = useMemo(() => {
    const q = normalizeSearch(search);
    const score = { converted: 7, lead_contributor: 6, closed_lost: 5, activated: 4, contacted: 3, attempted: 2, no_outreach: 1 };
    return scopedRows
      .filter(row => !activityOnly || row.engagements > 0 || row.notConnected > 0 || row.leads > 0 || row.won > 0 || row.lost > 0)
      .filter(row => stageFilter === "all" || row.activationStage === stageFilter)
      .filter(row => !q || [row.agencyName, row.agentCode, row.city, row.assignedTo].some(v => normalizeSearch(v).includes(q)))
      .sort((a, b) => (score[b.activationStage] - score[a.activationStage]) ||
        (b.won - a.won) || (b.leads - a.leads) || (b.activatedEngagements - a.activatedEngagements) ||
        a.agencyName.localeCompare(b.agencyName));
  }, [scopedRows, activityOnly, stageFilter, search]);

  const downloadCsv = () => {
    const headers = [
      "Travel Agent Code", "Travel Agent", "City / Area", "Assigned To", "Master Status",
      "Relationship Stage", "Not Connected Attempts", "Qualified Engagements", "Meaningful / Connected Engagements",
      "Connected Calls", "Meetings", "Email", "WhatsApp", "Leads Created",
      "Closed Won", "Closed Lost", "Last Recorded Activity"
    ];
    const values = row => [
      row.agentCode, row.agencyName, row.city, row.assignedTo, row.masterStatus,
      ACTIVATION_STAGES.find(item => item.key === row.activationStage)?.label || row.activationStage,
      row.notConnected, row.engagements, row.activatedEngagements,
      row.callConnected, row.meetings, row.email, row.whatsapp, row.leads,
      row.won, row.lost, formatDate(row.lastActivityAt)
    ];
    const lines = [headers.map(csvCell).join(","), ...visibleRows.map(row => values(row).map(csvCell).join(","))];
    const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `travel-agent-activation-${preset === "all" ? "all-time" : new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminGuard permission="travel_agents.view">
      <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-[1700px] space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <Link href="/admin/travel-agents" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900">
                <ArrowLeft className="h-4 w-4" /> Travel Agents
              </Link>
              <div className="mt-3 flex items-center gap-3">
                <div className="rounded-2xl bg-slate-900 p-3 text-white"><BarChart3 className="h-6 w-6" /></div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Travel Agent Activation &amp; Conversion</h1>
                  <p className="mt-1 text-sm text-slate-600">Understand outreach, real relationship activation, leads received and bookings closed for each Travel Agent.</p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/admin/travel-agents/engagement-intelligence" className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-800 hover:bg-blue-100">
                <Target className="h-4 w-4" /> Engagement Grades A+/A/B/C
              </Link>
              <button type="button" onClick={loadData} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
              </button>
              <button type="button" onClick={downloadCsv} disabled={loading || !visibleRows.length} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
                <Download className="h-4 w-4" /> Download CSV
              </button>
            </div>
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Report date range">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="flex flex-wrap gap-2">
                {[["all", "All Time"], ["month", "This Month"], ["30", "Last 30 Days"], ["custom", "Custom"]].map(([value, label]) => (
                  <button key={value} type="button" onClick={() => setPreset(value)} className={`rounded-xl px-4 py-2 text-sm font-semibold ${preset === value ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>{label}</button>
                ))}
              </div>
              {preset === "custom" && (
                <div className="flex flex-wrap gap-3">
                  <label className="text-xs font-semibold text-slate-600">From
                    <input type="date" value={customFrom} max={customTo || undefined} onChange={event => setCustomFrom(event.target.value)} className="mt-1 block rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800" />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">To
                    <input type="date" value={customTo} min={customFrom || undefined} onChange={event => setCustomTo(event.target.value)} className="mt-1 block rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800" />
                  </label>
                </div>
              )}
            </div>
          </section>

          {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">{error}</div>}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard icon={Users} label="Valid Travel Agents" value={ownerSummary.validAgents} helper={owner === "all" ? `${formatNumber(ownerSummary.invalidAgents)} invalid-number agents excluded` : "Filtered by relationship owner"} />
            <SummaryCard icon={PhoneCall} label="Agents Contacted" value={ownerSummary.agentsContacted} helper="At least one qualified engagement" />
            <SummaryCard icon={Handshake} label="Activated Relationships" value={ownerSummary.activatedAgents} helper="Connected call, meeting, meaningful outcome or lead" />
            <SummaryCard icon={Target} label="Lead Contributors" value={ownerSummary.leadContributors} helper="Agents who submitted a lead in this period" />
            <SummaryCard icon={Trophy} label="Converted Partners" value={ownerSummary.convertedPartners} helper="Agents with a closed-won booking in this period" />
            <SummaryCard icon={BarChart3} label="Engagements" value={ownerSummary.engagements} helper={`${formatNumber(ownerSummary.notConnected)} unsuccessful attempts excluded`} />
            <SummaryCard icon={Mail} label="Email / WhatsApp" value={ownerSummary.email + ownerSummary.whatsapp} helper={`${formatNumber(ownerSummary.email)} emails · ${formatNumber(ownerSummary.whatsapp)} WhatsApp`} />
            <SummaryCard icon={MessageCircle} label="Leads / Closures" value={ownerSummary.leads} helper={`${formatNumber(ownerSummary.won)} won · ${formatNumber(ownerSummary.lost)} lost`} />
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-bold text-slate-900">Relationship activation journey</h2>
              <p className="text-xs leading-5 text-slate-500">Select a stage to see those agents. Each agent appears only in their highest qualifying stage for the date range.</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => setStageFilter("all")} className={`rounded-xl border px-3 py-2 text-xs font-semibold ${stageFilter === "all" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"}`}>
                All ({formatNumber(scopedRows.length)})
              </button>
              {ACTIVATION_STAGES.map(stage => (
                <button key={stage.key} type="button" onClick={() => setStageFilter(stage.key)} aria-pressed={stageFilter === stage.key} className={`rounded-xl border px-3 py-2 text-xs font-semibold ${stageFilter === stage.key ? "border-slate-900 bg-slate-900 text-white" : stageColors[stage.key]}`}>
                  {stage.label} ({formatNumber(ownerSummary.stageCounts[stage.key])})
                </button>
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-bold text-slate-900">Travel Agent-wise Activity &amp; Conversion</h2>
                <p className="mt-1 text-xs text-slate-500">{formatNumber(visibleRows.length)} agents shown. Sort order prioritizes converted partners, then lead contributors and activated relationships.</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-600">
                  <input type="checkbox" checked={activityOnly} onChange={event => setActivityOnly(event.target.checked)} className="h-4 w-4 rounded border-slate-300" /> Only with activity
                </label>
                <select aria-label="Relationship owner" value={owner} onChange={event => setOwner(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700">
                  <option value="all">All relationship owners</option>
                  {owners.map(name => <option value={name} key={name}>{name}</option>)}
                </select>
                <div className="relative min-w-[240px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input aria-label="Search agents" value={search} onChange={event => setSearch(event.target.value)} placeholder="Agent, code, city, owner..." className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-slate-500" />
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[1550px] w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3">Travel Agent</th><th className="px-3 py-3">City</th><th className="px-3 py-3">Owner</th>
                    <th className="px-3 py-3">Activation Stage</th><th className="px-3 py-3 text-right">Not Connected</th>
                    <th className="px-3 py-3 text-right">Engagements</th><th className="px-3 py-3 text-right">Meaningful</th>
                    <th className="px-3 py-3 text-right">Calls Connected</th><th className="px-3 py-3 text-right">Meetings</th>
                    <th className="px-3 py-3 text-right">Email</th><th className="px-3 py-3 text-right">WhatsApp</th>
                    <th className="px-3 py-3 text-right">Leads</th><th className="px-3 py-3 text-right">Won</th><th className="px-3 py-3 text-right">Lost</th>
                    <th className="px-3 py-3">Last Activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {loading ? (
                    <tr><td colSpan={15} className="px-4 py-12 text-center text-slate-500">Loading report…</td></tr>
                  ) : !visibleRows.length ? (
                    <tr><td colSpan={15} className="px-4 py-12 text-center text-slate-500">No agents match the selected filters.</td></tr>
                  ) : visibleRows.map(row => (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Link href={`/admin/travel-agents/${encodeURIComponent(row.id)}`} className="font-semibold text-slate-900 hover:text-blue-700">{row.agencyName}</Link>
                        <div className="mt-0.5 text-[11px] text-slate-500">{row.agentCode || "No code"} · Master: {row.masterStatus.replaceAll("_", " ")}</div>
                      </td>
                      <td className="px-3 py-3 text-slate-600">{row.city}</td><td className="px-3 py-3 text-slate-600">{row.assignedTo}</td>
                      <td className="px-3 py-3"><ActivationBadge stage={row.activationStage} /></td>
                      <td className="px-3 py-3 text-right text-amber-700">{row.notConnected}</td>
                      <td className="px-3 py-3 text-right font-semibold">{row.engagements}</td>
                      <td className="px-3 py-3 text-right text-indigo-700">{row.activatedEngagements}</td>
                      <td className="px-3 py-3 text-right">{row.callConnected}</td>
                      <td className="px-3 py-3 text-right">{row.meetings}</td>
                      <td className="px-3 py-3 text-right">{row.email}</td>
                      <td className="px-3 py-3 text-right">{row.whatsapp}</td>
                      <td className="px-3 py-3 text-right font-bold text-purple-700">{row.leads}</td>
                      <td className="px-3 py-3 text-right font-bold text-emerald-700">{row.won}</td>
                      <td className="px-3 py-3 text-right font-semibold text-rose-700">{row.lost}</td>
                      <td className="px-3 py-3 whitespace-nowrap text-xs text-slate-600">{formatDate(row.lastActivityAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="rounded-2xl border border-slate-200 bg-slate-100 p-4 text-xs leading-6 text-slate-700">
            <strong>How activation is measured:</strong> An outreach attempt that was not connected remains <strong>Attempted</strong>.
            A valid logged email/WhatsApp or other qualified engagement is <strong>Contacted</strong>.
            A connected call, meeting, meaningful engagement outcome or lead establishes an <strong>Activated</strong> relationship.
            A linked lead makes the agent a <strong>Lead contributor</strong>; a closed-won lead makes them a <strong>Converted partner</strong>.
            A closed-lost lead is shown separately when there is no higher qualifying milestone in the period.
            These are reporting stages, not changes to the Travel Agent master Active/Inactive status.
            Leads are counted by creation date; won/lost closures are counted by closure date (even if the lead was created earlier).
            Currently reopened leads do not count as won/lost. Invalid-number agents and unsuccessful attempts are excluded from qualified engagement totals.
          </div>
        </div>
      </div>
    </AdminGuard>
  );
}
