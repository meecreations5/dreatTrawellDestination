"use client";

import { Activity, CalendarDays, RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import { LEAD_CLOSING_POTENTIAL_OPTIONS } from "@/lib/leadPotential";
import { getLeadStageMeta } from "@/lib/leadStages";

const toDateInput = date => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDisplayDate = value => {
  if (!value) return "";
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
};

const sortOptions = [
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
  { value: "leadCode", label: "Lead Code A-Z" },
  { value: "stage", label: "Stage A-Z" },
  { value: "health", label: "Attention First" }
];

function followUpLabel(value) {
  return { overdue: "Overdue", today: "Due Today", upcoming: "Upcoming", none: "No Next Action" }[value] || value;
}

export default function LeadFilterBar({ filters, setFilters, stageOptions = [], locationOptions = { states: [], cities: [], subAreas: [] }, activeFilterCount = 0, resultCount = 0, onClearFilters }) {
  const updateFilter = (key, value) => setFilters(prev => {
    const next = { ...prev, [key]: value };
    if (key === "state") { next.city = ""; next.subArea = ""; }
    if (key === "city") next.subArea = "";
    return next;
  });

  const setDateRange = type => {
    const today = new Date();
    if (type === "today") {
      const date = toDateInput(today);
      setFilters(prev => ({ ...prev, dateFrom: date, dateTo: date }));
    }
    if (type === "last7") {
      const from = new Date(today);
      from.setDate(today.getDate() - 6);
      setFilters(prev => ({ ...prev, dateFrom: toDateInput(from), dateTo: toDateInput(today) }));
    }
    if (type === "thisMonth") {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      setFilters(prev => ({ ...prev, dateFrom: toDateInput(first), dateTo: toDateInput(today) }));
    }
  };

  const chips = [
    filters.search && ["Search", filters.search, () => updateFilter("search", "")],
    filters.workScope && filters.workScope !== "all" && ["Work", filters.workScope === "owned" ? "Owned by Me" : "Assigned to Me", () => updateFilter("workScope", "all")],
    filters.potential && ["Potential", filters.potential === "priority_attention" ? "Hot / At Risk" : LEAD_CLOSING_POTENTIAL_OPTIONS.find(item => item.value === filters.potential)?.label || filters.potential, () => updateFilter("potential", "")],
    filters.stage && ["Stage", getLeadStageMeta(filters.stage).label, () => updateFilter("stage", "")],
    filters.followUp && ["Follow-up", followUpLabel(filters.followUp), () => updateFilter("followUp", "")],
    filters.state && ["Agent State", filters.state, () => updateFilter("state", "")],
    filters.city && ["Agent City", filters.city, () => updateFilter("city", "")],
    filters.subArea && ["Agent Sub Area", filters.subArea, () => updateFilter("subArea", "")],
    filters.dateFrom && ["From", formatDisplayDate(filters.dateFrom), () => updateFilter("dateFrom", "")],
    filters.dateTo && ["To", formatDisplayDate(filters.dateTo), () => updateFilter("dateTo", "")]
  ].filter(Boolean);

  return (
    <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-gray-100 p-4">
        <div className="flex items-start gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><SlidersHorizontal size={18} /></div><div><h2 className="text-sm font-semibold text-gray-900">Lead Filters</h2><p className="mt-0.5 text-xs text-gray-500">{resultCount} matching leads · Owner is creator credit, Assignee is current workload.</p></div></div>
        {activeFilterCount > 0 ? <button type="button" onClick={onClearFilters} className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2.5 py-1 text-[11px] font-medium text-gray-500 hover:bg-gray-50"><RotateCcw size={12} /> Reset</button> : null}
      </div>

      <div className="space-y-4 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <div className="relative sm:col-span-2 xl:col-span-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input value={filters.search || ""} onChange={e => updateFilter("search", e.target.value)} placeholder="Lead code, destination, travel agent..." className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100" /></div>

          <select value={filters.workScope || "all"} onChange={e => updateFilter("workScope", e.target.value)} className="h-10 w-full min-w-0 rounded-xl border border-gray-200 px-3 text-sm"><option value="all">All My Leads</option><option value="owned">Owned by Me</option><option value="assigned">Assigned to Me</option></select>

          <select value={filters.potential || ""} onChange={e => updateFilter("potential", e.target.value)} className="h-10 w-full min-w-0 rounded-xl border border-gray-200 px-3 text-sm"><option value="">All Closing Potentials</option><option value="priority_attention">Hot / At Risk</option>{LEAD_CLOSING_POTENTIAL_OPTIONS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select>

          <div className="relative"><Activity size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><select value={filters.stage || ""} onChange={e => updateFilter("stage", e.target.value)} className="h-10 w-full min-w-0 rounded-xl border border-gray-200 pl-9 pr-8 text-sm"><option value="">All Stages</option>{stageOptions.map(stage => <option key={stage} value={stage}>{getLeadStageMeta(stage).label}</option>)}</select></div>

          <select value={filters.followUp || ""} onChange={e => updateFilter("followUp", e.target.value)} className="h-10 w-full min-w-0 rounded-xl border border-gray-200 px-3 text-sm"><option value="">All Follow-ups</option><option value="today">Due Today</option><option value="overdue">Overdue</option><option value="upcoming">Upcoming</option><option value="none">No Next Action</option></select>

          <select value={filters.state || ""} onChange={e => updateFilter("state", e.target.value)} className="h-10 w-full min-w-0 rounded-xl border border-gray-200 px-3 text-sm"><option value="">All Agent States</option>{locationOptions.states.map(value => <option key={value} value={value}>{value}</option>)}</select>
          <select value={filters.city || ""} onChange={e => updateFilter("city", e.target.value)} className="h-10 w-full min-w-0 rounded-xl border border-gray-200 px-3 text-sm"><option value="">All Agent Cities</option>{locationOptions.cities.map(value => <option key={value} value={value}>{value}</option>)}</select>
          <select value={filters.subArea || ""} onChange={e => updateFilter("subArea", e.target.value)} className="h-10 w-full min-w-0 rounded-xl border border-gray-200 px-3 text-sm"><option value="">All Agent Sub Areas</option>{locationOptions.subAreas.map(value => <option key={value} value={value}>{value}</option>)}</select>

          <select value={filters.sortBy || "newest"} onChange={e => updateFilter("sortBy", e.target.value)} className="h-10 w-full min-w-0 rounded-xl border border-gray-200 px-3 text-sm">{sortOptions.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
        </div>

        <div className="space-y-3 border-t border-gray-100 pt-3">
          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={() => setDateRange("today")} className="rounded-full border border-gray-200 px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-50">Today</button>
            <button type="button" onClick={() => setDateRange("last7")} className="rounded-full border border-gray-200 px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-50">Last 7 Days</button>
            <button type="button" onClick={() => setDateRange("thisMonth")} className="rounded-full border border-gray-200 px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-50">This Month</button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
            <label className="text-xs font-medium text-gray-500"><span className="mb-1 block">From</span><input type="date" value={filters.dateFrom || ""} onChange={e => updateFilter("dateFrom", e.target.value)} className="h-10 w-full rounded-xl border border-gray-200 px-3 text-sm text-gray-700" /></label>
            <label className="text-xs font-medium text-gray-500"><span className="mb-1 block">To</span><input type="date" value={filters.dateTo || ""} onChange={e => updateFilter("dateTo", e.target.value)} className="h-10 w-full rounded-xl border border-gray-200 px-3 text-sm text-gray-700" /></label>
          </div>
        </div>

        {chips.length ? <div className="flex flex-wrap gap-2">{chips.map(([label, value, clear]) => <button type="button" key={`${label}-${value}`} onClick={clear} className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700"><span>{label}: {value}</span><X size={11} /></button>)}</div> : null}
      </div>
    </div>
  );
}
