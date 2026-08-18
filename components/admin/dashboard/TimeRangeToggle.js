"use client";

export default function TimeRangeToggle({ value, onChange }) {
  const options = [
    { key: "today", label: "Today" },
    { key: "7d", label: "Last 7 days" },
    { key: "30d", label: "Last 30 days" }
  ];

  return (
    <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
      {options.map(o => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={`px-3 py-1.5 text-sm rounded-md transition
            ${
              value === o.key
                ? "bg-white shadow text-gray-900 font-medium"
                : "text-gray-500 hover:text-gray-700"
            }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
