"use client";

import Link from "next/link";
import { useState } from "react";
import { formatInr } from "@/lib/reporting/businessIntelligence.mjs";
import { ArrowUpRight, ClipboardList, PhoneCall, UserRoundCheck, Handshake, Send, CheckCircle2, TrendingUp } from "lucide-react";

const tiles = [
  {key:"callAttempts",label:"Call attempts", icon:PhoneCall},
  {key:"connectedCalls",label:"Calls connected", icon:UserRoundCheck},
  {key:"qualifiedByTelecaller",label:"Telecaller-qualified agents",icon:ClipboardList},
  {key:"agentsHandedOver",label:"Agents handed over",icon:Handshake},
  {key:"quotesSent",label:"Quotes sent this period",icon:Send},
  {key:"dealsWon",label:"Deals won this period",icon:CheckCircle2}
];
const readable = value => Number(value || 0).toLocaleString("en-IN");

export default function RelationshipPerformancePanel({ report }) {
  const [tab,setTab] = useState("journey");
  if (!report) return null;
  const {summary,cohort,callerRows,executiveRows,actions} = report;
  const max=Math.max(1,cohort[0]?.count || 0);
  return (
    <section className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm" aria-label="Telecalling and relationship business performance">
      <div className="flex flex-col gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-700">Team intelligence</p>
          <h2 className="mt-1 text-lg font-bold text-slate-900 sm:text-xl">Calls → Relationships → Confirmed Business</h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-600">The period filter is applied independently to calls, new enquiries, quotation dispatches and actual Deal Won dates. Telecaller assisted business is separate from executive closure credit.</p>
        </div>
        <div className="shrink-0 rounded-xl border border-blue-100 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
          {report.window.from || "All time"}{report.window.to ? ` – ${report.window.to}` : ""}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 xl:grid-cols-6 sm:p-5">
        {tiles.map(({key,label,icon:Icon}) => (
          <div key={key} className="rounded-xl border border-slate-200 bg-white p-3">
            <Icon size={17} className="text-blue-700" aria-hidden="true" />
            <div className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{readable(summary[key])}</div>
            <div className="mt-1 text-xs font-medium text-slate-600">{label}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 border-t border-slate-100 p-4 sm:grid-cols-4 sm:px-5">
        {[
          ['Confirmed booked INR',formatInr(summary.bookedInr)],
          ['Confirmed vendor INR',formatInr(summary.vendorCostInr)],
          ['Expected GP INR',formatInr(summary.expectedGpInr)],
          ['Amounts awaiting review',summary.bookingAmountsPending||0]
        ].map(([label,value])=><div key={label} className="rounded-xl bg-blue-50/60 p-3"><p className="text-xs text-slate-600">{label}</p><p className="mt-2 text-lg font-bold text-slate-900 tabular-nums">{value}</p></div>)}
        <p className="col-span-2 text-xs leading-5 text-slate-500 sm:col-span-4">INR values include only reconciled bookings. Telecaller-assisted value and executive primary-closure value are separate attribution views of the same bookings, not additive revenue.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-y border-slate-100 px-4 py-3 sm:px-6">
        {[
          ["journey","Relationship journey"],
          ["team","Team attribution"],
          ["actions",`Management actions (${actions.length})`]
        ].map(([value,label])=><button key={value} type="button" onClick={()=>setTab(value)} aria-pressed={tab===value}
          className={`rounded-lg px-3 py-2 text-xs font-semibold transition sm:text-sm ${tab===value ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-800"}`}>{label}</button>)}
      </div>

      {tab === "journey" && (
        <div className="grid gap-6 p-4 lg:grid-cols-[1.3fr_1fr] sm:p-6">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Unique-agent relationship cohort</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">Agents with meaningful connections in the selected period. Later steps can occur in future months. This is a connected-agent cohort, not a sum of monthly events.</p>
            <div className="mt-5 space-y-3">
              {cohort.map((item,index)=><div key={item.name}>
                <div className="mb-1 flex justify-between gap-3 text-xs"><span className="font-medium text-slate-700">{item.name}</span><span className="font-semibold tabular-nums text-slate-900">{readable(item.count)}</span></div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${index>3 ? "bg-cyan-600" : "bg-blue-600"}`} style={{width:`${Math.round(item.count/max*100)}%`}} /></div>
              </div>)}
            </div>
          </div>
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Independent monthly events</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-blue-50 p-4"><p className="text-xs font-medium text-slate-600">New enquiries</p><p className="mt-2 text-2xl font-bold text-blue-900">{readable(summary.newLeads)}</p></div>
              <div className="rounded-xl bg-blue-50 p-4"><p className="text-xs font-medium text-slate-600">Booking wins</p><p className="mt-2 text-2xl font-bold text-blue-900">{readable(summary.dealsWon)}</p></div>
            </div>
            <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-700">
              <p className="font-semibold">Successful call connection rate</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{summary.connectionRate}%</p>
              <p className="mt-1 text-xs text-slate-500">Only documented connected calls ÷ call attempts. Unanswered calls do not improve this percentage.</p>
            </div>
            <Link href="/admin/travel-agents/engagement-intelligence" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900">Review A+/A agent engagement grades <ArrowUpRight size={13}/></Link>
          </div>
        </div>
      )}

      {tab === "team" && (
        <div className="grid gap-6 p-4 xl:grid-cols-2 sm:p-6">
          <div className="overflow-x-auto">
            <h3 className="mb-2 text-sm font-bold text-slate-900">Telecaller activity & assisted conversions</h3>
            <p className="mb-3 text-xs text-slate-500">Call / handover events in the selected period; assisted wins belong to the same month's confirmed bookings.</p>
            <table className="min-w-full text-left text-xs"><thead className="bg-slate-50 text-slate-600"><tr>{["Caller","Attempts","Connected","Qualified","Handed","Assisted won","Assisted booked INR","Pending INR"].map(h=><th key={h} className="px-2 py-2 font-semibold">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">{callerRows.map(row=><tr key={row.id}><td className="px-2 py-3 font-medium text-slate-900">{row.name}</td>{["attempts","connected","qualified","handovers","assistedWins"].map(key=><td key={key} className="px-2 py-3 tabular-nums">{row[key]}</td>)}<td className="px-2 py-3 font-semibold tabular-nums text-blue-800">{formatInr(row.assistedBookedInr)}</td><td className="px-2 py-3 tabular-nums">{row.assistedPendingInr}</td></tr>)}</tbody></table>
            {!callerRows.length && <p className="mt-3 text-xs text-slate-500">No telecalling events in this period.</p>}
          </div>
          <div>
            <h3 className="mb-2 text-sm font-bold text-slate-900">Relationship Executive · primary wins</h3>
            <p className="mb-3 text-xs text-slate-500">Counts are grouped by lead owner/assignee and actual Deal Won date, not telecaller assisted credit.</p>
            <table className="min-w-full text-left text-xs"><thead className="bg-slate-50 text-slate-600"><tr><th className="px-3 py-2">Executive</th><th className="px-3 py-2 text-right">Confirmed deals</th><th className="px-3 py-2 text-right">Booked INR</th><th className="px-3 py-2 text-right">Expected GP INR</th><th className="px-3 py-2 text-right">Pending</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{executiveRows.map(row=><tr key={row.id}><td className="px-3 py-3 text-slate-900">{row.name}</td><td className="px-3 py-3 text-right font-semibold tabular-nums">{row.primaryWins}</td><td className="px-3 py-3 text-right tabular-nums">{formatInr(row.bookedInr)}</td><td className="px-3 py-3 text-right tabular-nums">{formatInr(row.expectedGpInr)}</td><td className="px-3 py-3 text-right tabular-nums">{row.pendingInr}</td></tr>)}</tbody></table>
            {!executiveRows.length && <p className="mt-3 text-xs text-slate-500">No confirmed booking wins in this period.</p>}
            <p className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-slate-600">One booking = one primary closure. An associated Telecaller receives an assisted metric only; the booking is not counted twice.</p>
          </div>
        </div>
      )}

      {tab === "actions" && (
        <div className="p-4 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-bold text-slate-900">Open management action queue</h3><p className="mt-1 text-xs text-slate-500">Live unresolved records; deliberately not restricted to the reporting month.</p></div><Link href="/admin/telecalling" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700">Open Telecalling <ArrowUpRight size={13}/></Link></div>
          {actions.length ? <div className="grid gap-2 md:grid-cols-2">{actions.slice(0,20).map(action=><Link key={action.id} href={action.href} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 px-3 py-3 transition hover:border-blue-300 hover:bg-blue-50">
            <div><p className="text-sm font-semibold text-slate-900">{action.title}</p><p className="mt-1 text-xs text-slate-600">{action.description}</p><p className="mt-1 text-xs text-slate-500">Owner: {action.owner}</p></div><ArrowUpRight size={16} className="shrink-0 text-blue-600" /></Link>)}</div> : <div className="rounded-xl bg-slate-50 p-5 text-sm text-slate-600">No flagged items from the available records.</div>}
          {actions.length>20 && <p className="mt-3 text-xs text-slate-500">Showing 20 of {actions.length} flagged records.</p>}
        </div>
      )}
    </section>
  );
}
