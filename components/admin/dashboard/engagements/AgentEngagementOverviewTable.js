"use client";

import Link from "next/link";
import { useMemo } from "react";
import { CalendarClock } from "lucide-react";

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value?.toDate === "function") return value.toDate();
  if (typeof value?.seconds === "number") return new Date(value.seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export default function AgentEngagementOverviewTable({
  engagements = [],
  leads = [],
  meetingBase = "/admin/meetings"
}) {
  const rows = useMemo(() => {
    const map = {};

    /* ---------------- ENGAGEMENT SIDE ---------------- */
    engagements.forEach(e => {
      const agentId = e.travelAgentId || e.agentId || e.travelAgentRefId || "";
      if (!agentId) return;

      if (!map[agentId]) {
        map[agentId] = {
          agentId,
          agentName: e.agentName || "—",
          engagementCount: 0,
          destinations: new Set(),
          channels: new Set(),
          lastEngagement: null,
          lastEngagementId: "",
          leadsCount: 0
        };
      }

      const row = map[agentId];
      row.engagementCount += 1;

      if (e.channel) row.channels.add(e.channel);

      if (Array.isArray(e.destinationNames)) {
        e.destinationNames.forEach(d =>
          row.destinations.add(d)
        );
      } else if (typeof e.destinationNames === "string") {
        row.destinations.add(e.destinationNames);
      }

      const d = toDate(e.engagedAt || e.createdAt || e.updatedAt);
      if (!row.lastEngagementId || (d && (!row.lastEngagement || d > row.lastEngagement))) {
        row.lastEngagement = d || row.lastEngagement;
        row.lastEngagementId = e.id || row.lastEngagementId;
      }
    });

    /* ---------------- LEADS SIDE ---------------- */
    leads.forEach(l => {
      const agentId = l.travelAgentId || l.agentId || "";
      if (!agentId) return;

      if (!map[agentId]) {
        map[agentId] = {
          agentId,
          agentName: l.agentName || "—",
          engagementCount: 0,
          destinations: new Set(),
          channels: new Set(),
          lastEngagement: null,
          lastEngagementId: "",
          leadsCount: 0
        };
      }

      map[agentId].leadsCount += 1;
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
            <th className="px-3 py-2 text-right">Action</th>
          </tr>
        </thead>

        <tbody>
          {rows.map(r => (
            <tr
              key={r.agentId}
              className="border-t border-gray-200 "
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

              <td className="px-3 py-2 text-right">
                <Link
                  href={`${meetingBase}?agentId=${encodeURIComponent(r.agentId)}${r.lastEngagementId ? `&engagementId=${encodeURIComponent(r.lastEngagementId)}` : ""}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100"
                >
                  <CalendarClock size={13} />
                  Meeting
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
