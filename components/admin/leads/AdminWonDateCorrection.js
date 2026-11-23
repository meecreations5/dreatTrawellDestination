"use client";

import { useEffect, useState } from "react";
import { isAdmin } from "@/lib/rolePermissions";
import { businessDateKey, getDealWonEventDate, isCurrentWon } from "@/lib/reporting/leadReportingDates.mjs";
import { correctDealWonDate } from "@/lib/correctDealWonDate";

export default function AdminWonDateCorrection({lead,user}) {
  const won=isCurrentWon(lead);
  const oldDate=businessDateKey(getDealWonEventDate(lead));
  const [open,setOpen]=useState(false);
  const [date,setDate]=useState(oldDate);
  const [reference,setReference]=useState(lead?.bookingConfirmationReference || "");
  const [reason,setReason]=useState("");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  useEffect(()=>{setDate(oldDate);setReference(lead?.bookingConfirmationReference || "");setReason("");},[oldDate,lead?.bookingConfirmationReference]);
  if (!isAdmin(user) || !won) return null;
  const submit=async event=>{
    event.preventDefault();setLoading(true);setError("");setMessage("");
    try {
      await correctDealWonDate({leadId:lead.id,wonDateKey:date,confirmationReference:reference,reason,user});
      setMessage("Deal Won date corrected and audited. Reports use the new confirmation month.");
      setOpen(false);
    } catch(err){setError(err.message || "Could not correct the date.");}
    finally {setLoading(false);}
  };
  return <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
    <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Deal Won reporting date</p>
    <p className="mt-2 text-sm font-semibold text-slate-900">{oldDate || "Missing date"}</p>
    <p className="mt-1 text-xs text-slate-500">Actual booking confirmation day · India business calendar</p>
    <button type="button" onClick={()=>{setOpen(v=>!v);setError("");}} className="mt-3 text-xs font-semibold text-blue-700 hover:text-blue-900">{open?"Cancel correction":"Correct date (Admin only)"}</button>
    {open && <form onSubmit={submit} className="mt-3 space-y-3">
      <div><label htmlFor="admin-correct-won-date" className="block text-xs font-semibold text-slate-600">Verified confirmation date</label><input id="admin-correct-won-date" type="date" required max={businessDateKey(new Date())} value={date} onChange={e=>setDate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></div>
      <div><label htmlFor="admin-correct-won-ref" className="block text-xs font-semibold text-slate-600">Booking reference</label><input id="admin-correct-won-ref" required value={reference} onChange={e=>setReference(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></div>
      <div><label htmlFor="admin-correct-won-reason" className="block text-xs font-semibold text-slate-600">Correction reason</label><textarea id="admin-correct-won-reason" required minLength={8} rows={2} value={reason} onChange={e=>setReason(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></div>
      <button disabled={loading} type="submit" className="w-full rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50">{loading?"Saving...":"Save audited correction"}</button>
    </form>}
    {error && <p role="alert" className="mt-2 text-xs text-rose-700">{error}</p>}
    {message && <p role="status" className="mt-2 text-xs text-blue-700">{message}</p>}
  </section>;
}
