// components/leads/LeadStatusChip.jsx

"use client";

import { getLeadStageMeta } from "@/lib/leadStages";

const toneClassMap = {
  gray: "bg-gray-50 text-gray-700 border-gray-200",
  amber: "bg-amber-50 text-amber-700 border-amber-100",
  blue: "bg-blue-50 text-blue-700 border-blue-100",
  orange: "bg-orange-50 text-orange-700 border-orange-100",
  purple: "bg-purple-50 text-purple-700 border-purple-100",
  violet: "bg-violet-50 text-violet-700 border-violet-100",
  red: "bg-red-50 text-red-700 border-red-100",
  yellow: "bg-yellow-50 text-yellow-700 border-yellow-100",
  green: "bg-green-50 text-green-700 border-green-100",
  rose: "bg-rose-50 text-rose-700 border-rose-100",
  cyan: "bg-cyan-50 text-cyan-700 border-cyan-100"
};

export default function LeadStatusChip({ stage }) {
  const meta = getLeadStageMeta(stage);

  return (
    <span
      className={`
        inline-flex items-center
        px-2 py-1 rounded-full border
        text-xs font-medium
        ${toneClassMap[meta.tone] || toneClassMap.gray}
      `}
    >
      {meta.label}
    </span>
  );
}