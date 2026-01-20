"use client";

export default function EngagementKpiCard({
  label,
  value,
  color = "gray"
}) {
  const colorMap = {
    gray: "text-gray-800",
    blue: "text-blue-600",
    green: "text-green-600",
    amber: "text-amber-600",
    purple: "text-purple-600"
  };

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
      <p className="text-xs text-gray-500 mb-1">
        {label}
      </p>

      <p
        className={`text-xl font-bold ${
          colorMap[color] || colorMap.gray
        }`}
      >
        {value}
      </p>
    </div>
  );
}
