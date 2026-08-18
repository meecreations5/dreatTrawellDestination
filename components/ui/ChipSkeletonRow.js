
// components/ui/ChipSkeltonRow.js

export default function ChipSkeletonRow() {
  return (
    <div className="flex gap-2 animate-pulse">
      {[1, 2, 3].map(i => (
        <div
          key={i}
          className="h-8 w-24 bg-gray-200 rounded-full"
        />
      ))}
    </div>
  );
}
