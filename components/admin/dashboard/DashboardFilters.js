"use client";

export default function DashboardFilters({
  filters,
  setFilters
}) {
  return (
    <div
      className="
        sticky top-20 z-20
        bg-white/90 backdrop-blur
        border border-gray-100
        rounded-xl
        p-3
      "
    >
      <div className="flex flex-wrap gap-3 items-center">

        <select
          className="border border-gray-100 rounded-lg px-3 py-2 text-xs"
          value={filters.stage}
          onChange={e =>
            setFilters(f => ({
              ...f,
              stage: e.target.value
            }))
          }
        >
          <option value="all">All Stages</option>
          <option value="new">New</option>
          <option value="follow_up">Follow Up</option>
          <option value="quoted">Quoted</option>
          <option value="closed_won">Won</option>
          <option value="closed_lost">Lost</option>
        </select>

        <input
          type="date"
          className="border border-gray-100 rounded-lg px-3 py-2 text-xs"
          value={filters.from}
          onChange={e =>
            setFilters(f => ({
              ...f,
              from: e.target.value
            }))
          }
        />

        <input
          type="date"
          className="border border-gray-100 rounded-lg px-3 py-2 text-xs"
          value={filters.to}
          onChange={e =>
            setFilters(f => ({
              ...f,
              to: e.target.value
            }))
          }
        />

        <label className="flex items-center gap-2 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={filters.overdue}
            onChange={e =>
              setFilters(f => ({
                ...f,
                overdue: e.target.checked
              }))
            }
          />
          Overdue only
        </label>
      </div>
    </div>
  );
}
