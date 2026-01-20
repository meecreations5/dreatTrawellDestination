// components/ui/HeaderSkeleton.js

export default function HeaderSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      <div className="h-5 w-48 bg-gray-200 rounded" />
      <div className="h-3 w-32 bg-gray-200 rounded" />
    </div>
  );
}
