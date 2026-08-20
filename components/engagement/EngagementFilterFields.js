"use client";

export default function EngagementFilterFields({
  filters,
  setFilters,
  onApply
}) {
  return (
    <>
      {/* SEARCH */}
      <input
        placeholder="Search"
        value={filters.search}
        onChange={e =>
          setFilters(f => ({
            ...f,
            search: e.target.value
          }))
        }
        className="w-full md:w-64 border rounded-md px-3 py-2 text-sm"
      />

      {/* TRAVEL AGENT */}
      <input
        placeholder="Travel Agent"
        value={filters.travelAgent}
        onChange={e =>
          setFilters(f => ({
            ...f,
            travelAgent: e.target.value
          }))
        }
        className="w-full md:w-44 border rounded-md px-3 py-2 text-sm"
      />

      {/* SPOC */}
      <input
        placeholder="SPOC"
        value={filters.spoc}
        onChange={e =>
          setFilters(f => ({
            ...f,
            spoc: e.target.value
          }))
        }
        className="w-full md:w-44 border rounded-md px-3 py-2 text-sm"
      />

      {/* DESTINATION */}
      <input
        placeholder="Destination"
        value={filters.destination}
        onChange={e =>
          setFilters(f => ({
            ...f,
            destination: e.target.value
          }))
        }
        className="w-full md:w-44 border rounded-md px-3 py-2 text-sm"
      />

      {/* CHANNEL */}
      <select
        value={filters.channel}
        onChange={e =>
          setFilters(f => ({
            ...f,
            channel: e.target.value
          }))
        }
        className="w-full md:w-40 border rounded-md px-3 py-2 text-sm"
      >
        <option value="all">All</option>
        <option value="email">Email</option>
        <option value="call">Call</option>
        <option value="whatsapp">WhatsApp</option>
        <option value="meeting">Meeting</option>
      </select>

      {/* APPLY (ONLY IN MOBILE SHEET) */}
      {onApply && (
        <button
          onClick={onApply}
          className="
            w-full md:w-auto
            bg-blue-600 text-white
            px-6 py-2.5
            rounded-md
            font-medium
          "
        >
          Apply Filters
        </button>
      )}
    </>
  );
}
