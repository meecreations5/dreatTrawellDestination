"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from "recharts";

export default function RevenueByDestinationChart({ leads }) {
  const data = useMemo(() => {
    const map = {};

    leads.forEach(l => {
      if (l.stage !== "closed_won") return;

      const dest = l.destinationName || "Unknown";
      const amount =
        l.lastQuotedAmount ||
        l.totalQuotedAmount ||
        0;

      if (!map[dest]) map[dest] = 0;
      map[dest] += amount;
    });

    return Object.entries(map).map(
      ([destination, revenue]) => ({
        destination,
        revenue
      })
    );
  }, [leads]);

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4">
      <p className="text-sm font-medium mb-3">
        Revenue by Destination
      </p>

      <ResponsiveContainer width="100%" height={300}>
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
      </ResponsiveContainer>
    </div>
  );
}
