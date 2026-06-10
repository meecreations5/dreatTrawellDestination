// componenets/leads/LeadStatusChip

"use client";

export default function LeadStatusChip({ stage }) {
  const map = {
    new: {
      label: "New",
      className: "bg-gray-50 text-gray-700 border-gray-200"
    },
    assigned: {
      label: "Assigned",
      className: "bg-indigo-50 text-indigo-700 border-indigo-100"
    },
    follow_up: {
      label: "Follow Up",
      className: "bg-blue-50 text-blue-700 border-blue-100"
    },
    vendor_pricing_requested: {
      label: "Vendor Pricing",
      className: "bg-amber-50 text-amber-700 border-amber-100"
    },

    awaiting_vendor_revert: {
      label: "Awaiting Vendor",
      className: "bg-orange-50 text-orange-700 border-orange-100"
    },
    quoted: {
      label: "Quoted",
      className: "bg-purple-50 text-purple-700 border-purple-100"
    },
    closed_won: {
      label: "Closed Won",
      className: "bg-green-50 text-green-700 border-green-100"
    },
    
    closed_lost: {
      label: "Closed Lost",
      className: "bg-red-50 text-red-700 border-red-100"
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
