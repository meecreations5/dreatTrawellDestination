"use client";

export default function TravelChipSkeleton({ count = 3 }) {
  return (
    <div className="flex gap-2 max-w-[240px]">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`
            h-5
            rounded-full
            bg-gray-200
            animate-pulse
            ${i % 2 === 0 ? "w-20" : "w-14"}
          `}
        />
      ))}
    </div>
  );
}
