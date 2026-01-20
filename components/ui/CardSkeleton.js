// components/ui/CardSkeleton.js

"use client";

import { Skeleton } from "./Skeleton";

export default function CardSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-card p-4 space-y-3">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-3 w-2/3" />
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-8 w-32" />
    </div>
  );
}
