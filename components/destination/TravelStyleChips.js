"use client";

const STYLE_GROUPS = [
  {
    title: "Traveller Type",
    options: [
      { key: "family", label: "Family" },
      { key: "couple", label: "Couple" },
      { key: "friends", label: "Friends" },
      { key: "group", label: "Group" },
      { key: "corporate", label: "Corporate" }
    ]
  },
  {
    title: "Budget Segment",
    options: [
      { key: "budget", label: "Budget" },
      { key: "premium", label: "Premium" },
      { key: "luxury", label: "Luxury" }
    ]
  },
  {
    title: "Experience Type",
    options: [
      { key: "shopping", label: "Shopping" },
      { key: "beach", label: "Beach" },
      { key: "adventure", label: "Adventure" },
      { key: "snow", label: "Snow" },
      { key: "food", label: "Food" },
      { key: "culture", label: "Culture" },
      { key: "nightlife", label: "Nightlife" },
      { key: "theme_park", label: "Theme Park" },
      { key: "nature", label: "Nature" },
      { key: "wellness", label: "Wellness" },
      { key: "cruise", label: "Cruise" },
      { key: "photography", label: "Photography" },
      { key: "romantic", label: "Romantic" }
    ]
  }
];

export default function TravelStyleChips({ value = {}, onChange }) {
  const selected = value || {};

  const toggle = key => {
    onChange?.({
      ...selected,
      [key]: !selected[key]
    });
  };

  const clearGroup = options => {
    const next = { ...selected };

    options.forEach(option => {
      next[option.key] = false;
    });

    onChange?.(next);
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 rounded-2xl border border-blue-100 bg-blue-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-blue-950">
            Destination Tags
          </h3>

          <p className="mt-1 text-xs text-blue-700">
            Select traveller type, budget segment, and experience type.
          </p>
        </div>

        <span className="w-fit rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm">
          {selectedCount} selected
        </span>
      </div>

      {STYLE_GROUPS.map(group => (
        <section
          key={group.title}
          className="rounded-2xl border border-slate-200 bg-white p-4"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold text-slate-900">
              {group.title}
            </h4>

            <button
              type="button"
              onClick={() => clearGroup(group.options)}
              className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              Clear
            </button>
          </div>

          <div className="flex flex-wrap gap-3">
            {group.options.map(option => {
              const active = Boolean(selected[option.key]);

              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => toggle(option.key)}
                  className={`
                    rounded-full px-4 py-1.5 text-sm font-medium transition
                    ${
                      active
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }
                  `}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}