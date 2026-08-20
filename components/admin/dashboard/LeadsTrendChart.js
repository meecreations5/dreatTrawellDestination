"use client";

import { useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  BriefcaseBusiness,
  CalendarDays,
  CircleDollarSign,
  Eye,
  MapPin,
  TrendingUp,
  User,
  X
} from "lucide-react";

/* =========================
   DATE HELPERS
========================= */

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === "function") return value.toDate();
  if (value?.seconds) return new Date(value.seconds * 1000);

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getLocalDateKey(value) {
  const date = toDate(value);
  if (!date) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatShortDate(dateKey) {
  const date = toDate(`${dateKey}T00:00:00`);
  if (!date) return dateKey;

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short"
  });
}

function formatFullDate(dateKey) {
  const date = toDate(`${dateKey}T00:00:00`);
  if (!date) return dateKey;

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function formatDate(value) {
  const date = toDate(value);
  if (!date) return "—";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function formatCurrency(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

/* =========================
   LEAD HELPERS
========================= */

function isDeletedLead(lead) {
  return (
    lead?.isDeleted === true ||
    lead?.deleted === true ||
    String(lead?.isDeleted).trim().toLowerCase() === "true" ||
    String(lead?.deleted).trim().toLowerCase() === "true" ||
    Boolean(lead?.deletedAt)
  );
}

function getLeadTrendDate(lead) {
  return (
    lead?.createdAt ||
    lead?.leadCreatedAt ||
    lead?.createdOn ||
    lead?.assignedAt ||
    lead?.updatedAt ||
    lead?.lastActivityAt
  );
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

function buildLastDays(days = 14) {
  const rows = [];
  const today = new Date();

  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - index);
    date.setHours(0, 0, 0, 0);

    const dateKey = getLocalDateKey(date);

    rows.push({
      dateKey,
      date: formatShortDate(dateKey),
      fullDate: formatFullDate(dateKey),
      count: 0,
      amount: 0,
      leads: []
    });
  }

  return rows;
}

/* =========================
   CUSTOM TOOLTIP
========================= */

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  const item = payload[0]?.payload;
  if (!item) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-lg">
      <p className="text-xs font-medium text-gray-500">
        {label}
      </p>

      <p className="mt-1 text-sm font-semibold text-gray-900">
        {item.count} {item.count === 1 ? "lead" : "leads"}
      </p>

      <p className="mt-0.5 text-xs text-gray-500">
        Value: {formatCurrency(item.amount)}
      </p>

      <p className="mt-1 text-[11px] font-medium text-blue-600">
        Click to view leads
      </p>
    </div>
  );
}

/* =========================
   MAIN COMPONENT
========================= */

