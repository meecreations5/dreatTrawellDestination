"use client";

import { useRouter } from "next/navigation";
import { CalendarDays, CalendarX2, ChevronRight, PlaneTakeoff } from "lucide-react";
import { formatTravelMonthLabel, getLeadTravelMonthKey } from "@/lib/leadTravelDates";

export default function OpenLeadTravelMonthBoard({ leads = [], teamLabel = "All Teams" }) {
  const router = useRouter();

  const groups = new Map();
  let missing = 0;

  leads.forEach(lead => {
    const key = getLeadTravelMonthKey(lead);
    if (!key) {
      missing += 1;
      return;
    }
    groups.set(key, (groups.get(key) || 0) + 1);
  });

  const months = Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  const total = leads.length;
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const openMonth = key => {
    const params = new URLSearchParams();
    params.set("openOnly", "1");
    params.set("travelMonth", key);
    router.push(`/admin/leads?${params.toString()}`);
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <PlaneTakeoff className="h-4 w-4 text-blue-600" />
            Open Queries by Travel Month
          </div>
          <p className="mt-1 text-xs text-slate-500">
            All open leads in {teamLabel}; Closed-Won, Closed-Lost and Cancelled/Invalid are excluded. Lead-created date scope is intentionally ignored here.
          </p>
        </div>

        <div className="rounded-xl bg-blue-50 px-3 py-2 text-right">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-600">Open Queries</p>
          <p className="text-xl font-bold text-blue-800">{total}</p>
        </div>
      </div>

      <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
        {months.map(([key, count]) => {
          const isPastMonth = key < currentMonthKey;
          return (
            <button
              key={key}
              type="button"
              onClick={() => openMonth(key)}
              className={`min-w-[170px] rounded-2xl border p-3 text-left transition ${isPastMonth ? "border-red-200 bg-red-50 hover:bg-red-100" : "border-slate-200 bg-slate-50 hover:border-blue-200 hover:bg-blue-50"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <CalendarDays className={`h-4 w-4 ${isPastMonth ? "text-red-600" : "text-blue-600"}`} />
                <ChevronRight className="h-4 w-4 text-slate-300" />
              </div>
              <p className={`mt-3 text-xs font-semibold ${isPastMonth ? "text-red-800" : "text-slate-700"}`}>{formatTravelMonthLabel(key)}</p>
              <p className={`mt-1 text-2xl font-bold ${isPastMonth ? "text-red-950" : "text-slate-950"}`}>{count}</p>
              <p className={`text-[11px] ${isPastMonth ? "text-red-700" : "text-slate-500"}`}>{isPastMonth ? "past travel month · " : ""}open quer{count === 1 ? "y" : "ies"}</p>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => openMonth("missing")}
          className="min-w-[170px] rounded-2xl border border-amber-200 bg-amber-50 p-3 text-left transition hover:bg-amber-100"
        >
          <div className="flex items-start justify-between gap-2">
            <CalendarX2 className="h-4 w-4 text-amber-700" />
            <ChevronRight className="h-4 w-4 text-amber-300" />
          </div>
          <p className="mt-3 text-xs font-semibold text-amber-800">Travel Date Missing</p>
          <p className="mt-1 text-2xl font-bold text-amber-950">{missing}</p>
          <p className="text-[11px] text-amber-700">open queries need date</p>
        </button>
      </div>
    </section>
  );
}
