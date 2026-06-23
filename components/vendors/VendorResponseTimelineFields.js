"use client";

import { useEffect } from "react";

const TAT_OPTIONS = [
  { value: "urgent_2_hours", label: "Urgent - 2 hrs" },
  { value: "same_day", label: "Same day" },
  { value: "within_4_working_hours", label: "4 working hrs" },
  { value: "within_24_hours", label: "24 hrs" },
  { value: "custom", label: "Custom" }
];

function toDateTimeLocalValue(date) {
  if (!date) return "";

  const pad = value => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function calculateTatDate(value) {
  const now = new Date();
  const result = new Date(now);

  if (value === "urgent_2_hours") {
    result.setHours(result.getHours() + 2);
    return result;
  }

  if (value === "same_day") {
    result.setHours(18, 0, 0, 0);

    if (result <= now) {
      result.setHours(now.getHours() + 2);
    }

    return result;
  }

  if (value === "within_24_hours") {
    result.setHours(result.getHours() + 24);
    return result;
  }

  result.setHours(result.getHours() + 4);
  return result;
}

export default function VendorResponseTimelineFields({
  expectedTat,
  setExpectedTat,
  expectedReplyBy,
  setExpectedReplyBy,
  autoFollowUpFromExpectedReply,
  setAutoFollowUpFromExpectedReply
}) {
  useEffect(() => {
    if (expectedTat === "custom") return;

    setExpectedReplyBy(
      toDateTimeLocalValue(calculateTatDate(expectedTat))
    );
  }, [expectedTat, setExpectedReplyBy]);

  return (
    <div className="rounded-2xl border border-rose-100 bg-rose-50/70 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-gray-900">
            Response Timeline
          </p>
          <p className="text-xs text-gray-500">
            Vendor reply TAT and follow-up tracking
          </p>
        </div>

        <label className="flex items-center gap-2 text-xs font-semibold text-gray-700">
          <input
            type="checkbox"
            checked={autoFollowUpFromExpectedReply}
            onChange={e =>
              setAutoFollowUpFromExpectedReply(e.target.checked)
            }
          />
          Auto follow-up
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label className="text-[11px] font-semibold text-gray-500">
            Expected TAT
          </label>

          <select
            value={expectedTat}
            onChange={e => setExpectedTat(e.target.value)}
            className="mt-1 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#1d4e89] focus:ring-2 focus:ring-[#1d4e89]/10"
          >
            {TAT_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] font-semibold text-gray-500">
            Expected Reply By
          </label>

          <input
            type="datetime-local"
            value={expectedReplyBy}
            onChange={e => setExpectedReplyBy(e.target.value)}
            className="mt-1 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#1d4e89] focus:ring-2 focus:ring-[#1d4e89]/10"
          />
        </div>
      </div>
    </div>
  );
}