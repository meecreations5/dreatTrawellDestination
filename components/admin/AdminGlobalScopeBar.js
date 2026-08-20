"use client";

import { CalendarDays, RotateCcw, UsersRound } from "lucide-react";
import { usePathname } from "next/navigation";
import { useAdminScope } from "@/components/admin/AdminScopeProvider";
import { ADMIN_DATE_SCOPE_OPTIONS } from "@/lib/adminScope";
import { getTeamOptionLabel } from "@/lib/teamDirectory";

export default function AdminGlobalScopeBar() {
  const pathname = usePathname();
  const { scope, setScope, resetScope, teamOptions, usersLoading } = useAdminScope();
  const isCustom = scope.dateRange === "custom";

  const scopeMeaning = (() => {
    if (pathname === "/admin/engagements") {
      return "Date = Activity Date · Team = Activity Performer. Acquisition tables use Agent Created By.";
    }
    if (pathname === "/admin/leads" || pathname === "/admin/leads/dashboard") {
      return "Date = Lead Created Date · Team = Lead Owner or Current Assignee.";
    }
    if (pathname === "/admin/travel-agents/assigned") {
      return "Date = Assignment Date · Team = Current Assignee.";
    }
    if (pathname === "/admin/travel-agents/dashboard") {
      return "Acquisition uses Agent Created Date / Creator Team; engagement uses Activity Date / Performer Team.";
    }
    if (pathname === "/admin/travel-agents") {
      return "Date = Agent Created Date · Team = Agent Created By.";
    }
    return "Date = selected reporting period · Team follows the accountable role shown by each metric.";
  })();

  const updateDatePreset = value => {
    setScope(current => ({
      ...current,
      dateRange: value,
      ...(value === "custom" ? {} : { dateFrom: "", dateTo: "" })
    }));
  };

  const updateCustomDate = (key, value) => {
    setScope(current => ({
      ...current,
      dateRange: "custom",
      [key]: value
    }));
  };

  return (
    <div className="mx-4 mt-2 rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm sm:mx-6 lg:mx-6">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Global Reporting Scope
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            Date and Team stay applied across Dashboard, Engagements, Leads and Travel Agent reporting/listings.
          </p>
          <p className="mt-1 text-[11px] font-medium text-blue-600">{scopeMeaning}</p>
        </div>

        <div className={`grid grid-cols-1 gap-2 sm:grid-cols-2 ${isCustom ? "xl:w-[980px] xl:grid-cols-5" : "xl:w-[700px] xl:grid-cols-3"}`}>
          <label className="relative">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <select
              aria-label="Global date scope"
              value={scope.dateRange}
              onChange={event => updateDatePreset(event.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs font-semibold text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              {ADMIN_DATE_SCOPE_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          {isCustom && (
            <>
              <label>
                <span className="sr-only">Custom date from</span>
                <input
                  aria-label="Global date from"
                  type="date"
                  value={scope.dateFrom || ""}
                  onChange={event => updateCustomDate("dateFrom", event.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label>
                <span className="sr-only">Custom date to</span>
                <input
                  aria-label="Global date to"
                  type="date"
                  value={scope.dateTo || ""}
                  onChange={event => updateCustomDate("dateTo", event.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </label>
            </>
          )}

          <label className="relative">
            <UsersRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <select
              aria-label="Global team scope"
              value={scope.team}
              disabled={usersLoading}
              onChange={event => setScope(current => ({ ...current, team: event.target.value }))}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs font-semibold text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
            >
              <option value="all">All Teams</option>
              {teamOptions.map(team => (
                <option key={team} value={team}>{getTeamOptionLabel(team)}</option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={resetScope}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Scope
          </button>
        </div>
      </div>
    </div>
  );
}
