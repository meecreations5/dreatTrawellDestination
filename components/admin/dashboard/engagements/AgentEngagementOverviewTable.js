"use client";

import { useMemo } from "react";

export default function AgentEngagementOverviewTable({
  engagements = [],
  leads = []
}) {
  const rows = useMemo(() => {
    const map = {};

    /* ---------------- ENGAGEMENT SIDE ---------------- */
    engagements.forEach(e => {
      if (!e.agentId) return;

      if (!map[e.agentId]) {
        map[e.agentId] = {
          agentId: e.agentId,
          agentName: e.agentName || "—",
          engagementCount: 0,
          destinations: new Set(),
          channels: new Set(),
          lastEngagement: null,
          leadsCount: 0
        };
      }

      const row = map[e.agentId];
      row.engagementCount += 1;

      if (e.channel) row.channels.add(e.channel);

      if (Array.isArray(e.destinationNames)) {
        e.destinationNames.forEach(d =>
          row.destinations.add(d)
        );
      } else if (typeof e.destinationNames === "string") {
        row.destinations.add(e.destinationNames);
      }

      const d = e.createdAt?.toDate?.();
      if (d && (!row.lastEngagement || d > row.lastEngagement)) {
        row.lastEngagement = d;
      }
    });

    /* ---------------- LEADS SIDE ---------------- */
    leads.forEach(l => {
      if (!l.agentId) return;

      if (!map[l.agentId]) {
        map[l.agentId] = {
          agentId: l.agentId,
          agentName: l.agentName || "—",
          engagementCount: 0,
          destinations: new Set(),
          channels: new Set(),
          lastEngagement: null,
          leadsCount: 0
        };
      }

      map[l.agentId].leadsCount += 1;
    });

    return Object.values(map)
      .map(r => ({
        ...r,
        destinations: Array.from(r.destinations),
        channels: Array.from(r.channels)
      }))
      .sort(
        (a, b) =>
          (b.engagementCount || 0) -
          (a.engagementCount || 0)
      );
  }, [engagements, leads]);

  if (!rows.length) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl p-4">
        <p className="text-sm text-gray-500">
          No agent engagement data available
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 overflow-x-auto">
      <h3 className="font-semibold mb-4">
        Agent Engagement Overview
      </h3>

      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left">Agent</th>
            <th className="px-3 py-2 text-center">Engagements</th>
            <th className="px-3 py-2 text-center">Leads</th>
            <th className="px-3 py-2 text-left">Channels</th>
            <th className="px-3 py-2 text-left">Destinations</th>
            <th className="px-3 py-2 text-center">Last Engagement</th>
          </tr>
        </thead>

        <tbody>
          {rows.map(r => (
            <tr
              key={r.agentId}
              className="border-t"
            >
              <td className="px-3 py-2 font-medium">
                {r.agentName}
              </td>

              <td className="px-3 py-2 text-center">
                {r.engagementCount}
              </td>

              <td className="px-3 py-2 text-center">
                {r.leadsCount}
              </td>

              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-1">
                  {r.channels.length
                    ? r.channels.map(c => (
                        <span
                          key={c}
                          className="px-2 py-0.5 rounded bg-gray-100 text-xs"
                        >
                          {c}
                        </span>
                      ))
                    : "—"}
                </div>
              </td>

              <td className="px-3 py-2 max-w-[220px]">
                <div className="flex flex-wrap gap-1">
                  {r.destinations.length
                    ? r.destinations.map(d => (
                        <span
                          key={d}
                          className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs"
                        >
                          {d}
                        </span>
                      ))
                    : "—"}
                </div>
              </td>

              <td className="px-3 py-2 text-center">
                {r.lastEngagement
                  ? r.lastEngagement.toLocaleDateString()
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
