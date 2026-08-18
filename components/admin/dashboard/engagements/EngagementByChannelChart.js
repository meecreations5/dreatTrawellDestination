"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from "recharts";

export default function EngagementByChannelChart({ engagements = [] }) {
  const data = useMemo(() => {
    const map = {};

    engagements.forEach(e => {
      const channel = e.channel || "unknown";
      map[channel] = (map[channel] || 0) + 1;
    });

    return Object.entries(map).map(([channel, count]) => ({
      channel,
      count
    }));
  }, [engagements]);

  if (!data.length) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl p-4">
        <p className="text-sm text-gray-500">
          No engagement data available
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4">
      <h3 className="font-semibold mb-4">
        Engagements by Channel
      </h3>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="channel" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
