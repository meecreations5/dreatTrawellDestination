"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { canAccess } from "@/lib/rolePermissions";
import { formatInvoiceMoney } from "@/lib/invoiceCore.mjs";

export default function LeadInvoicesTab({ lead }) {
  const { user } = useAuth();
  const [outgoing,setOutgoing]=useState([]), [incoming,setIncoming]=useState([]);
  const [error,setError]=useState("");
  const outgoingAccess=canAccess(user,"invoices.outgoing.view");
  const vendorAccess=canAccess(user,"invoices.vendor.view");
  useEffect(()=>{
    const unsubs=[];
    if(outgoingAccess)unsubs.push(onSnapshot(query(collection(db,"travelAgentInvoices"),where("leadId","==",lead.id)),s=>setOutgoing(s.docs.map(d=>({id:d.id,...d.data()}))),err=>setError(err.message)));
    if(vendorAccess)unsubs.push(onSnapshot(query(collection(db,"vendorInvoices"),where("leadId","==",lead.id)),s=>setIncoming(s.docs.map(d=>({id:d.id,...d.data()}))),err=>setError(err.message)));
    return()=>unsubs.forEach(f=>f());
  },[lead.id,outgoingAccess,vendorAccess]);
  if(!outgoingAccess&&!vendorAccess)return <div className="rounded-2xl border bg-white p-6 text-sm text-slate-500">Invoice access is restricted to Accounts and authorised Operations roles.</div>;
  return <section className="rounded-2xl border border-slate-200 bg-white p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-900">Booking invoices</h2><p className="mt-1 text-xs text-slate-500">Invoices link to this booking, while payments remain in the existing ledger.</p></div><Link href={`/admin/invoices?leadId=${encodeURIComponent(lead.id)}`} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white">Open invoicing workspace</Link></div>
    {error&&<p className="mt-3 text-sm text-red-600">{error}</p>}
    <div className="mt-5 grid gap-4 md:grid-cols-2">{[["Travel agent invoices",outgoing,outgoingAccess],["Vendor invoices received",incoming,vendorAccess]].filter(([, , allowed])=>allowed).map(([label,rows])=><div key={label} className="rounded-xl border border-slate-100 p-3"><h3 className="mb-2 text-sm font-semibold">{label}</h3>{rows.length?rows.map(row=><div key={row.id} className="flex justify-between gap-2 border-t py-2 text-xs"><div><b>{row.invoiceNumber||row.vendorInvoiceNumber||"Draft"}</b><p className="capitalize text-slate-500">{row.status}</p></div><span className="font-semibold">{formatInvoiceMoney(row.total,row.currency)}</span></div>):<p className="text-xs text-slate-500">No invoices linked.</p>}</div>)}</div>
  </section>;
}
