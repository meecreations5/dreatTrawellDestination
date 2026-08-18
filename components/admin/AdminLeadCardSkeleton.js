"use client";

export default function AdminLeadCardSkeleton() {
  return (
    <div className="
      bg-white
      rounded-xl
      border border-gray-100
      p-4
      space-y-3
      animate-pulse
    ">
      <div className="flex justify-between">
        <div className="space-y-2">
          <div className="h-4 w-36 bg-gray-200 rounded" />
          <div className="h-3 w-24 bg-gray-200 rounded" />
        </div>
        <div className="h-5 w-20 bg-gray-200 rounded-full" />
      </div>

      <div className="flex gap-2">
        <div className="h-5 w-24 bg-gray-200 rounded-full" />
        <div className="h-5 w-20 bg-gray-200 rounded-full" />
      </div>

      <div className="flex justify-between items-center">
        <div className="flex gap-2 items-center">
          <div className="h-7 w-7 bg-gray-200 rounded-full" />
          <div className="h-3 w-24 bg-gray-200 rounded" />
        </div>
        <div className="h-3 w-28 bg-gray-200 rounded" />
      </div>
    </div>
  );
}
