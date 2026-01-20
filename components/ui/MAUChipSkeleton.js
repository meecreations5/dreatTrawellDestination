// components/ui/MAUChipSkeleton.js
export function MAUChipSkeleton({ count = 3 }) {
  return (
    <div className="flex flex-wrap gap-1">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="
            h-6 w-16
            bg-gray-200
            rounded-full
            animate-pulse
          "
        />
      ))}
    </div>
  );
}
