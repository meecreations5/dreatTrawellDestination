"use client";

import {
  Download,
  LayoutGrid,
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
  sort,
  setSort,
  onExport,
  totalCount = 0,
  filteredCount = 0,
  isSuperAdmin = false
}) {
  const resetFilters = () => {
    setFilters({
      stage: "all",
      assignedTo: "all",
      nextAction: "all",
      status: "all",
      leadHealth: "all",
      search: ""
    });

    setSort?.({
      key: "createdAt",
      direction: "desc"
    });
  };

  return (
    <div
      className="
        sticky top-0 z-20 mb-4
        rounded-2xl border border-gray-100
        bg-white/90 p-3 shadow-sm backdrop-blur
      "
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* LEFT */}
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              value={filters.search || ""}
              onChange={e =>
                setFilters(f => ({
                  ...f,
                  search: e.target.value
                }))
              }
              placeholder="Search lead, customer, phone, agent..."
              className="h-9 w-full rounded-xl border border-gray-100 bg-white pl-9 pr-3 text-xs outline-none focus:border-blue-200 focus:ring-2 focus:ring-blue-50"
            />
          </div>

          <select
            value={filters.stage}
            onChange={e =>
              setFilters(f => ({
                ...f,
                stage: e.target.value
              }))
            }
            className="h-9 rounded-xl border border-gray-100 bg-white px-3 text-xs outline-none focus:border-blue-200"
          >
            <option value="all">All Stages</option>
            <option value="new">New</option>
            <option value="follow_up">Follow Up</option>
            <option value="quoted">Quoted</option>
            <option value="closed_won">Closed Won</option>
            <option value="closed_lost">Closed Lost</option>
          </select>

          <select
            value={filters.assignedTo}
            onChange={e =>
              setFilters(f => ({
                ...f,
                assignedTo: e.target.value
              }))
            }
            className="h-9 rounded-xl border border-gray-100 bg-white px-3 text-xs outline-none focus:border-blue-200"
          >
            <option value="all">All Team</option>
            {/* map team users here later */}
          </select>

          <select
            value={filters.nextAction}
            onChange={e =>
              setFilters(f => ({
                ...f,
                nextAction: e.target.value
              }))
            }
            className="h-9 rounded-xl border border-gray-100 bg-white px-3 text-xs outline-none focus:border-blue-200"
          >
            <option value="all">All Actions</option>
            <option value="overdue">Overdue</option>
            <option value="today">Due Today</option>
            <option value="none">No Next Action</option>
          </select>

          <select
            value={filters.status || "all"}
            onChange={e =>
              setFilters(f => ({
                ...f,
                status: e.target.value
              }))
            }
            className="h-9 rounded-xl border border-gray-100 bg-white px-3 text-xs outline-none focus:border-blue-200"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <select
            value={filters.leadHealth || "all"}
            onChange={e =>
              setFilters(f => ({
                ...f,
                leadHealth: e.target.value
              }))
            }
            className="h-9 rounded-xl border border-gray-100 bg-white px-3 text-xs outline-none focus:border-blue-200"
          >
            <option value="all">All Health</option>
            <option value="healthy">Healthy</option>
            <option value="due_today">Due Today</option>
            <option value="overdue">Overdue</option>
            <option value="no_followup">No Follow-up</option>
          </select>

          {sort && setSort && (
            <select
              value={`${sort.key}:${sort.direction}`}
              onChange={e => {
                const [key, direction] = e.target.value.split(":");
                setSort({ key, direction });
              }}
              className="h-9 rounded-xl border border-gray-100 bg-white px-3 text-xs outline-none focus:border-blue-200"
            >
              <option value="createdAt:desc">Newest First</option>
              <option value="createdAt:asc">Oldest First</option>
              <option value="nextActionAt:asc">Next Follow-up</option>
              <option value="overdue:desc">Overdue First</option>
              <option value="leadCode:asc">Lead Code A-Z</option>
              <option value="stage:asc">Stage A-Z</option>
            </select>
          )}
        </div>

        {/* RIGHT */}
        <div className="flex items-center gap-2">
          <div className="hidden text-right sm:block">
            <p className="text-[11px] font-medium text-gray-700">
              {filteredCount} / {totalCount}
            </p>
            <p className="text-[10px] text-gray-400">visible leads</p>
          </div>

          {isSuperAdmin && (
            <div className="hidden items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-medium text-violet-700 sm:inline-flex">
              <ShieldCheck className="h-3 w-3" />
              Super admin
            </div>
          )}

          <button
            type="button"
            onClick={resetFilters}
            className="
              inline-flex h-9 items-center gap-1.5
              rounded-xl border border-gray-100 px-3
              text-xs text-gray-600 hover:bg-gray-50
            "
          >
            <RotateCcw size={14} />
            Reset
          </button>

          <button
            type="button"
            onClick={onExport}
            className="
              inline-flex h-9 items-center gap-1.5
              rounded-xl border border-gray-100 px-3
              text-xs text-gray-600 hover:bg-gray-50
            "
          >
            <Download size={14} />
            Export
          </button>

          <div className="flex h-9 overflow-hidden rounded-xl border border-gray-100">
            <button
              type="button"
              onClick={() => setView("card")}
              className={`px-3 ${
                view === "card"
                  ? "bg-blue-600 text-white"
                  : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              <LayoutGrid size={14} />
            </button>

            <button
              type="button"
              onClick={() => setView("table")}
              className={`px-3 ${
                view === "table"
                  ? "bg-blue-600 text-white"
                  : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              <List size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}