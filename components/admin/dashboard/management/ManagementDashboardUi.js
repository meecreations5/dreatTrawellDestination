"use client";

import {
  Activity, AlertTriangle, ArrowRight, BarChart3, BriefcaseBusiness,
  CheckCircle2, CircleDollarSign, CreditCard, Eye, Handshake, IndianRupee,
  Layers3, LayoutDashboard, LineChart, PieChart, Target, TrendingUp, UserCheck,
  Users, Wallet, X
} from "lucide-react";
import * as dashboardHelpers from "@/lib/dashboard/managementDashboardHelpers";

const {
  getGroupedAttentionRows,
  normalize,
  readableLabel,
  formatCurrency,
  formatDateTime,
  getScoreLabel,
  getScoreClass,
  getRangeLabel,
  getActiveLeads,
  getLeadDate,
  getLeadDisplayName,
  getLeadVendorCost,
  getLeadGrossProfit,
  getLeadActualRealizedGrossProfit,
  getLeadUnrealizedGrossProfit,
  getLeadVendorPaymentBalance,
  getLeadVendorPaidAmount,
  getEngagementDate,
  getEngagementDestinationList
} = dashboardHelpers;

/* =========================
   UX COMPONENTS
========================== */

const KPI_TONES = {
  blue: {
    card: "border-blue-100 bg-blue-50/70",
    icon: "bg-blue-600 text-white",
    title: "text-blue-700",
    value: "text-blue-950",
    helper: "text-blue-600"
  },
  green: {
    card: "border-green-100 bg-green-50/70",
    icon: "bg-green-600 text-white",
    title: "text-green-700",
    value: "text-green-950",
    helper: "text-green-600"
  },
  emerald: {
    card: "border-emerald-100 bg-emerald-50/70",
    icon: "bg-emerald-600 text-white",
    title: "text-emerald-700",
    value: "text-emerald-950",
    helper: "text-emerald-600"
  },
  purple: {
    card: "border-purple-100 bg-purple-50/70",
    icon: "bg-purple-600 text-white",
    title: "text-purple-700",
    value: "text-purple-950",
    helper: "text-purple-600"
  },
  amber: {
    card: "border-amber-100 bg-amber-50/80",
    icon: "bg-amber-500 text-white",
    title: "text-amber-700",
    value: "text-amber-950",
    helper: "text-amber-700"
  },
  orange: {
    card: "border-orange-100 bg-orange-50/80",
    icon: "bg-orange-500 text-white",
    title: "text-orange-700",
    value: "text-orange-950",
    helper: "text-orange-700"
  },
  red: {
    card: "border-red-100 bg-red-50/80",
    icon: "bg-red-600 text-white",
    title: "text-red-700",
    value: "text-red-950",
    helper: "text-red-700"
  },
  slate: {
    card: "border-slate-200 bg-slate-50",
    icon: "bg-slate-700 text-white",
    title: "text-slate-600",
    value: "text-slate-950",
    helper: "text-slate-500"
  }
};

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-32 animate-pulse rounded-3xl border border-slate-200 bg-white" />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map(item => (
          <div
            key={item}
            className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white"
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {[1, 2, 3].map(item => (
          <div
            key={item}
            className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white"
          />
        ))}
      </div>
    </div>
  );
}

function ExecutiveKpiCard({
  title,
  value,
  helper,
  icon: Icon,
  tone = "slate",
  onClick
}) {
  const theme = KPI_TONES[tone] || KPI_TONES.slate;

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wide ${theme.title}`}>
            {title}
          </p>

          <p className={`mt-2 text-xl font-bold ${theme.value}`}>
            {value}
          </p>

          {helper ? (
            <p className={`mt-1 text-xs ${theme.helper}`}>
              {helper}
            </p>
          ) : null}

          {onClick ? (
            <p className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-gray-500">
              View details
              <ArrowRight className="h-3.5 w-3.5" />
            </p>
          ) : null}
        </div>

        <div className={`rounded-2xl p-2.5 ${theme.icon}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <div className="pointer-events-none absolute -right-6 -bottom-6 h-20 w-20 rounded-full bg-white/40" />
    </>
  );

  const className = `
    relative overflow-hidden rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-md
    ${theme.card}
    ${onClick ? "cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-blue-500/20" : ""}
  `;

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}

function DashboardGraphCard({
  title,
  description,
  icon: Icon,
  tone = "slate",
  children
}) {
  const theme = KPI_TONES[tone] || KPI_TONES.slate;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 ">
      <div className="flex items-start gap-3">
        <div className={`rounded-2xl p-2.5 ${theme.icon}`}>
          <Icon className="h-5 w-5" />
        </div>

        <div>
          <h2 className="text-sm font-semibold text-gray-900">
            {title}
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">
            {description}
          </p>
        </div>
      </div>

      <div className="mt-5">
        {children}
      </div>
    </div>
  );
}

