"use client";

const STYLES = [
  { key: "family", label: "Family" },
  { key: "couple", label: "Couple" },
  { key: "luxury", label: "Luxury" },
  { key: "adventure", label: "Adventure" }
];

export default function TravelStyleChips({ value = {}, onChange }) {
  const toggle = key => {
    onChange({
      ...value,
      [key]: !value[key]
    });
  };

  return (
    <div className="flex flex-wrap gap-3">
      {STYLES.map(s => {
        const active = value[s.key];

        return (
          <button
            key={s.key}
            type="button"
            onClick={() => toggle(s.key)}
            className={`
              px-4 py-1.5 rounded-full text-sm font-medium
              transition
              ${
                active
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }
            `}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
