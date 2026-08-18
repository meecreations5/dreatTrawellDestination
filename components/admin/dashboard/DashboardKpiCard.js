"use client";

import { ArrowUpRight } from "lucide-react";

const COLOR_MAP = {
  gray: {
    card: "border-slate-200 bg-white",
    icon: "bg-slate-100 text-slate-700",
    value: "text-slate-950"
  },
  blue: {
    card: "border-blue-100 bg-blue-50/55",
    icon: "bg-blue-100 text-blue-700",
    value: "text-blue-950"
  },
  green: {
    card: "border-emerald-100 bg-emerald-50/55",
    icon: "bg-emerald-100 text-emerald-700",
    value: "text-emerald-950"
  },
  red: {
    card: "border-rose-100 bg-rose-50/60",
    icon: "bg-rose-100 text-rose-700",
    value: "text-rose-950"
  },
  amber: {
    card: "border-amber-100 bg-amber-50/65",
    icon: "bg-amber-100 text-amber-700",
    value: "text-amber-950"
  },
  purple: {
    card: "border-violet-100 bg-violet-50/60",
    icon: "bg-violet-100 text-violet-700",
    value: "text-violet-950"
  }
};

export default function DashboardKpiCard({
  label,
  value,
  color = "gray",
  icon: Icon,
  helper,
  onClick
}) {
  const theme = COLOR_MAP[color] || COLOR_MAP.gray;

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            {label}
          </p>

          <p className={`mt-2 break-words text-xl font-bold tracking-tight sm:text-2xl ${theme.value}`}>
            {value}
          </p>

          {helper ? (
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {helper}
            </p>
          ) : null}
        </div>

        {Icon ? (
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${theme.icon}`}>
            <Icon className="h-5 w-5" />
          </div>
        ) : null}
      </div>

      {onClick ? (
        <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-slate-500">
          View details
          <ArrowUpRight className="h-3.5 w-3.5" />
        </div>
      ) : null}
    </>
  );

  const className = `
    relative min-h-[108px] overflow-hidden rounded-2xl border p-4 text-left
    shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all duration-200
    ${theme.card}
    ${
      onClick
        ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        : ""
    }
  `;

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}
