"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Cell,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip
} from "recharts";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Eye,
  MapPin,
  PieChart as PieChartIcon,
  TrendingUp,
  User,
  X
} from "lucide-react";

/* =========================
   STAGE COLORS
========================= */

const STAGE_COLORS = {
  new_enquiry: "#2563eb",
  requirement_pending: "#f59e0b",
  requirement_completed: "#0ea5e9",
  quote_pending: "#a855f7",
  quote_sent: "#7c3aed",
  follow_up_pending: "#f97316",
  revision_required: "#eab308",
  hot_lead: "#ef4444",
  payment_pending: "#fb7185",
  converted: "#16a34a",
  lost: "#dc2626",
  future_follow_up: "#64748b",
  unknown: "#94a3b8"
};

/* =========================
   HELPERS
========================= */

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function normalizeStageForDashboard(value) {
  const stage = normalize(value);

  const aliases = {
    new: "new_enquiry",
    enquiry: "new_enquiry",
    new_lead: "new_enquiry",

    requirement: "requirement_pending",
    requirement_pending: "requirement_pending",

    requirement_done: "requirement_completed",
    requirement_complete: "requirement_completed",
    requirement_completed: "requirement_completed",

    quote_pending: "quote_pending",
    quotation_pending: "quote_pending",

    quoted: "quote_sent",
    quote_sent: "quote_sent",
    quotation_sent: "quote_sent",
    quote_shared: "quote_sent",
    sent_quote: "quote_sent",
    sent: "quote_sent",

    follow_up: "follow_up_pending",
    followup: "follow_up_pending",
    follow_up_pending: "follow_up_pending",

    revision: "revision_required",
    revision_required: "revision_required",

    hot: "hot_lead",
    hot_lead: "hot_lead",

    payment: "payment_pending",
    payment_pending: "payment_pending",

    won: "converted",
    converted: "converted",
    closed_won: "converted",

    lost: "lost",
    closed_lost: "lost",
    cancelled: "lost",

    future_followup: "future_follow_up",
    future_follow_up: "future_follow_up"
  };

  return aliases[stage] || stage || "unknown";
}

function readableLabel(value) {
  if (!value) return "Unknown";

  return String(value)
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, char => char.toUpperCase());
}

function isDeletedLead(lead) {
  return (
    lead?.isDeleted === true ||
    lead?.deleted === true ||
    String(lead?.isDeleted).trim().toLowerCase() === "true" ||
    String(lead?.deleted).trim().toLowerCase() === "true" ||
    Boolean(lead?.deletedAt)
  );
}

function getStageKey(lead) {
  return normalizeStageForDashboard(
    lead?.stage ||
      lead?.status ||
      lead?.stageLabel ||
      "unknown"
  );
}

function getStageLabel(stageKey) {
  return readableLabel(stageKey);
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === "function") return value.toDate();
  if (value?.seconds) return new Date(value.seconds * 1000);

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value) {
  const d = toDate(value);
  if (!d) return "—";

  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function formatCurrency(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

function getLeadAmount(lead) {
  return Number(
    lead?.latestQuotationAmount ||
      lead?.latestCustomerQuoteAmount ||
      lead?.totalReceivableAmount ||
      lead?.customerQuoteAmount ||
      0
  );
}

function getLeadDate(lead) {
  return (
    lead?.createdAt ||
    lead?.assignedAt ||
    lead?.updatedAt ||
    lead?.lastActivityAt
  );
}

function getAgentName(lead) {
  return (
    lead?.agentName ||
    lead?.agencyName ||
    lead?.travelAgentName ||
    "Unknown Agent"
  );
}

function getClientName(lead) {
  return (
    lead?.customerName ||
    lead?.clientName ||
    lead?.guestName ||
    getAgentName(lead)
  );
}

function getAssignedName(lead) {
  return (
    lead?.assignedToName ||
    lead?.assignedTo ||
    lead?.assignedToEmail ||
    "Unassigned"
  );
}

/* =========================
   CUSTOM TOOLTIP
========================= */

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;

  const item = payload[0]?.payload;
  if (!item) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-lg">
      <p className="text-xs font-medium text-gray-500">
        {item.name}
      </p>

      <p className="mt-1 text-sm font-semibold text-gray-900">
        {item.value} {item.value === 1 ? "lead" : "leads"}
      </p>

      <p className="mt-0.5 text-xs text-gray-500">
        {item.percent}% of pipeline
      </p>

      <p className="mt-1 text-[11px] font-medium text-purple-600">
        Click to view leads
      </p>
    </div>
  );
}

