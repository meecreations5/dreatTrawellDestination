"use client";

import { useMemo } from "react";

export default function TeamPerformanceTable({ leads }) {
  const rows = useMemo(() => {
    const map = {};

    leads.forEach(l => {
      const uid = l.assignedToUid;
      if (!uid) return;

      if (!map[uid]) {
        map[uid] = {
          name: l.assignedTo || "User",
          totalLeads: 0,
          wonLeads: 0,
          lostLeads: 0,
          revenue: 0
        };
      }

      map[uid].totalLeads += 1;

      if (l.stage === "closed_won") {
        map[uid].wonLeads += 1;

        const amount =
          l.lastQuotedAmount ||
          l.totalQuotedAmount ||
          0;

        map[uid].revenue += amount;
      }

      if (l.stage === "closed_lost") {
        map[uid].lostLeads += 1;
      }
    });

    return Object.values(map).map(u => ({
      ...u,
      conversion:
        u.totalLeads > 0
          ? Math.round(
            (u.wonLeads / u.totalLeads) * 100
          )
          : 0,
      avgDeal:
        u.wonLeads > 0
          ? Math.round(u.revenue / u.wonLeads)
          : 0
    }));
  }, [leads]);

  return (
    <div className="
      bg-white
      border border-gray-100
      rounded-xl
      p-4
    ">
      <p className="text-sm font-medium mb-3">
        Team Revenue & Conversion
      </p>

      <table className="w-full text-sm">
        <thead className="text-gray-500">
          <tr>
            <th className="text-left py-2">
              Team Member
            </th>
            <th>Total Leads</th>
            <th>Won</th>
            <th>Revenue (₹)</th>
            <th>Avg Deal (₹)</th>
            <th>Conversion %</th>
          </tr>
        </thead>

        <tbody>
          {rows.map(r => (
            <tr
              key={r.name}
              className="border-t border-gray-100"
            >
              <td className="py-2 font-medium">
                {r.name}
              </td>

              <td className="text-center">
                {r.totalLeads}
              </td>

              <td className="text-center text-green-600">
                {r.wonLeads}
              </td>

              <td className="text-center font-medium">
                ₹{r.revenue.toLocaleString()}
              </td>

              <td className="text-center">
                ₹{r.avgDeal.toLocaleString()}
              </td>

              <td className="text-center">
                <span
                  className={`font-medium ${r.conversion >= 40
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
