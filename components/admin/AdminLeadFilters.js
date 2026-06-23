"use client";

import {
  Download,
  Grid3X3,
  List,
  RotateCcw,
  Search,
  ShieldCheck
} from "lucide-react";

export default function AdminLeadFilters({
  view,
  setView,
  filters,
  setFilters,
  teamOptions = [],
  totalCount = 0,
  filteredCount = 0,
  isSuperAdmin = false,
  onExport
}) {
  const updateFilter = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const resetFilters = () => {
    setFilters({
      stage: "all",
      assignedTo: "all",
      nextAction: "all",
      leadHealth: "all",
      dateRange: "all",
      search: ""
    });
  };

  return (
    <div className="sticky top-4 z-20 rounded-2xl border border-gray-100 bg-white/95 p-3 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-center gap-2">
        {/* SEARCH */}
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

          <input
            value={filters.search || ""}
            onChange={e => updateFilter("search", e.target.value)}
            placeholder="Search lead, customer, phone"
            className="h-9 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-xs text-gray-700 outline-none transition placeholder:text-gray-400 hover:border-blue-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        {/* STAGE */}
        <select
          value={filters.stage || "all"}
          onChange={e => updateFilter("stage", e.target.value)}
          className="h-9 min-w-[115px] rounded-xl border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 outline-none transition hover:border-blue-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        >
          <option value="all">All Stages</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="qualified">Qualified</option>
          <option value="quotation">Quotation</option>
          <option value="negotiation">Negotiation</option>
          <option value="won">Won</option>
          <option value="lost">Lost</option>
        </select>

        {/* TEAM */}
        <select
          value={filters.assignedTo || "all"}
          onChange={e => updateFilter("assignedTo", e.target.value)}
          className="h-9 min-w-[155px] rounded-xl border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 outline-none transition hover:border-blue-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        >
          <option value="all">All Team</option>

          {teamOptions.map(member => (
            <option key={member.value} value={member.value}>
              {member.label}
            </option>
          ))}
        </select>

        {/* NEXT ACTION */}
        <select
          value={filters.nextAction || "all"}
          onChange={e => updateFilter("nextAction", e.target.value)}
          className="h-9 min-w-[120px] rounded-xl border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 outline-none transition hover:border-blue-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        >
          <option value="all">All Actions</option>
          <option value="today">Due Today</option>
          <option value="overdue">Overdue</option>
          <option value="none">No Follow-up</option>
        </select>

        {/* HEALTH */}
        <select
          value={filters.leadHealth || "all"}
          onChange={e => updateFilter("leadHealth", e.target.value)}
          className="h-9 min-w-[110px] rounded-xl border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 outline-none transition hover:border-blue-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        >
          <option value="all">All Health</option>
          <option value="healthy">Healthy</option>
          <option value="due_today">Due Today</option>
          <option value="overdue">Overdue</option>
          <option value="no_followup">No Follow-up</option>
          <option value="inactive">Inactive</option>
        </select>

        {/* DATE */}
        <select
          value={filters.dateRange || "all"}
          onChange={e => updateFilter("dateRange", e.target.value)}
          className="h-9 min-w-[105px] rounded-xl border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 outline-none transition hover:border-blue-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        >
          <option value="all">All Time</option>
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
        </select>

        {/* COUNT */}
        <div className="ml-auto hidden min-w-[70px] text-right lg:block">
          <p className="text-xs font-semibold text-gray-700">
            {filteredCount} / {totalCount}
          </p>
          <p className="text-[10px] text-gray-400">
            visible leads
          </p>
        </div>

        {isSuperAdmin && (
          <div className="hidden items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-medium text-violet-700 xl:inline-flex">
            <ShieldCheck className="h-3.5 w-3.5" />
            Super admin
          </div>
        )}

        {/* RESET */}
        <button
          type="button"
          onClick={resetFilters}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-xs font-medium text-gray-600 transition hover:border-gray-300 hover:bg-gray-50"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </button>

        {/* EXPORT */}
        <button
          type="button"
          onClick={onExport}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-xs font-medium text-gray-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </button>

        {/* VIEW SWITCH */}
        <div className="flex overflow-hidden rounded-xl border border-gray-200 bg-white">
          <button
            type="button"
            onClick={() => setView("card")}
            className={`
              flex h-9 w-9 items-center justify-center transition
              ${
                view === "card"
                  ? "bg-blue-600 text-white"
                  : "text-gray-500 hover:bg-gray-50"
              }
            `}
            title="Card view"
          >
            <Grid3X3 className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => setView("table")}
            className={`
              flex h-9 w-9 items-center justify-center border-l border-gray-200 transition
              ${
                view === "table"
                  ? "bg-blue-600 text-white"
                  : "text-gray-500 hover:bg-gray-50"
              }
            `}
            title="Table view"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}