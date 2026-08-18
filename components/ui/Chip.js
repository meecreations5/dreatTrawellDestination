// components/ui/Chip.js

"use client";

import { MapPin } from "lucide-react";

export default function Chip({
  label,
  icon: Icon = MapPin,
  color = "primary"
}) {
  const map = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning"
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full font-medium ${map[color]}`}
    >
      <Icon size={14} />
      {label}
    </span>
  );
}
