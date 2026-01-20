"use client";

export default function EngagementFilterSheet({
  open,
  onClose,
  filters,
  setFilters
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[10000]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Bottom Sheet */}
      <div
        className="
          absolute bottom-0 left-0 right-0
          bg-white rounded-t-2xl
          max-h-[90vh]
          flex flex-col
          shadow-2xl
        "
      >
        {/* Drag Handle */}
        <div className="flex justify-center py-2">
          <div className="w-10 h-1.5 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-4 pb-2 border-b font-medium">
          Filters
        </div>

        {/* Content */}
        <div
          className="
            flex-1 overflow-y-auto
            px-4 py-4 space-y-4
          "
        >
          <Field label="Search" value={filters.search}
            onChange={v => setFilters(f => ({ ...f, search: v }))} />

          <Field label="Travel Agent" value={filters.travelAgent}
            onChange={v => setFilters(f => ({ ...f, travelAgent: v }))} />

          <Field label="SPOC" value={filters.spoc}
            onChange={v => setFilters(f => ({ ...f, spoc: v }))} />

          <Field label="Destination" value={filters.destination}
            onChange={v => setFilters(f => ({ ...f, destination: v }))} />

          <div>
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
        </div>

        {/* Footer (safe-area aware) */}
        <div
          className="
            border-t px-4 py-3 bg-white
          "
          style={{
            paddingBottom:
              "calc(env(safe-area-inset-bottom, 0px) + 72px)"
          }}
        >
          <button
            onClick={onClose}
            className="
              w-full bg-blue-600 text-white
              py-3 rounded-lg font-medium
            "
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
}

/* Input */
function Field({ label, value, onChange }) {
  return (
    <div>
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
