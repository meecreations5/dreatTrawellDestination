// components/leads/AssignLeadModal.js

"use client";

import EngagementChip from "@/components/engagement/EngagementChip";

export default function LeadStageChip({ stage }) {
  const map = {
    new: { label: "New", icon: "🆕" },
    contacted: { label: "Contacted", icon: "📞" },
    proposal: { label: "Proposal", icon: "📄" },
    closed: { label: "Closed", icon: "🏁" }
  };

  const s = map[stage] || {
    label: stage || "Unknown",
    icon: "📌"
  };

  return (
    <EngagementChip
      label={s.label}
      icon={s.icon}
      active={stage === "closed"}
    />
  );
}
