"use client";

export default function NoDataState({ label = "No data found" }) {
  return (
    <div className="p-6 text-center text-gray-500 text-sm">
      {label}
    </div>
  );
}
