// componenets/leads/LeadStatusChip

"use client";

export default function LeadStatusChip({ stage }) {
  const map = {
    new: {
      label: "New",
      className: "bg-blue-50 text-blue-700"
    },
    follow_up: {
      label: "Follow Up",
      className: "bg-yellow-50 text-yellow-700"
    },
    quoted: {
      label: "Quoted",
      className: "bg-purple-50 text-purple-700"
    },
    closed_won: {
      label: "Closed Won",
      className: "bg-green-50 text-green-700"
    },
    closed_lost: {
      label: "Closed Lost",
      className: "bg-red-50 text-red-700"
    }
  };

  const s = map[stage] || {
    label: stage || "Unknown",
    className: "bg-gray-100 text-gray-600"
  };

  return (
    <span
      className={`
        inline-flex items-center
        px-2 py-1 rounded-full
        text-xs font-medium
        ${s.className}
      `}
    >
      {s.label}
    </span>
  );
}
