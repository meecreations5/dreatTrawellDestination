// components/ui/EngagementSkelton.js

"use client";

import { Skeleton } from "./Skeleton";

export default function EngagementSkeleton() {
  return (
    <div className="card space-y-3">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-3 w-2/3" />
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-3 w-1/4" />

      <div className="flex gap-2 pt-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-8 w-28" />
      </div>
    </div>
  );
}
