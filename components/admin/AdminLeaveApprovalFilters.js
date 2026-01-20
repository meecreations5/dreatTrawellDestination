"use client";

import {
  LayoutGrid,
  List
} from "lucide-react";

export default function AdminLeaveApprovalFilters({
  view,
  setView,
  filters,
  setFilters,
  selectedCount,
  onBulkApprove,
  onBulkReject
}) {
  return (
    <div className="
      sticky top-0 z-20
      bg-white/90 backdrop-blur
      border border-gray-100
      rounded-xl
      p-3
      mb-4
    ">
      <div className="flex flex-wrap items-center justify-between gap-3">

        {/* LEFT FILTERS */}
        <div className="flex flex-wrap gap-2">
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

          {/* BULK ACTIONS */}
          {selectedCount > 0 && (
            <>
              <button
                onClick={onBulkApprove}
                className="text-green-600 text-xs font-medium"
              >
                Approve ({selectedCount})
              </button>

              <button
                onClick={onBulkReject}
                className="text-red-600 text-xs font-medium"
              >
                Reject ({selectedCount})
              </button>
            </>
          )}

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
