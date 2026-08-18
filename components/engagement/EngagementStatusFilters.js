"use client";

import EngagementChip from "@/components/engagement/EngagementChip";

export default function EngagementStatusFilters({
  value,
  onChange,
  counts
}) {
  const items = [
    { key: "all", label: "All", icon: "📋" },
    { key: "completed", label: "Completed", icon: "✅" },
    { key: "scheduled", label: "Scheduled", icon: "⏰" }
  ];

  return (
    <div className="flex gap-3 flex-wrap">
      {items.map(i => (
        <EngagementChip
          key={i.key}
          label={`${i.label} (${counts[i.key] || 0})`}
          icon={i.icon}
          active={value === i.key}
          onClick={() => onChange(i.key)}
        />
      ))}
    </div>
  );
}
