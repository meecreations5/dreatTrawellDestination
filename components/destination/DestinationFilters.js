"use client";

import {
  LayoutGrid,
  List
} from "lucide-react";

export default function DestinationFilters({
  view,
  setView,
  filters,
  setFilters
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
          {/* SEARCH */}
          <input
            type="text"
            placeholder="Search destination"
            value={filters.search}
            onChange={e =>
              setFilters(f => ({
                ...f,
                search: e.target.value
              }))
            }
            className="
              text-xs px-3 py-2
              border border-gray-100
              rounded-lg
              bg-white
              focus:outline-none
            "
          />

          {/* STATUS FILTER (optional ready) */}
          <select
            value={filters.status || "all"}
            onChange={e =>
              setFilters(f => ({
                ...f,
                status: e.target.value
              }))
            }
            className="
              text-xs px-3 py-2
              border border-gray-100
              rounded-lg
              bg-white
            "
          >
            <option value="all">
              All Status
            </option>
            <option value="draft">
              Draft
            </option>
            <option value="published">
              Published
            </option>
          </select>

          {/* ACTIVE FILTER (optional ready) */}
          <select
            value={filters.active || "all"}
            onChange={e =>
              setFilters(f => ({
                ...f,
                active: e.target.value
              }))
            }
            className="
              text-xs px-3 py-2
              border border-gray-100
              rounded-lg
              bg-white
            "
          >
            <option value="all">
              All Visibility
            </option>
            <option value="active">
              Active
            </option>
            <option value="inactive">
              Inactive
            </option>
          </select>
        </div>

        {/* RIGHT ACTIONS */}
        <div className="flex items-center gap-2">
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
