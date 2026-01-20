"use client";

import { Download } from "lucide-react";

export default function AdminTemplateCategoryFilters({
  search,
  type,
  setSearch,
  setType,
  onExport
}) {
  return (
    <div
      className="
        sticky top-0 z-20
        bg-white/90 backdrop-blur
        border border-gray-100
        rounded-xl
        p-3
        mb-4
      "
    >
      <div className="flex flex-wrap gap-3 items-center justify-between">

        {/* LEFT FILTERS */}
        <div className="flex flex-wrap gap-2">

          {/* SEARCH */}
          <input
            placeholder="Search category"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="text-xs px-3 py-2 border border-gray-100 rounded-lg bg-white"
          />

          {/* TYPE */}
          <select
            value={type}
            onChange={e => setType(e.target.value)}
            className="text-xs px-3 py-2 border border-gray-100 rounded-lg bg-white"
          >
            <option value="all">All Types</option>
            <option value="required">Requires Attachment</option>
            <option value="not_required">No Attachment</option>
          </select>
        </div>

        {/* RIGHT ACTIONS */}
        <div className="flex items-center gap-2">
          <button
            onClick={onExport}
            className="
              inline-flex items-center gap-1.5
              border border-gray-100
              rounded-lg
              px-3 py-2
              text-xs
              text-gray-600
              hover:bg-gray-50
            "
          >
            <Download size={14} />
            Export
          </button>
        </div>
      </div>
    </div>
  );
}
