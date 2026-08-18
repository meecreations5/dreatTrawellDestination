  // components/ui/Skelton.js

  "use client";

  export function Skeleton({ className = "" }) {
    return (
      <div
        className={`animate-pulse rounded-lg bg-gray-200 ${className}`}
      />
    );
  }