function MiniColumnGraph({ rows = [] }) {
  const max = Math.max(...rows.map(row => Number(row.value || 0)), 1);

  return (
    <div className="flex items-end gap-3 h-44">
      {rows.map(row => {
        const theme = KPI_TONES[row.tone] || KPI_TONES.slate;
        const height = `${Math.max((Number(row.value || 0) / max) * 100, 8)}%`;

        return (
          <div key={row.label} className="flex-1 h-full flex flex-col justify-end">
            <div className="flex-1 flex items-end">
              <div
                className={`
                  w-full rounded-t-2xl transition-all
                  ${theme.icon}
                `}
                style={{ height }}
              />
            </div>

            <div className="mt-2 text-center">
              <p className="text-[11px] font-medium text-gray-500 truncate">
                {row.label}
              </p>
              <p className="text-xs font-semibold text-gray-900 truncate">
                {row.display}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SectionHeader({ icon: Icon, title, description }) {
  return (
    <div className="flex items-start gap-3">
      <div className="rounded-2xl border border-gray-200 bg-white p-2.5 text-gray-700 ">
        <Icon className="h-5 w-5" />
      </div>

      <div>
        <h2 className="text-base font-semibold text-gray-900">
          {title}
        </h2>
        <p className="mt-0.5 text-sm text-gray-500">
          {description}
        </p>
      </div>
    </div>
  );
}

function BusinessPulseCard({
  range,
  financeTotals,
  leadTotals,
  vendorTotals,
  attentionSummary,
  onOpenDetail
}) {
  return (
    <section className="rounded-3xl border border-gray-200 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 p-5 text-white ">
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-gray-200">
            <Activity className="h-3.5 w-3.5" />
            {getRangeLabel(range)} Snapshot
          </div>

          <h2 className="mt-3 text-2xl font-semibold">
            Business Pulse
          </h2>

          <p className="mt-1 max-w-2xl text-sm text-gray-300">
            Quick view of revenue, collection, vendor exposure, team pipeline and management attention.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <PulseMetric
            icon={LineChart}
            label="Active Leads"
            value={leadTotals.activeLeads}
            onClick={() => onOpenDetail?.("activeLeads")}
          />

          <PulseMetric
            icon={CircleDollarSign}
            label="Quotation"
            value={formatCurrency(financeTotals.quotationValue)}
            onClick={() => onOpenDetail?.("quotationValue")}
          />

          <PulseMetric
            icon={Wallet}
            label="Cash Position"
            value={formatCurrency(financeTotals.cashInHand)}
            danger={financeTotals.cashInHand < 0}
            onClick={() => onOpenDetail?.("customerReceived")}
          />

          <PulseMetric
            icon={AlertTriangle}
            label="Attention"
            value={attentionSummary.total}
            danger={attentionSummary.total > 0}
            onClick={() => onOpenDetail?.("attentionItems")}
          />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
        <PulseInfo
          icon={TrendingUp}
          label="Actual Realized GP"
          value={formatCurrency(financeTotals.realizedGrossProfit)}
          helper={`${formatCurrency(financeTotals.unrealizedGrossProfit)} not realized`}
          onClick={() => onOpenDetail?.("grossProfit")}
        />

        <PulseInfo
          icon={Handshake}
          label="Vendor Exposure"
          value={formatCurrency(financeTotals.vendorBalance)}
          helper={`${vendorTotals.pendingQuoteLeads} pending vendor quotes`}
          warning={financeTotals.vendorBalance > 0 || vendorTotals.pendingQuoteLeads > 0}
          onClick={() => onOpenDetail?.("vendorBalance")}
        />

        <PulseInfo
          icon={CheckCircle2}
          label="Converted Leads"
          value={leadTotals.wonLeads}
          helper={`${financeTotals.customerFullyPaid} customer fully paid`}
          onClick={() => onOpenDetail?.("convertedLeads")}
        />
      </div>
    </section>
  );
}

function PulseMetric({ icon: Icon, label, value, danger = false, onClick }) {
  const content = (
    <>
      <div className="flex items-center gap-2 text-gray-300">
        <Icon className="h-4 w-4" />
        <p className="text-xs">{label}</p>
      </div>

      <p className={`mt-2 text-lg font-semibold ${danger ? "text-red-300" : "text-white"}`}>
        {value}
      </p>
    </>
  );

  const className = `
    rounded-2xl bg-white/10 px-4 py-3 backdrop-blur transition
    ${onClick ? "cursor-pointer text-left hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/20" : ""}
  `;

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}

function PulseInfo({ icon: Icon, label, value, helper, warning = false, onClick }) {
  const content = (
    <>
      <div className="flex items-center gap-2 text-gray-300">
        <Icon className="h-4 w-4" />
        <span className="text-xs">{label}</span>
      </div>

      <p className="mt-2 text-lg font-semibold text-white">
        {value}
      </p>

      <p className={`mt-1 text-xs ${warning ? "text-amber-300" : "text-gray-300"}`}>
        {helper}
      </p>
    </>
  );

  const className = `
    rounded-2xl border border-white/10 bg-white/5 p-4 transition
    ${onClick ? "cursor-pointer text-left hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/20" : ""}
  `;

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}

function FinanceFlowCard({ financeTotals }) {
  const items = [
    {
      label: "Quotation",
      value: formatCurrency(financeTotals.quotationValue),
      icon: LineChart
    },
    {
      label: "Received",
      value: formatCurrency(financeTotals.receivedAmount),
      icon: Wallet
    },
    {
      label: "Vendor Paid",
      value: formatCurrency(financeTotals.vendorPaid),
      icon: Handshake
    },
    {
      label: "Cash Position",
      value: formatCurrency(financeTotals.cashInHand),
      icon: CircleDollarSign
    },
    {
      label: "Gross Profit",
      value: formatCurrency(financeTotals.grossProfit),
      icon: TrendingUp
    }
  ];

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 ">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-purple-50 p-2.5 text-purple-700">
            <CircleDollarSign className="h-5 w-5" />
          </div>

          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              Finance Flow
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Quote to collection to vendor payout and final profit.
            </p>
          </div>
        </div>

        <span className="w-fit rounded-full bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700">
          Margin {financeTotals.marginPercent}%
        </span>
      </div>

      <div className="mt-5 grid grid-cols-1 md:grid-cols-5 gap-3">
        {items.map((item, index) => {
          const ItemIcon = item.icon;

          return (
            <div key={item.label} className="relative rounded-xl bg-gray-50 p-4">
              <div className="flex items-center gap-2 text-gray-500">
                <ItemIcon className="h-4 w-4" />
                <p className="text-xs">{item.label}</p>
              </div>

              <p className="mt-2 text-base font-semibold text-gray-900">
                {item.value}
              </p>

              {index < items.length - 1 && (
                <span className="hidden md:flex absolute -right-2 top-1/2 -translate-y-1/2 h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400">
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InsightCards({ financeTotals, attentionSummary }) {
  const bestDestination = financeTotals.byDestinationRevenue?.[0];
  const bestAgent = financeTotals.byAgentRevenue?.[0];
  const biggestRisk = attentionSummary.byType?.[0];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <InsightCard
        icon={Target}
        label="Best Destination"
        title={bestDestination?.name || "No destination yet"}
        value={bestDestination?.displayCount || "—"}
      />

      <InsightCard
        icon={BriefcaseBusiness}
        label="Best Travel Agent"
        title={bestAgent?.name || "No agent yet"}
        value={bestAgent?.displayCount || "—"}
      />

      <InsightCard
        icon={AlertTriangle}
        label="Biggest Risk"
        title={biggestRisk ? readableLabel(biggestRisk.name) : "No risk found"}
        value={biggestRisk ? `${biggestRisk.count} items` : "Clear"}
        danger={Boolean(biggestRisk)}
      />
    </div>
  );
}

function InsightCard({ icon: Icon, label, title, value, danger = false }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 ">
      <div className="flex items-center gap-2 text-gray-400">
        <Icon className="h-4 w-4" />
        <p className="text-xs font-medium uppercase tracking-wide">
          {label}
        </p>
      </div>

      <p className="mt-3 text-sm font-semibold text-gray-900">
        {readableLabel(title)}
      </p>

      <p className={`mt-1 text-lg font-semibold ${danger ? "text-red-600" : "text-gray-900"}`}>
        {value}
      </p>
    </div>
  );
}

function ChartShell({
  title,
  description,
  icon: Icon,
  tone = "slate",
  children,
  rightContent = null,
  noPadding = false,
  className = ""
}) {
  const theme = KPI_TONES[tone] || KPI_TONES.slate;

  return (
    <section
      className={`
        group overflow-hidden rounded-2xl border border-gray-200 bg-white
        shadow-sm transition-all duration-200
        hover:border-gray-300 hover:shadow-md
        ${className}
      `}
    >
      <div className="border-b border-gray-100 bg-gradient-to-r from-gray-50 via-white to-gray-50 px-4 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            {Icon ? (
              <div
                className={`
                  flex h-10 w-10 shrink-0 items-center justify-center
                  rounded-2xl shadow-sm ring-1 ring-black/5
                  transition-transform duration-200 group-hover:scale-105
                  ${theme.icon}
                `}
              >
                <Icon className="h-4.5 w-4.5" />
              </div>
            ) : null}

            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-gray-950">
                {title}
              </h2>

              {description ? (
                <p className="mt-1 max-w-2xl text-xs leading-5 text-gray-500">
                  {description}
                </p>
              ) : null}
            </div>
          </div>

          {rightContent ? (
            <div className="flex shrink-0 items-center justify-end">
              {rightContent}
            </div>
          ) : null}
        </div>
      </div>

      <div
        className={`
          bg-white
          ${noPadding ? "" : "p-4 sm:p-5"}
        `}
      >
        {children}
      </div>
    </section>
  );
}

/* =========================
   MINI BAR LIST
========================== */

function MiniBarList({
  title,
  rows,
  icon: Icon = BarChart3,
  tone = "slate",
  preserveLabel = false
}) {
  const max = rows?.length ? Math.max(...rows.map(row => row.count)) : 0;
  const theme = KPI_TONES[tone] || KPI_TONES.slate;

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
      <div className="flex items-center gap-2">
        <div className={`rounded-xl p-2 ${theme.icon}`}>
          <Icon className="h-4 w-4" />
        </div>

        <h2 className="text-sm font-semibold text-gray-900">
          {title}
        </h2>
      </div>

      {!rows?.length ? (
        <p className="text-sm text-gray-500 mt-4">
          No data found.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {rows.slice(0, 8).map(row => {
            const width = max
              ? `${Math.max((row.count / max) * 100, 8)}%`
              : "0%";

            return (
              <div key={row.name}>
                <div className="flex items-start justify-between gap-3 mb-1">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">
                      {preserveLabel ? row.name : readableLabel(row.name)}
                    </p>

                    {row.subLabel ? (
                      <p className="mt-0.5 text-[11px] text-gray-400 truncate">
                        {row.subLabel}
                      </p>
                    ) : null}
                  </div>

                  <p className="text-sm font-semibold text-gray-900 shrink-0">
                    {row.displayCount || row.count}
                  </p>
                </div>

                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${theme.icon}`}
                    style={{ width }}
                  />
                </div>
              </div>
            );
          })}

          {rows.length > 8 && (
            <p className="text-xs text-gray-400">
              Showing top 8 of {rows.length}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* =========================
   ATTENTION PANEL
========================== */

function getSeverityClass(severity) {
  if (severity === "critical") {
    return "bg-red-50 text-red-700 border-red-100";
  }

  if (severity === "high") {
    return "bg-orange-50 text-orange-700 border-orange-100";
  }

  if (severity === "medium") {
    return "bg-yellow-50 text-yellow-700 border-yellow-100";
  }

  return "bg-gray-50 text-gray-700 border-gray-100";
}

function AttentionRequiredPanel({ rows, compact = false, onViewLead }) {
  const groupedRows = getGroupedAttentionRows(rows);
  const visibleRows = groupedRows.slice(0, compact ? 8 : 50);

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-start gap-3">
        <div className="rounded-xl bg-red-50 p-2 text-red-600">
          <AlertTriangle className="h-4 w-4" />
        </div>

        <div>
          <h2 className="text-sm font-semibold text-gray-900">
            Attention Required
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Unique leads that need management or operations action.
          </p>
        </div>
      </div>

      {!visibleRows.length ? (
        <div className="px-4 py-8 text-center text-sm text-gray-500">
          No attention items found.
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {visibleRows.map(item => (
            <div
              key={item.leadId || item.leadCode}
              className="px-4 py-4 flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-sm text-gray-900">
                    {item.leadCode}
                  </p>

                  <span
                    className={`
                      inline-flex items-center px-2 py-0.5 rounded-full text-xs border
                      ${getSeverityClass(item.highestSeverity)}
                    `}
                  >
                    Highest {readableLabel(item.highestSeverity)}
                  </span>

                  <span className="text-xs text-gray-500">
                    {item.issues.length} attention item
                    {item.issues.length > 1 ? "s" : ""}
                  </span>
                </div>

                <p className="text-xs text-gray-500 mt-1">
                  {item.customerName} • {item.destinationName} • Assigned:{" "}
                  {item.assignedToName}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {item.issues.map((issue, index) => (
                    <div
                      key={`${item.leadCode}-${issue.type}-${index}`}
                      className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`
                            inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border
                            ${getSeverityClass(issue.severity)}
                          `}
                        >
                          {readableLabel(issue.severity)}
                        </span>

                        <span className="text-xs font-medium text-gray-700">
                          {readableLabel(issue.type)}
                        </span>
                      </div>

                      <p className="mt-1 text-xs text-gray-500">
                        {issue.reason}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-left xl:text-right shrink-0 space-y-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {formatCurrency(item.amount)}
                  </p>
                  <p className="text-xs text-gray-500">
                    Last: {formatDateTime(item.lastActivityAt)}
                  </p>
                </div>

                {onViewLead && (
                  <button
                    type="button"
                    onClick={() => onViewLead(item.leadId)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    View Lead
                  </button>
                )}
              </div>
            </div>
          ))}

          {groupedRows.length > visibleRows.length && (
            <div className="px-4 py-3 text-xs text-gray-400">
              Showing {visibleRows.length} of {groupedRows.length} attention leads
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* =========================
   TABLES
========================== */

function ManagementOverviewTable({ rows, onOpenMetric }) {
  return (
    <DashboardTable
      icon={Users}
      title="Team Member Management Overview"
      description="Lead ownership, revenue and travel-agent engagement performance in one view."
      headers={[
        "Team Member",
        "Leads",
        "Won",
        "Quotation",
        "GP",
        "Engagements",
        "First Calls",
        "Last Activity",
        "Status"
      ]}
      emptyText="No management data found."
      colSpan={9}
    >
      {rows.map(row => (
        <tr key={row.uid || row.email || row.name} className="hover:bg-gray-50">
          <td className="px-4 py-3 text-left">
            <div className="font-medium text-gray-900">{row.name}</div>
            <div className="text-xs text-gray-500">
              {row.department || row.email || "—"}
            </div>
          </td>

          <td className="px-4 py-3 text-right">
            <ClickableTableMetric
              value={row.newLeads}
              onClick={() => onOpenMetric?.(row, "newLeads")}
            />
          </td>

          <td className="px-4 py-3 text-right">
            <ClickableTableMetric
              value={row.wonLeads}
              tone="green"
              onClick={() => onOpenMetric?.(row, "wonLeads")}
            />
          </td>

          <td className="px-4 py-3 text-right">
            <ClickableTableMetric
              value={row.quotationValue}
              display={formatCurrency(row.quotationValue)}
              tone="purple"
              onClick={() => onOpenMetric?.(row, "quotationValue")}
            />
          </td>

          <td className="px-4 py-3 text-right">
            <ClickableTableMetric
              value={row.grossProfit}
              display={formatCurrency(row.grossProfit)}
              tone="emerald"
              onClick={() => onOpenMetric?.(row, "grossProfit")}
            />
          </td>

          <td className="px-4 py-3 text-right">
            <ClickableTableMetric
              value={row.engagements}
              tone="blue"
              onClick={() => onOpenMetric?.(row, "engagements")}
            />
          </td>

          <td className="px-4 py-3 text-right">
            <ClickableTableMetric
              value={row.firstCalls}
              tone="green"
              onClick={() => onOpenMetric?.(row, "newAgentCalls")}
            />
          </td>

          <td className="px-4 py-3 text-right text-gray-600">
            {formatDateTime(row.lastActivityAt)}
          </td>

          <td className="px-4 py-3 text-right">
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs border ${getScoreClass(row.score)}`}>
              {getScoreLabel(row.score)}
            </span>
          </td>
        </tr>
      ))}
    </DashboardTable>
  );
}

function ManagementFinanceTable({ rows, onOpenMetric }) {
  return (
    <DashboardTable
      icon={CircleDollarSign}
      title="Team Finance Overview"
      description="Revenue, collection, vendor payout and gross profit by team member."
      headers={[
        "Team Member",
        "Quotation Value",
        "Customer Received",
        "Vendor Paid",
        "Gross Profit",
        "Won Leads",
        "Score"
      ]}
      emptyText="No finance data found."
      colSpan={7}
    >
      {rows.map(row => (
        <tr key={row.uid || row.email || row.name} className="hover:bg-gray-50">
          <td className="px-4 py-3 text-left">
            <div className="font-medium text-gray-900">{row.name}</div>
            <div className="text-xs text-gray-500">{row.email || "—"}</div>
          </td>

          <td className="px-4 py-3 text-right">
            <ClickableTableMetric
              value={row.quotationValue}
              display={formatCurrency(row.quotationValue)}
              tone="purple"
              onClick={() => onOpenMetric?.(row, "quotationValue")}
            />
          </td>

          <td className="px-4 py-3 text-right">
            <ClickableTableMetric
              value={row.receivedAmount}
              display={formatCurrency(row.receivedAmount)}
              tone="green"
              onClick={() => onOpenMetric?.(row, "receivedAmount")}
            />
          </td>

          <td className="px-4 py-3 text-right">
            <ClickableTableMetric
              value={row.vendorPaid}
              display={formatCurrency(row.vendorPaid)}
              tone="blue"
              onClick={() => onOpenMetric?.(row, "vendorPaid")}
            />
          </td>

          <td className="px-4 py-3 text-right">
            <ClickableTableMetric
              value={row.grossProfit}
              display={formatCurrency(row.grossProfit)}
              tone="emerald"
              onClick={() => onOpenMetric?.(row, "grossProfit")}
            />
          </td>

          <td className="px-4 py-3 text-right">
            <ClickableTableMetric
              value={row.wonLeads}
              tone="green"
              onClick={() => onOpenMetric?.(row, "wonLeads")}
            />
          </td>

          <td className="px-4 py-3 text-right font-semibold">
            {row.score}
          </td>
        </tr>
      ))}
    </DashboardTable>
  );
}

function ManagementVendorTable({ rows, onOpenLeadMetric }) {
  const activeRows = getActiveLeads(rows);

  return (
    <DashboardTable
      icon={Handshake}
      title="Vendor Operations Overview"
      description="Vendor request, quote and payment status by active lead."
      headers={[
        "Lead",
        "Destination",
        "Vendor",
        "Requests",
        "Quotes",
        "Vendor Cost",
        "Vendor Paid",
        "Balance",
        "Status"
      ]}
      emptyText="No vendor data found."
      colSpan={9}
    >
      {activeRows.map(row => (
        <tr key={row.id} className="hover:bg-gray-50">
          <td className="px-4 py-3 text-left">
            <div className="font-medium text-gray-900">
              {row.leadCode || row.id}
            </div>
            <div className="text-xs text-gray-500">
              {row.agentName || row.agencyName || "—"}
            </div>
          </td>

          <td className="px-4 py-3 text-right text-gray-600">
            {row.destinationName || "—"}
          </td>

          <td className="px-4 py-3 text-right text-gray-600">
            {row.latestVendorName || row.latestSelectedVendorName || "—"}
          </td>

          <td className="px-4 py-3 text-right">
            <ClickableTableMetric
              value={Number(row.vendorRequestCount || 0)}
              tone="blue"
              onClick={() => onOpenLeadMetric?.(row, "vendorRequests")}
            />
          </td>

          <td className="px-4 py-3 text-right">
            <ClickableTableMetric
              value={Number(row.vendorQuoteCount || 0)}
              tone="green"
              onClick={() => onOpenLeadMetric?.(row, "vendorQuotes")}
            />
          </td>

          <td className="px-4 py-3 text-right">
            <ClickableTableMetric
              value={getLeadVendorCost(row)}
              display={formatCurrency(getLeadVendorCost(row))}
              tone="purple"
              onClick={() => onOpenLeadMetric?.(row, "vendorCost")}
            />
          </td>

          <td className="px-4 py-3 text-right">
            <ClickableTableMetric
              value={getLeadVendorPaidAmount(row)}
              display={formatCurrency(getLeadVendorPaidAmount(row))}
              tone="green"
              onClick={() => onOpenLeadMetric?.(row, "vendorPaid")}
            />
          </td>

          <td className="px-4 py-3 text-right">
            <ClickableTableMetric
              value={getLeadVendorPaymentBalance(row)}
              display={formatCurrency(getLeadVendorPaymentBalance(row))}
              tone="amber"
              onClick={() => onOpenLeadMetric?.(row, "vendorBalance")}
            />
          </td>

          <td className="px-4 py-3 text-right text-gray-600">
            {readableLabel(
              row.latestVendorQuoteStatus ||
              row.latestVendorRequestStatus ||
              "Pending"
            )}
          </td>
        </tr>
      ))}
    </DashboardTable>
  );
}

function ManagementLeadsTable({ rows, onOpenMetric }) {
  return (
    <DashboardTable
      icon={LineChart}
      title="Lead Ownership & Workload"
      description="Owner is permanent creator credit. Assignee is the current person responsible for working the lead."
      headers={[
        "Team Member",
        "Owned Leads",
        "Assigned Workload",
        "Assigned Active",
        "Active Owned",
        "Quote Sent",
        "Won Owned",
        "Lost Owned"
      ]}
      emptyText="No lead data found."
      colSpan={8}
    >
      {rows.map(row => (
        <tr key={row.uid || row.email || row.name} className="hover:bg-gray-50">
          <td className="px-4 py-3 text-left">
            <div className="font-medium text-gray-900">{row.name}</div>
            <div className="text-xs text-gray-500">{row.email || "—"}</div>
          </td>
          <td className="px-4 py-3 text-right"><ClickableTableMetric value={row.ownedLeads} tone="blue" onClick={() => onOpenMetric?.(row, "newLeads")} /></td>
          <td className="px-4 py-3 text-right"><ClickableTableMetric value={row.assignedLeads} tone="purple" onClick={() => onOpenMetric?.(row, "assignedLeads")} /></td>
          <td className="px-4 py-3 text-right"><ClickableTableMetric value={row.assignedActiveLeads} tone="amber" onClick={() => onOpenMetric?.(row, "assignedActiveLeads")} /></td>
          <td className="px-4 py-3 text-right"><ClickableTableMetric value={row.activeLeads} onClick={() => onOpenMetric?.(row, "activeLeads")} /></td>
          <td className="px-4 py-3 text-right"><ClickableTableMetric value={row.quoteSentLeads} tone="purple" onClick={() => onOpenMetric?.(row, "quoteSentLeads")} /></td>
          <td className="px-4 py-3 text-right"><ClickableTableMetric value={row.wonLeads} tone="green" onClick={() => onOpenMetric?.(row, "wonLeads")} /></td>
          <td className="px-4 py-3 text-right"><ClickableTableMetric value={row.lostLeads} tone="red" onClick={() => onOpenMetric?.(row, "lostLeads")} /></td>
        </tr>
      ))}
    </DashboardTable>
  );
}

function ManagementEngagementTable({ rows, onOpenMetric }) {
  return (
    <div className="space-y-6">
      <DashboardTable
        icon={Users}
        title="New Agent Acquisition"
        description="Acquisition credit stays with the team member who created the travel-agent record. Contact coverage is measured separately from who made the call."
        headers={[
          "Team Member",
          "New Agents",
          "Called",
          "Pending First Call",
          "Contact Rate",
          "Invalid No.",
          "Business Shut"
        ]}
        emptyText="No new-agent acquisition data found."
        colSpan={7}
      >
        {rows
          .filter(row => row.newAgentsAdded > 0)
          .map(row => (
            <tr key={row.uid || row.email || row.name} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-left">
                <div className="font-medium text-gray-900">{row.name}</div>
                <div className="text-xs text-gray-500">{row.email || "—"}</div>
              </td>
              <td className="px-4 py-3 text-right font-semibold text-blue-700">{row.newAgentsAdded}</td>
              <td className="px-4 py-3 text-right font-semibold text-green-700">{row.newAgentsCalled}</td>
              <td className="px-4 py-3 text-right font-semibold text-amber-700">{row.pendingFirstCalls}</td>
              <td className="px-4 py-3 text-right">{row.acquisitionContactRate}%</td>
              <td className="px-4 py-3 text-right text-red-700">{row.acquisitionInvalidNumber}</td>
              <td className="px-4 py-3 text-right text-amber-700">{row.acquisitionBusinessShutDown}</td>
            </tr>
          ))}
      </DashboardTable>

      <DashboardTable
        icon={Activity}
        title="Team Calling & Engagement"
        description="Activity credit follows the person who performed it. First Call is counted once per new agent; repeat calls stay in Follow-up / Other Calls."
        headers={[
          "Team Member",
          "First Calls",
          "Other / Follow-up Calls",
          "Total Calls",
          "Unique Agents Called",
          "WhatsApp",
          "Meetings",
          "Total Touches",
          "Last Activity"
        ]}
        emptyText="No engagement data found."
        colSpan={9}
      >
        {rows
          .filter(row => row.engagements > 0)
          .map(row => (
            <tr key={row.uid || row.email || row.name} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-left">
                <div className="font-medium text-gray-900">{row.name}</div>
                <div className="text-xs text-gray-500">{row.email || "—"}</div>
              </td>
              <td className="px-4 py-3 text-right"><ClickableTableMetric value={row.firstCalls} tone="green" onClick={() => onOpenMetric?.(row, "newAgentCalls")} /></td>
              <td className="px-4 py-3 text-right">{row.followUpCalls}</td>
              <td className="px-4 py-3 text-right"><ClickableTableMetric value={row.calls} tone="blue" onClick={() => onOpenMetric?.(row, "calls")} /></td>
              <td className="px-4 py-3 text-right font-medium">{row.uniqueAgentsCalled}</td>
              <td className="px-4 py-3 text-right">{row.whatsapp}</td>
              <td className="px-4 py-3 text-right">{row.meetings}</td>
              <td className="px-4 py-3 text-right"><ClickableTableMetric value={row.engagements} tone="purple" onClick={() => onOpenMetric?.(row, "engagements")} /></td>
              <td className="px-4 py-3 text-right text-gray-600">{formatDateTime(row.lastActivityAt)}</td>
            </tr>
          ))}
      </DashboardTable>
    </div>
  );
}

function ManagementTeamTable({ rows }) {
  return (
    <DashboardTable
      icon={Users}
      title="Team Commercial Activity"
      description="Creator ownership, current assigned workload, conversions and agent engagement are kept distinct."
      headers={[
        "Team Member",
        "New Agents",
        "First Calls",
        "Owned Leads",
        "Assigned",
        "Won",
        "Gross Profit",
        "Engagements",
        "Score",
        "Rating"
      ]}
      emptyText="No team data found."
      colSpan={10}
    >
      {rows.map(row => (
        <tr key={row.uid || row.email || row.name} className="hover:bg-gray-50">
          <td className="px-4 py-3 text-left">
            <div className="font-medium text-gray-900">{row.name}</div>
            <div className="text-xs text-gray-500">{row.department || row.email || "—"}</div>
          </td>
          <td className="px-4 py-3 text-right">{row.newAgentsAdded}</td>
          <td className="px-4 py-3 text-right font-medium text-green-700">{row.firstCalls}</td>
          <td className="px-4 py-3 text-right">{row.ownedLeads}</td>
          <td className="px-4 py-3 text-right">{row.assignedLeads}</td>
          <td className="px-4 py-3 text-right font-medium text-green-700">{row.wonLeads}</td>
          <td className="px-4 py-3 text-right font-medium">{formatCurrency(row.grossProfit)}</td>
          <td className="px-4 py-3 text-right">{row.engagements}</td>
          <td className="px-4 py-3 text-right font-semibold">{row.score}</td>
          <td className="px-4 py-3 text-right"><span className={`inline-flex items-center px-2 py-1 rounded-full text-xs border ${getScoreClass(row.score)}`}>{getScoreLabel(row.score)}</span></td>
        </tr>
      ))}
    </DashboardTable>
  );
}

function DashboardTable({
  icon: Icon = BarChart3,
  title,
  description,
  headers,
  children,
  emptyText,
  colSpan
}) {
  const hasRows = Array.isArray(children)
    ? children.length > 0
    : Boolean(children);

  return (
    <div className="bg-white border border-gray-200 rounded-xl  overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-start gap-3">
        <div className="rounded-xl bg-gray-50 p-2 text-gray-600">
          <Icon className="h-4 w-4" />
        </div>

        <div>
          <h2 className="text-sm font-semibold text-gray-900">
            {title}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {description}
          </p>
        </div>
      </div>

      <div className="max-h-[560px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-gray-50 text-xs text-gray-500">
            <tr>
              {headers.map((header, index) => (
                <th
                  key={header}
                  className={`
                    px-4 py-3 font-medium
                    ${index === 0 ? "text-left" : "text-right"}
                  `}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {hasRows ? (
              children
            ) : (
              <tr>
                <td
                  colSpan={colSpan}
                  className="px-4 py-8 text-center text-sm text-gray-500"
                >
                  {emptyText}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DrawerSummaryCard({ label, value, tone = "slate" }) {
  const toneMap = {
    emerald: "bg-emerald-50 text-emerald-800",
    green: "bg-green-50 text-green-800",
    amber: "bg-amber-50 text-amber-800",
    red: "bg-red-50 text-red-800",
    slate: "bg-gray-50 text-gray-900"
  };

  return (
    <div className={`rounded-2xl p-3 ${toneMap[tone] || toneMap.slate}`}>
      <p className="text-xs font-medium opacity-80">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold">
        {value}
      </p>
    </div>
  );
}

function isSameDashboardMember(member = {}, person = {}) {
  const memberUid = normalize(member.uid);
  const personUid = normalize(person.uid);

  if (memberUid && personUid && memberUid === personUid) return true;

  const memberEmail = normalize(member.email);
  const personEmail = normalize(person.email);

  if (memberEmail && personEmail && memberEmail === personEmail) return true;

  const memberName = normalize(member.name);
  const personName = normalize(person.name);

  if (memberName && personName && memberName === personName) return true;

  return false;
}

function ClickableTableMetric({
  value,
  display,
  onClick,
  tone = "blue",
  disabled = false
}) {
  const text = display ?? value ?? 0;
  const isDisabled = disabled || Number(value || 0) === 0;

  if (isDisabled) {
    return (
      <span className="font-medium text-gray-400">
        {text}
      </span>
    );
  }

  const toneMap = {
    blue: "text-blue-700 hover:bg-blue-50",
    green: "text-green-700 hover:bg-green-50",
    red: "text-red-700 hover:bg-red-50",
    amber: "text-amber-700 hover:bg-amber-50",
    purple: "text-purple-700 hover:bg-purple-50",
    emerald: "text-emerald-700 hover:bg-emerald-50",
    slate: "text-gray-700 hover:bg-gray-50"
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        inline-flex min-w-8 justify-end rounded-lg px-2 py-1 text-sm font-semibold transition
        ${toneMap[tone] || toneMap.blue}
      `}
    >
      {text}
    </button>
  );
}

function DashboardDetailDrawer({ panel, onClose, onViewLead }) {
  if (!panel) return null;

  const rows = Array.isArray(panel.rows) ? panel.rows : [];

  const totalAmount =
    panel.type === "lead" && panel.amountGetter
      ? rows.reduce((sum, lead) => {
        return sum + Number(panel.amountGetter(lead) || 0);
      }, 0)
      : 0;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close drawer backdrop"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/30 backdrop-blur-[1px]"
      />

      <aside className="absolute right-0 top-0 h-full w-full max-w-xl overflow-hidden bg-white shadow-2xl">
        <div className="flex h-full flex-col">
          <div className="border-b border-gray-100 px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  {panel.title}
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  {panel.description}
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-gray-200 p-2 text-gray-500 hover:bg-gray-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DrawerSummaryCard
                label="Total Records"
                value={rows.length}
              />

              {panel.summaryCards?.length ? (
                panel.summaryCards.map(card => (
                  <DrawerSummaryCard
                    key={card.label}
                    label={card.label}
                    value={card.value}
                    tone={card.tone}
                  />
                ))
              ) : panel.type === "lead" && panel.amountGetter ? (
                <DrawerSummaryCard
                  label={`Total ${panel.amountLabel || "Value"}`}
                  value={formatCurrency(totalAmount)}
                  tone="emerald"
                />
              ) : (
                <DrawerSummaryCard
                  label="Attention View"
                  value={rows.length}
                  tone="red"
                />
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {!rows.length ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
                <p className="text-sm font-semibold text-gray-800">
                  No records found
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  No matching data is available for the selected range.
                </p>
              </div>
            ) : panel.type === "attention" ? (
              <div className="space-y-3">
                {rows.map((item, index) => (
                  <div
                    key={item.id || `${item.leadId}-${item.type}-${index}`}
                    className="rounded-2xl border border-gray-200 bg-white p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900">
                          {item.leadCode}
                        </p>

                        <p className="mt-1 text-xs text-gray-500">
                          {item.customerName} • {item.destinationName}
                        </p>
                      </div>

                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getSeverityClass(item.severity)}`}
                      >
                        {readableLabel(item.severity)}
                      </span>
                    </div>

                    <p className="mt-3 text-sm font-medium text-gray-800">
                      {readableLabel(item.type)}
                    </p>

                    <p className="mt-1 text-xs leading-5 text-gray-500">
                      {item.reason}
                    </p>

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-gray-900">
                        {formatCurrency(item.amount)}
                      </p>

                      {item.leadId ? (
                        <button
                          type="button"
                          onClick={() => onViewLead?.(item.leadId)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View Lead
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : panel.type === "engagement" ? (
              <div className="space-y-3">
                {rows.map((item, index) => {
                  const destinations = getEngagementDestinationList(item);

                  return (
                    <div
                      key={item.id || `engagement-${index}`}
                      className="rounded-2xl border border-gray-200 bg-white p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900">
                            {readableLabel(item.channel || "Engagement")}
                          </p>

                          <p className="mt-1 text-xs text-gray-500">
                            {item.agentName ||
                              item.agencyName ||
                              item.customerName ||
                              "Unknown Agent"}{" "}
                            • {destinations.length ? destinations.join(", ") : "No Destination"}
                          </p>
                        </div>

                        <span className="rounded-full bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600">
                          {readableLabel(item.status || "Open")}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-gray-50 p-3">
                          <p className="text-[11px] font-medium text-gray-500">
                            Channel
                          </p>
                          <p className="mt-1 truncate text-xs font-semibold text-gray-800">
                            {readableLabel(item.channel || "Unknown")}
                          </p>
                        </div>

                        <div className="rounded-xl bg-gray-50 p-3">
                          <p className="text-[11px] font-medium text-gray-500">
                            Date
                          </p>
                          <p className="mt-1 text-xs font-semibold text-gray-800">
                            {formatDateTime(getEngagementDate(item))}
                          </p>
                        </div>
                      </div>

                      {item.subject || item.notes || item.remark || item.description ? (
                        <p className="mt-3 text-xs leading-5 text-gray-500">
                          {item.subject || item.notes || item.remark || item.description}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-3">
                {rows.map(lead => {
                  const amount = panel.amountGetter
                    ? Number(panel.amountGetter(lead) || 0)
                    : 0;

                  const formattedAmount = panel.amountFormatter
                    ? panel.amountFormatter(amount, lead)
                    : formatCurrency(amount);

                  const dateValue = panel.dateGetter
                    ? panel.dateGetter(lead)
                    : getLeadDate(lead);

                  return (
                    <div
                      key={lead.id || lead.leadCode}
                      className="rounded-2xl border border-gray-200 bg-white p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900">
                            {getLeadDisplayName(lead)}
                          </p>

                          <p className="mt-1 text-xs text-gray-500">
                            {lead.customerName ||
                              lead.agentName ||
                              lead.agencyName ||
                              "Unknown Client"}{" "}
                            • {lead.destinationName || "Unknown Destination"}
                          </p>
                        </div>

                        <span className="rounded-full bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600">
                          {readableLabel(lead.stage || lead.status || "Open")}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-gray-50 p-3">
                          <p className="text-[11px] font-medium text-gray-500">
                            Assigned To
                          </p>
                          <p className="mt-1 truncate text-xs font-semibold text-gray-800">
                            {lead.assignedToName ||
                              lead.assignedToEmail ||
                              "Unassigned"}
                          </p>
                        </div>

                        <div className="rounded-xl bg-gray-50 p-3">
                          <p className="text-[11px] font-medium text-gray-500">
                            Date
                          </p>
                          <p className="mt-1 text-xs font-semibold text-gray-800">
                            {formatDateTime(dateValue)}
                          </p>
                        </div>
                      </div>

                      {panel.showGrossProfitBreakdown ? (
                        <div className="mt-4 grid grid-cols-3 gap-2">
                          <div className="rounded-xl bg-emerald-50 p-3">
                            <p className="text-[11px] font-medium text-emerald-700">
                              Total GP
                            </p>
                            <p className="mt-1 text-xs font-semibold text-emerald-900">
                              {formatCurrency(getLeadGrossProfit(lead))}
                            </p>
                          </div>

                          <div className="rounded-xl bg-green-50 p-3">
                            <p className="text-[11px] font-medium text-green-700">
                              Realized
                            </p>
                            <p className="mt-1 text-xs font-semibold text-green-900">
                              {formatCurrency(getLeadActualRealizedGrossProfit(lead))}
                            </p>
                          </div>

                          <div className="rounded-xl bg-amber-50 p-3">
                            <p className="text-[11px] font-medium text-amber-700">
                              Not Realized
                            </p>
                            <p className="mt-1 text-xs font-semibold text-amber-900">
                              {formatCurrency(getLeadUnrealizedGrossProfit(lead))}
                            </p>
                          </div>
                        </div>
                      ) : null}

                      <div className="mt-4 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-medium text-gray-500">
                            {panel.amountLabel || "Value"}
                          </p>
                          <p className="text-sm font-semibold text-gray-900">
                            {/* {formatCurrency(amount)} */} {formattedAmount}
                          </p>
                        </div>

                        {lead.id ? (
                          <button
                            type="button"
                            onClick={() => onViewLead?.(lead.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View Lead
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

export {
  KPI_TONES,
  DashboardSkeleton,
  ExecutiveKpiCard,
  DashboardGraphCard,
  MiniColumnGraph,
  SectionHeader,
  BusinessPulseCard,
  FinanceFlowCard,
  InsightCards,
  ChartShell,
  MiniBarList,
  AttentionRequiredPanel,
  ManagementOverviewTable,
  ManagementFinanceTable,
  ManagementVendorTable,
  ManagementLeadsTable,
  ManagementEngagementTable,
  ManagementTeamTable,
  DashboardDetailDrawer,
  isSameDashboardMember
};
