"use client";

import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer
} from "recharts";

const COLORS = {
  new: "#3b82f6",
  follow_up: "#f59e0b",
  quoted: "#8b5cf6",
  closed_won: "#22c55e",
  closed_lost: "#ef4444"
};

export default function LeadsByStageChart({ leads }) {
  const data = useMemo(() => {
    const map = {};
    leads.forEach(l => {
      map[l.stage] = (map[l.stage] || 0) + 1;
    });

    return Object.entries(map).map(
      ([stage, value]) => ({
        stage,
        value
      })
    );
  }, [leads]);

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4">
      <p className="text-sm font-medium mb-3">
        Leads by Stage
      </p>

      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="stage"
            outerRadius={80}
            label
          >
            {data.map(d => (
              <Cell
                key={d.stage}
                fill={COLORS[d.stage] || "#9ca3af"}
              />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
