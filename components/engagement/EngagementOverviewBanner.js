"use client";

import {
  Activity,
  CalendarDays,
  Filter,
  MessageCircle,
  RotateCcw,
  TrendingUp
} from "lucide-react";

function MetricPill({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
        <Icon size={17} />
      </div>

      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
          {label}
        </p>
        <p className="text-sm font-semibold text-gray-900 truncate">
          {value}
        </p>
      </div>
    </div>
  );
}

export default function EngagementOverviewBanner({
  summary,
  filteredCount = 0,
  activeFilterCount = 0,
  onClearFilters
}) {
  return (
    <section className="rounded-3xl border border-gray-200 bg-gradient-to-br from-white via-white to-slate-50 p-5 md:p-6 shadow-sm">

      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6">

        {/* LEFT CONTENT */}
        <div className="flex items-start gap-4 min-w-0">
          <div className="h-13 w-13 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-sm shrink-0">
            <Activity size={24} />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                <Activity size={13} />
                Activity Timeline
              </span>

              <span className="inline-flex items-center rounded-full bg-gray-100 border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600">
                {filteredCount} results
              </span>

              {activeFilterCount > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                  <Filter size={13} />
                  {activeFilterCount} filter
                  {activeFilterCount > 1 ? "s" : ""} active
                </span>
              )}
            </div>

            <h1 className="text-2xl font-semibold tracking-tight text-gray-950">
              My Engagements
            </h1>

            <p className="mt-1 text-sm text-gray-500 max-w-2xl leading-6">
              Review your travel-agent interactions, calls, WhatsApp messages,
              emails, meetings and follow-ups from one organized workspace.
            </p>

            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={onClearFilters}
                className="mt-3 inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              >
                <RotateCcw size={14} />
                Reset current view
              </button>
            )}
          </div>
        </div>

        {/* RIGHT METRICS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4 gap-3 xl:min-w-[460px]">
          <MetricPill
            icon={TrendingUp}
            label="Filtered"
            value={summary?.filtered || 0}
          />

          <MetricPill
            icon={CalendarDays}
            label="Today"
            value={summary?.today || 0}
          />

          <MetricPill
            icon={MessageCircle}
            label="Top Channel"
            value={summary?.topChannel || "—"}
          />

          <MetricPill
            icon={Activity}
            label="Total"
            value={summary?.total || 0}
          />
        </div>
      </div>
    </section>
  );
}