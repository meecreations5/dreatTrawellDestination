'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, BadgeIndianRupee, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { formatInr, groupConfirmedBusiness } from '@/lib/reporting/businessIntelligence.mjs';

const money = amount => formatInr(amount);
const kpis = [
  ['wins','Deals Won','One current won lead = one booking'],
  ['sellingInr','Booked Value · INR','Confirmed INR snapshots only'],
  ['vendorCostInr','Confirmed Cost · INR','Same verified bookings'],
  ['grossProfitInr','Expected Gross Profit · INR','Booked value less vendor cost']
];

export default function ConfirmedBusinessPanel({ summary, label='Confirmed Business', compact=false, showBreakdown=true }) {
  const [expanded,setExpanded]=useState(false);
  const [group,setGroup]=useState('destination');
  const totals=summary?.totals || {};
  const groups=useMemo(()=>groupConfirmedBusiness(summary,group),[summary,group]);
  if (!summary) return null;
  return <section className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm" aria-label="Reconciled confirmed business">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-blue-100 bg-gradient-to-r from-slate-50 to-blue-50/60 p-4 sm:p-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-700">Booking-date reporting · INR</p>
        <h2 className="mt-1 text-lg font-bold text-slate-900">{label}</h2>
        <p className="mt-1 text-xs leading-5 text-slate-600">One lead is counted once. September enquiries confirmed in October appear in October's Deal Won totals. Payment activity is separate.</p>
      </div>
      <span className={`rounded-lg border px-3 py-2 text-xs font-semibold ${totals.pendingWins?'border-amber-200 bg-amber-50 text-amber-800':'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{totals.verifiedWins||0}/{totals.wins||0} INR amounts reconciled</span>
    </div>
    <div className="grid grid-cols-2 gap-3 p-4 lg:grid-cols-4 sm:p-5">
      {kpis.map(([key,title,help])=><div key={key} className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
        <div className="flex items-center gap-2"><BadgeIndianRupee size={15} className="text-blue-600"/><p className="text-xs font-medium leading-5 text-slate-600">{title}</p></div>
        <p className="mt-2 text-xl font-bold tabular-nums tracking-tight text-slate-900 sm:text-2xl">{key==='wins' ? totals.wins||0 : (totals.wins>0 && totals.verifiedWins===0 ? 'Pending INR review' : money(totals[key]??0))}</p>
        {!compact&&<p className="mt-1 text-[11px] leading-4 text-slate-500">{help}</p>}
      </div>)}
    </div>
    <div className="flex flex-wrap gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-600 sm:px-5">
      <span><b className="text-slate-900">Margin:</b> {totals.grossMarginPct===null?'Pending verification':`${totals.grossMarginPct}%`}</span>
      <span><b className="text-slate-900">Average verified booking:</b> {totals.averageBookingInr===null?'—':money(totals.averageBookingInr)}</span>
      <span><b className="text-slate-900">Financial coverage:</b> {totals.coveragePct}%</span>
    </div>
    {totals.pendingWins>0&&<div className="mx-4 mb-3 flex flex-wrap items-start justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900 sm:mx-5">
      <div className="flex min-w-0 items-start gap-2"><AlertTriangle size={16} className="mt-0.5 shrink-0"/><span><b>{totals.pendingWins} won booking{totals.pendingWins===1?'':'s'} need INR verification.</b> Their amounts are excluded from booked value, cost, profit and margin. No currency is guessed or vendor cost assumed zero.</span></div>
      <Link href="/admin/business-verification" className="shrink-0 font-semibold underline">Review bookings</Link>
    </div>}
    {showBreakdown&&<div className="border-t border-slate-100 px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-slate-500">Expected GP is selling minus vendor cost, before separate tax/accounting adjustments.</span>
        <button type="button" onClick={()=>setExpanded(v=>!v)} className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100">{expanded?'Hide breakdown':'View reconciled breakdown'}{expanded?<ChevronUp size={14}/>:<ChevronDown size={14}/>}</button>
      </div>
      {expanded&&<div className="mt-3 space-y-4">
        <div className="flex flex-wrap gap-2">{[['destination','By destination'],['agentName','By travel agent'],['executiveName','By executive']].map(([id,text])=><button key={id} type="button" onClick={()=>setGroup(id)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${group===id?'bg-blue-700 text-white':'bg-slate-100 text-slate-700'}`}>{text}</button>)}</div>
        <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="min-w-[670px] w-full text-left text-xs"><thead className="bg-slate-50 text-slate-600"><tr>{['Group','Wins','Amount verified','Booked INR','Cost INR','GP INR'].map(h=><th key={h} className="px-3 py-2">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{groups.map(row=><tr key={row.name}><td className="px-3 py-2 font-semibold text-slate-800">{row.name}</td><td className="px-3 py-2">{row.wins}</td><td className="px-3 py-2">{row.verifiedWins}/{row.wins}</td><td className="px-3 py-2">{money(row.sellingInr)}</td><td className="px-3 py-2">{money(row.vendorCostInr)}</td><td className="px-3 py-2">{money(row.grossProfitInr)}</td></tr>)}</tbody></table></div>
        <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="min-w-[860px] w-full text-left text-xs"><thead className="bg-slate-50 text-slate-600"><tr>{['Booking','Won date','Travel agent','Destination','Selling INR','Vendor INR','Expected GP','Status'].map(h=><th key={h} className="px-3 py-2">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{summary.rows.map(row=><tr key={row.id}><td className="px-3 py-2"><Link href={row.href} className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:underline">{row.leadCode}<ExternalLink size={11}/></Link></td><td className="px-3 py-2">{row.date}</td><td className="px-3 py-2">{row.agentName}</td><td className="px-3 py-2">{row.destination}</td><td className="px-3 py-2">{money(row.financial.sellingInr)}</td><td className="px-3 py-2">{money(row.financial.vendorCostInr)}</td><td className="px-3 py-2">{money(row.financial.grossProfitInr)}</td><td className="px-3 py-2 font-semibold">{row.financial.verified?'Reconciled':'Needs review'}</td></tr>)}</tbody></table>{summary.rows.length===0&&<p className="p-5 text-center text-sm text-slate-500">No confirmed bookings for this date range.</p>}</div>
      </div>}
    </div>}
  </section>;
}
