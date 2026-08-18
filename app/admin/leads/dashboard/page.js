"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import {
  Activity,
  AlertTriangle,
  BadgeIndianRupee,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  Flame,
  Filter,
  RefreshCcw,
  RotateCcw,
  Send,
  Target,
  TrendingUp,
  Trophy,
  UserMinus,
  Users,
  X,
  XCircle
} from "lucide-react";

import { db } from "@/lib/firebase";
import { useAdminScope } from "@/components/admin/AdminScopeProvider";
import { useAuth } from "@/hooks/useAuth";
import { exportLeadsCsv } from "@/lib/exportLeadsCsv";
import { canAccess } from "@/lib/rolePermissions";
import {
  getLeadAssignee as getLeadAssigneeIdentity,
  getLeadOwner as getLeadOwnerIdentity
} from "@/lib/leadOwnership";
import { LEAD_STAGES, isTerminalLeadStage, normalizeLeadStage } from "@/lib/leadStages";
import {
  findDirectoryMember,
  getMembersForTeam,
  memberMatchesValues,
  resolveDirectoryIdentity,
  teamMatchesScope
} from "@/lib/teamDirectory";

/* DASHBOARD COMPONENTS */
import DashboardFilters from "@/components/admin/dashboard/DashboardFilters";
import DashboardKpiCard from "@/components/admin/dashboard/DashboardKpiCard";
import LeadsTrendChart from "@/components/admin/dashboard/LeadsTrendChart";
import LeadsByStageChart from "@/components/admin/dashboard/LeadsByStageChart";
import TeamPerformanceTable from "@/components/admin/dashboard/TeamPerformanceTable";
import LeadsByDestinationChart from "@/components/admin/dashboard/LeadsByDestinationChart";
import RevenueByDestinationChart from "@/components/admin/dashboard/RevenueByDestinationChart";
import OpenLeadTravelMonthBoard from "@/components/admin/OpenLeadTravelMonthBoard";

/* =========================
   INITIAL FILTERS
========================== */

const INITIAL_FILTERS = {
  team: "all",
  stage: "all",
  owner: "all",
  assignedTo: "all",
  followUp: "all",
  destination: "all",
  from: "",
  to: ""
};

function getAssignedKey(lead) {
  const raw =
    lead.assignedToUid ||
    lead.assignedToEmail ||
    lead.assignedTo ||
    lead.assignedToName ||
    "";

  return String(raw).trim().toLowerCase();
}

function getOwnerKey(lead) {
  const owner = getLeadOwnerIdentity(lead);
  return String(owner?.uid || owner?.email || owner?.name || "")
    .trim()
    .toLowerCase();
}

/* =========================
   DATE HELPERS
========================== */

