"use client";

export default function StatusBadge({ status }) {
  const map = {
    // Generic
    pending: "bg-yellow-100 text-yellow-700",
    approved: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",

    // Attendance
    pending: "bg-yellow-100 text-yellow-800",
    approved: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
    present: "bg-green-100 text-green-700",
    leave: "bg-blue-100 text-blue-700",
    regularized: "bg-purple-100 text-purple-700",
    absent: "bg-red-100 text-red-700",
    "half-day": "bg-orange-100 text-orange-700",

    // Legacy / other flows
    completed: "bg-green-100 text-green-700",
    scheduled: "bg-yellow-100 text-yellow-700",
    cancelled: "bg-red-100 text-red-700"
  };

  const label = status
    ? status.replace(/_/g, " ")
    : "—";

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full
        text-xs font-semibold capitalize
        ${map[status] || "bg-gray-100 text-gray-600"}
      `}
    >
      {label}
    </span>
  );
}
