"use client";

import BottomSheetModal from "@/components/ui/BottomSheetModal";

export default function EngagementFilterModal({
  open,
  onClose,
  filters,
  setFilters
}) {
  return (
    <BottomSheetModal
      open={open}
      onClose={onClose}
      title="Filters"
      footer={
        <button
          onClick={onClose}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium"
        >
          Apply Filters
        </button>
      }
    >
      <Field
        label="Search"
        value={filters.search}
        onChange={v => setFilters(f => ({ ...f, search: v }))}
      />

      <Field
        label="Travel Agent"
        value={filters.travelAgent}
        onChange={v => setFilters(f => ({ ...f, travelAgent: v }))}
      />

      <Field
        label="SPOC"
        value={filters.spoc}
        onChange={v => setFilters(f => ({ ...f, spoc: v }))}
      />

      <Field
        label="Destination"
        value={filters.destination}
        onChange={v => setFilters(f => ({ ...f, destination: v }))}
      />

      <div className="mt-4">
        <label className="text-xs text-gray-500">
          Engagement Channel
        </label>
        <select
          value={filters.channel}
          onChange={e =>
            setFilters(f => ({ ...f, channel: e.target.value }))
          }
          className="w-full border rounded-lg px-3 py-2 mt-1"
        >
          <option value="all">All</option>
          <option value="email">Email</option>
          <option value="call">Call</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="meeting">Meeting</option>
        </select>
      </div>
    </BottomSheetModal>
  );
}

function Field({ label, value, onChange }) {
  return (
    <div className="mb-4">
      <label className="text-xs text-gray-500">
        {label}
      </label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full border rounded-lg px-3 py-2 mt-1"
      />
    </div>
  );
}
