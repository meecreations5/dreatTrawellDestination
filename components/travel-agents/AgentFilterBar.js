"use client";

export default function AgentFilterBar({
  filters,
  setFilters,
  cities = [],
  onClear
}) {
  const updateFilter = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
        {/* SEARCH */}
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Search
          </label>

          <input
            value={filters.search}
            onChange={e => updateFilter("search", e.target.value)}
            placeholder="Search agency, code, SPOC, city, phone"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50"
          />
        </div>

        {/* CITY */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            City
          </label>

          <select
            value={filters.city}
            onChange={e => updateFilter("city", e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50"
          >
            <option value="all">All Cities</option>

            {cities.map(city => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </div>

        {/* CHANNEL */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Channel
          </label>

          <select
            value={filters.channel}
            onChange={e => updateFilter("channel", e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50"
          >
            <option value="all">All Channels</option>
            <option value="call">Call</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Email</option>
            <option value="meeting">Meeting</option>
          </select>
        </div>

        {/* SORT */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Sort By
          </label>

          <select
            value={filters.sortBy}
            onChange={e => updateFilter("sortBy", e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50"
          >
            <option value="agency_az">Agency Name A-Z</option>
            <option value="agency_za">Agency Name Z-A</option>
            <option value="recently_engaged">Latest Engagement First</option>
            <option value="oldest_engaged">Oldest Engagement First</option>
            <option value="needs_followup">Needs Follow-up First</option>
            <option value="most_leads">Most Leads</option>
          </select>
        </div>

        {/* CLEAR */}
        <div className="flex items-end">
          <button
            type="button"
            onClick={onClear}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}