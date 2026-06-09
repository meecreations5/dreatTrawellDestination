"use client";

import {
  Activity,
  CalendarDays,
  Filter,
  HeartPulse,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X
} from "lucide-react";

/* =========================
   DATE HELPERS
========================= */
const toDateInput = date => {
  const d = new Date(date);

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const formatDisplayDate = value => {
  if (!value) return "";

  const date = new Date(`${value}T00:00:00`);

  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
};

const formatStage = value => {
  if (!value) return "Not Set";

  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, char => char.toUpperCase());
};

const healthOptions = [
  { value: "", label: "All Health" },
  { value: "healthy", label: "Healthy" },
  { value: "at_risk", label: "Needs Attention" },
  { value: "overdue", label: "Overdue" }
];

const sortOptions = [
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
  { value: "leadCode", label: "Lead Code A-Z" },
  { value: "stage", label: "Stage A-Z" },
  { value: "health", label: "Health Priority" }
];

export default function LeadFilterBar({
  filters,
  setFilters,
  stageOptions = [],
  activeFilterCount = 0,
  resultCount = 0,
  onClearFilters
}) {
  const updateFilter = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const setDateRange = type => {
    const today = new Date();

    if (type === "today") {
      const date = toDateInput(today);

      setFilters(prev => ({
        ...prev,
        dateFrom: date,
        dateTo: date
      }));
    }

    if (type === "yesterday") {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);

      const date = toDateInput(yesterday);

      setFilters(prev => ({
        ...prev,
        dateFrom: date,
        dateTo: date
      }));
    }

    if (type === "last7") {
      const from = new Date(today);
      from.setDate(today.getDate() - 6);

      setFilters(prev => ({
        ...prev,
        dateFrom: toDateInput(from),
        dateTo: toDateInput(today)
      }));
    }

    if (type === "thisMonth") {
      const firstDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        1
      );

      setFilters(prev => ({
        ...prev,
        dateFrom: toDateInput(firstDay),
        dateTo: toDateInput(today)
      }));
    }
  };

  const removeFilter = key => {
    if (key === "sortBy") {
      updateFilter("sortBy", "newest");
      return;
    }

    updateFilter(key, "");
  };

  const activeChips = [
    filters.search && {
      key: "search",
      label: `Search: ${filters.search}`
    },
    filters.stage && {
      key: "stage",
      label: `Stage: ${formatStage(filters.stage)}`
    },
    filters.health && {
      key: "health",
      label: `Health: ${
        healthOptions.find(h => h.value === filters.health)?.label ||
        filters.health
      }`
    },
    filters.dateFrom && {
      key: "dateFrom",
      label: `From: ${formatDisplayDate(filters.dateFrom)}`
    },
    filters.dateTo && {
      key: "dateTo",
      label: `To: ${formatDisplayDate(filters.dateTo)}`
    },
    filters.sortBy !== "newest" && {
      key: "sortBy",
      label: `Sort: ${
        sortOptions.find(s => s.value === filters.sortBy)?.label ||
        filters.sortBy
      }`
    }
  ].filter(Boolean);

  return (
    <div className="rounded-3xl border border-gray-200 bg-white shadow-sm overflow-hidden">

      {/* HEADER */}
      <div className="border-b border-gray-100 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center">
              <SlidersHorizontal size={18} />
            </div>

            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                Filters
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {resultCount} matching leads
              </p>
            </div>
          </div>

          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={onClearFilters}
              className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2.5 py-1 text-[11px] font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-900"
            >
              <RotateCcw size={12} />
              Reset
            </button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-5">

        {/* SEARCH */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">
            Search
          </label>

          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <input
              type="text"
              value={filters.search || ""}
              onChange={e =>
                updateFilter("search", e.target.value)
              }
              placeholder="Lead code, destination, owner..."
              className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>

        {/* STAGE */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">
            Stage
          </label>

          <div className="relative">
            <Activity
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <select
              value={filters.stage || ""}
              onChange={e =>
                updateFilter("stage", e.target.value)
              }
              className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 py-2.5 text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="">All Stages</option>

              {stageOptions.map(stage => (
                <option key={stage} value={stage}>
                  {formatStage(stage)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* HEALTH */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">
            Lead Health
          </label>

          <div className="relative">
            <HeartPulse
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <select
              value={filters.health || ""}
              onChange={e =>
                updateFilter("health", e.target.value)
              }
              className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 py-2.5 text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              {healthOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* SORT */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">
            Sort By
          </label>

          <select
            value={filters.sortBy || "newest"}
            onChange={e =>
              updateFilter("sortBy", e.target.value)
            }
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            {sortOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* DATE RANGE */}
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-600">
              <CalendarDays size={15} />
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-800">
                Date Range
              </p>
              <p className="text-[11px] text-gray-500">
                Filter by lead created date
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1">
                From
              </label>

              <input
                type="date"
                value={filters.dateFrom || ""}
                onChange={e =>
                  updateFilter("dateFrom", e.target.value)
                }
                className="w-full rounded-xl border border-gray-200 bg-white px-2.5 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1">
                To
              </label>

              <input
                type="date"
                value={filters.dateTo || ""}
                onChange={e =>
                  updateFilter("dateTo", e.target.value)
                }
                className="w-full rounded-xl border border-gray-200 bg-white px-2.5 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDateRange("today")}
              className="rounded-xl border border-gray-200 bg-white px-2 py-2 text-xs font-medium text-gray-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            >
              Today
            </button>

            <button
              type="button"
              onClick={() => setDateRange("yesterday")}
              className="rounded-xl border border-gray-200 bg-white px-2 py-2 text-xs font-medium text-gray-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            >
              Yesterday
            </button>

            <button
              type="button"
              onClick={() => setDateRange("last7")}
              className="rounded-xl border border-gray-200 bg-white px-2 py-2 text-xs font-medium text-gray-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            >
              Last 7 Days
            </button>

            <button
              type="button"
              onClick={() => setDateRange("thisMonth")}
              className="rounded-xl border border-gray-200 bg-white px-2 py-2 text-xs font-medium text-gray-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            >
              This Month
            </button>
          </div>

          {(filters.dateFrom || filters.dateTo) && (
            <button
              type="button"
              onClick={() =>
                setFilters(prev => ({
                  ...prev,
                  dateFrom: "",
                  dateTo: ""
                }))
              }
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900"
            >
              Clear Date Range
            </button>
          )}
        </div>

        {/* ACTIVE FILTER CHIPS */}
        {activeChips.length > 0 && (
          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Filter size={14} className="text-gray-400" />
              <p className="text-xs font-semibold text-gray-600">
                Active Filters
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {activeChips.map(chip => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => removeFilter(chip.key)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-100 px-2.5 py-1.5 text-[11px] font-medium text-blue-700 hover:bg-blue-100"
                >
                  <span className="max-w-[190px] truncate">
                    {chip.label}
                  </span>
                  <X size={12} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}