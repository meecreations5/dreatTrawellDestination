"use client";

const COLOR_MAP = {
  blue: "text-blue-700",
  green: "text-green-700",
  red: "text-red-700",
  amber: "text-yellow-700"
};

export default function DashboardKpiCard({
  label,
  value,
  color = "gray"
}) {
  return (
    <div className="
      bg-white
      border border-gray-100
      rounded-xl
      p-4
    ">
      <p className="text-xs text-gray-500">
        {label}
      </p>
      <p
        className={`text-2xl font-semibold ${
          COLOR_MAP[color] || "text-gray-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
