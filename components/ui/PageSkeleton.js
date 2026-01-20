"use client";

export default function PageSkeleton({ lines = 4 }) {
  return (
    <div className="p-6 animate-pulse max-w-md mx-auto">
      <div className="h-6 bg-gray-200 rounded w-1/2 mb-4" />
      {[...Array(lines)].map((_, i) => (
        <div
          key={i}
          className="h-4 bg-gray-200 rounded w-full mb-2"
        />
      ))}
    </div>
  );
}
