// components/ui/MAUChip.js
export default function MAUChip({
  label,
  variant = "destination",
  onRemove,
  disabled = false
}) {
  if (!label) return null;

  const variants = {
    destination:
      "bg-indigo-50 text-indigo-800 border-indigo-200",
    product:
      "bg-cyan-50 text-cyan-800 border-cyan-200",
    neutral:
      "bg-gray-100 text-gray-700 border-gray-200"
  };

  return (
    <span
      className={`
        group inline-flex items-center gap-1.5
        px-3 py-1 text-xs font-medium
        border rounded-full
        whitespace-nowrap
        transition
        ${disabled
          ? "opacity-50 cursor-not-allowed"
          : "hover:shadow-sm"}
        ${variants[variant]}
      `}
    >
      <span className="truncate max-w-[120px]">
        {label}
      </span>

      {onRemove && !disabled && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${label}`}
          className="
            ml-1 text-xs opacity-0
            group-hover:opacity-100
            transition
          "
        >
          ✕
        </button>
      )}
    </span>
  );
}
