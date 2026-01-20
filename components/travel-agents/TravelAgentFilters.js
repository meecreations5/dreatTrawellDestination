"use client";

import { LayoutGrid, List } from "lucide-react";

export default function TravelAgentFilterBar({
  view,
  setView,
  filters,
  setFilters,
  destinations,
  onExport
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap items-center gap-3 justify-between">

      {/* LEFT: FILTERS */}
      <div className="flex flex-wrap gap-3 items-center">

        {/* SEARCH */}
        <input
          value={filters.search}
          onChange={e =>
            setFilters(f => ({
              ...f,
              search: e.target.value
            }))
          }
          placeholder="Search agency / code / SPOC"
          className="border border-gray-200 rounded-md px-3 py-1.5 text-sm w-56"
        />

        {/* STATUS */}
        <select
          value={filters.status}
          onChange={e =>
            setFilters(f => ({
              ...f,
              status: e.target.value
            }))
          }
          className="border border-gray-200 rounded-md px-2 py-1.5 text-sm"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        {/* AGENCY TYPE */}
        <select
          value={filters.agencyType}
          onChange={e =>
            setFilters(f => ({
              ...f,
              agencyType: e.target.value
            }))
          }
          className="border border-gray-200 rounded-md px-2 py-1.5 text-sm"
        >
          <option value="">All Types</option>
          <option value="b2b">B2B</option>
          <option value="b2c">B2C</option>
          <option value="corporate">Corporate</option>
        </select>

        {/* DESTINATION */}
        <select
          value={filters.destinationId}
          onChange={e =>
            setFilters(f => ({
              ...f,
              destinationId: e.target.value
            }))
          }
          className="border border-gray-200 rounded-md px-2 py-1.5 text-sm"
        >
          <option value="">All Destinations</option>
          {destinations.map(d => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        {/* RELATIONSHIP */}
        <select
          value={filters.relationshipStage}
          onChange={e =>
            setFilters(f => ({
              ...f,
              relationshipStage: e.target.value
            }))
          }
          className="border border-gray-200 rounded-md px-2 py-1.5 text-sm"
        >
          <option value="">All Stages</option>
          <option value="lead">Lead</option>
          <option value="onboarded">Onboarded</option>
          <option value="active">Active</option>
        </select>
      </div>

      {/* RIGHT: VIEW + EXPORT */}
      <div className="flex items-center gap-3">

        {/* VIEW TOGGLE */}
        <div className="flex border border-gray-100 rounded-lg overflow-hidden">
          <button
            onClick={() => setView("card")}
            className={`p-2 ${view === "card"
                ? "bg-blue-600 text-white"
                : "text-gray-500 hover:bg-gray-50"
              }`}
          >
            <LayoutGrid size={14} />
          </button>

          <button
            onClick={() => setView("table")}
            className={`p-2 ${view === "table"
                ? "bg-blue-600 text-white"
                : "text-gray-500 hover:bg-gray-50"
              }`}
          >
            <List size={14} />
          </button>
        </div>

        {/* EXPORT */}
        <button
          onClick={onExport}
          className="text-xs border border-gray-200 px-3 py-1.5 rounded-md hover:bg-gray-50"
        >
          Export CSV
        </button>
      </div>
    </div>
  );
}
