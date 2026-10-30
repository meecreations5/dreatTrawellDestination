"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, getDocs } from "firebase/firestore";
import {
  ArrowLeft,
  BarChart3,
  Download,
  Mail,
  MessageCircle,
  RefreshCcw,
  Search,
  Target,
  Users
} from "lucide-react";

import AdminGuard from "@/components/AdminGuard";
import { db } from "@/lib/firebase";
import { getEngagementConnectionStatus } from "@/lib/engagementProductivity";
import { normalizeTravelAgentStatus } from "@/lib/travelAgentStatus";

const normalize = value =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

const normalizeName = value =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const toDate = value => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (value?.seconds) return new Date(value.seconds * 1000);
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const recordDate = item =>
  toDate(
    item?.createdAt ||
      item?.engagementDate ||
      item?.activityAt ||
      item?.date ||
      item?.timestamp ||
      item?.updatedAt
  );

const startOfDay = value => {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const endOfDay = value => {
  if (!value) return null;
  const date = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const isWithinRange = (item, fromDate, toDateValue) => {
  if (!fromDate && !toDateValue) return true;
  const date = recordDate(item);
  if (!date) return false;
  if (fromDate && date < fromDate) return false;
  if (toDateValue && date > toDateValue) return false;
  return true;
};

const csvCell = value => {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
};

const getAgentId = item =>
  String(
    item?.agentId ||
      item?.travelAgentId ||
      item?.travelAgentRefId ||
      item?.entityId ||
      item?.agentRefId ||
      ""
  ).trim();

const getAgentName = item =>
  item?.agentName ||
  item?.travelAgentName ||
  item?.agencyName ||
  item?.travelAgent?.agencyName ||
  item?.travelAgent?.name ||
  "";

const getChannel = item => normalize(item?.channel || item?.type || item?.engagementType || item?.activityType);

const getAssigneeName = agent =>
  agent?.assignedToName ||
  agent?.assignedToUserName ||
  agent?.relationshipOwnerName ||
  agent?.assignedToEmail ||
  agent?.assignedTo ||
  "—";

const getCity = agent =>
  agent?.city ||
  agent?.location?.city ||
  agent?.address?.city ||
  agent?.area ||
  "—";

function SummaryCard({ icon: Icon, label, value, helper }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{Number(value || 0).toLocaleString("en-IN")}</p>
          {helper ? <p className="mt-1 text-xs leading-5 text-slate-500">{helper}</p> : null}
        </div>
        <div className="rounded-xl bg-slate-100 p-2.5 text-slate-700">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
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
  const [activityOnly, setActivityOnly] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [agentsSnap, engagementsSnap, leadsSnap] = await Promise.all([
        getDocs(collection(db, "travelAgents")),
        getDocs(collection(db, "engagements")),
        getDocs(collection(db, "leads"))
      ]);

      setTravelAgents(agentsSnap.docs.map(item => ({ id: item.id, ...item.data() })));
      setEngagements(engagementsSnap.docs.map(item => ({ id: item.id, ...item.data() })));
      setLeads(leadsSnap.docs.map(item => ({ id: item.id, ...item.data() })));
    } catch (err) {
      console.error("Failed to load Travel Agent activity report:", err);
      setError(err?.message || "Failed to load report data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const dateRange = useMemo(() => {
    const now = new Date();
    if (preset === "month") {
      return {
        from: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0),
        to: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
      };
    }
    if (preset === "30") {
      const from = new Date(now);
      from.setDate(from.getDate() - 29);
      from.setHours(0, 0, 0, 0);
      return { from, to: new Date() };
    }
    if (preset === "custom") {
      return { from: startOfDay(customFrom), to: endOfDay(customTo) };
    }
    return { from: null, to: null };
  }, [preset, customFrom, customTo]);

  const report = useMemo(() => {
    const validAgents = travelAgents.filter(agent => {
      if (agent?.deleted === true || agent?.isDeleted === true) return false;
      return normalizeTravelAgentStatus(agent?.status || agent?.agentStatus, agent?.active) !== "invalid_number";
    });

    const invalidAgents = travelAgents.filter(agent => {
      if (agent?.deleted === true || agent?.isDeleted === true) return false;
      return normalizeTravelAgentStatus(agent?.status || agent?.agentStatus, agent?.active) === "invalid_number";
    });

    const byId = new Map(validAgents.map(agent => [agent.id, agent]));
    const byName = new Map();
    validAgents.forEach(agent => {
      const name = normalizeName(agent?.agencyName || agent?.name || agent?.agentName);
      if (name && !byName.has(name)) byName.set(name, agent);
    });

    const rows = new Map(
      validAgents.map(agent => [
        agent.id,
        {
          id: agent.id,
          agentCode: agent?.agentCode || agent?.code || "",
          agencyName: agent?.agencyName || agent?.name || agent?.agentName || "Unnamed Travel Agent",
          city: getCity(agent),
          assignedTo: getAssigneeName(agent),
          engagements: 0,
          email: 0,
          whatsapp: 0,
          leads: 0,
          totalActivity: 0
        }
      ])
    );

    const resolveAgent = item => {
      const id = getAgentId(item);
      if (id && byId.has(id)) return byId.get(id);
      const name = normalizeName(getAgentName(item));
      return name ? byName.get(name) || null : null;
    };

    let excludedNotConnected = 0;
    let validEngagementCount = 0;
    let emailCount = 0;
    let whatsappCount = 0;

    engagements.forEach(item => {
      if (item?.deleted === true || item?.isDeleted === true) return;
      if (!isWithinRange(item, dateRange.from, dateRange.to)) return;

      const agent = resolveAgent(item);
      if (!agent) return;

      if (getEngagementConnectionStatus(item) === "not_connected") {
        excludedNotConnected += 1;
        return;
      }

      const row = rows.get(agent.id);
      if (!row) return;

      row.engagements += 1;
      validEngagementCount += 1;

      const channel = getChannel(item);
      if (channel === "email" || channel.includes("email")) {
        row.email += 1;
        emailCount += 1;
      }
      if (channel === "whatsapp" || channel.includes("whatsapp")) {
        row.whatsapp += 1;
        whatsappCount += 1;
      }
    });

    let leadCount = 0;
    leads.forEach(item => {
      if (item?.deleted === true || item?.isDeleted === true) return;
      if (!isWithinRange(item, dateRange.from, dateRange.to)) return;
      const agent = resolveAgent(item);
      if (!agent) return;
      const row = rows.get(agent.id);
      if (!row) return;
      row.leads += 1;
      leadCount += 1;
    });

    const allRows = Array.from(rows.values()).map(row => ({
      ...row,
      totalActivity: row.engagements + row.leads
    }));

    const activeAgentCount = allRows.filter(row => row.totalActivity > 0).length;

    return {
      rows: allRows,
      summary: {
        validAgents: validAgents.length,
        activeAgents: activeAgentCount,
        engagements: validEngagementCount,
        email: emailCount,
        whatsapp: whatsappCount,
        leads: leadCount,
        invalidAgents: invalidAgents.length,
        excludedNotConnected
      }
    };
  }, [travelAgents, engagements, leads, dateRange]);

  const visibleRows = useMemo(() => {
    const query = normalizeName(search);
    return report.rows
      .filter(row => !activityOnly || row.totalActivity > 0)
      .filter(row => {
        if (!query) return true;
        return [row.agencyName, row.agentCode, row.city, row.assignedTo]
          .some(value => normalizeName(value).includes(query));
      })
      .sort((a, b) => {
        if (b.totalActivity !== a.totalActivity) return b.totalActivity - a.totalActivity;
        return a.agencyName.localeCompare(b.agencyName);
      });
  }, [report.rows, search, activityOnly]);

  const downloadCsv = () => {
    const headers = [
      "Travel Agent Code",
      "Travel Agent",
      "City / Area",
      "Assigned To",
      "Engagements",
      "Email",
      "WhatsApp",
      "Leads",
      "Total Activity"
    ];

    const lines = [
      headers.map(csvCell).join(","),
      ...visibleRows.map(row =>
        [
          row.agentCode,
          row.agencyName,
          row.city,
          row.assignedTo,
          row.engagements,
          row.email,
          row.whatsapp,
          row.leads,
          row.totalActivity
        ].map(csvCell).join(",")
      )
    ];

    const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const suffix = preset === "all" ? "all-time" : new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `travel-agent-activity-report-${suffix}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminGuard permission="travel_agents.view">
      <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-[1600px] space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <Link href="/admin/travel-agents" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900">
                <ArrowLeft className="h-4 w-4" />
                Travel Agents
              </Link>
              <div className="mt-3 flex items-center gap-3">
                <div className="rounded-2xl bg-slate-900 p-3 text-white">
                  <BarChart3 className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Travel Agent Activity Report</h1>
                  <p className="mt-1 text-sm text-slate-600">Valid Travel Agents with connected Engagement, Email, WhatsApp and Lead counts.</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={loadData}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
              <button
                type="button"
                onClick={downloadCsv}
                disabled={loading || visibleRows.length === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                Download CSV
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="flex flex-wrap gap-2">
                {[
                  ["all", "All Time"],
                  ["month", "This Month"],
                  ["30", "Last 30 Days"],
                  ["custom", "Custom"]
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPreset(value)}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold ${preset === value ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {preset === "custom" ? (
                <div className="flex flex-wrap gap-3">
                  <label className="text-xs font-semibold text-slate-600">
                    From
                    <input type="date" value={customFrom} onChange={event => setCustomFrom(event.target.value)} className="mt-1 block rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800" />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    To
                    <input type="date" value={customTo} onChange={event => setCustomTo(event.target.value)} className="mt-1 block rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800" />
                  </label>
                </div>
              ) : null}
            </div>
          </div>

          {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            <SummaryCard icon={Users} label="Valid Travel Agents" value={report.summary.validAgents} helper={`${report.summary.invalidAgents} invalid-number agents excluded`} />
            <SummaryCard icon={BarChart3} label="Agents With Activity" value={report.summary.activeAgents} helper="At least one valid engagement or lead" />
            <SummaryCard icon={BarChart3} label="Engagements" value={report.summary.engagements} helper={`${report.summary.excludedNotConnected} not-connected records excluded`} />
            <SummaryCard icon={Mail} label="Email" value={report.summary.email} helper="Valid email engagement records" />
            <SummaryCard icon={MessageCircle} label="WhatsApp" value={report.summary.whatsapp} helper="Valid WhatsApp engagement records" />
            <SummaryCard icon={Target} label="Leads" value={report.summary.leads} helper="Leads linked to valid Travel Agents" />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-bold text-slate-900">Travel Agent-wise Activity</h2>
                <p className="mt-1 text-xs text-slate-500">{visibleRows.length.toLocaleString("en-IN")} agents shown</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-600">
                  <input type="checkbox" checked={activityOnly} onChange={event => setActivityOnly(event.target.checked)} className="h-4 w-4 rounded border-slate-300" />
                  Only agents with activity
                </label>
                <div className="relative min-w-[260px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                    placeholder="Search agent, code, city, owner..."
                    className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-slate-500"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3">Travel Agent</th>
                    <th className="px-4 py-3">City / Area</th>
                    <th className="px-4 py-3">Assigned To</th>
                    <th className="px-4 py-3 text-right">Engagements</th>
                    <th className="px-4 py-3 text-right">Email</th>
                    <th className="px-4 py-3 text-right">WhatsApp</th>
                    <th className="px-4 py-3 text-right">Leads</th>
                    <th className="px-4 py-3 text-right">Total Activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {loading ? (
                    <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-500">Loading report…</td></tr>
                  ) : visibleRows.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-500">No Travel Agents match the selected filters.</td></tr>
                  ) : visibleRows.map(row => (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Link href={`/admin/travel-agents/${row.id}`} className="font-semibold text-slate-900 hover:text-blue-700">{row.agencyName}</Link>
                        {row.agentCode ? <div className="mt-0.5 text-xs text-slate-500">{row.agentCode}</div> : null}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{row.city}</td>
                      <td className="px-4 py-3 text-slate-600">{row.assignedTo}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">{row.engagements}</td>
                      <td className="px-4 py-3 text-right text-slate-700">{row.email}</td>
                      <td className="px-4 py-3 text-right text-slate-700">{row.whatsapp}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">{row.leads}</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900">{row.totalActivity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-800">
            <strong>Exclusion logic:</strong> Travel Agents whose current status is <strong>Invalid Number</strong> are removed completely. Engagement records classified as <strong>Not Connected</strong> (for example call not picked, no response, busy, not reachable, invalid number, wrong details) are not counted. A Travel Agent that later records a successful engagement, Email, WhatsApp or Lead remains eligible unless the agent itself is currently marked Invalid Number.
          </div>
        </div>
      </div>
    </AdminGuard>
  );
}
