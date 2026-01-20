import { useState } from "react";

export default function AttendanceCalendar({ records }) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const map = {};
  records.forEach(r => (map[r.date] = r));

  const getColor = status => {
    switch (status) {
      case "present": return "bg-green-200";
      case "leave": return "bg-blue-200";
      case "regularized": return "bg-purple-200";
      case "half-day": return "bg-yellow-200";
      case "absent": return "bg-red-200";
      default: return "bg-gray-100";
    }
  };

  return (
    <div className="grid grid-cols-7 gap-2 mt-4">
      {[...Array(daysInMonth)].map((_, i) => {
        const d = new Date(year, month, i + 1)
          .toISOString()
          .slice(0, 10);

        const rec = map[d];

        return (
          <div
            key={d}
            className={`h-20 rounded-lg p-2 text-xs cursor-pointer ${
              getColor(rec?.status)
            }`}
            title={
              rec
                ? `${rec.status} • ${(rec.totalMinutes / 60).toFixed(1)} hrs`
                : "No record"
            }
          >
            <div className="font-bold">{i + 1}</div>
            {rec && (
              <div className="mt-1 text-[10px]">
                {(rec.totalMinutes / 60).toFixed(1)} hrs
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
