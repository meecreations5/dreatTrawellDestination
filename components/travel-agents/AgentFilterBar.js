"use client";

import { TRAVEL_AGENT_STATUS_OPTIONS } from "@/lib/travelAgentStatus";
import { TRAVEL_AGENT_POTENTIAL_OPTIONS } from "@/lib/travelAgentPotential";

const inputClass = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50";

export default function AgentFilterBar({
  filters,
  setFilters,
  locationOptions = { states: [], cities: [], subAreas: [] },
  onClear
}) {
  const updateFilter = (key, value) => {
    setFilters(prev => {
      const next = { ...prev, [key]: value };
      if (key === "state") {
        next.city = "";
        next.subArea = "";
      }
      if (key === "city") next.subArea = "";
      return next;
    });
  };

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <p className="text-sm font-semibold text-gray-900">Travel Agent Filters</p>
        <p className="mt-0.5 text-xs text-gray-500">Potential is commercial priority. Location cascades State → City → Sub Area.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
        <div className="2xl:col-span-2">
          <label className="mb-1 block text-xs font-medium text-gray-500">Search</label>
          <input value={filters.search} onChange={e => updateFilter("search", e.target.value)} placeholder="Agency, code, SPOC, location, phone" className={inputClass} />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Agent Potential</label>
          <select value={filters.potential || "all"} onChange={e => updateFilter("potential", e.target.value)} className={inputClass}>
            <option value="all">All Potentials</option>
            {TRAVEL_AGENT_POTENTIAL_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Agent Status</label>
          <select value={filters.status || "all"} onChange={e => updateFilter("status", e.target.value)} className={inputClass}>
            <option value="all">All Statuses</option>
            {TRAVEL_AGENT_STATUS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">State</label>
          <select value={filters.state || ""} onChange={e => updateFilter("state", e.target.value)} className={inputClass}>
            <option value="">All States</option>
            {locationOptions.states.map(value => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">City</label>
          <select value={filters.city || ""} onChange={e => updateFilter("city", e.target.value)} className={inputClass}>
            <option value="">All Cities</option>
            {locationOptions.cities.map(value => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Sub Area</label>
          <select value={filters.subArea || ""} onChange={e => updateFilter("subArea", e.target.value)} className={inputClass}>
            <option value="">All Sub Areas</option>
            {locationOptions.subAreas.map(value => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Latest Channel</label>
          <select value={filters.channel} onChange={e => updateFilter("channel", e.target.value)} className={inputClass}>
            <option value="all">All Channels</option>
            <option value="call">Call</option><option value="whatsapp">WhatsApp</option><option value="email">Email</option><option value="meeting">Meeting</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Sort By</label>
          <select value={filters.sortBy} onChange={e => updateFilter("sortBy", e.target.value)} className={inputClass}>
            <option value="agency_az">Agency Name A-Z</option><option value="agency_za">Agency Name Z-A</option><option value="recently_engaged">Latest Engagement First</option><option value="oldest_engaged">Oldest Engagement First</option><option value="needs_followup">Needs Follow-up First</option><option value="most_leads">Most Leads</option>
          </select>
        </div>

        <div className="flex items-end">
          <button type="button" onClick={onClear} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Clear Filters</button>
        </div>
      </div>
    </div>
  );
}
