"use client";

export default function SelectableChip({
  label,
  icon,
  selected,
  onClick
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        inline-flex items-center gap-1.5
        px-3 py-1.5 rounded-full text-sm
        border transition
        ${
          selected
            ? "bg-blue-600 text-white border-blue-600"
            : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
        }
      `}
    >
      <span>{icon}</span>
      {label}
    </button>
  );
}
