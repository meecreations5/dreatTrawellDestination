"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from "recharts";

export default function LeadsTrendChart({ leads }) {
  const data = useMemo(() => {
    const map = {};

    leads.forEach(l => {
      const d = l.createdAt?.toDate?.();
      if (!d) return;

      const key = d.toLocaleDateString();
      map[key] = (map[key] || 0) + 1;
    });

    return Object.entries(map)
      .map(([date, count]) => ({
        date,
        count
      }))
      .slice(-14);
  }, [leads]);

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4">
      <p className="text-sm font-medium mb-3">
        Leads Trend
      </p>

      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data}>
          <XAxis dataKey="date" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="count"
            stroke="#2563eb"
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
