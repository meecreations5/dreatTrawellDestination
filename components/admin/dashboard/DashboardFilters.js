"use client";

import { LEAD_STAGE_OPTIONS } from "@/lib/leadStages";

export default function DashboardFilters({
  filters,
  setFilters,
  ownerOptions = [],
  assignedOptions = [],
  destinationOptions = []
}) {
  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <FilterField label="Lead Owner">
        <select
          className="dashboard-filter-control"
          value={filters.owner || "all"}
          onChange={e => updateFilter("owner", e.target.value)}
        >
          <option value="all">All Owners</option>
          {ownerOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FilterField>

      <FilterField label="Current Assignee">
        <select
          className="dashboard-filter-control"
          value={filters.assignedTo || "all"}
          onChange={e => updateFilter("assignedTo", e.target.value)}
        >
          <option value="all">All Assignees</option>
          <option value="unassigned">Unassigned</option>
          {assignedOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FilterField>

      <FilterField label="Stage">
        <select
          className="dashboard-filter-control"
          value={filters.stage || "all"}
          onChange={e => updateFilter("stage", e.target.value)}
        >
          <option value="all">All Stages</option>
          {LEAD_STAGE_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </FilterField>

      <FilterField label="Follow-up">
        <select
          className="dashboard-filter-control"
          value={filters.followUp || "all"}
          onChange={e => updateFilter("followUp", e.target.value)}
        >
          <option value="all">All Follow-ups</option>
          <option value="today">Due Today</option>
          <option value="overdue">Overdue</option>
          <option value="upcoming">Upcoming</option>
          <option value="none">No Next Action</option>
        </select>
      </FilterField>

      <FilterField label="Destination">
        <select
          className="dashboard-filter-control"
          value={filters.destination || "all"}
          onChange={e => updateFilter("destination", e.target.value)}
        >
          <option value="all">All Destinations</option>
          {destinationOptions.map(destination => (
            <option key={destination} value={destination}>{destination}</option>
          ))}
        </select>
      </FilterField>

      <div className="sm:col-span-2 xl:col-span-5 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] leading-4 text-blue-700">
        Global Date + Team apply above. Owner = creator credit; Assignee = current work responsibility; Date = Lead Created Date.
      </div>
    </div>
  );
}

function FilterField({ label, children }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}