/* =========================
   MAIN COMPONENT
========================= */

export default function LeadsByStageChart({ leads = [] }) {
  const router = useRouter();
  const [selectedStage, setSelectedStage] = useState(null);

  const { data, total, totalAmount } = useMemo(() => {
    const activeLeads = Array.isArray(leads)
      ? leads.filter(lead => !isDeletedLead(lead))
      : [];

    const map = new Map();

    activeLeads.forEach(lead => {
      const stageKey = getStageKey(lead);
      const existing = map.get(stageKey);
      const amount = getLeadAmount(lead);

      const leadPayload = {
        ...lead,
        amount,
        createdDate: getLeadDate(lead)
      };

      map.set(stageKey, {
        key: stageKey,
        name: getStageLabel(stageKey),
        value: (existing?.value || 0) + 1,
        amount: (existing?.amount || 0) + amount,
        leads: [...(existing?.leads || []), leadPayload]
      });
    });

    const rows = Array.from(map.values()).sort((a, b) => b.value - a.value);
    const totalCount = rows.reduce((sum, item) => sum + item.value, 0);
    const amountTotal = rows.reduce((sum, item) => sum + item.amount, 0);

    return {
      total: totalCount,
      totalAmount: amountTotal,
      data: rows.map(item => ({
        ...item,
        percent: totalCount
          ? Number(((item.value / totalCount) * 100).toFixed(1))
          : 0,
        leads: item.leads.sort((a, b) => {
          const ad = toDate(getLeadDate(a))?.getTime() || 0;
          const bd = toDate(getLeadDate(b))?.getTime() || 0;
          return bd - ad;
        })
      }))
    };
  }, [leads]);

  const quoteSent = data.find(item => item.key === "quote_sent");
  const converted = data.find(item => item.key === "converted");

  function openStage(item) {
    if (!item) return;
    setSelectedStage(item);
  }

  function openAllLeads() {
    setSelectedStage({
      key: "all",
      name: "All Leads",
      value: total,
      amount: totalAmount,
      percent: 100,
      leads: data.flatMap(item => item.leads)
    });
  }

  function closeStage() {
    setSelectedStage(null);
  }

  function viewLead(leadId) {
    if (!leadId) return;
    router.push(`/admin/leads/${leadId}`);
  }

  if (!data.length) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50">
        <div className="text-center">
          <p className="text-sm font-medium text-gray-700">
            No stage data available
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Lead stage distribution will appear once leads are available.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StageSummaryKpi
            label="Total Leads"
            value={total}
            helper={formatCurrency(totalAmount)}
            icon={PieChartIcon}
            tone="blue"
            onClick={openAllLeads}
          />

          <StageSummaryKpi
            label="Top Stage"
            value={data[0]?.name || "—"}
            helper={`${data[0]?.value || 0} leads`}
            icon={TrendingUp}
            tone="purple"
            onClick={() => openStage(data[0])}
          />

          <StageSummaryKpi
            label="Quote Sent"
            value={quoteSent?.value || 0}
            helper={formatCurrency(quoteSent?.amount || 0)}
            icon={CircleDollarSign}
            tone="green"
            onClick={() => openStage(quoteSent)}
          />

          <StageSummaryKpi
            label="Converted"
            value={converted?.value || 0}
            helper={formatCurrency(converted?.amount || 0)}
            icon={CheckCircle2}
            tone="emerald"
            onClick={() => openStage(converted)}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-4">
          <div className="rounded-2xl border border-gray-100 bg-gradient-to-br from-gray-50 via-white to-purple-50/40 p-4">
            <div className="relative h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={72}
                    outerRadius={108}
                    paddingAngle={3}
                    stroke="#ffffff"
                    strokeWidth={3}
                  >
                    {data.map(item => (
                      <Cell
                        key={item.key}
                        fill={STAGE_COLORS[item.key] || STAGE_COLORS.unknown}
                        className="cursor-pointer outline-none transition-opacity hover:opacity-80"
                        onClick={() => openStage(item)}
                      />
                    ))}
                  </Pie>

                  <Tooltip content={<CustomTooltip />} />
                </RechartsPieChart>
              </ResponsiveContainer>

              <button
                type="button"
                onClick={openAllLeads}
                className="absolute inset-0 m-auto flex h-28 w-28 flex-col items-center justify-center rounded-full border border-gray-100 bg-white text-center shadow-sm transition hover:border-purple-200 hover:bg-purple-50"
              >
                <p className="text-3xl font-bold text-gray-900">
                  {total}
                </p>
                <p className="text-xs text-gray-500">
                  Total Leads
                </p>
                <p className="mt-1 text-[10px] font-semibold text-purple-600">
                  View all
                </p>
              </button>
            </div>

            <p className="mt-2 text-center text-xs text-gray-500">
              Click any segment to view matching leads.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.slice(0, 8).map(item => {
              const isActive = selectedStage?.key === item.key;

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => openStage(item)}
                  className={`
                    group rounded-2xl border p-4 text-left transition
                    ${
                      isActive
                        ? "border-purple-200 bg-purple-50 shadow-sm"
                        : "border-gray-200 bg-white hover:border-purple-200 hover:shadow-sm"
                    }
                  `}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span
                        className="mt-1 h-3 w-3 shrink-0 rounded-full"
                        style={{
                          backgroundColor:
                            STAGE_COLORS[item.key] || STAGE_COLORS.unknown
                        }}
                      />

                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900">
                          {item.name}
                        </p>

                        <p className="mt-1 text-xs text-gray-500">
                          {item.value} leads • {item.percent}%
                        </p>
                      </div>
                    </div>

                    <ArrowUpRight className="h-4 w-4 shrink-0 text-gray-400 transition group-hover:text-purple-600" />
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400">
                        Pipeline Value
                      </span>
                      <span className="font-semibold text-gray-700">
                        {formatCurrency(item.amount)}
                      </span>
                    </div>

                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(item.percent, 5)}%`,
                          backgroundColor:
                            STAGE_COLORS[item.key] || STAGE_COLORS.unknown
                        }}
                      />
                    </div>
                  </div>
                </button>
              );
            })}

            {data.length > 8 && (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                Showing top 8 of {data.length} stages.
              </div>
            )}
          </div>
        </div>
      </div>

      <StageSidePanel
        stage={selectedStage}
        onClose={closeStage}
        onViewLead={viewLead}
      />
    </>
  );
}

/* =========================
   KPI CARD
========================= */

function StageSummaryKpi({
  label,
  value,
  helper,
  icon: Icon,
  tone = "blue",
  onClick
}) {
  const tones = {
    blue: "border-blue-100 bg-blue-50 text-blue-700 hover:border-blue-200",
    purple: "border-purple-100 bg-purple-50 text-purple-700 hover:border-purple-200",
    green: "border-green-100 bg-green-50 text-green-700 hover:border-green-200",
    emerald: "border-emerald-100 bg-emerald-50 text-emerald-700 hover:border-emerald-200",
    amber: "border-amber-100 bg-amber-50 text-amber-700 hover:border-amber-200",
    red: "border-red-100 bg-red-50 text-red-700 hover:border-red-200",
    slate: "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300"
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        rounded-2xl border p-4 text-left transition
        hover:-translate-y-0.5 hover:shadow-sm
        ${tones[tone] || tones.blue}
      `}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium opacity-80">
            {label}
          </p>

          <p className="mt-2 truncate text-lg font-bold">
            {value}
          </p>

          {helper ? (
            <p className="mt-1 truncate text-xs opacity-75">
              {helper}
            </p>
          ) : null}
        </div>

        {Icon ? (
          <div className="shrink-0 rounded-xl bg-white/70 p-2 shadow-sm">
            <Icon className="h-4 w-4" />
          </div>
        ) : null}
      </div>
    </button>
  );
}

