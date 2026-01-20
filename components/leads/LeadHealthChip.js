// componenets/leads/LeadHeatChip

"use client";

import { getLeadHealth } from "@/lib/getLeadHealth";

/**
 * LeadHealthChip
 * Can accept either:
 *  - `lead` (recommended)
 *  - OR `health` (precomputed)
 */
export default function LeadHealthChip({ lead, health }) {
  // ✅ Compute health safely
  const computedHealth =
    health || (lead ? getLeadHealth(lead) : null);

  // ✅ Hard fallback (never crash UI)
  if (!computedHealth) {
    return (
      <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-500">
        Unknown
      </span>
    );
  }

  const colorMap = {
    green: "bg-green-100 text-green-700",
    amber: "bg-yellow-100 text-yellow-700",
    red: "bg-red-100 text-red-700"
  };

  return (
    <span
      className={`text-xs font-medium px-2 py-1 rounded-full ${
        colorMap[computedHealth.color] ||
        "bg-gray-100 text-gray-600"
      }`}
    >
      {computedHealth.label}
    </span>
  );
}
