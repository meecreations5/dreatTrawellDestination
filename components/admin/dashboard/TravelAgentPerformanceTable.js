"use client";

import { useMemo } from "react";

export default function TravelAgentPerformanceTable({ leads = [] }) {
    const rows = useMemo(() => {
        const map = {};

        leads.forEach(l => {
            const agentId = l.agentId;
            if (!agentId) return;

            if (!map[agentId]) {
                map[agentId] = {
                    id: agentId,
                    name: l.agentName || "Travel Agent",
                    totalLeads: 0,
                    wonLeads: 0,
                    revenue: 0
                };
            }

            map[agentId].totalLeads += 1;

            if (l.status === "won") {
                map[agentId].wonLeads += 1;
                map[agentId].revenue += Number(l.dealValue || 0);
            }
        });

        return Object.values(map).map(a => ({
            ...a,
            conversion:
                a.totalLeads > 0
                    ? Math.round((a.wonLeads / a.totalLeads) * 100)
                    : 0,
            avgDeal:
                a.wonLeads > 0
                    ? Math.round(a.revenue / a.wonLeads)
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
                Travel Agent Performance
            </p>

            <table className="w-full text-sm">
                <thead className="text-gray-500">
                    <tr>
                        <th className="text-left py-2">Agent</th>
                        <th className="text-center">Leads</th>
                        <th className="text-center">Won</th>
                        <th className="text-center">Conversion</th>
                        <th className="text-center">Revenue</th>
                        <th className="text-center">Avg Deal</th>
                    </tr>
                </thead>

                <tbody>
                    {rows.map(r => (
                        <tr key={r.id} className="border-t border-gray-100">
                            <td className="px-4 py-2 font-medium">{r.name}</td>
                            <td className="text-center">{r.totalLeads}</td>
                            <td className="text-center text-green-600">{r.wonLeads}</td>
                            <td className="text-center">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.conversion >= 40
                                    ? "bg-green-100 text-green-700"
                                    : r.conversion >= 20
                                        ? "bg-yellow-100 text-yellow-700"
                                        : "bg-red-100 text-red-700"
                                    }`}>
                                    {r.conversion}%
                                </span>
                            </td>
                            <td className="text-center font-medium">
                                ₹{r.revenue.toLocaleString()}
                            </td>
                            <td className="text-center">
                                ₹{r.avgDeal.toLocaleString()}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
