import TravelChip from "./TravelChip";
import { TravelChipSkeleton } from "./TravelChipSkeleton";

export default function TravelChipGroup({
  items,
  loading = false,
  max = 3,
  icon = "destination",
  color = "neutral"
}) {
  if (loading) {
    return <TravelChipSkeleton count={max} />;
  }

  if (!Array.isArray(items) || items.length === 0) {
    return (
      <span className="text-xs text-gray-400">
        —
      </span>
    );
  }

  const safeItems = items.filter(Boolean);
  const visible = safeItems.slice(0, max);
  const extra = safeItems.length - max;

  return (
    <div className="flex flex-wrap gap-1 max-w-[240px]">
      {visible.map((item, i) => (
        <TravelChip
          key={`${item}-${i}`} // ✅ defensive key
          label={item}
          icon={icon}
          color={color}
        />
      ))}

      {extra > 0 && (
        <span className="text-xs text-gray-500">
          +{extra}
        </span>
      )}
    </div>
  );
}
