// components/ui/EmptyState.js

"use client";

export default function EmptyState({
  icon = "📭",
  title,
  description,
  hint
}) {
  return (
    <div className="bg-white rounded-xl shadow-card p-8 text-center space-y-3">
      <div className="text-4xl">{icon}</div>
      <h3 className="font-semibold text-sm">{title}</h3>
      <p className="text-sm text-gray-500">{description}</p>
      {hint && (
        <p className="text-xs text-blue-600">{hint}</p>
      )}
    </div>
  );
}
