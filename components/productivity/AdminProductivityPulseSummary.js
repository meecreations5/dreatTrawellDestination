"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { Activity, Settings2, Star, TimerReset, Users } from "lucide-react";

import { db } from "@/lib/firebase";
import { WORKSTREAMS, roleWorkstream, workstreamShortLabel } from "@/lib/workstream";

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === "function") return value.toDate();
  if (typeof value?.seconds === "number") return new Date(value.seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isToday(value) {
  const date = toDate(value);
  if (!date) return false;
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}

function formatTime(value) {
  const date = toDate(value);
  return date ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-";
}

export default function AdminProductivityPulseSummary() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const pulseQuery = query(
      collection(db, "productivityPulses"),
      where("pulseSlotAt", ">=", dayStart),
      where("pulseSlotAt", "<", dayEnd)
    );

    return onSnapshot(
      pulseQuery,
      snap => setRows(snap.docs.map(item => ({ id: item.id, ...item.data() }))),
      error => console.error("Unable to load productivity pulses:", error)
    );
  }, []);

  const summary = useMemo(() => {
    const today = rows.filter(row => isToday(row.pulseSlotAt || row.createdAt));
    const grouped = new Map();

    today.forEach(row => {
      const key = row.userUid || row.userEmail || row.userName || "unknown";
      if (!grouped.has(key)) {
        grouped.set(key, {
          key,
          name: row.userName || row.userEmail || "Team Member",
          role: row.role || "",
          workstream: row.workstream || roleWorkstream(row.role),
          pulses: 0,
          ratingTotal: 0,
          ratingCount: 0,
          latest: null
        });
      }
      const item = grouped.get(key);
      item.pulses += 1;
      item.role = row.role || item.role;
      item.workstream = row.workstream || roleWorkstream(row.role || item.role);
      if (Number(row.rating) > 0) {
        item.ratingTotal += Number(row.rating);
        item.ratingCount += 1;
      }
      const rowDate = toDate(row.pulseSlotAt || row.createdAt);
      const latestDate = toDate(item.latest?.pulseSlotAt || item.latest?.createdAt);
      if (!item.latest || (rowDate && (!latestDate || rowDate > latestDate))) item.latest = row;
    });

    return Array.from(grouped.values())
      .map(item => ({
        ...item,
        averageRating: item.ratingCount ? (item.ratingTotal / item.ratingCount).toFixed(1) : "-"
      }))
      .sort((a, b) => b.pulses - a.pulses || a.name.localeCompare(b.name));
  }, [rows]);

  if (!summary.length) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <TimerReset className="h-4 w-4 text-blue-600" />
              Today&apos;s Productivity Pulses
            </div>
            <p className="mt-1 text-xs text-slate-500">No pulse ratings have been submitted today yet.</p>
          </div>
          <Link href="/admin/settings/engagement-productivity" className="inline-flex items-center gap-2 text-xs font-semibold text-blue-600 hover:text-blue-700">
            <Settings2 className="h-4 w-4" /> Configure Pulse
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <TimerReset className="h-4 w-4 text-blue-600" />
            Today&apos;s Productivity Pulses
          </div>
          <p className="mt-1 text-xs text-slate-500">Self-rating plus objective activity captured at the configured interval. Break windows are skipped.</p>
        </div>
        <Link href="/admin/settings/engagement-productivity" className="inline-flex items-center gap-2 text-xs font-semibold text-blue-600 hover:text-blue-700">
          <Settings2 className="h-4 w-4" /> Configure Pulse
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Team Member</th>
              <th className="px-4 py-3 font-semibold">Workstream</th>
              <th className="px-4 py-3 text-right font-semibold">Pulses</th>
              <th className="px-4 py-3 text-right font-semibold">Avg Rating</th>
              <th className="px-4 py-3 font-semibold">Latest Output</th>
              <th className="px-4 py-3 font-semibold">Latest Detail</th>
              <th className="px-4 py-3 text-right font-semibold">Latest Pulse</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {summary.map(item => {
              const metrics = item.latest?.intervalMetrics || {};
              return (
                <tr key={item.key} className="text-slate-700">
                  <td className="px-4 py-3 font-semibold text-slate-900">{item.name}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${item.workstream === WORKSTREAMS.ENGAGEMENT ? "bg-violet-50 text-violet-700" : item.workstream === WORKSTREAMS.LEAD_OPERATIONS ? "bg-cyan-50 text-cyan-700" : "bg-slate-100 text-slate-600"}`}>{workstreamShortLabel(item.workstream)}</span></td>
                  <td className="px-4 py-3 text-right">{item.pulses}</td>
                  <td className="px-4 py-3 text-right"><span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 text-amber-500" />{item.averageRating}</span></td>
                  <td className="px-4 py-3 font-medium text-slate-800">{item.workstream === WORKSTREAMS.LEAD_OPERATIONS ? `${metrics.completedWork ?? 0} completed · ${metrics.workActions ?? 0} actions` : `${metrics.requirements ?? 0} requirements · ${metrics.leadsGenerated ?? 0} leads`}</td>
                  <td className="px-4 py-3 text-slate-500">{item.workstream === WORKSTREAMS.LEAD_OPERATIONS ? `${metrics.quoteWork ?? 0} quote · ${metrics.requoteWork ?? 0} re-quote · ${metrics.vendorCoordination ?? 0} vendor · ${metrics.paymentWork ?? 0} payment · ${metrics.onGroundWork ?? 0} on-ground` : `${metrics.connected ?? 0} connected · ${metrics.uniqueAgents ?? 0} agents · ${metrics.meaningful ?? 0} meaningful`}</td>
                  <td className="px-4 py-3 text-right text-slate-500">{formatTime(item.latest?.pulseSlotAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3 sm:grid-cols-3">
        <FooterStat icon={Users} label="Team members reporting" value={summary.length} />
        <FooterStat icon={Activity} label="Pulses submitted" value={summary.reduce((sum, item) => sum + item.pulses, 0)} />
        <FooterStat icon={Star} label="Purpose" value="Coaching + output" />
      </div>
    </section>
  );
}

function FooterStat({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
      <Icon className="h-4 w-4 text-slate-400" />
      <span className="text-[11px] text-slate-500">{label}</span>
      <span className="ml-auto text-xs font-bold text-slate-800">{value}</span>
    </div>
  );
}
