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

export default function EngagementByDestinationChart({
  engagements = []
}) {
  const data = useMemo(() => {
    const map = {};

    engagements.forEach(e => {
      // destinationNames can be string or array (as per your data)
      if (Array.isArray(e.destinationNames)) {
        e.destinationNames.forEach(name => {
          if (!name) return;
          map[name] = (map[name] || 0) + 1;
        });
      } else if (typeof e.destinationNames === "string") {
        map[e.destinationNames] =
          (map[e.destinationNames] || 0) + 1;
      }
    });

    return Object.entries(map).map(([name, count]) => ({
      name,
      count
    }));
  }, [engagements]);

  if (!data.length) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl p-4">
        <p className="text-sm text-gray-500">
          No destination engagement data available
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4">
      <h3 className="font-semibold mb-4">
        Engagements by Destination
      </h3>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="name"
            interval={0}
            angle={-30}
            textAnchor="end"
            height={80}
          />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
