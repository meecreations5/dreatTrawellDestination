"use client";

export default function LeadFilterFields({
  filters,
  setFilters,
  onApply
}) {
  return (
    <>
      {/* SEARCH */}
      <input
        placeholder="Search leads…"
        value={filters.search}
        onChange={e =>
          setFilters(f => ({
            ...f,
            search: e.target.value
          }))
        }
        className="w-full md:w-64 border rounded-md px-3 py-2 text-sm"
      />

      {/* STAGE */}
      <select
        value={filters.stage}
        onChange={e =>
          setFilters(f => ({
            ...f,
            stage: e.target.value
          }))
        }
        className="w-full md:w-44 border rounded-md px-3 py-2 text-sm"
      >
        <option value="">All Stages</option>
        <option value="new">New</option>
        <option value="follow_up">Follow-up</option>
        <option value="quoted">Quoted</option>
        <option value="closed_won">Closed Won</option>
        <option value="closed_lost">Closed Lost</option>
      </select>

      {/* HEALTH */}
      <select
        value={filters.health}
        onChange={e =>
          setFilters(f => ({
            ...f,
            health: e.target.value
          }))
        }
        className="w-full md:w-44 border rounded-md px-3 py-2 text-sm"
      >
        <option value="">All Health</option>
        <option value="healthy">Healthy</option>
        <option value="at_risk">Needs Attention</option>
        <option value="overdue">Overdue</option>
      </select>

      {/* APPLY (mobile only) */}
      {onApply && (
        <button
          onClick={onApply}
          className="
            w-full md:w-auto
            bg-blue-600 text-white
            px-6 py-2.5
            rounded-md font-medium
          "
        >
          Apply Filters
        </button>
      )}
    </>
  );
}
