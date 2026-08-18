"use client";

import { LEAD_STAGE_OPTIONS } from "@/lib/leadStages";
import { LEAD_CLOSING_POTENTIAL_OPTIONS } from "@/lib/leadPotential";
import { formatTravelMonthLabel } from "@/lib/leadTravelDates";
import {
  Download,
  Grid3X3,
  List,
  RotateCcw,
  Search,
  ShieldCheck,
  X
} from "lucide-react";

const INITIAL = {
  search: "",
  owner: "all",
  assignedTo: "all",
  potential: "all",
  stage: "all",
  followUp: "all",
  destination: "all",
  state: "",
  city: "",
  subArea: "",
  travelMonth: "all",
  openOnly: false,
  priorityAttention: false
};

export default function AdminLeadFilters({
  view,
  setView,
  filters,
  setFilters,
  ownerOptions = [],
  assigneeOptions = [],
  destinationOptions = [],
  locationOptions = { states: [], cities: [], subAreas: [] },
  travelMonthOptions = [],
  totalCount = 0,
  filteredCount = 0,
  isSuperAdmin = false,
  onExport
}) {
  const updateFilter = (key, value) => {
    setFilters(prev => {
      const next = { ...prev, [key]: value };
      if (key === "state") { next.city = ""; next.subArea = ""; }
      if (key === "city") next.subArea = "";
      return next;
    });
  };

  const resetFilters = () => setFilters(INITIAL);

  const selectedOwner = ownerOptions.find(item => item.value === filters.owner);
  const selectedAssignee = assigneeOptions.find(item => item.value === filters.assignedTo);

  const chips = [
    filters.owner !== "all" && {
      key: "owner",
      label: `Owner: ${selectedOwner?.label || "Selected user"}`,
      clear: () => updateFilter("owner", "all")
    },
    filters.assignedTo !== "all" && {
      key: "assignedTo",
      label:
        filters.assignedTo === "unassigned"
          ? "Assignee: Unassigned"
          : `Assignee: ${selectedAssignee?.label || "Selected user"}`,
      clear: () => updateFilter("assignedTo", "all")
    },
    filters.priorityAttention && {
      key: "priorityAttention",
      label: "Potential: Hot / At Risk",
      clear: () => updateFilter("priorityAttention", false)
    },
    filters.potential !== "all" && {
      key: "potential",
      label: `Potential: ${LEAD_CLOSING_POTENTIAL_OPTIONS.find(item => item.value === filters.potential)?.label || filters.potential}`,
      clear: () => updateFilter("potential", "all")
    },
    filters.stage !== "all" && {
      key: "stage",
      label: `Stage: ${LEAD_STAGE_OPTIONS.find(item => item.value === filters.stage)?.label || filters.stage}`,
      clear: () => updateFilter("stage", "all")
    },
    filters.followUp !== "all" && {
      key: "followUp",
      label: `Follow-up: ${followUpLabel(filters.followUp)}`,
      clear: () => updateFilter("followUp", "all")
    },
    filters.destination !== "all" && {
      key: "destination",
      label: `Destination: ${filters.destination}`,
      clear: () => updateFilter("destination", "all")
    },
    filters.state && { key: "state", label: `Agent State: ${filters.state}`, clear: () => updateFilter("state", "") },
    filters.city && { key: "city", label: `Agent City: ${filters.city}`, clear: () => updateFilter("city", "") },
    filters.subArea && { key: "subArea", label: `Agent Sub Area: ${filters.subArea}`, clear: () => updateFilter("subArea", "") },
    filters.travelMonth !== "all" && {
      key: "travelMonth",
      label: filters.travelMonth === "missing" ? "Travel Date: Missing" : `Travel Month: ${formatTravelMonthLabel(filters.travelMonth)}`,
      clear: () => updateFilter("travelMonth", "all")
    },
    filters.openOnly && {
      key: "openOnly",
      label: "Open leads only",
      clear: () => updateFilter("openOnly", false)
    }
  ].filter(Boolean);

  return (
    <div className="sticky top-4 z-20 rounded-2xl border border-gray-100 bg-white/95 p-3 shadow-sm backdrop-blur">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
        <div>
          <p className="text-xs font-semibold text-gray-800">Lead Filters</p>
          <p className="mt-0.5 text-[10px] text-gray-400">
            Global Date + Team apply above. Owner = creator credit; Assignee = current responsibility.
          </p>
        </div>
        <p className="text-[11px] font-semibold text-gray-600">
          {filteredCount} / {totalCount} visible
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-5 2xl:grid-cols-10">
        <div className="relative xl:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={filters.search || ""}
            onChange={e => updateFilter("search", e.target.value)}
            placeholder="Search lead, customer, phone, agent"
            className="h-10 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-xs text-gray-700 outline-none transition placeholder:text-gray-400 hover:border-blue-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <FilterSelect
          value={filters.owner || "all"}
          onChange={value => updateFilter("owner", value)}
          ariaLabel="Lead owner"
        >
          <option value="all">All Lead Owners</option>
          {ownerOptions.map(member => (
            <option key={member.value} value={member.value}>{member.label}</option>
          ))}
        </FilterSelect>

        <FilterSelect
          value={filters.assignedTo || "all"}
          onChange={value => updateFilter("assignedTo", value)}
          ariaLabel="Current assignee"
        >
          <option value="all">All Current Assignees</option>
          <option value="unassigned">Unassigned</option>
          {assigneeOptions.map(member => (
            <option key={member.value} value={member.value}>{member.label}</option>
          ))}
        </FilterSelect>

        <FilterSelect
          value={filters.potential || "all"}
          onChange={value => updateFilter("potential", value)}
          ariaLabel="Lead closing potential"
        >
          <option value="all">All Closing Potentials</option>
          {LEAD_CLOSING_POTENTIAL_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </FilterSelect>

        <FilterSelect
          value={filters.stage || "all"}
          onChange={value => updateFilter("stage", value)}
          ariaLabel="Lead stage"
        >
          <option value="all">All Stages</option>
          {LEAD_STAGE_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </FilterSelect>

        <FilterSelect
          value={filters.followUp || "all"}
          onChange={value => updateFilter("followUp", value)}
          ariaLabel="Follow-up status"
        >
          <option value="all">All Follow-ups</option>
          <option value="today">Due Today</option>
          <option value="overdue">Overdue</option>
          <option value="upcoming">Upcoming</option>
          <option value="none">No Next Action</option>
        </FilterSelect>

        <FilterSelect
          value={filters.destination || "all"}
          onChange={value => updateFilter("destination", value)}
          ariaLabel="Destination"
        >
          <option value="all">All Destinations</option>
          {destinationOptions.map(destination => (
            <option key={destination} value={destination}>{destination}</option>
          ))}
        </FilterSelect>

        <FilterSelect
          value={filters.travelMonth || "all"}
          onChange={value => updateFilter("travelMonth", value)}
          ariaLabel="Travel month"
        >
          <option value="all">All Travel Months</option>
          <option value="missing">Travel Date Missing</option>
          {travelMonthOptions.map(monthKey => (
            <option key={monthKey} value={monthKey}>{formatTravelMonthLabel(monthKey)}</option>
          ))}
        </FilterSelect>

        <label className="flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-xs font-medium text-gray-600">
          <input
            type="checkbox"
            checked={Boolean(filters.openOnly)}
            onChange={event => updateFilter("openOnly", event.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600"
          />
          Open leads only
        </label>

        <FilterSelect value={filters.state || ""} onChange={value => updateFilter("state", value)} ariaLabel="Agent state">
          <option value="">All Agent States</option>
          {locationOptions.states.map(value => <option key={value} value={value}>{value}</option>)}
        </FilterSelect>
        <FilterSelect value={filters.city || ""} onChange={value => updateFilter("city", value)} ariaLabel="Agent city">
          <option value="">All Agent Cities</option>
          {locationOptions.cities.map(value => <option key={value} value={value}>{value}</option>)}
        </FilterSelect>
        <FilterSelect value={filters.subArea || ""} onChange={value => updateFilter("subArea", value)} ariaLabel="Agent sub area">
          <option value="">All Agent Sub Areas</option>
          {locationOptions.subAreas.map(value => <option key={value} value={value}>{value}</option>)}
        </FilterSelect>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
        {chips.length ? chips.map(chip => (
          <button
            type="button"
            key={chip.key}
            onClick={chip.clear}
            className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700"
          >
            {chip.label}
            <X className="h-3 w-3" />
          </button>
        )) : (
          <span className="text-[11px] text-gray-400">No page-specific filters applied</span>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {isSuperAdmin && (
            <div className="hidden items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-medium text-violet-700 xl:inline-flex">
              <ShieldCheck className="h-3.5 w-3.5" />
              Super admin
            </div>
          )}

          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Page Filters
          </button>

          {onExport ? (
            <button
              type="button"
              onClick={onExport}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-xs font-medium text-gray-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
          ) : null}

          <div className="flex overflow-hidden rounded-xl border border-gray-200 bg-white">
            <button
              type="button"
              onClick={() => setView("card")}
              className={`flex h-9 w-9 items-center justify-center transition ${view === "card" ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-50"}`}
              title="Card view"
            >
              <Grid3X3 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setView("table")}
              className={`flex h-9 w-9 items-center justify-center border-l border-gray-200 transition ${view === "table" ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-50"}`}
              title="Table view"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterSelect({ value, onChange, children, ariaLabel }) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={e => onChange(e.target.value)}
      className="h-10 min-w-0 rounded-xl border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 outline-none transition hover:border-blue-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
    >
      {children}
    </select>
  );
}

function followUpLabel(value) {
  const labels = {
    today: "Due Today",
    overdue: "Overdue",
    upcoming: "Upcoming",
    none: "No Next Action"
  };
  return labels[value] || value;
}