function toDate(value) {
  if (!value) return null;

  if (typeof value?.toDate === "function") {
    return value.toDate();
  }

  if (value instanceof Date) {
    return value;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateInput(date) {
  if (!date) return "";

  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function startOfDay(value) {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(value) {
  const d = new Date(value);
  d.setHours(23, 59, 59, 999);
  return d;
}

function isSameDay(a, b) {
  if (!a || !b) return false;

  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getDateRangeByPreset(preset) {
  const today = new Date();

  if (preset === "today") {
    return {
      from: formatDateInput(today),
      to: formatDateInput(today)
    };
  }

  if (preset === "yesterday") {
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    return {
      from: formatDateInput(yesterday),
      to: formatDateInput(yesterday)
    };
  }

  if (preset === "last7") {
    const from = new Date(today);
    from.setDate(today.getDate() - 6);

    return {
      from: formatDateInput(from),
      to: formatDateInput(today)
    };
  }

  if (preset === "last30") {
    const from = new Date(today);
    from.setDate(today.getDate() - 29);

    return {
      from: formatDateInput(from),
      to: formatDateInput(today)
    };
  }

  if (preset === "thisMonth") {
    const from = new Date(today.getFullYear(), today.getMonth(), 1);

    return {
      from: formatDateInput(from),
      to: formatDateInput(today)
    };
  }

  if (preset === "lastMonth") {
    const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const to = new Date(today.getFullYear(), today.getMonth(), 0);

    return {
      from: formatDateInput(from),
      to: formatDateInput(to)
    };
  }

  return {
    from: "",
    to: ""
  };
}

/* =========================
   VALUE HELPERS
========================== */

function getNumber(value) {
  if (typeof value === "number") return value;

  if (typeof value === "string") {
    const cleaned = value.replace(/[₹,\s]/g, "");
    const parsed = Number(cleaned);
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

function getLeadCreatedDate(lead) {
  return toDate(lead.createdAt || lead.createdOn || lead.addedAt);
}

function getNextActionDate(lead) {
  return toDate(
    lead.nextActionAt ||
    lead.nextActionDueAt ||
    lead.followUpAt ||
    lead.nextFollowUpAt
  );
}

function isLeadClosed(lead) {
  return isTerminalLeadStage(lead?.stage || lead?.status || "");
}

function isLeadOverdue(lead) {
  const nextActionDate = getNextActionDate(lead);
  if (!nextActionDate) return false;

  return nextActionDate < new Date() && !isLeadClosed(lead);
}

function isLeadUnassigned(lead) {
  return !(
    lead.assignedToUid ||
    lead.assignedToEmail ||
    lead.assignedTo ||
    lead.assignedToName
  );
}

function isHotLead(lead) {
  const value = String(
    lead.priority ||
    lead.leadPriority ||
    lead.leadTemperature ||
    lead.temperature ||
    lead.leadType ||
    ""
  ).toLowerCase();

  return value === "hot" || value === "high" || value === "urgent";
}

function isQuotationPending(lead) {
  if (isLeadClosed(lead)) return false;

  const stage = lead.stage || "";
  const amount = getLeadAmount(lead);

  return (
    stage === "qualified" ||
    stage === "quotation_pending" ||
    stage === "quotation_requested" ||
    (stage === "contacted" && amount <= 0)
  );
}

function hasNoNextAction(lead) {
  return !getNextActionDate(lead) && !isLeadClosed(lead);
}

function getStageLabel(stage = "") {
  const map = {
    new: "New",
    assigned: "Assigned",
    contacted: "Contacted",
    qualified: "Qualified",
    quotation_pending: "Quotation Pending",
    quotation_requested: "Quotation Requested",
    quotation_sent: "Quotation Sent",
    follow_up: "Follow Up",
    negotiation: "Negotiation",
    closed_won: "Won",
    closed_lost: "Lost",
    converted: "Closed - Won",
    lost: "Closed - Lost",
    cancelled_invalid: "Closed - Cancelled / Invalid"
  };

  return map[stage] || stage?.replaceAll("_", " ") || "Unknown";
}


/* =========================
   SMALL UI COMPONENTS
========================== */

function HeaderStat({ icon: Icon, label, value, tone = "white" }) {
  const toneMap = {
    white: "text-white",
    amber: "text-amber-300",
    green: "text-emerald-300",
    blue: "text-sky-300"
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur-sm">
      <div className="flex items-center gap-2 text-xs text-slate-300">
        <Icon size={14} />
        {label}
      </div>

      <p className={`mt-2 text-xl font-semibold ${toneMap[tone]}`}>
        {value}
      </p>
    </div>
  );
}

function DashboardHeader({
  totalLeads,
  activeUsers,
  overdueCount,
  wonCount,
  onRefresh,
  onExport
}) {
  return (
    <section className="rounded-[28px] border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.14)] md:p-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-slate-200">
            <BarChart3 size={14} />
            Admin Lead Dashboard
          </div>

          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white md:text-3xl">
            Lead Command Center
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            Separate permanent lead ownership from current assignment, then monitor
            workload, follow-up health, conversions, value and destination demand.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:min-w-[560px]">
          <HeaderStat
            icon={Activity}
            label="Visible Leads"
            value={totalLeads}
            tone="white"
          />

          <HeaderStat
            icon={Users}
            label="Lead Owners"
            value={activeUsers}
            tone="blue"
          />

          <HeaderStat
            icon={Clock3}
            label="Overdue"
            value={overdueCount}
            tone="amber"
          />

          <HeaderStat
            icon={Trophy}
            label="Won"
            value={wonCount}
            tone="green"
          />
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-white/10 pt-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <Filter size={14} />
          Use quick filters and action cards to instantly narrow down the
          dashboard.
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onExport}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/15"
          >
            <Download size={14} />
            Export Visible Leads
          </button>

          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/15"
          >
            <RefreshCcw size={14} />
            Refresh
          </button>
        </div>
      </div>
    </section>
  );
}

function ActionCard({
  icon: Icon,
  label,
  value,
  helper,
  active,
  tone = "slate",
  onClick
}) {
  const toneMap = {
    slate: {
      box: "border-slate-200 bg-white text-slate-700",
      icon: "bg-slate-100 text-slate-700"
    },
    blue: {
      box: "border-blue-100 bg-blue-50 text-blue-700",
      icon: "bg-blue-100 text-blue-700"
    },
    amber: {
      box: "border-amber-100 bg-amber-50 text-amber-700",
      icon: "bg-amber-100 text-amber-700"
    },
    red: {
      box: "border-rose-100 bg-rose-50 text-rose-700",
      icon: "bg-rose-100 text-rose-700"
    },
    green: {
      box: "border-emerald-100 bg-emerald-50 text-emerald-700",
      icon: "bg-emerald-100 text-emerald-700"
    },
    purple: {
      box: "border-violet-100 bg-violet-50 text-violet-700",
      icon: "bg-violet-100 text-violet-700"
    }
  };

  const currentTone = toneMap[tone] || toneMap.slate;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left  transition hover:-translate-y-0.5 hover:shadow-md ${active
        ? "border-slate-900 bg-slate-900 text-white"
        : currentTone.box
        }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className={`text-xs font-medium uppercase tracking-wide ${active ? "text-slate-300" : "opacity-80"
              }`}
          >
            {label}
          </p>

          <p className="mt-2 text-2xl font-semibold tracking-tight">
            {value}
          </p>
        </div>

        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${active ? "bg-white/10 text-white" : currentTone.icon
            }`}
        >
          <Icon size={19} />
        </div>
      </div>

      <p
        className={`mt-3 text-xs leading-5 ${active ? "text-slate-300" : "opacity-75"
          }`}
      >
        {helper}
      </p>
    </button>
  );
}

function TodayActionCenter({ counts, quickView, setQuickView }) {
  const actions = [
    {
      key: "todayFollowups",
      label: "Today's Follow-ups",
      value: counts.todayFollowups,
      helper: "Follow-ups due today.",
      icon: CalendarDays,
      tone: "blue"
    },
    {
      key: "overdue",
      label: "Overdue Follow-ups",
      value: counts.overdue,
      helper: "Needs urgent attention.",
      icon: Clock3,
      tone: "amber"
    },
    {
      key: "unassigned",
      label: "Unassigned Leads",
      value: counts.unassigned,
      helper: "Assign quickly to avoid delay.",
      icon: UserMinus,
      tone: "red"
    },
    {
      key: "hot",
      label: "Hot Leads",
      value: counts.hot,
      helper: "High priority opportunities.",
      icon: Flame,
      tone: "purple"
    },
    {
      key: "quotationPending",
      label: "Quotation Pending",
      value: counts.quotationPending,
      helper: "Leads waiting for quote.",
      icon: Send,
      tone: "green"
    }
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 ">
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Today&apos;s Action Center
          </h2>
          <p className="text-xs text-slate-500">
            Click any card to filter dashboard data instantly.
          </p>
        </div>

        {quickView !== "all" ? (
          <button
            type="button"
            onClick={() => setQuickView("all")}
            className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            <X size={14} />
            Clear Action Filter
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {actions.map(action => (
          <ActionCard
            key={action.key}
            icon={action.icon}
            label={action.label}
            value={action.value}
            helper={action.helper}
            tone={action.tone}
            active={quickView === action.key}
            onClick={() =>
              setQuickView(prev =>
                prev === action.key ? "all" : action.key
              )
            }
          />
        ))}
      </div>
    </section>
  );
}

function PipelineHealth({ counts, activeView, setQuickView }) {
  const items = [
    {
      key: "all",
      label: "Healthy/Open",
      value: counts.healthy,
      icon: CheckCircle2,
      tone: "green",
      helper: "Open leads with no overdue risk."
    },
    {
      key: "overdue",
      label: "Overdue",
      value: counts.overdue,
      icon: Clock3,
      tone: "amber",
      helper: "Follow-up date has passed."
    },
    {
      key: "noNextAction",
      label: "No Next Action",
      value: counts.noNextAction,
      icon: AlertTriangle,
      tone: "red",
      helper: "Open leads without next follow-up."
    },
    {
      key: "quotationPending",
      label: "Quote Pending",
      value: counts.quotationPending,
      icon: Send,
      tone: "blue",
      helper: "Qualified leads needing quotation."
    }
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 ">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-slate-900">
          Pipeline Health
        </h2>
        <p className="text-xs text-slate-500">
          Understand where attention is needed before leads become cold.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {items.map(item => (
          <ActionCard
            key={item.key}
            icon={item.icon}
            label={item.label}
            value={item.value}
            helper={item.helper}
            tone={item.tone}
            active={activeView === item.key && item.key !== "all"}
            onClick={() => {
              if (item.key === "all") {
                setQuickView("all");
              } else {
                setQuickView(prev =>
                  prev === item.key ? "all" : item.key
                );
              }
            }}
          />
        ))}
      </div>
    </section>
  );
}

function ActiveFilterChips({
  filters,
  ownerOptions,
  assignedOptions,
  quickView,
  setFilters,
  setQuickView,
  resetAll
}) {
  const chips = [];

  if (filters.stage !== "all") {
    chips.push({
      key: "stage",
      label: `Stage: ${getStageLabel(filters.stage)}`,
      onClear: () =>
        setFilters(prev => ({
          ...prev,
          stage: "all"
        }))
    });
  }


  if (filters.owner !== "all") {
    const ownerLabel =
      ownerOptions.find(item => item.value === filters.owner)?.label || filters.owner;

    chips.push({
      key: "owner",
      label: `Owner: ${ownerLabel}`,
      onClear: () =>
        setFilters(prev => ({
          ...prev,
          owner: "all"
        }))
    });
  }

  if (filters.assignedTo !== "all") {
    const assignedLabel =
      assignedOptions.find(item => item.value === filters.assignedTo)
        ?.label || filters.assignedTo;

    chips.push({
      key: "assignedTo",
      label: `Assigned: ${assignedLabel}`,
      onClear: () =>
        setFilters(prev => ({
          ...prev,
          assignedTo: "all"
        }))
    });
  }

  if (filters.destination !== "all") {
    chips.push({
      key: "destination",
      label: `Destination: ${filters.destination}`,
      onClear: () => setFilters(prev => ({ ...prev, destination: "all" }))
    });
  }

  if (filters.followUp !== "all") {
    const followUpLabels = {
      today: "Due Today",
      overdue: "Overdue",
      upcoming: "Upcoming",
      none: "No Next Action"
    };
    chips.push({
      key: "followUp",
      label: `Follow-up: ${followUpLabels[filters.followUp] || filters.followUp}`,
      onClear: () =>
        setFilters(prev => ({
          ...prev,
          followUp: "all"
        }))
    });
  }

  if (quickView !== "all") {
    const quickViewLabelMap = {
      todayFollowups: "Today's Follow-ups",
      overdue: "Overdue Follow-ups",
      unassigned: "Unassigned Leads",
      hot: "Hot Leads",
      quotationPending: "Quotation Pending",
      noNextAction: "No Next Action"
    };

    chips.push({
      key: "quickView",
      label: quickViewLabelMap[quickView] || "Action Filter",
      onClear: () => setQuickView("all")
    });
  }

  if (!chips.length) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
      <span className="text-xs font-medium text-slate-500">
        Active Filters:
      </span>

      {chips.map(chip => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.onClear}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
        >
          {chip.label}
          <X size={13} />
        </button>
      ))}

      <button
        type="button"
        onClick={resetAll}
        className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-800"
      >
        <RotateCcw size={13} />
        Reset All
      </button>
    </div>
  );
}

function InsightCard({ icon: Icon, label, value, helper, tone = "slate" }) {
  const toneMap = {
    slate: "bg-slate-50 text-slate-700 border-slate-200",
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    green: "bg-emerald-50 text-emerald-700 border-emerald-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    red: "bg-rose-50 text-rose-700 border-rose-100",
    purple: "bg-violet-50 text-violet-700 border-violet-100"
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 ">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {label}
          </p>

          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
            {value}
          </p>
        </div>

        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl border ${toneMap[tone] || toneMap.slate
            }`}
        >
          <Icon size={19} />
        </div>
      </div>

      {helper ? (
        <p className="mt-3 text-xs leading-5 text-slate-500">
          {helper}
        </p>
      ) : null}
    </div>
  );
}

function LoadingState() {
  return (
    <main className="w-full space-y-6 bg-slate-50 p-4 md:p-6">
      <div className="h-52 animate-pulse rounded-[28px] bg-slate-200" />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-2xl bg-slate-200"
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="h-80 animate-pulse rounded-2xl bg-slate-200" />
        <div className="h-80 animate-pulse rounded-2xl bg-slate-200" />
      </div>
    </main>
  );
}

function ErrorState({ message }) {
  return (
    <main className="flex min-h-[60vh] items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md rounded-3xl border border-rose-100 bg-white p-6 text-center ">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
          <AlertTriangle size={22} />
        </div>

        <h2 className="mt-4 text-lg font-semibold text-slate-900">
          Unable to load dashboard
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          {message ||
            "Something went wrong while loading lead dashboard data."}
        </p>
      </div>
    </main>
  );
}

function EmptyDashboardState({ resetAll }) {
  return (
    <section className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center ">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
        <Filter size={22} />
      </div>

      <h2 className="mt-4 text-lg font-semibold text-slate-900">
        No leads found for selected filters
      </h2>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        Try changing the Global Date + Team scope above, or clear the page-specific owner, assignee, stage and follow-up filters.
      </p>

      <button
        type="button"
        onClick={resetAll}
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
      >
        <RotateCcw size={16} />
        Reset Page Filters
      </button>
    </section>
  );
}

/* =========================
   MAIN PAGE
========================== */

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const { scope, teamDirectory, userLookup } = useAdminScope();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [quickView, setQuickView] = useState("all");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const presetMap = {
      all: "",
      today: "today",
      yesterday: "yesterday",
      "7d": "last7",
      "30d": "last30",
      thisMonth: "thisMonth",
      lastMonth: "lastMonth"
    };
    const localPreset = presetMap[scope.dateRange] ?? "";
    const range = scope.dateRange === "custom"
      ? { from: scope.dateFrom || "", to: scope.dateTo || "" }
      : localPreset
        ? getDateRangeByPreset(localPreset)
        : { from: "", to: "" };

    setFilters(prev => ({
      ...prev,
      team: scope.team || "all",
      from: range.from,
      to: range.to,
      ...(prev.team !== (scope.team || "all") ? { owner: "all", assignedTo: "all" } : {})
    }));
  }, [scope.team, scope.dateRange, scope.dateFrom, scope.dateTo]);

  /* =========================
     REALTIME LOAD
  ========================== */
  useEffect(() => {
    setLoading(true);
    setLoadError("");

    const unsub = onSnapshot(
      collection(db, "leads"),
      snap => {
        const rows = snap.docs.map(d => ({
          id: d.id,
          ...d.data()
        }));

        setLeads(rows);
        setLoading(false);
      },
      error => {
        console.error("Lead dashboard load error:", error);
        setLoadError(error?.message || "Failed to load leads.");
        setLoading(false);
      }
    );

    return () => unsub();
  }, [refreshKey]);



  /* =========================
     ACTIVE LEADS ONLY
  ========================== */
  const activeLeads = useMemo(() => {
    return leads
      .filter(lead => lead?.isDeleted !== true)
      .sort((a, b) => {
        const aDate = getLeadCreatedDate(a)?.getTime() || 0;
        const bDate = getLeadCreatedDate(b)?.getTime() || 0;
        return bDate - aDate;
      });
  }, [leads]);

  /* =========================
     CANONICAL TEAM DIRECTORY
     Sourced only from the global Users master.
  ========================== */
  const scopedMembers = useMemo(
    () => getMembersForTeam(teamDirectory, filters.team),
    [teamDirectory, filters.team]
  );

  const ownerOptions = useMemo(
    () => scopedMembers.map(member => ({
      value: member.key,
      label: member.label,
      email: member.email,
      team: member.team
    })),
    [scopedMembers]
  );

  const assignedOptions = ownerOptions;

  const destinationOptions = useMemo(() =>
    Array.from(new Set(activeLeads
      .map(lead => String(lead.destination || lead.destinationName || lead.city || "").trim())
      .filter(Boolean)))
      .sort((a, b) => a.localeCompare(b)),
    [activeLeads]
  );

  const resolveMember = identity => {
    if (!identity) return null;
    const resolved = resolveDirectoryIdentity(
      { uid: identity.uid, email: identity.email, name: identity.name },
      userLookup
    );
    return resolved?.isUnmapped ? null : resolved;
  };

  /* =========================
     OPEN TRAVEL PIPELINE
     Intentionally ignores lead-created date/page filters.
     It reflects every currently open query, optionally scoped by Team.
  ========================== */
  const openTravelLeads = useMemo(() => {
    return activeLeads.filter(lead => {
      if (isLeadClosed(lead)) return false;

      if (filters.team !== "all") {
        const ownerMember = resolveMember(getLeadOwnerIdentity(lead));
        const assigneeMember = resolveMember(getLeadAssigneeIdentity(lead));
        const ownerInTeam = ownerMember ? teamMatchesScope(ownerMember.team, filters.team) : false;
        const assigneeInTeam = assigneeMember ? teamMatchesScope(assigneeMember.team, filters.team) : false;
        if (!ownerInTeam && !assigneeInTeam) return false;
      }

      return true;
    });
  }, [activeLeads, filters.team, userLookup]);

  const openTravelTeamLabel = useMemo(() => {
    if (filters.team === "all") return "All Teams";
    return filters.team;
  }, [filters.team]);

  /* =========================
     FILTER RESET
  ========================== */
  const resetAll = () => {
    setFilters(prev => ({
      ...INITIAL_FILTERS,
      team: scope.team || "all",
      from: prev.from,
      to: prev.to
    }));
    setQuickView("all");
  };

  /* =========================
     BASE FILTERED LEADS
     Stage / Assigned / Date / Overdue
  ========================== */
  const baseFilteredLeads = useMemo(() => {
    return activeLeads.filter(lead => {
      if (filters.stage !== "all" && normalizeLeadStage(lead.stage) !== filters.stage) return false;

      const destination = String(lead.destination || lead.destinationName || lead.city || "").trim();
      if (filters.destination !== "all" && destination !== filters.destination) return false;

      const owner = getLeadOwnerIdentity(lead);
      const assignee = getLeadAssigneeIdentity(lead);
      const ownerMember = resolveMember(owner);
      const assigneeMember = resolveMember(assignee);

      if (filters.team !== "all") {
        const ownerInTeam = ownerMember ? teamMatchesScope(ownerMember.team, filters.team) : false;
        const assigneeInTeam = assigneeMember ? teamMatchesScope(assigneeMember.team, filters.team) : false;
        if (!ownerInTeam && !assigneeInTeam) return false;
      }

      if (filters.owner !== "all") {
        const member = findDirectoryMember(teamDirectory, filters.owner);
        if (!member || !memberMatchesValues(member, [owner.uid, owner.email, owner.name])) {
          return false;
        }
      }

      if (filters.assignedTo === "unassigned") {
        if (assignee.uid || assignee.email || assignee.name) return false;
      } else if (filters.assignedTo !== "all") {
        const member = findDirectoryMember(teamDirectory, filters.assignedTo);
        if (!member || !memberMatchesValues(member, [assignee.uid, assignee.email, assignee.name])) {
          return false;
        }
      }

      const nextAction = getNextActionDate(lead);
      const today = new Date();
      if (filters.followUp === "today" && (!nextAction || !isSameDay(nextAction, today))) return false;
      if (filters.followUp === "overdue" && !isLeadOverdue(lead)) return false;
      if (filters.followUp === "upcoming" && (!nextAction || nextAction <= today || isSameDay(nextAction, today))) return false;
      if (filters.followUp === "none" && nextAction) return false;

      const created = getLeadCreatedDate(lead);
      if (filters.from) {
        const fromDate = startOfDay(filters.from);
        if (!created || created < fromDate) return false;
      }
      if (filters.to) {
        const toDateValue = endOfDay(filters.to);
        if (!created || created > toDateValue) return false;
      }

      return true;
    });
  }, [activeLeads, filters, teamDirectory, userLookup]);

  /* =========================
     ACTION COUNTS
  ========================== */
  const actionCounts = useMemo(() => {
    const today = new Date();

    return baseFilteredLeads.reduce(
      (acc, lead) => {
        const nextAction = getNextActionDate(lead);

        if (nextAction && isSameDay(nextAction, today) && !isLeadClosed(lead)) {
          acc.todayFollowups += 1;
        }

        if (isLeadOverdue(lead)) acc.overdue += 1;
        if (isLeadUnassigned(lead)) acc.unassigned += 1;
        if (isHotLead(lead)) acc.hot += 1;
        if (isQuotationPending(lead)) acc.quotationPending += 1;
        if (hasNoNextAction(lead)) acc.noNextAction += 1;

        if (
          !isLeadClosed(lead) &&
          !isLeadOverdue(lead) &&
          !hasNoNextAction(lead)
        ) {
          acc.healthy += 1;
        }

        return acc;
      },
      {
        todayFollowups: 0,
        overdue: 0,
        unassigned: 0,
        hot: 0,
        quotationPending: 0,
        noNextAction: 0,
        healthy: 0
      }
    );
  }, [baseFilteredLeads]);

  /* =========================
     QUICK VIEW FILTERED LEADS
  ========================== */
  const filteredLeads = useMemo(() => {
    if (quickView === "all") return baseFilteredLeads;

    const today = new Date();

    return baseFilteredLeads.filter(lead => {
      const nextAction = getNextActionDate(lead);

      if (quickView === "todayFollowups") {
        return (
          nextAction && isSameDay(nextAction, today) && !isLeadClosed(lead)
        );
      }

      if (quickView === "overdue") {
        return isLeadOverdue(lead);
      }

      if (quickView === "unassigned") {
        return isLeadUnassigned(lead);
      }

      if (quickView === "hot") {
        return isHotLead(lead);
      }

      if (quickView === "quotationPending") {
        return isQuotationPending(lead);
      }

      if (quickView === "noNextAction") {
        return hasNoNextAction(lead);
      }

      return true;
    });
  }, [baseFilteredLeads, quickView]);

  const hasPageFilters = Boolean(
    filters.owner !== "all" ||
    filters.assignedTo !== "all" ||
    filters.stage !== "all" ||
    filters.followUp !== "all" ||
    filters.destination !== "all" ||
    quickView !== "all"
  );

  /* =========================
     METRICS
  ========================== */
  const metrics = useMemo(() => {
    let totalQuoted = 0;
    let totalWonValue = 0;
    let totalGrossProfit = 0;

    let quotedCount = 0;
    let wonCount = 0;
    let lostCount = 0;
    let cancelledInvalidCount = 0;
    let overdueCount = 0;

    filteredLeads.forEach(lead => {
      const amount = getLeadAmount(lead);
      const grossProfit = getGrossProfit(lead);

      if (amount > 0) {
        totalQuoted += amount;
        quotedCount += 1;
      }

      const normalizedStage = normalizeLeadStage(lead.stage || lead.status || "");
      if (normalizedStage === LEAD_STAGES.CONVERTED) {
        wonCount += 1;
        totalWonValue += amount;
        totalGrossProfit += grossProfit;
      }

      if (normalizedStage === LEAD_STAGES.LOST) {
        lostCount += 1;
      }

      if (normalizedStage === LEAD_STAGES.CANCELLED_INVALID) {
        cancelledInvalidCount += 1;
      }

      if (isLeadOverdue(lead)) {
        overdueCount += 1;
      }
    });

    const openCount = filteredLeads.filter(lead => !isLeadClosed(lead)).length;

    return {
      totalLeads: filteredLeads.length,
      totalQuoted,
      totalWonValue,
      totalGrossProfit,
      quotedCount,
      wonCount,
      lostCount,
      cancelledInvalidCount,
      openCount,
      overdueCount,
      avgDeal:
        wonCount > 0
          ? Math.round(totalWonValue / wonCount)
          : 0,
      winRate:
        quotedCount > 0
          ? Math.round((wonCount / quotedCount) * 100)
          : 0
    };
  }, [filteredLeads]);

  /* =========================
     TOP STAGE
  ========================== */
  const topStage = useMemo(() => {
    const map = new Map();

    filteredLeads.forEach(lead => {
      const stage = lead.stage || "unknown";
      map.set(stage, (map.get(stage) || 0) + 1);
    });

    const sorted = Array.from(map.entries()).sort(
      (a, b) => b[1] - a[1]
    );

    if (!sorted.length) {
      return {
        label: "No Data",
        count: 0
      };
    }

    return {
      label: getStageLabel(sorted[0][0]),
      count: sorted[0][1]
    };
  }, [filteredLeads]);

  if (loading) {
    return <LoadingState />;
  }

  if (loadError) {
    return <ErrorState message={loadError} />;
  }

  return (
    <main className="mx-auto w-full max-w-[1600px] space-y-6 p-4 md:p-6">
      {/* HEADER */}
      <DashboardHeader
        totalLeads={filteredLeads.length}
        activeUsers={ownerOptions.length}
        overdueCount={metrics.overdueCount}
        wonCount={metrics.wonCount}
        onRefresh={() => setRefreshKey(prev => prev + 1)}
        onExport={canAccess(user, "leads.export") ? () => exportLeadsCsv(filteredLeads, {
          includeVendorCost: canAccess(user, "payments.view_vendor_cost"),
          includeRevenueGp: canAccess(user, "payments.view_revenue_gp"),
          fileName: `lead-dashboard-${formatDateInput(new Date())}.csv`
        }) : null}
      />

      {/* FILTERS */}
      <div className="sticky top-20 z-20 space-y-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <div>
            <p className="text-xs font-semibold text-slate-700">
              Lead Filters
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Showing {filteredLeads.length} of {activeLeads.length} non-deleted leads
            </p>
          </div>

          {hasPageFilters ? (
            <button
              type="button"
              onClick={resetAll}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              <RotateCcw size={13} />
              Reset Page Filters
            </button>
          ) : null}
        </div>

        <DashboardFilters
          filters={filters}
          setFilters={setFilters}
          ownerOptions={ownerOptions}
          assignedOptions={assignedOptions}
          destinationOptions={destinationOptions}
        />

        <ActiveFilterChips
          filters={filters}
          ownerOptions={ownerOptions}
          assignedOptions={assignedOptions}
          quickView={quickView}
          setFilters={setFilters}
          setQuickView={setQuickView}
          resetAll={resetAll}
        />
      </div>

      {/* TODAY ACTION CENTER */}
      <TodayActionCenter
        counts={actionCounts}
        quickView={quickView}
        setQuickView={setQuickView}
      />

      {/* OPEN QUERY TRAVEL MONTH */}
      <OpenLeadTravelMonthBoard
        leads={openTravelLeads}
        teamLabel={openTravelTeamLabel}
      />

      {/* KPI ROW */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <DashboardKpiCard
          label="Total Leads"
          value={metrics.totalLeads}
          icon={Target}
        />

        <DashboardKpiCard
          label="Total Quoted"
          value={formatCurrency(metrics.totalQuoted)}
          color="blue"
          icon={BadgeIndianRupee}
        />

        <DashboardKpiCard
          label="Total Won"
          value={formatCurrency(metrics.totalWonValue)}
          color="green"
          icon={Trophy}
        />

        <DashboardKpiCard
          label="Avg Deal Size"
          value={formatCurrency(metrics.avgDeal)}
          color="purple"
          icon={TrendingUp}
        />

        <DashboardKpiCard
          label="Win Rate"
          value={`${metrics.winRate}%`}
          color="amber"
          icon={CheckCircle2}
        />
      </div>

      {/* PIPELINE HEALTH */}
      <PipelineHealth
        counts={actionCounts}
        activeView={quickView}
        setQuickView={setQuickView}
      />

      {/* SECONDARY INSIGHTS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <InsightCard
          icon={Activity}
          label="Open Leads"
          value={metrics.openCount}
          helper="Leads still active in the pipeline."
          tone="blue"
        />

        <InsightCard
          icon={CheckCircle2}
          label="Won Leads"
          value={metrics.wonCount}
          helper="Closed-won leads in selected filters."
          tone="green"
        />

        <InsightCard
          icon={XCircle}
          label="Lost Leads"
          value={metrics.lostCount}
          helper="Closed-lost leads in selected filters."
          tone="red"
        />

        <InsightCard
          icon={XCircle}
          label="Cancelled / Invalid"
          value={metrics.cancelledInvalidCount}
          helper="Closed without counting as a lost sales opportunity."
          tone="gray"
        />

        <InsightCard
          icon={Clock3}
          label="Overdue Follow-ups"
          value={metrics.overdueCount}
          helper="Needs attention from team."
          tone="amber"
        />

        <InsightCard
          icon={BarChart3}
          label="Top Stage"
          value={topStage.label}
          helper={`${topStage.count} lead${topStage.count === 1 ? "" : "s"
            } in this stage.`}
          tone="purple"
        />
      </div>

      {/* GROSS PROFIT */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 ">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <BadgeIndianRupee size={18} className="text-emerald-600" />
              Gross Profit Snapshot
            </div>

            <p className="mt-1 text-sm text-slate-500">
              Based on won leads where actual gross profit is available.
            </p>
          </div>

          <div className="rounded-2xl bg-emerald-50 px-5 py-3 text-right">
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
              Total Gross Profit
            </p>

            <p className="mt-1 text-2xl font-semibold text-emerald-700">
              {formatCurrency(metrics.totalGrossProfit)}
            </p>
          </div>
        </div>
      </section>

      {filteredLeads.length === 0 ? (
        <EmptyDashboardState resetAll={resetAll} />
      ) : (
        <>
          {/* TREND + STAGE */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 ">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-slate-900">
                  Lead Trend
                </h2>

                <p className="text-xs text-slate-500">
                  Lead creation movement over the selected period.
                </p>
              </div>

              <LeadsTrendChart leads={filteredLeads} />
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 ">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-slate-900">
                  Leads by Stage
                </h2>

                <p className="text-xs text-slate-500">
                  Pipeline distribution by current lead stage.
                </p>
              </div>

              <LeadsByStageChart leads={filteredLeads} />
            </section>
          </div>

          {/* TEAM PERFORMANCE */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 ">
            <div className="mb-4 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Team Performance
                </h2>

                <p className="text-xs text-slate-500">
                  Owner credit and conversion are separated from current assignee
                  workload and follow-up responsibility.
                </p>
              </div>
            </div>

            <TeamPerformanceTable
              leads={filteredLeads}
              teamDirectory={teamDirectory}
              visibleMembers={scopedMembers}
              includeUnmapped={filters.team === "all"}
            />
          </section>

          {/* DESTINATION ANALYTICS */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 ">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-slate-900">
                  Leads by Destination
                </h2>

                <p className="text-xs text-slate-500">
                  Most demanded destinations from selected lead data.
                </p>
              </div>

              <LeadsByDestinationChart leads={filteredLeads} />
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 ">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-slate-900">
                  Revenue by Destination
                </h2>

                <p className="text-xs text-slate-500">
                  Quotation and won value grouped destination-wise.
                </p>
              </div>

              <RevenueByDestinationChart leads={filteredLeads} />
            </section>
          </div>
        </>
      )}
    </main>
  );
}