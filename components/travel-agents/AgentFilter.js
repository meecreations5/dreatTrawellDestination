"use client";

export default function AgentFilters({
  filters,
  setFilters,
  onApply
}) {
  return (
    <>
      <input
        placeholder="Search agent"
        value={filters.search}
        onChange={e =>
          setFilters(f => ({
            ...f,
            search: e.target.value
          }))
        }
        className="w-full md:w-64 border rounded-md px-3 py-2 text-sm"
      />

      <select
        value={filters.engagement}
        onChange={e =>
          setFilters(f => ({
            ...f,
            engagement: e.target.value
          }))
        }
        className="w-full md:w-44 border rounded-md px-3 py-2 text-sm"
      >
        <option value="all">All</option>
        <option value="engaged">Engaged</option>
        <option value="not_engaged">Not engaged</option>
      </select>

      <select
        value={filters.channel}
        onChange={e =>
          setFilters(f => ({
            ...f,
            channel: e.target.value
          }))
        }
        className="w-full md:w-44 border rounded-md px-3 py-2 text-sm"
      >
        <option value="all">All</option>
        <option value="call">Call</option>
        <option value="whatsapp">WhatsApp</option>
        <option value="email">Email</option>
        <option value="meeting">Meeting</option>
      </select>

      {onApply && (
        <button
          onClick={onApply}
          className="w-full md:w-auto bg-blue-600 text-white px-6 py-2.5 rounded-md"
        >
          Apply Filters
        </button>
      )}
    </>
  );
}
