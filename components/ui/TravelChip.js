"use client";

import {
  MapPin,
  Plane,
  Calendar,
  User,
  Mail,
  Phone,
  MessageCircle,
  Users,
  CheckCircle,
  AlertTriangle
} from "lucide-react";

const ICON_MAP = {
  /* Existing */
  destination: MapPin,
  travel: Plane,
  date: Calendar,
  agent: User,

  /* Added for Agents / Leads UI */
  leads: Users,
  location: MapPin,

  email: Mail,
  call: Phone,
  whatsapp: MessageCircle,
  meeting: Users,

  engaged: CheckCircle,
  warning: AlertTriangle
};

const COLOR_MAP = {
  primary: "bg-blue-50 text-blue-700 border-blue-200",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  neutral: "bg-gray-50 text-gray-700 border-gray-200"
};

export default function TravelChip({
  label,
  icon = "destination",
  color = "neutral",
  className = ""
}) {
  if (!label) return null;

  const Icon = ICON_MAP[icon] || MapPin;

  return (
    <span
      className={`
        inline-flex items-center gap-1.5
        px-2.5 py-1
        text-xs font-medium
        rounded-full border
        whitespace-nowrap
        max-w-[160px]
        truncate
        ${COLOR_MAP[color]}
        ${className}
      `}
      title={label}
    >
      <Icon size={14} className="shrink-0" />
      <span className="truncate">{label}</span>
    </span>
  );
}
