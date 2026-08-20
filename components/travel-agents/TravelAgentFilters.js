"use client";

import { LayoutGrid, List, Search, X } from "lucide-react";
import { TRAVEL_AGENT_STATUS_OPTIONS } from "@/lib/travelAgentStatus";
import { TRAVEL_AGENT_POTENTIAL_OPTIONS } from "@/lib/travelAgentPotential";

const selectClass =
  "h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50";

export default function TravelAgentFilterBar({
  view,
  setView,
  filters,
  setFilters,
  creatorOptions = [],
  locationOptions = { states: [], cities: [], subAreas: [] }
}) {
  const hasActiveFilters = Boolean(
    filters.search ||
      filters.createdBy !== "all" ||
      filters.potential !== "all" ||
      filters.status ||
      filters.contactStatus !== "all" ||
      filters.state ||
      filters.city ||
      filters.subArea ||
      filters.createdRange
  );

  const updateFilter = (key, value) => {
    setFilters(current => {
      const next = { ...current, [key]: value };
      if (key === "state") {
        next.city = "";
        next.subArea = "";
      }
      if (key === "city") next.subArea = "";
      return next;
    });
  };

  const resetFilters = () => {
    setFilters({
      search: "",
      createdBy: "all",
      potential: "all",
      status: "",
      contactStatus: "all",
      state: "",
      city: "",
      subArea: "",
      createdRange: ""
    });
  };

  const chips = [
    filters.createdRange === "7d" && [
      "Created",
      "Last 7 Days",
      () => updateFilter("createdRange", "")
    ],
    filters.createdBy !== "all" && [
      "Created By",
      creatorOptions.find(item => item.key === filters.createdBy)?.label || "Selected user",
      () => updateFilter("createdBy", "all")
    ],
    filters.potential !== "all" && [
      "Potential",
      TRAVEL_AGENT_POTENTIAL_OPTIONS.find(item => item.value === filters.potential)?.label || filters.potential,
      () => updateFilter("potential", "all")
    ],
    filters.status && [
      "Status",
      TRAVEL_AGENT_STATUS_OPTIONS.find(item => item.value === filters.status)?.label || filters.status,
      () => updateFilter("status", "")
    ],
    filters.contactStatus !== "all" && [
      "Contact",
      {
        never_contacted: "Never Contacted",
        contacted_today: "Contacted Today",
        contacted: "Contacted",
        follow_up_due: "Follow-up Due Today",
        overdue: "Overdue"
      }[filters.contactStatus],
      () => updateFilter("contactStatus", "all")
    ],
    filters.state && ["State", filters.state, () => updateFilter("state", "")],
    filters.city && ["City", filters.city, () => updateFilter("city", "")],
    filters.subArea && ["Sub Area", filters.subArea, () => updateFilter("subArea", "")]
  ].filter(Boolean);

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <p className="text-sm font-semibold text-gray-900">Travel Agent Filters</p>
        <p className="mt-0.5 text-xs text-gray-500">
          Global Date + Team apply above. Potential is commercial priority; Status is operational usability. Location cascades State → City → Sub Area.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5 2xl:grid-cols-9">
        <div className="relative sm:col-span-2 2xl:col-span-2">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={filters.search}
            onChange={event => updateFilter("search", event.target.value)}
            placeholder="Search agency, code, SPOC, phone or location"
            className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm text-gray-800 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-50"
          />
        </div>

        <select value={filters.createdBy} onChange={e => updateFilter("createdBy", e.target.value)} className={selectClass}>
          <option value="all">All Agent Creators</option>
          {creatorOptions.map(member => (
            <option key={member.key} value={member.key}>{member.label}</option>
          ))}
        </select>

        <select value={filters.potential} onChange={e => updateFilter("potential", e.target.value)} className={selectClass}>
          <option value="all">All Potentials</option>
          {TRAVEL_AGENT_POTENTIAL_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>

        <select value={filters.status} onChange={e => updateFilter("status", e.target.value)} className={selectClass}>
          <option value="">All Agent Statuses</option>
          {TRAVEL_AGENT_STATUS_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>

        <select value={filters.contactStatus} onChange={e => updateFilter("contactStatus", e.target.value)} className={selectClass}>
          <option value="all">All Contact Status</option>
          <option value="never_contacted">Never Contacted</option>
          <option value="contacted_today">Contacted Today</option>
          <option value="contacted">Contacted</option>
          <option value="follow_up_due">Follow-up Due Today</option>
          <option value="overdue">Overdue</option>
        </select>

        <select value={filters.state} onChange={e => updateFilter("state", e.target.value)} className={selectClass}>
          <option value="">All States</option>
          {locationOptions.states.map(value => <option key={value} value={value}>{value}</option>)}
        </select>
        <select value={filters.city} onChange={e => updateFilter("city", e.target.value)} className={selectClass}>
          <option value="">All Cities</option>
          {locationOptions.cities.map(value => <option key={value} value={value}>{value}</option>)}
        </select>
        <select value={filters.subArea} onChange={e => updateFilter("subArea", e.target.value)} className={selectClass}>
          <option value="">All Sub Areas</option>
          {locationOptions.subAreas.map(value => <option key={value} value={value}>{value}</option>)}
        </select>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
        <div className="flex min-h-8 flex-wrap items-center gap-2">
          {chips.length === 0 ? (
            <span className="text-xs text-gray-400">No page-specific filters applied</span>
          ) : (
            chips.map(([label, value, clear]) => (
              <button key={`${label}-${value}`} type="button" onClick={clear} className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                {label}: {value}<X size={12} />
              </button>
            ))
          )}
        </div>

        <div className="flex items-center gap-2">
          {hasActiveFilters && <button type="button" onClick={resetFilters} className="inline-flex h-9 items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 text-xs font-medium text-gray-600 hover:bg-gray-50"><X size={14} /> Reset Page Filters</button>}
          <div className="flex rounded-xl border border-gray-200 bg-gray-50 p-1">
            <button type="button" onClick={() => setView("table")} className={`inline-flex h-8 items-center gap-1 rounded-lg px-3 text-xs font-medium transition ${view === "table" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"}`}><List size={14} /> Table</button>
            <button type="button" onClick={() => setView("card")} className={`inline-flex h-8 items-center gap-1 rounded-lg px-3 text-xs font-medium transition ${view === "card" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"}`}><LayoutGrid size={14} /> Cards</button>
          </div>
        </div>
      </div>
    </div>
  );
}
