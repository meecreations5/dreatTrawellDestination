"use client";

import { LayoutGrid, List, Search, X } from "lucide-react";

export default function TravelAgentFilterBar({
  view,
  setView,
  filters,
  setFilters,
  destinations = [],
  cityOptions = []
}) {
  const hasActiveFilters =
    filters.search ||
    filters.status ||
    filters.agencyType ||
    filters.destinationId ||
    filters.relationshipStage ||
    filters.city ||
    filters.engagement;

  const updateFilter = (key, value) => {
    setFilters(current => ({
      ...current,
      [key]: value
    }));
  };

  const resetFilters = () => {
    setFilters({
      search: "",
      status: "",
      agencyType: "",
      destinationId: "",
      relationshipStage: "",
      city: "",
      engagement: ""
    });
  };

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div className="relative sm:col-span-2 xl:col-span-2">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <input
              value={filters.search}
              onChange={event => updateFilter("search", event.target.value)}
              placeholder="Search agency, code, SPOC, city, destination"
              className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm text-gray-800 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-50"
            />
          </div>

          <select
            value={filters.status}
            onChange={event => updateFilter("status", event.target.value)}
            className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <select
            value={filters.city}
            onChange={event => updateFilter("city", event.target.value)}
            className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
          >
            <option value="">All Cities</option>
            {cityOptions.map(city => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>

          <select
            value={filters.destinationId}
            onChange={event =>
              updateFilter("destinationId", event.target.value)
            }
            className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
          >
            <option value="">All Destinations</option>
            {destinations.map(destination => (
              <option key={destination.id} value={destination.id}>
                {destination.name || destination.id}
              </option>
            ))}
          </select>

          <select
            value={filters.engagement}
            onChange={event => updateFilter("engagement", event.target.value)}
            className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
          >
            <option value="">All Engagement</option>
            <option value="7d">Fresh - 7 days</option>
            <option value="30d">Warm - 30 days</option>
            <option value="stale">Need Follow-up</option>
            <option value="no_contact">No Contact</option>
          </select>

          <select
            value={filters.relationshipStage}
            onChange={event =>
              updateFilter("relationshipStage", event.target.value)
            }
            className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
          >
            <option value="">All Stages</option>
            <option value="new">New</option>
            <option value="prospect">Prospect</option>
            <option value="onboarded">Onboarded</option>
            <option value="preferred">Preferred</option>
            <option value="inactive">Inactive</option>
          </select>

          <select
            value={filters.agencyType}
            onChange={event => updateFilter("agencyType", event.target.value)}
            className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
          >
            <option value="">All Agency Types</option>
            <option value="individual">Individual</option>
            <option value="proprietorship">Proprietorship</option>
            <option value="partnership">Partnership</option>
            <option value="llp">LLP</option>
            <option value="private_limited">Private Limited</option>
            <option value="public_limited">Public Limited</option>
          </select>
        </div>

        <div className="flex items-center justify-between gap-2 xl:justify-end">
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex h-10 items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
            >
              <X size={14} />
              Reset
            </button>
          )}

          <div className="flex rounded-xl border border-gray-200 bg-gray-50 p-1">
            <button
              type="button"
              onClick={() => setView("table")}
              className={`inline-flex h-8 items-center gap-1 rounded-lg px-3 text-xs font-medium transition ${
                view === "table"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              <List size={14} />
              Table
            </button>

            <button
              type="button"
              onClick={() => setView("card")}
              className={`inline-flex h-8 items-center gap-1 rounded-lg px-3 text-xs font-medium transition ${
                view === "card"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              <LayoutGrid size={14} />
              Cards
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}