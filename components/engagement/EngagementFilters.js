"use client";

import EngagementChip from "./EngagementChip";

const CHANNELS = [
  { key: "call", label: "Call", icon: "📞" },
  { key: "email", label: "Email", icon: "✉️" },
  { key: "whatsapp", label: "WhatsApp", icon: "💬" },
  { key: "meeting", label: "Meeting", icon: "🤝" }
];

export default function EngagementFilters({ value, onChange }) {
  const toggle = key => {
    onChange({
      ...value,
      [key]: !value[key]
    });
  };

  return (
    <div className="flex flex-wrap gap-3">
      {CHANNELS.map(c => (
        <EngagementChip
          key={c.key}
          label={c.label}
          icon={c.icon}
          active={value[c.key]}
          onClick={() => toggle(c.key)}
        />
      ))}
    </div>
  );
}
