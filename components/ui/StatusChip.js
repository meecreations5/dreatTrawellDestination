export function StatusChip({ label, color = "gray" }) {
  const colors = {
    green: "bg-green-100 text-green-700",
    yellow: "bg-yellow-100 text-yellow-700",
    red: "bg-red-100 text-red-700",
    blue: "bg-blue-100 text-blue-700",
    purple: "bg-purple-100 text-purple-700",
    gray: "bg-gray-100 text-gray-600"
  };

  return (
    <span
      className={`px-3 py-1 rounded-full text-xs font-semibold ${
        colors[color]
      }`}
    >
      {label}
    </span>
  );
}
