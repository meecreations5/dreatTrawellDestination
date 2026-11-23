"use client";

import { useMemo } from "react";
import { getBookingFinance } from "@/lib/reporting/businessIntelligence.mjs";
import { isCurrentWon } from "@/lib/reporting/leadReportingDates.mjs";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from "recharts";

export default function RevenueByDestinationChart({ leads }) {
  const {data,pending} = useMemo(() => {
    const map = new Map();
    let missing = 0;
    leads.forEach(lead => {
      if (!isCurrentWon(lead)) return;
      const finance = getBookingFinance(lead);
      if (!finance.verified) { missing += 1; return; }
      const dest = lead.destinationName || lead.destination || 'Unspecified destination';
      map.set(dest, (map.get(dest) || 0) + finance.sellingInr);
    });
    return {data:Array.from(map,([destination,revenue])=>({destination,revenue})),pending:missing};
  }, [leads]);

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4">
      <p className="text-sm font-medium mb-3">
        Confirmed Booked Value by Destination · INR
      </p>

      {pending > 0 && <p className="mb-2 text-xs text-amber-800">{pending} won booking(s) awaiting INR amount verification are excluded from this chart.</p>}
      {!data.length ? <p className="flex h-40 items-center justify-center text-sm text-slate-500">No reconciled INR bookings for this period.</p> : <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={data}
          layout="vertical"
        >
          <XAxis
            type="number"
            tickFormatter={v => `₹${v / 1000}k`}
          />
          <YAxis
            type="category"
            dataKey="destination"
            tick={{ fontSize: 11 }}
          />
          <Tooltip
            formatter={v =>
              `₹${v.toLocaleString()}`
            }
          />
          <Bar
            dataKey="revenue"
            fill="#22c55e"
            radius={[0, 4, 4, 0]}
          />
        </BarChart>
      </ResponsiveContainer>}
    </div>
  );
}