export default function LeadsTrendChart({ leads = [], days = 14 }) {
  const router = useRouter();
  const gradientId = useId().replaceAll(":", "");

  const [selectedDay, setSelectedDay] = useState(null);

  const { data, hasData, totalLeads, totalAmount, peakDay } = useMemo(() => {
    const activeLeads = Array.isArray(leads)
      ? leads.filter(lead => !isDeletedLead(lead))
      : [];

    const baseRows = buildLastDays(days);
    const map = new Map(baseRows.map(row => [row.dateKey, row]));

    activeLeads.forEach(lead => {
      const key = getLocalDateKey(getLeadTrendDate(lead));

      if (!key || !map.has(key)) return;

      const row = map.get(key);
      const amount = getLeadAmount(lead);

      row.count += 1;
      row.amount += amount;
      row.leads.push({
        ...lead,
        amount,
        trendDate: getLeadTrendDate(lead)
      });
    });

    const rows = Array.from(map.values()).map(row => ({
      ...row,
      leads: row.leads.sort((a, b) => {
        const ad = toDate(getLeadTrendDate(a))?.getTime() || 0;
        const bd = toDate(getLeadTrendDate(b))?.getTime() || 0;
        return bd - ad;
      })
    }));

    const total = rows.reduce((sum, row) => sum + row.count, 0);
    const amount = rows.reduce((sum, row) => sum + row.amount, 0);

    const peak = rows.reduce(
      (best, row) => (row.count > best.count ? row : best),
      {
        date: "—",
        fullDate: "—",
        count: 0,
        amount: 0,
        leads: []
      }
    );

    return {
      data: rows,
      hasData: rows.some(row => row.count > 0),
      totalLeads: total,
      totalAmount: amount,
      peakDay: peak
    };
  }, [leads, days]);

  function openDay(row) {
    if (!row || row.count <= 0) return;
    setSelectedDay(row);
  }

  function closeDay() {
    setSelectedDay(null);
  }

  function viewLead(leadId) {
    if (!leadId) return;
    router.push(`/admin/leads/${leadId}`);
  }

  function handleChartClick(state) {
    const row = state?.activePayload?.[0]?.payload;
    openDay(row);
  }

  if (!hasData) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50">
        <div className="text-center">
          <p className="text-sm font-medium text-gray-700">
            No lead trend available
          </p>
          <p className="mt-1 text-xs text-gray-500">
            New leads will appear here once created.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <TrendKpi
            icon={TrendingUp}
            label="Total Leads"
            value={totalLeads}
            helper={`Last ${days} days`}
            tone="blue"
          />

          <TrendKpi
            icon={CircleDollarSign}
            label="Total Value"
            value={formatCurrency(totalAmount)}
            helper="Quotation value"
            tone="green"
          />

          <TrendKpi
            icon={CalendarDays}
            label="Peak Day"
            value={peakDay.count}
            helper={peakDay.fullDate}
            tone="purple"
            onClick={() => openDay(peakDay)}
          />

          <TrendKpi
            icon={Eye}
            label="View Peak Leads"
            value={peakDay.count}
            helper="Click to open"
            tone="amber"
            onClick={() => openDay(peakDay)}
          />
        </div>

        <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-gray-50 p-4">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart
              data={data}
              onClick={handleChartClick}
              margin={{
                top: 10,
                right: 12,
                left: -18,
                bottom: 0
              }}
            >
              <defs>
                <linearGradient
                  id={`leadTrendGradient-${gradientId}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0.03} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#e5e7eb"
              />

              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tick={{
                  fontSize: 11,
                  fill: "#6b7280"
                }}
              />

              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tick={{
                  fontSize: 11,
                  fill: "#6b7280"
                }}
              />

              <Tooltip
                content={<CustomTooltip />}
                cursor={{
                  stroke: "#93c5fd",
                  strokeWidth: 1
                }}
              />

              <Area
                type="monotone"
                dataKey="count"
                stroke="#2563eb"
                strokeWidth={3}
                fill={`url(#leadTrendGradient-${gradientId})`}
                className="cursor-pointer"
                dot={{
                  r: 4,
                  strokeWidth: 2,
                  stroke: "#2563eb",
                  fill: "#ffffff"
                }}
                activeDot={{
                  r: 6,
                  strokeWidth: 2,
                  stroke: "#1d4ed8",
                  fill: "#ffffff",
                  className: "cursor-pointer"
                }}
              />
            </AreaChart>
          </ResponsiveContainer>

          <p className="mt-2 text-center text-xs text-gray-500">
            Click any point on the graph to view leads for that date.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
          {data.map(row => (
            <button
              key={row.dateKey}
              type="button"
              onClick={() => openDay(row)}
              disabled={row.count <= 0}
              className={`
                rounded-xl border px-3 py-2 text-left transition
                ${
                  row.count > 0
                    ? "border-blue-100 bg-blue-50 text-blue-700 hover:border-blue-200 hover:bg-blue-100"
                    : "border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed"
                }
              `}
            >
              <p className="text-[11px] font-medium">
                {row.date}
              </p>
              <p className="mt-1 text-sm font-bold">
                {row.count}
              </p>
            </button>
          ))}
        </div>
      </div>

      <TrendSidePanel
        day={selectedDay}
        onClose={closeDay}
        onViewLead={viewLead}
      />
    </>
  );
}

/* =========================
   KPI
========================= */

function TrendKpi({
  icon: Icon,
  label,
  value,
  helper,
  tone = "blue",
  onClick
}) {
  const tones = {
    blue: "border-blue-100 bg-blue-50 text-blue-700 hover:border-blue-200",
    green: "border-green-100 bg-green-50 text-green-700 hover:border-green-200",
    purple: "border-purple-100 bg-purple-50 text-purple-700 hover:border-purple-200",
    amber: "border-amber-100 bg-amber-50 text-amber-700 hover:border-amber-200"
  };

  const Component = onClick ? "button" : "div";

  return (
    <Component
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`
        rounded-2xl border p-4 text-left transition
        ${onClick ? "hover:-translate-y-0.5 hover:shadow-sm" : ""}
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

        <div className="shrink-0 rounded-xl bg-white/70 p-2 shadow-sm">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Component>
  );
}

/* =========================
   SIDE PANEL
========================= */

function TrendSidePanel({ day, onClose, onViewLead }) {
  if (!day) return null;

  const leads = Array.isArray(day.leads) ? day.leads : [];
  const totalAmount = leads.reduce((sum, lead) => sum + getLeadAmount(lead), 0);

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close lead trend details"
        onClick={onClose}
        className="absolute inset-0 bg-gray-950/30 backdrop-blur-[1px]"
      />

      <aside className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
        <div className="border-b border-gray-100 bg-gradient-to-r from-blue-50 via-white to-gray-50 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-blue-600 p-2.5 text-white shadow-sm">
                <TrendingUp className="h-5 w-5" />
              </div>

              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  {day.fullDate}
                </h2>
                <p className="mt-0.5 text-sm text-gray-500">
                  Leads created on this date.
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

          <div className="mt-4 grid grid-cols-2 gap-3">
            <TrendPanelKpi
              icon={TrendingUp}
              label="Leads"
              value={leads.length}
            />
            <TrendPanelKpi
              icon={CircleDollarSign}
              label="Value"
              value={formatCurrency(totalAmount)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {!leads.length ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
              <p className="text-sm font-medium text-gray-700">
                No leads found
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {leads.map(lead => (
                <TrendLeadCard
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

function TrendPanelKpi({ icon: Icon, label, value }) {
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

function TrendLeadCard({ lead, onViewLead }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">
            {lead.leadCode || lead.id}
          </p>

          <p className="mt-1 truncate text-sm text-gray-600">
            {getClientName(lead)}
          </p>
        </div>

        <div className="shrink-0 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
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
          value={formatDate(getLeadTrendDate(lead))}
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