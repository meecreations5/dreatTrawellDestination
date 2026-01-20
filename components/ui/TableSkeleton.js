"use client";

export function TableSkeleton({ rows = 5, cols = 5 }) {
  return (
    <div className="bg-white rounded-xl shadow p-4 animate-pulse">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="flex gap-4 mb-3">
          {[...Array(cols)].map((_, j) => (
            <div
              key={j}
              className="h-4 bg-gray-200 rounded w-full"
            />
          ))}
        </div>
      ))}
    </div>
  );
}
