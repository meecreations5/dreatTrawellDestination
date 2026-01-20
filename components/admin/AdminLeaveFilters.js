"use client";

import {
  LayoutGrid,
  List,
  Download
} from "lucide-react";

export default function AdminLeaveFilters({
  view,
  setView,
  filters,
  setFilters,
  onExport
}) {
  return (
    <div
      className="
        sticky top-0 z-20
        bg-white/90 backdrop-blur
        border border-gray-100
        rounded-xl
        p-3
        mb-4
      "
    >
      <div className="flex flex-wrap gap-3 items-center justify-between">

        {/* LEFT FILTERS */}
        <div className="flex flex-wrap gap-2">

          {/* STATUS */}
          <select
            value={filters.status}
            onChange={e =>
              setFilters(f => ({
                ...f,
                status: e.target.value
              }))
            }
            className="text-xs px-3 py-2 border border-gray-100 rounded-lg bg-white"
          >
            <option value="all">All Status</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="pending">Pending</option>
          </select>

          {/* EMPLOYEE */}
          <input
            placeholder="Employee name"
            value={filters.employee}
            onChange={e =>
              setFilters(f => ({
                ...f,
                employee: e.target.value
              }))
            }
            className="text-xs px-3 py-2 border border-gray-100 rounded-lg bg-white"
          />

          {/* FROM DATE */}
          <input
            type="date"
            value={filters.fromDate}
            onChange={e =>
              setFilters(f => ({
                ...f,
                fromDate: e.target.value
              }))
            }
            className="text-xs px-3 py-2 border border-gray-100 rounded-lg bg-white"
          />

          {/* TO DATE */}
          <input
            type="date"
            value={filters.toDate}
            onChange={e =>
              setFilters(f => ({
                ...f,
                toDate: e.target.value
              }))
            }
            className="text-xs px-3 py-2 border border-gray-100 rounded-lg bg-white"
          />
        </div>

        {/* RIGHT ACTIONS */}
        <div className="flex items-center gap-2">

          {/* EXPORT */}
          <button
            onClick={onExport}
            className="
              inline-flex items-center gap-1.5
              border border-gray-100
              rounded-lg
              px-3 py-2
              text-xs
              text-gray-600
              hover:bg-gray-50
            "
          >
            <Download size={14} />
            Export
          </button>

          {/* VIEW TOGGLE */}
          <div className="flex border border-gray-100 rounded-lg overflow-hidden">
            <button
              onClick={() => setView("card")}
              className={`p-2 ${
                view === "card"
                  ? "bg-blue-600 text-white"
                  : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              <LayoutGrid size={14} />
            </button>

            <button
              onClick={() => setView("table")}
              className={`p-2 ${
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
