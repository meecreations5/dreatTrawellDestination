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

export default function LeadsByDestinationChart({ leads }) {
  const data = useMemo(() => {
    const map = {};

    leads.forEach(l => {
      const dest = l.destinationName || "Unknown";
      map[dest] = (map[dest] || 0) + 1;
    });

    return Object.entries(map).map(
      ([destination, total]) => ({
        destination,
        total
      })
    );
  }, [leads]);

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4">
      <p className="text-sm font-medium mb-3">
        Leads by Destination
      </p>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <XAxis
            dataKey="destination"
            tick={{ fontSize: 11 }}
          />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar
            dataKey="total"
            fill="#2563eb"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
