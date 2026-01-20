export default function DestinationFilters({
  view,
  setView,
  filters,
  setFilters
}) {
  return (
    <div
      className="
        bg-white border border-gray-200 rounded-lg
        p-3 flex flex-wrap gap-3 items-center
      "
    >
      {/* SEARCH */}
      <input
        type="text"
        placeholder="Search destination"
        className="
          text-sm border rounded-md px-3 py-1.5
          focus:outline-none focus:ring-2 focus:ring-blue-100
        "
        value={filters.search}
        onChange={e =>
          setFilters(f => ({
            ...f,
            search: e.target.value
          }))
        }
      />

      {/* VIEW TOGGLE (same button style) */}
      <div className="ml-auto flex border rounded-md overflow-hidden">
        {["card", "table"].map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`
              px-3 py-1.5 text-sm
              ${view === v
                ? "bg-blue-600 text-white"
                : "bg-white hover:bg-gray-50"}
            `}
          >
            {v}
          </button>
        ))}
      </div>

      
    </div>
  );
}