/* =========================
   SIDE PANEL
========================= */

function StageSidePanel({ stage, onClose, onViewLead }) {
  if (!stage) return null;

  const leads = Array.isArray(stage.leads) ? stage.leads : [];
  const totalAmount = leads.reduce((sum, lead) => sum + getLeadAmount(lead), 0);

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close stage details"
        onClick={onClose}
        className="absolute inset-0 bg-gray-950/30 backdrop-blur-[1px]"
      />

      <aside className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
        <div className="border-b border-gray-100 bg-gradient-to-r from-gray-50 via-white to-gray-50 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div
                className="rounded-2xl p-2.5 text-white shadow-sm"
                style={{
                  backgroundColor:
                    STAGE_COLORS[stage.key] || STAGE_COLORS.unknown
                }}
              >
                <PieChartIcon className="h-5 w-5" />
              </div>

              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  {stage.name}
                </h2>
                <p className="mt-0.5 text-sm text-gray-500">
                  Leads under this pipeline stage.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-gray-200 p-2 text-gray-500 hover:bg-gray-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <StagePanelKpi
              icon={PieChartIcon}
              label="Leads"
              value={leads.length}
            />
            <StagePanelKpi
              icon={CircleDollarSign}
              label="Value"
              value={formatCurrency(totalAmount)}
            />
            <StagePanelKpi
              icon={CalendarDays}
              label="Share"
              value={`${stage.percent || 0}%`}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {!leads.length ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
              <p className="text-sm font-medium text-gray-700">
                No leads found
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Leads will appear here once available.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {leads.map(lead => (
                <LeadStageCard
                  key={lead.id || lead.leadCode}
                  lead={lead}
                  onViewLead={onViewLead}
                />
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function StagePanelKpi({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-2 text-gray-400">
        <Icon className="h-3.5 w-3.5" />
        <p className="text-[11px] font-medium uppercase tracking-wide">
          {label}
        </p>
      </div>

      <p className="mt-2 truncate text-sm font-semibold text-gray-900">
        {value}
      </p>
    </div>
  );
}

function LeadStageCard({ lead, onViewLead }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-purple-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">
            {lead.leadCode || lead.id}
          </p>

          <p className="mt-1 truncate text-sm text-gray-600">
            {getClientName(lead)}
          </p>
        </div>

        <div className="shrink-0 rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700">
          {formatCurrency(getLeadAmount(lead))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 text-xs text-gray-500">
        <LeadInfoRow
          icon={BriefcaseBusiness}
          label="Agent"
          value={getAgentName(lead)}
        />

        <LeadInfoRow
          icon={MapPin}
          label="Destination"
          value={lead.destinationName || "—"}
        />

        <LeadInfoRow
          icon={User}
          label="Assigned"
          value={getAssignedName(lead)}
        />

        <LeadInfoRow
          icon={CalendarDays}
          label="Created"
          value={formatDate(getLeadDate(lead))}
        />
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={() => onViewLead(lead.id)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
        >
          <Eye className="h-3.5 w-3.5" />
          View Lead
        </button>
      </div>
    </div>
  );
}

function LeadInfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 shrink-0 text-gray-400" />
      <span className="shrink-0 text-gray-400">
        {label}:
      </span>
      <span className="truncate font-medium text-gray-600">
        {value}
      </span>
    </div>
  );
}