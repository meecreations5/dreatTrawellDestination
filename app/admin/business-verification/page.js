'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { collection, onSnapshot } from 'firebase/firestore';
import { ArrowLeft, CheckCircle2, Search, ShieldCheck, AlertTriangle } from 'lucide-react';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { isAdmin } from '@/lib/rolePermissions';
import { summarizeConfirmedBusiness, formatInr } from '@/lib/reporting/businessIntelligence.mjs';
import { verifyConfirmedBusiness } from '@/lib/verifyConfirmedBusiness';

export default function BusinessVerificationPage() {
  const {user,loading:authLoading}=useAuth('admin');
  const [leads,setLeads]=useState([]),[loading,setLoading]=useState(true);
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[search,setSearch]=useState('');
  const [active,setActive]=useState(null),[saving,setSaving]=useState(false);
  const [form,setForm]=useState({selling:'',cost:'',reference:'',reason:''});
  useEffect(()=>{
    if(!user || !isAdmin(user))return;
    return onSnapshot(collection(db,'leads'),snap=>{setLeads(snap.docs.map(row=>({id:row.id,...row.data()})));setLoading(false);},err=>{setError(err.message);setLoading(false);});
  },[user?.uid]);
  const summary=useMemo(()=>summarizeConfirmedBusiness(leads),[leads]);
  const filtered=useMemo(()=>summary.rows.filter(row=>[row.leadCode,row.agentName,row.destination,row.executiveName].some(text=>String(text).toLowerCase().includes(search.toLowerCase()))),[summary,search]);
  const begin=row=>{
    const candidate=row.financial;
    setActive(row);
    setError('');setNotice('');
    setForm({selling:candidate.verified?String(candidate.sellingInr):candidate.customerCurrency==='INR' && candidate.candidateSelling!=null?String(candidate.candidateSelling):'',
      cost:candidate.verified?String(candidate.vendorCostInr):candidate.vendorCurrency==='INR' && candidate.candidateCost!=null?String(candidate.candidateCost):'',
      reference:'', reason:''});
  };
  const save=async event=>{
    event.preventDefault();if(!active||saving)return;
    setSaving(true);setError('');
    try {
      await verifyConfirmedBusiness({leadId:active.id,sellingAmountInr:form.selling,vendorCostInr:form.cost,bookingReference:form.reference,reason:form.reason,user});
      setNotice(`INR booking amounts verified for ${active.leadCode}. Audit record saved.`);setActive(null);
    } catch(err){setError(err.message||'Unable to verify amounts.');}
    finally{setSaving(false);}
  };
  if(authLoading)return <main className="p-8 text-sm text-slate-600">Verifying access…</main>;
  if(!user||!isAdmin(user))return <main className="p-8 text-sm text-red-700">Admin access required to verify booked financial amounts.</main>;
  return <main className="mx-auto max-w-7xl space-y-5 p-4 pb-16 sm:p-6">
    <Link href="/admin/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700"><ArrowLeft size={16}/> Back to Management</Link>
    <div className="rounded-2xl border border-slate-200 bg-white p-5"><span className="text-xs font-semibold uppercase tracking-widest text-blue-700">Finance verification</span><h1 className="mt-2 text-2xl font-bold text-slate-900">Confirmed Booking Amounts</h1><p className="mt-2 text-sm text-slate-600">One lead = one booking. Review INR selling price and INR vendor cost before they contribute to business-value and profit dashboards. All original quotations, payment entries and invoices stay unchanged.</p></div>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[
      ['Deals Won',summary.totals.wins],['Amounts Reconciled',summary.totals.verifiedWins],['Needs Review',summary.totals.pendingWins],['Reconciled Booked INR',formatInr(summary.totals.sellingInr)]
    ].map(([label,value])=><div key={label} className="rounded-xl border border-blue-100 bg-white p-4"><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-2 text-xl font-bold tabular-nums text-slate-900">{value}</p></div>)}</div>
    {(error||notice)&&<div role="status" className={`rounded-xl border p-3 text-sm ${error?'border-red-200 bg-red-50 text-red-800':'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{error||notice}</div>}
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap justify-between gap-3 border-b border-slate-100 p-4"><h2 className="font-semibold text-slate-900">Confirmed bookings · All time</h2><label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3"><Search size={14} className="text-slate-500"/><input className="py-2 text-sm outline-none" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search booking, agent or destination"/></label></div>
      {loading?<p className="p-6 text-sm text-slate-500">Loading bookings…</p>:<div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-xs"><thead className="bg-slate-50 text-slate-600"><tr>{['Booking','Confirmed','Travel agent','Destination','Selling INR','Vendor INR','Status','Action'].map(h=><th key={h} className="px-3 py-3">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{filtered.map(row=><tr key={row.id}><td className="px-3 py-3"><Link href={row.href} className="font-semibold text-blue-700 hover:underline">{row.leadCode}</Link></td><td className="px-3 py-3">{row.date}</td><td className="px-3 py-3">{row.agentName}</td><td className="px-3 py-3">{row.destination}</td><td className="px-3 py-3">{formatInr(row.financial.sellingInr)}</td><td className="px-3 py-3">{formatInr(row.financial.vendorCostInr)}</td><td className="px-3 py-3">{row.financial.verified?<span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 size={13}/> Reconciled</span>:<span className="inline-flex items-center gap-1 text-amber-800"><AlertTriangle size={13}/> Needs review</span>}</td><td className="px-3 py-3"><button type="button" onClick={()=>begin(row)} className="font-semibold text-blue-700 hover:underline">{row.financial.verified?'Revise with audit':'Verify amount'}</button></td></tr>)}</tbody></table>{!filtered.length&&<p className="p-6 text-sm text-slate-500">No matching bookings.</p>}</div>}
    </section>
    {active&&<div role="dialog" aria-modal="true" aria-label="Verify INR financial snapshot" className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 p-3 sm:p-8"><div className="mx-auto max-w-xl rounded-2xl bg-white p-5 shadow-2xl sm:p-6"><div className="flex items-center gap-2"><ShieldCheck className="text-blue-700" size={21}/><h2 className="text-lg font-bold text-slate-900">Verify {active.leadCode}</h2></div>
      <p className="mt-2 text-sm text-slate-600">Review final quotation, vendor quote and agreed exchange rates. Enter the actual comparable INR amounts, not the foreign-currency face values. This action does not modify invoices or payment records.</p>
      {!active.financial.verified&&<p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">{active.financial.reason}</p>}
      <form onSubmit={save} className="mt-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">{[['selling','Confirmed selling amount · INR'],['cost','Confirmed vendor cost · INR']].map(([key,label])=><label key={key} className="text-xs font-semibold text-slate-600">{label}<input className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-sm" type="number" min={key==='selling'?'0.01':'0'} step="0.01" required value={form[key]} onChange={e=>setForm(p=>({...p,[key]:e.target.value}))}/></label>)}</div>
        <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">Expected GP: {form.selling!==''&&form.cost!==''?formatInr(Number(form.selling)-Number(form.cost)):'Pending INR values'}</div>
        <label className="block text-xs font-semibold text-slate-600">Booking confirmation / supporting reference<input className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-sm" required value={form.reference} onChange={e=>setForm(p=>({...p,reference:e.target.value}))} placeholder="Booking ID / verified communication"/></label>
        <label className="block text-xs font-semibold text-slate-600">Reason / source of verification<textarea className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-sm" required rows={2} minLength={8} value={form.reason} onChange={e=>setForm(p=>({...p,reason:e.target.value}))} placeholder="Verified with final supplier and agent confirmation"/></label>
        {error&&<p className="text-xs text-red-700">{error}</p>}
        <div className="flex justify-end gap-2"><button type="button" onClick={()=>{setActive(null);setError('');}} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold">Cancel</button><button disabled={saving} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving?'Saving…':'Verify & record audit'}</button></div>
      </form>
    </div></div>}
  </main>;
}
