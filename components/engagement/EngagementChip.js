"use client";

export default function EngagementChip({
  label,
  icon,
  active = false,
  onClick
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        flex items-center gap-2
        px-4 py-2
        rounded-full
        text-sm font-medium
        border
        transition
        ${
          active
            ? "bg-blue-50 text-blue-700 border-blue-200"
            : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
        }
      `}
    >
      {icon && <span className="text-base">{icon}</span>}
      <span>{label}</span>
    </button>
  );
}
