"use client";

import { useMemo } from "react";

export default function LeadsByDestinationTable({ leads }) {
  const rows = useMemo(() => {
    const map = {};

    leads.forEach(l => {
      const dest =
        l.destinationName || "Unknown";

      if (!map[dest]) {
        map[dest] = {
          destination: dest,
          total: 0,
          won: 0,
          revenue: 0
        };
      }

      map[dest].total += 1;

      if (l.stage === "closed_won") {
        map[dest].won += 1;

        const amount =
          l.lastQuotedAmount ||
          l.totalQuotedAmount ||
          0;

        map[dest].revenue += amount;
      }
    });

    return Object.values(map).map(d => ({
      ...d,
      conversion:
        d.total > 0
          ? Math.round((d.won / d.total) * 100)
          : 0
    }));
  }, [leads]);

  return (
    <div
      className="
        bg-white
        border border-gray-100
        rounded-xl
        p-4
      "
    >
      <p className="text-sm font-medium mb-3">
        Leads by Destination
      </p>

      <table className="w-full text-sm">
        <thead className="text-gray-500">
          <tr>
            <th className="text-left py-2">
              Destination
            </th>
            <th>Total</th>
            <th>Won</th>
            <th>Revenue (₹)</th>
            <th>Conversion %</th>
          </tr>
        </thead>

        <tbody>
          {rows.map(r => (
            <tr
              key={r.destination}
              className="border-t border-gray-100"
            >
              <td className="py-2 font-medium">
                {r.destination}
              </td>

              <td className="text-center">
                {r.total}
              </td>

              <td className="text-center text-green-600">
                {r.won}
              </td>

              <td className="text-center font-medium">
                ₹{r.revenue.toLocaleString()}
              </td>

              <td className="text-center">
                <span
                  className={`font-medium ${
                    r.conversion >= 40
                      ? "text-green-600"
                      : r.conversion >= 20
                      ? "text-yellow-600"
                      : "text-red-600"
                  }`}
                >
                  {r.conversion}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
