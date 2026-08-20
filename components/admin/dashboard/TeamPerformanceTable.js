"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Trophy,
  UserCheck,
  UserPlus,
  Users,
  XCircle
} from "lucide-react";
import {
  getLeadAssignee,
  getLeadOwner
} from "@/lib/leadOwnership";
import { LEAD_STAGES, normalizeLeadStage } from "@/lib/leadStages";
import {
  buildTeamDirectoryLookup,
  resolveDirectoryIdentity
} from "@/lib/teamDirectory";

function toDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getNumber(value) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[₹,\s]/g, ""));
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function formatCurrency(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

function getLeadAmount(lead) {
  return (
    getNumber(lead.finalQuotedAmount) ||
    getNumber(lead.lastQuotedAmount) ||
    getNumber(lead.totalQuotedAmount) ||
    getNumber(lead.quotationAmount) ||
    getNumber(lead.packageAmount) ||
    0
  );
}

function getGrossProfit(lead) {
  return (
    getNumber(lead.actualGrossProfit) ||
    getNumber(lead.grossProfit) ||
    getNumber(lead.expectedGrossProfit) ||
    0
  );
}

function getNextActionDate(lead) {
  return toDate(
    lead.nextActionAt ||
      lead.nextActionDueAt ||
      lead.followUpAt ||
      lead.nextFollowUpAt
  );
}

function isClosed(lead) {
  const stage = normalizeLeadStage(lead?.stage);
  return stage === LEAD_STAGES.CONVERTED || stage === LEAD_STAGES.LOST;
}

function isOverdue(lead) {
  const date = getNextActionDate(lead);
  return Boolean(date && date < new Date() && !isClosed(lead));
}

function personKey(person, fallback = "unassigned") {
  const canonicalKey = String(person?.key || "").trim();
  if (canonicalKey) return canonicalKey;
  const uid = String(person?.uid || "").trim().toLowerCase();
  const email = String(person?.email || "").trim().toLowerCase();
  const name = String(person?.name || "").trim().toLowerCase();
  if (uid) return `uid:${uid}`;
  if (email) return `email:${email}`;
  if (name) return `name:${name}`;
  return fallback;
}

function ensureRow(map, person, fallbackName = "Unassigned") {
  const key = personKey(person);
  if (!map[key]) {
    map[key] = {
      key,
      name: person?.name || person?.email || fallbackName,
      email: person?.email || "",
      owned: 0,
      assigned: 0,
      openAssigned: 0,
      overdueAssigned: 0,
      wonOwned: 0,
      lostOwned: 0,
      quotedOwned: 0,
      wonValueOwned: 0,
      grossProfitOwned: 0
    };
  }
  return map[key];
}

function getInitials(name = "") {
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "U";
  return words.slice(0, 2).map(word => word[0]).join("").toUpperCase();
}

export default function TeamPerformanceTable({
  leads = [],
  teamDirectory = [],
  visibleMembers = teamDirectory,
  includeUnmapped = true
}) {
  const rowMap = {};
  const directoryLookup = buildTeamDirectoryLookup(teamDirectory);
  const visibleKeys = new Set(visibleMembers.map(member => member.key));

  visibleMembers.forEach(member => {
    ensureRow(rowMap, {
      key: member.key,
      uid: member.uid,
      email: member.email,
      name: member.name
    });
  });

  const resolvePerson = person => resolveDirectoryIdentity(
    {
      uid: person?.uid || "",
      email: person?.email || "",
      name: person?.name || ""
    },
    directoryLookup
  );

  const shouldIncludePerson = person =>
    visibleKeys.has(person?.key) || (includeUnmapped && person?.isUnmapped === true);

  leads.forEach(lead => {
    const owner = resolvePerson(getLeadOwner(lead));
    const assignee = resolvePerson(getLeadAssignee(lead));
    const amount = getLeadAmount(lead);
    const grossProfit = getGrossProfit(lead);

    if (shouldIncludePerson(owner)) {
      const ownerRow = ensureRow(rowMap, owner, "Legacy creator");
      ownerRow.owned += 1;
      if (amount > 0) ownerRow.quotedOwned += amount;
      if (normalizeLeadStage(lead.stage) === LEAD_STAGES.CONVERTED) {
        ownerRow.wonOwned += 1;
        ownerRow.wonValueOwned += amount;
        ownerRow.grossProfitOwned += grossProfit;
      }
      if (normalizeLeadStage(lead.stage) === LEAD_STAGES.LOST) ownerRow.lostOwned += 1;
    }

    const rawAssignee = getLeadAssignee(lead);
    if (
      (rawAssignee?.uid || rawAssignee?.email || rawAssignee?.name) &&
      shouldIncludePerson(assignee)
    ) {
      const assigneeRow = ensureRow(rowMap, assignee);
      assigneeRow.assigned += 1;
      if (!isClosed(lead)) assigneeRow.openAssigned += 1;
      if (isOverdue(lead)) assigneeRow.overdueAssigned += 1;
    }
  });

  const rows = Object.values(rowMap)
    .map(row => ({
      ...row,
      ownerWinRate: row.owned > 0 ? Math.round((row.wonOwned / row.owned) * 100) : 0
    }))
    .sort((a, b) => b.owned - a.owned || b.assigned - a.assigned || a.name.localeCompare(b.name));

  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-500">
          <Users size={22} />
        </div>
        <h3 className="mt-4 text-sm font-semibold text-slate-900">No team performance data available</h3>
        <p className="mt-1 text-xs text-slate-500">Lead ownership and assignment activity will appear here.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
        <strong>Owner</strong> = permanent creator credit and conversion. <strong>Assignee</strong> = current workload and follow-up responsibility.
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[1180px] w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-white">
            <tr>
              <TableHead>Team Member</TableHead>
              <TableHead align="center">Owned</TableHead>
              <TableHead align="center">Assigned</TableHead>
              <TableHead align="center">Open Workload</TableHead>
              <TableHead align="center">Overdue</TableHead>
              <TableHead align="center">Won (Owned)</TableHead>
              <TableHead align="center">Lost (Owned)</TableHead>
              <TableHead align="right">Quoted (Owned)</TableHead>
              <TableHead align="right">Won Value</TableHead>
              <TableHead align="right">Gross Profit</TableHead>
              <TableHead align="center">Owner Win Rate</TableHead>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.map(row => (
              <tr key={row.key} className="transition hover:bg-slate-50">
                <td className="min-w-[220px] px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-sm font-semibold text-slate-700">
                      {getInitials(row.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">{row.name}</p>
                      {row.email ? <p className="mt-0.5 truncate text-xs text-slate-500">{row.email}</p> : null}
                    </div>
                  </div>
                </td>
                <MetricCell icon={UserPlus} value={row.owned} tone="blue" />
                <MetricCell icon={UserCheck} value={row.assigned} tone="purple" />
                <MetricCell icon={Clock3} value={row.openAssigned} tone="slate" />
                <MetricCell icon={AlertTriangle} value={row.overdueAssigned} tone={row.overdueAssigned ? "amber" : "slate"} />
                <MetricCell icon={CheckCircle2} value={row.wonOwned} tone="green" />
                <MetricCell icon={XCircle} value={row.lostOwned} tone="red" />
                <td className="px-4 py-4 text-right font-medium text-slate-700">{formatCurrency(row.quotedOwned)}</td>
                <td className="px-4 py-4 text-right font-semibold text-emerald-700">{formatCurrency(row.wonValueOwned)}</td>
                <td className="px-4 py-4 text-right font-semibold text-slate-900">{formatCurrency(row.grossProfitOwned)}</td>
                <td className="px-4 py-4 text-center">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                    <Trophy size={13} /> {row.ownerWinRate}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TableHead({ children, align = "left" }) {
  const classes = { left: "text-left", center: "text-center", right: "text-right" };
  return <th className={`whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 ${classes[align]}`}>{children}</th>;
}

function MetricCell({ icon: Icon, value, tone }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    blue: "bg-blue-50 text-blue-700",
    purple: "bg-violet-50 text-violet-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-rose-50 text-rose-700"
  };
  return (
    <td className="px-4 py-4 text-center">
      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${tones[tone] || tones.slate}`}>
        <Icon size={13} /> {value}
      </span>
    </td>
  );
}
