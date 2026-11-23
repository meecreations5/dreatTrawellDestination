"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowDownToLine, BadgeCheck, Banknote, CheckCircle2, CircleAlert, Clock3,
  Download, FileText, Mail, Plus, Printer, Receipt, RefreshCcw,
  Search, Settings2, ShieldAlert, UploadCloud, Wallet, X, MessageCircle
} from "lucide-react";
import { collection, doc, getDoc, getDocs, limit, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { canAccess } from "@/lib/rolePermissions";
import { normalizeLeadStage } from "@/lib/leadStages";
import {
  INVOICE_CURRENCIES, computeInvoiceTotals, formatInvoiceMoney, invoicePaymentStatus, validCurrency,
  money, normalizeCurrency, text
} from "@/lib/invoiceCore.mjs";
import {
  DEFAULT_INVOICE_SETTINGS, observeInvoices, getInvoiceSettings, saveInvoiceSettings,
  saveOutgoingInvoiceDraft, issueOutgoingInvoice, voidOutgoingInvoice,
  saveIncomingVendorInvoice, setVendorInvoiceReview, uploadInvoiceAttachment,
  saveOutgoingPdfReference, sendIssuedInvoiceEmail, observeLeadPayments,
  allocateExistingPayment, unallocateExistingPayment
} from "@/lib/invoiceService";
import InvoicePaper from "@/components/invoices/InvoicePaper";

const inputStyle = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100";
const labelStyle = "mb-1.5 block text-xs font-semibold text-slate-600";
const buttonStyle = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";
const primary = `${buttonStyle} bg-blue-600 text-white hover:bg-blue-700`;
const secondary = `${buttonStyle} border border-slate-200 bg-white text-slate-700 hover:bg-blue-50`;
const danger = `${buttonStyle} border border-red-200 bg-red-50 text-red-700 hover:bg-red-100`;
const dateToday = () => new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Kolkata"});
const pick = (...values) => values.map(text).find(Boolean) || "";
const mailing = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(value));
const addressOf = value => {
  if (typeof value === "string") return text(value);
  if (!value || typeof value !== "object") return "";
  return [value.line1, value.line2, value.subArea, value.city, value.state, value.pincode, value.country].map(text).filter(Boolean).join(", ");
};
const lineDefault = (description = "") => ({ description, sac:"", quantity:1, unitPrice:"", discountRate:0, taxRate:0 });
const invoiceBase = () => ({
  leadId:"", leadCode:"", travelAgentId:"", destination:"", travelDates:"", stage:"",
  supplier:{...DEFAULT_INVOICE_SETTINGS},recipient:{name:"",address:"",gstin:"",email:"",contactName:""},
  currency:"INR", fxRateINR:1, taxMode:"none", placeOfSupply:"", reverseCharge:false,
  lines:[lineDefault()], dueDate:"", issueDate:"", notes:""
});
const vendorBase = () => ({
  leadId:"", leadCode:"",vendorId:"",vendorInvoiceNumber:"",vendorInvoiceDate:dateToday(),
  vendorName:"",vendorGstin:"",vendorAddress:"",dueDate:"",currency:"INR",fxRateINR:1,taxMode:"none",lines:[lineDefault()],
  originalFileUrl:"",originalFilePath:"",originalFileName:"",notes:""
});
function Field({ label, children, help }) { return <div className="min-w-0"><label className={labelStyle}>{label}</label>{children}{help && <p className="mt-1 text-xs text-slate-500">{help}</p>}</div>; }
function Input({ value, onChange, ...props }) { return <input className={inputStyle} value={value ?? ""} onChange={event => onChange(event.target.value)} {...props}/>; }
function Select({ value, onChange, options, ...props }) { return <select className={inputStyle} value={value ?? ""} onChange={event=>onChange(event.target.value)} {...props}>{options.map(entry => Array.isArray(entry)?<option key={entry[0]} value={entry[0]}>{entry[1]}</option>:<option key={entry} value={entry}>{entry}</option>)}</select>; }
function Status({ value }) {
  const map={draft:"bg-slate-100 text-slate-700",issued:"bg-blue-100 text-blue-700",void:"bg-red-100 text-red-700",received:"bg-amber-100 text-amber-800",verified:"bg-emerald-100 text-emerald-700",disputed:"bg-red-100 text-red-700"};
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${map[value]||map.draft}`}>{text(value).replaceAll("_"," ")}</span>;
}
function SectionTitle({ children }) { return <h3 className="mt-5 border-b border-slate-100 pb-2 text-sm font-bold text-slate-900">{children}</h3>; }
function Totals({ form }) {
  let totals, error="";
  try { totals=computeInvoiceTotals(form); } catch (err) {error=err.message;}
  if (!totals) return <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">{error}</div>;
  return <div className="rounded-2xl bg-blue-50 p-4 text-sm">
    <div className="flex justify-between text-slate-600"><span>Taxable value</span><span>{formatInvoiceMoney(totals.taxable,totals.currency)}</span></div>
    <div className="mt-2 flex justify-between text-slate-600"><span>GST</span><span>{formatInvoiceMoney(totals.totalTax,totals.currency)}</span></div>
    <div className="mt-3 flex justify-between border-t border-blue-200 pt-3 font-bold text-slate-900"><span>Invoice total</span><span>{formatInvoiceMoney(totals.total,totals.currency)}</span></div>
    <div className="mt-2 flex justify-between text-xs text-blue-700"><span>Internal INR equivalent</span><span>{formatInvoiceMoney(totals.totalINR,"INR")}</span></div>
  </div>;
}
function InvoiceLines({ form, setForm }) {
  const patch = (index, key, value) => setForm(current => ({...current, lines:current.lines.map((line,i)=>i===index?{...line,[key]:value}:line)}));
  return <div className="space-y-3">
    {form.lines.map((line,index)=><div key={index} className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="mb-3 flex items-center justify-between"><p className="text-xs font-bold text-slate-500">ITEM {index+1}</p><button type="button" className="text-xs font-semibold text-red-600 hover:underline" disabled={form.lines.length===1} onClick={()=>setForm(current=>({...current,lines:current.lines.filter((_,i)=>i!==index)}))}>Remove</button></div>
      <div className="grid gap-3 sm:grid-cols-2"><Field label="Description"><Input value={line.description} onChange={v=>patch(index,"description",v)} placeholder="Hotel / transfers / sightseeing"/></Field><Field label="SAC / HSN"><Input value={line.sac} onChange={v=>patch(index,"sac",v)} placeholder="Enter applicable service code"/></Field></div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4"><Field label="Quantity"><Input type="number" min="0.01" step="any" value={line.quantity} onChange={v=>patch(index,"quantity",v)}/></Field><Field label="Unit price"><Input type="number" min="0" step="any" value={line.unitPrice} onChange={v=>patch(index,"unitPrice",v)}/></Field><Field label="Discount %"><Input type="number" min="0" max="100" value={line.discountRate} onChange={v=>patch(index,"discountRate",v)}/></Field><Field label="GST %"><Input type="number" min="0" max="100" disabled={form.taxMode==="none"} value={form.taxMode==="none"?0:line.taxRate} onChange={v=>patch(index,"taxRate",v)}/></Field></div>
    </div>)}
    <button type="button" className={secondary} onClick={()=>setForm(current=>({...current,lines:[...current.lines,lineDefault()]}))}><Plus size={15}/> Add item</button>
  </div>;
}
function TaxCurrencyFields({ form, setForm }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <Field label="Invoice currency"><Select value={form.currency} onChange={v=>setForm(current=>({...current,currency:v,fxRateINR:v==="INR"?1:""}))} options={INVOICE_CURRENCIES}/></Field>
    <Field label={`INR per 1 ${form.currency}`} help="Use agreed transaction rate, not an unverified live rate."><Input type="number" step="any" min="0" disabled={form.currency==="INR"} value={form.currency==="INR"?1:form.fxRateINR} onChange={v=>setForm(current=>({...current,fxRateINR:v}))}/></Field>
    <Field label="Tax treatment"><Select value={form.taxMode} onChange={v=>setForm(current=>({...current,taxMode:v}))} options={[["none","No GST / review classification"],["cgst_sgst","CGST + SGST"],["igst","IGST"]]}/></Field>
    <Field label="Due date"><Input type="date" value={form.dueDate} onChange={v=>setForm(current=>({...current,dueDate:v}))}/></Field>
  </div>;
}
function Dialog({ title, onClose, children, wide = false }) { return <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/55 px-3 py-8 backdrop-blur-[2px]" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}>
  <div role="dialog" aria-modal="true" aria-label={title} className={`relative w-full ${wide?"max-w-5xl":"max-w-xl"} rounded-3xl bg-slate-50 p-4 shadow-2xl sm:p-6`}>
    <div className="mb-5 flex items-center justify-between gap-4"><h2 className="text-lg font-bold text-slate-900">{title}</h2><button type="button" aria-label="Close" onClick={onClose} className="rounded-full bg-white p-2 text-slate-600"><X size={18}/></button></div>{children}
  </div></div>;
}
function SettingsDialog({ settings, onSaved, onClose, user }) {
  const [form,setForm]=useState({...settings}); const [busy,setBusy]=useState(false); const [error,setError]=useState("");
  const fields=[["name","Company legal name"],["address","Registered address"],["gstin","GSTIN"],["pan","PAN"],["state","Registered state"],["email","Billing email"],["phone","Phone"],["bankName","Bank name"],["accountName","Account name"],["accountNumber","Account number"],["ifsc","IFSC"],["swift","SWIFT / BIC"],["upi","UPI ID"],["terms","Default invoice terms"]];
  const save=async event=>{event.preventDefault();setBusy(true);setError("");try{const result=await saveInvoiceSettings(form,user);onSaved(result);onClose();}catch(err){setError(err.message);}finally{setBusy(false);}};
  return <Dialog title="Invoice Company & Bank Settings" onClose={onClose} wide><form onSubmit={save} className="space-y-4">
    <p className="rounded-xl bg-blue-50 p-3 text-xs text-blue-800">These fields are snapshotted into new invoice drafts. Configure correct legal entity/GST details with your accounts team before issuing.</p>
    <div className="grid gap-3 sm:grid-cols-2">{fields.map(([key,label])=><Field key={key} label={label}><Input value={form[key]||""} onChange={v=>setForm(current=>({...current,[key]:v}))}/></Field>)}</div>
    {error&&<p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="flex justify-end"><button className={primary} disabled={busy}>{busy?"Saving...":"Save invoice settings"}</button></div>
  </form></Dialog>;
}

export default function InvoicesPage() {
  const { user, loading }=useAuth();
  const [type,setType]=useState("outgoing");
  const [rowsOutgoing,setRowsOutgoing]=useState([]), [rowsIncoming,setRowsIncoming]=useState([]);
  const [leads,setLeads]=useState([]), [vendors,setVendors]=useState([]), [agents,setAgents]=useState([]);
  const [settings,setSettings]=useState({...DEFAULT_INVOICE_SETTINGS});
  const [settingsOpen,setSettingsOpen]=useState(false), [editOpen,setEditOpen]=useState(false);
  const [form,setForm]=useState(invoiceBase), [vendorForm,setVendorForm]=useState(vendorBase);
  const [editingId,setEditingId]=useState("");
  const [selection,setSelection]=useState(null);
  const [allPayments,setAllPayments]=useState([]);
  const [file,setFile]=useState(null);
  const [search,setSearch]=useState("");
  const [busy,setBusy]=useState(false), [error,setError]=useState(""), [notice,setNotice]=useState("");
  const paperRef=useRef(null);
  const canConfigure=canAccess(user,"invoices.configure");
  const canOutgoingCreate=canAccess(user,"invoices.outgoing.create");
  const canIssue=canAccess(user,"invoices.outgoing.issue");
  const canIncomingCreate=canAccess(user,"invoices.vendor.create");
  const canVerify=canAccess(user,"invoices.vendor.verify");
  const canAllocate=canAccess(user,"invoices.allocate");
  const canIncomingView=canAccess(user,"invoices.vendor.view");
  const canOutgoingView=canAccess(user,"invoices.outgoing.view");
  useEffect(()=>{const params=new URLSearchParams(window.location.search);if(params.get("type")==="incoming"||(!canOutgoingView&&canIncomingView))setType("incoming");},[canOutgoingView,canIncomingView]);
  useEffect(()=>{
    if(loading||!user)return;
    const unsubs=[];
    if(canOutgoingView)unsubs.push(observeInvoices("outgoing",setRowsOutgoing,err=>setError(`Outgoing invoices: ${err.message}`)));
    if(canIncomingView)unsubs.push(observeInvoices("incoming",setRowsIncoming,err=>setError(`Vendor invoices: ${err.message}`)));
    return()=>unsubs.forEach(unsub=>unsub());
  },[loading,user?.uid,canOutgoingView,canIncomingView]);
  useEffect(()=>{
    if(loading||!user)return;
    let live=true;
    Promise.allSettled([
      getDocs(query(collection(db,"leads"),limit(500))),
      getDocs(query(collection(db,"vendors"),limit(500))),
      getDocs(query(collection(db,"travelAgents"),limit(500))),
      getInvoiceSettings()
    ]).then(result=>{if(!live)return;
      if(result[0].status==="fulfilled")setLeads(result[0].value.docs.map(d=>({id:d.id,...d.data()})));
      if(result[1].status==="fulfilled")setVendors(result[1].value.docs.map(d=>({id:d.id,...d.data()})));
      if(result[2].status==="fulfilled")setAgents(result[2].value.docs.map(d=>({id:d.id,...d.data()})));
      if(result[3].status==="fulfilled")setSettings(result[3].value);
      if(result[3].status==="rejected")setError(`Invoice settings: ${result[3].reason.message}`);
    });
    return()=>{live=false;};
  },[loading,user?.uid]);
  // Invoice values are separate from bookings won and from dated cash receipts.
  const invoiceSummary=useMemo(()=>{
    const validInr=invoice=>{
      const n=Number(invoice?.totalINR);
      return invoice?.totalINR!==null && invoice?.totalINR!==undefined && Number.isFinite(n) && n>=0 ? n : null;
    };
    const validOutstanding=invoice=>{
      const totalInr=validInr(invoice);
      const total=Number(invoice?.total), allocated=Number(invoice?.allocatedTotal||0);
      if(totalInr===null||!Number.isFinite(total)||total<=0||!Number.isFinite(allocated))return null;
      return Math.max(0,totalInr-Math.max(0,allocated)*(totalInr/total));
    };
    const customer=rowsOutgoing.filter(inv=>inv.status==='issued');
    const vendor=rowsIncoming.filter(inv=>inv.status==='verified');
    const sum=(items,fn)=>items.reduce((total,item)=>total+(fn(item)||0),0);
    return {
      customerCount:customer.length,customerIssuedInr:sum(customer,validInr),customerOutstandingInr:sum(customer,validOutstanding),
      vendorCount:vendor.length,vendorVerifiedInr:sum(vendor,validInr),vendorOutstandingInr:sum(vendor,validOutstanding),
      missingInr:[...customer,...vendor].filter(inv=>validInr(inv)===null || validOutstanding(inv)===null).length
    };
  },[rowsOutgoing,rowsIncoming]);
  const selectedInvoice=useMemo(()=>selection ? (selection.type==="outgoing"?rowsOutgoing:rowsIncoming).find(row=>row.id===selection.id)||null : null,[selection,rowsOutgoing,rowsIncoming]);
  useEffect(()=>{
    if(!selectedInvoice){setAllPayments([]);return;}
    return observeLeadPayments(selectedInvoice,setAllPayments,err=>setError(`Payment records: ${err.message}`));
  },[selectedInvoice?.id,selectedInvoice?.leadId,selectedInvoice?.type]);
  const relevantPayment=useMemo(()=>allPayments.filter(p=>p.invoiceId===selectedInvoice?.id && (selectedInvoice?.type==="outgoing"?p.status==="verified":p.status==="paid") && normalizeCurrency(p.currency)===normalizeCurrency(selectedInvoice?.currency)),[allPayments,selectedInvoice]);
  const paymentSummary=selectedInvoice?invoicePaymentStatus(selectedInvoice.total,relevantPayment.map(row=>row.amount)):null;
  const visibleRows=useMemo(()=>{
    const candidates=type==="outgoing"?rowsOutgoing:rowsIncoming;
    const q=search.trim().toLowerCase();
    return candidates.filter(row=>!q||[row.invoiceNumber,row.vendorInvoiceNumber,row.leadCode,row.leadId,row.recipient?.name,row.vendorName,row.destination].some(v=>text(v).toLowerCase().includes(q)));
  },[type,rowsOutgoing,rowsIncoming,search]);
  const run=async callback=>{setBusy(true);setError("");setNotice("");try{await callback();}catch(err){setError(err?.message||String(err));}finally{setBusy(false);}};

  const applyLead=(lead, incoming=false)=>{
    if(!lead)return;
    const agent=agents.find(a=>a.id===pick(lead.travelAgentId,lead.agentId,lead.agencyId)) || agents.find(a=>a.agencyName===pick(lead.travelAgentName,lead.agencyName));
    const leadFields={leadId:lead.id,leadCode:text(lead.leadCode),destination:pick(lead.destination,lead.destinationName,lead.travelDestination),travelDates:pick(lead.travelDates,lead.travelDate,lead.dateOfTravel,lead.travelMonth)};
    if(incoming){setVendorForm(previous=>({...previous,...leadFields,lines:previous.lines.map((line,index)=>index===0&&!line.description?{...line,description:`${leadFields.destination||"Destination"} vendor services`}:line)}));return;}
    const recipient={
      name:pick(agent?.agencyName,lead.travelAgentName,lead.agencyName,lead.agentName),
      contactName:pick(lead.spoc?.name,agent?.spoc?.name,lead.spocName),
      email:pick(lead.travelAgentEmail,lead.agentEmail,agent?.email,agent?.primarySPOC?.email,lead.email),
      gstin:pick(agent?.gstNumber,agent?.gstin), address:addressOf(agent?.address)||pick(lead.travelAgentAddress,lead.billingAddress)
    };
    setForm(previous=>({...previous,...leadFields,stage:normalizeLeadStage(lead.stage),travelAgentId:text(agent?.id||lead.travelAgentId),recipient,
      lines:previous.lines.map((line,index)=>index===0&&!line.description?{...line,description:`${leadFields.destination||"Destination"} travel services`}:line)}));
  };
  const loadLead=async (id,incoming)=>{
    const lead=leads.find(l=>l.id===id);
    let result=lead;
    if(!result){const snap=await getDoc(doc(db,"leads",id));if(!snap.exists())throw new Error("Lead not found.");result={id:snap.id,...snap.data()};}
    applyLead(result,incoming);
  };
  const openNew=async incoming=>{
    setEditingId("");setFile(null);setError("");setNotice("");
    if(incoming)setVendorForm(vendorBase());else setForm({...invoiceBase(),supplier:{...settings}});
    setType(incoming?"incoming":"outgoing");setEditOpen(true);
    const id=new URLSearchParams(window.location.search).get("leadId");
    if(id){try{await loadLead(id,incoming);}catch(err){setError(err.message);}}
  };
  const editDraft=invoice=>{setEditingId(invoice.id);setForm({...invoice});setEditOpen(true);setError("");};
  const saveDraft=event=>{event.preventDefault();run(async()=>{
    const id=await saveOutgoingInvoiceDraft(form,user,editingId);
    setEditOpen(false);setNotice("Draft saved. Review all amounts and click Issue after finance approval.");setSelection({type:"outgoing",id});
  });};
  const saveVendor=event=>{event.preventDefault();run(async()=>{
    if(!file)throw new Error("Choose the vendor invoice PDF or image to upload.");
    // Validate numeric lines before uploading to avoid unnecessary files.
    computeInvoiceTotals(vendorForm);
    if(!vendorForm.leadId||!vendorForm.vendorId||!vendorForm.vendorInvoiceNumber)throw new Error("Select booking, vendor, and invoice number.");
    const mod=await import("@/lib/invoiceCore.mjs");
    const existing=await getDoc(doc(db,"vendorInvoices",mod.vendorInvoiceDocId(vendorForm.vendorId,vendorForm.vendorInvoiceNumber)));
    if(existing.exists())throw new Error("This vendor invoice is already registered. No second attachment was uploaded.");
    const proof=await uploadInvoiceAttachment({file,leadId:vendorForm.leadId,vendorId:vendorForm.vendorId,kind:"vendor"});
    const id=await saveIncomingVendorInvoice({...vendorForm,...proof},user);
    setEditOpen(false);setNotice("Vendor invoice registered. Finance can verify or dispute it.");setSelection({type:"incoming",id});
  });};
  const generatePdfBlob=async()=>{
    if(!paperRef.current)throw new Error("Open the invoice preview first.");
    const mod=await import("html2pdf.js");const html2pdf=mod.default||mod;
    return html2pdf().set({margin:7,filename:`${(selectedInvoice.invoiceNumber||"draft-invoice").replaceAll("/","-")}.pdf`,image:{type:"jpeg",quality:0.98},html2canvas:{scale:2,useCORS:true,backgroundColor:"#ffffff"},jsPDF:{unit:"mm",format:"a4",orientation:"portrait"},pagebreak:{mode:["css","legacy"]}}).from(paperRef.current).outputPdf("blob");
  };
  const pdfDownload=()=>run(async()=>{
    const blob=await generatePdfBlob();const url=URL.createObjectURL(blob);const element=document.createElement("a");element.href=url;element.download=`${selectedInvoice.invoiceNumber||"draft-invoice"}.pdf`.replaceAll("/","-");document.body.append(element);element.click();element.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
  });
  const ensureHostedPdf=async()=>{
    if(selectedInvoice?.status!=="issued")throw new Error("Issue the invoice before sharing its PDF.");
    if(selectedInvoice.pdfUrl)return selectedInvoice.pdfUrl;
    const blob=await generatePdfBlob();
    const pdfFile=new File([blob],`${selectedInvoice.invoiceNumber.replaceAll("/","-")}.pdf`,{type:"application/pdf"});
    const result=await uploadInvoiceAttachment({file:pdfFile,leadId:selectedInvoice.leadId,vendorId:selectedInvoice.travelAgentId||"agent",kind:"outgoing"});
    await saveOutgoingPdfReference(selectedInvoice.id,result,user);
    return result.originalFileUrl;
  };
  const emailInvoice=()=>run(async()=>{
    if(selectedInvoice?.status!=="issued")throw new Error("Only issued invoices may be emailed.");
    if(!mailing(selectedInvoice.recipient?.email))throw new Error("Enter a valid travel agent billing email in the invoice before issuing.");
    const url=await ensureHostedPdf();
    const result=await sendIssuedInvoiceEmail({invoice:selectedInvoice,pdfUrl:url,user});
    setNotice(`Invoice email accepted by Brevo for ${selectedInvoice.recipient.email}; message ID ${result.messageId||"pending"}. Delivery is not yet confirmed. ${result.auditWarning||""}`);
  });
  const shareWhatsApp=()=>{
    // Reserve a new tab in the direct click event so asynchronous PDF upload
    // cannot trigger a browser popup blocker.
    const popup=window.open("about:blank","_blank");
    run(async()=>{
      try {
        const url=await ensureHostedPdf();
        const message=`DreamTrawell Destination invoice ${selectedInvoice.invoiceNumber} for booking ${selectedInvoice.leadCode||selectedInvoice.leadId}. Amount: ${formatInvoiceMoney(selectedInvoice.total,selectedInvoice.currency)}. View PDF: ${url}`;
        const target=`https://wa.me/?text=${encodeURIComponent(message)}`;
        if(popup&&!popup.closed)popup.location.href=target;
        else throw new Error("Pop-up blocked. Allow WhatsApp pop-ups and retry.");
        setNotice("WhatsApp opened with a draft invoice message. Verify the recipient and press Send manually.");
      } catch(error) { if(popup&&!popup.closed)popup.close(); throw error; }
    });
  };
  if(loading||!user)return <div className="p-8 text-sm text-slate-500">Loading invoice workspace...</div>;
  if(!canIncomingView&&!canOutgoingView)return <div className="p-8 text-sm text-red-700">Your role does not have access to invoicing.</div>;
  return <div className="mx-auto max-w-[1450px] space-y-5 px-4 pb-12 pt-5 sm:px-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.14em] text-blue-700"><Receipt size={16}/> Finance workspace</div><h1 className="text-2xl font-bold text-slate-900">Accounts & Invoicing</h1><p className="mt-1 text-sm text-slate-500">Travel agent invoices out. Vendor invoices in. Original currency preserved, internal INR ledger.</p></div>
      <div className="flex flex-wrap gap-2">{canConfigure&&<button className={secondary} onClick={()=>setSettingsOpen(true)}><Settings2 size={17}/> Company & bank details</button>}{canOutgoingCreate&&<button className={primary} onClick={()=>openNew(false)}><Plus size={17}/> Travel agent invoice</button>}{canIncomingCreate&&<button className={secondary} onClick={()=>openNew(true)}><UploadCloud size={17}/> Register vendor invoice</button>}</div>
    </div>
    {(error||notice)&&<div role="status" className={`rounded-2xl border px-4 py-3 text-sm ${error?"border-red-200 bg-red-50 text-red-800":"border-blue-200 bg-blue-50 text-blue-800"}`}>{error||notice}<button className="float-right font-bold" onClick={()=>{setError("");setNotice("");}}>x</button></div>}
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">{[
      ['Issued TA invoice value · INR',invoiceSummary.customerIssuedInr,true],
      ['TA invoice outstanding · INR',invoiceSummary.customerOutstandingInr,true],
      ['Verified vendor invoice value · INR',invoiceSummary.vendorVerifiedInr,true],
      ['Vendor invoice outstanding · INR',invoiceSummary.vendorOutstandingInr,true],
      ['Issued TA invoices',invoiceSummary.customerCount,false],
      ['Verified vendor invoices',invoiceSummary.vendorCount,false]
    ].map(([label,value,isMoney])=><div key={label} className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-2 text-xl font-bold tabular-nums text-slate-900">{isMoney?formatInvoiceMoney(value,'INR'):value}</p></div>)}</div>
    <p className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-900">These are <b>all-time issued/verified invoice amounts</b>, less payments allocated to each invoice at its invoice FX rate. They are neither monthly cash movement nor the booked business total. {invoiceSummary.missingInr ? `${invoiceSummary.missingInr} invoice(s) are missing reliable INR amounts / allocation bases and are excluded.` : ''}</p>
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
        <div className="flex gap-2">{canOutgoingView&&<button className={type==="outgoing"?primary:secondary} onClick={()=>setType("outgoing")}><FileText size={16}/> Travel agent invoices</button>}{canIncomingView&&<button className={type==="incoming"?primary:secondary} onClick={()=>setType("incoming")}><ArrowDownToLine size={16}/> Vendor invoices</button>}</div>
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3"><Search size={17} className="text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} className="min-w-0 bg-transparent py-2.5 text-sm outline-none" placeholder="Search invoice / booking / agent"/></div>
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Invoice</th><th className="px-5 py-3">{type==="outgoing"?"Travel agent":"Vendor"}</th><th className="px-5 py-3">Booking</th><th className="px-5 py-3">Amount</th><th className="px-5 py-3">Internal INR</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Action</th></tr></thead>
        <tbody className="divide-y divide-slate-100">{visibleRows.map(row=><tr key={row.id} className="hover:bg-blue-50/30"><td className="px-5 py-4 font-semibold text-slate-900">{row.invoiceNumber||row.vendorInvoiceNumber||"Draft"}<p className="mt-1 text-xs font-normal text-slate-500">{row.issueDate||row.vendorInvoiceDate||"Not issued"}</p></td><td className="px-5 py-4">{row.recipient?.name||row.vendorName||"-"}</td><td className="px-5 py-4"><Link className="text-blue-700 hover:underline" href={`/admin/leads/${row.leadId}`}>{row.leadCode||row.leadId}</Link></td><td className="px-5 py-4 font-semibold">{formatInvoiceMoney(row.total,row.currency)}</td><td className="px-5 py-4 text-slate-600">{formatInvoiceMoney(row.totalINR,"INR")}</td><td className="px-5 py-4"><Status value={row.status}/></td><td className="px-5 py-4"><button className="text-sm font-semibold text-blue-700 hover:underline" onClick={()=>{setSelection({type:row.type||type,id:row.id});setError("");}}>View details</button></td></tr>)}
          {visibleRows.length===0&&<tr><td colSpan={7} className="p-10 text-center text-slate-500">No invoices found. Create the first invoice from a confirmed booking.</td></tr>}</tbody>
      </table></div>
    </section>
    <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-xs leading-5 text-amber-900"><b>Accounting control:</b> GST rate and tax treatment are not assumed. Confirm correct place of supply, SAC, tax treatment, e-invoicing requirements and legal entity with your accountant. Lead-level payments remain in the existing Payments module; allocation links a verified/paid entry to one invoice without creating new cash entries.</div>
    {settingsOpen&&<SettingsDialog settings={settings} user={user} onSaved={setSettings} onClose={()=>setSettingsOpen(false)}/>}
    {editOpen&&<Dialog wide title={type==="incoming"?"Register Received Vendor Invoice":editingId?"Edit Invoice Draft":"Create Travel Agent Invoice Draft"} onClose={()=>setEditOpen(false)}>
      {error&&<p role="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {type==="outgoing"?<form className="space-y-5" onSubmit={saveDraft}>
        <div className="rounded-xl bg-blue-50 p-3 text-xs leading-5 text-blue-900">Link a booking and verify billing information. Quotation amounts are <b>not copied automatically</b> because some historic vendor/quotation amounts may have currency inconsistencies. Finance should enter the confirmed selling amount.</div>
        <SectionTitle>Booking & travel agent</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Choose CRM booking / lead"><Select value={form.leadId} onChange={id=>run(()=>loadLead(id,false))} options={[["","Select a booking"],...leads.filter(lead=>!form.leadId||lead.id===form.leadId||normalizeLeadStage(lead.stage)==="converted").map(lead=>[lead.id,`${lead.leadCode||lead.id} - ${pick(lead.travelAgentName,lead.agencyName,lead.customerName)}`])]} /></Field>
          <Field label="Or paste an existing Lead ID"><div className="flex gap-2"><Input value={form.leadId} onChange={v=>setForm(previous=>({...previous,leadId:v}))} placeholder="Lead Firestore document ID"/><button type="button" className={secondary} onClick={()=>run(()=>loadLead(form.leadId,false))}>Load</button></div></Field>
          <Field label="Destination"><Input value={form.destination} onChange={v=>setForm(previous=>({...previous,destination:v}))}/></Field>
          <Field label="Travel dates / booking reference"><Input value={form.travelDates} onChange={v=>setForm(previous=>({...previous,travelDates:v}))}/></Field>
          <Field label="Travel agent legal name"><Input value={form.recipient.name} onChange={v=>setForm(previous=>({...previous,recipient:{...previous.recipient,name:v}}))}/></Field>
          <Field label="Travel agent GSTIN (if registered)"><Input value={form.recipient.gstin} onChange={v=>setForm(previous=>({...previous,recipient:{...previous.recipient,gstin:v.toUpperCase()}}))}/></Field>
          <Field label="Billing email"><Input type="email" value={form.recipient.email} onChange={v=>setForm(previous=>({...previous,recipient:{...previous.recipient,email:v}}))}/></Field>
          <Field label="Contact name"><Input value={form.recipient.contactName} onChange={v=>setForm(previous=>({...previous,recipient:{...previous.recipient,contactName:v}}))}/></Field>
          <div className="sm:col-span-2"><Field label="Billing address"><textarea rows={2} className={inputStyle} value={form.recipient.address} onChange={e=>setForm(previous=>({...previous,recipient:{...previous.recipient,address:e.target.value}}))}/></Field></div>
        </div>
        <SectionTitle>Invoice currency & GST</SectionTitle>
        <TaxCurrencyFields form={form} setForm={setForm}/>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Place of supply"><Input value={form.placeOfSupply} onChange={v=>setForm(previous=>({...previous,placeOfSupply:v}))} placeholder="State / country as applicable"/></Field>
          <Field label="Reverse charge"><Select value={form.reverseCharge?"yes":"no"} onChange={v=>setForm(previous=>({...previous,reverseCharge:v==="yes"}))} options={[["no","No"],["yes","Yes"]]}/></Field>
        </div>
        <SectionTitle>Services & itemisation</SectionTitle>
        <InvoiceLines form={form} setForm={setForm}/>
        <Totals form={form}/>
        <Field label="Notes / commercial terms"><textarea rows={3} className={inputStyle} value={form.notes} onChange={e=>setForm(previous=>({...previous,notes:e.target.value}))} placeholder="Payment terms or special booking reference"/></Field>
        <div className="flex flex-wrap justify-end gap-2"><button type="button" className={secondary} onClick={()=>setEditOpen(false)}>Cancel</button><button className={primary} disabled={busy}>{busy?"Saving...":editingId?"Update draft":"Save draft"}</button></div>
      </form>:<form onSubmit={saveVendor} className="space-y-5">
        <p className="rounded-xl bg-blue-50 p-3 text-xs text-blue-900">Register the original invoice received from the vendor. Duplicate vendor + invoice-number entries are blocked. Verification and payment stay separate.</p>
        <SectionTitle>Link vendor and booking</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Linked booking / lead"><Select value={vendorForm.leadId} onChange={id=>run(()=>loadLead(id,true))} options={[["","Select booking"],...leads.filter(lead=>!vendorForm.leadId||lead.id===vendorForm.leadId||normalizeLeadStage(lead.stage)==="converted").map(lead=>[lead.id,`${lead.leadCode||lead.id} - ${pick(lead.travelAgentName,lead.agencyName)}`])]}/></Field>
          <Field label="Or paste Lead ID"><div className="flex gap-2"><Input value={vendorForm.leadId} onChange={v=>setVendorForm(p=>({...p,leadId:v}))}/><button type="button" className={secondary} onClick={()=>run(()=>loadLead(vendorForm.leadId,true))}>Load</button></div></Field>
          <Field label="Vendor"><Select value={vendorForm.vendorId} onChange={id=>{const vendor=vendors.find(v=>v.id===id);setVendorForm(p=>({...p,vendorId:id,vendorName:vendor?.vendorName||"",vendorGstin:vendor?.gstNumber||"",vendorAddress:addressOf(vendor?.address)||[vendor?.city,vendor?.state,vendor?.country].filter(Boolean).join(", ")}));}} options={[["","Select vendor"],...vendors.map(v=>[v.id,pick(v.vendorName,v.name,v.vendorCode,v.id)])]}/></Field>
          <Field label="Vendor GSTIN"><Input value={vendorForm.vendorGstin} onChange={v=>setVendorForm(p=>({...p,vendorGstin:v.toUpperCase()}))}/></Field>
          <Field label="Vendor billing address"><Input value={vendorForm.vendorAddress} onChange={v=>setVendorForm(p=>({...p,vendorAddress:v}))}/></Field>
          <Field label="Vendor invoice number"><Input value={vendorForm.vendorInvoiceNumber} onChange={v=>setVendorForm(p=>({...p,vendorInvoiceNumber:v}))}/></Field>
          <Field label="Vendor invoice date"><Input type="date" value={vendorForm.vendorInvoiceDate} onChange={v=>setVendorForm(p=>({...p,vendorInvoiceDate:v}))}/></Field>
          <Field label="Original vendor document"><input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className={inputStyle} onChange={e=>setFile(e.target.files?.[0]||null)} required/><p className="mt-1 text-xs text-slate-500">PDF/JPG/PNG/WebP, maximum 10 MB.</p></Field>
        </div>
        <SectionTitle>Invoice values</SectionTitle>
        <TaxCurrencyFields form={vendorForm} setForm={setVendorForm}/>
        <InvoiceLines form={vendorForm} setForm={setVendorForm}/>
        <Totals form={vendorForm}/>
        <Field label="Finance notes"><textarea rows={2} className={inputStyle} value={vendorForm.notes} onChange={e=>setVendorForm(p=>({...p,notes:e.target.value}))}/></Field>
        <div className="flex justify-end gap-2"><button type="button" className={secondary} onClick={()=>setEditOpen(false)}>Cancel</button><button className={primary} disabled={busy}>{busy?"Uploading & saving...":"Register received invoice"}</button></div>
      </form>}
    </Dialog>}
    {selectedInvoice&&<Dialog title={selectedInvoice.type==="incoming"?"Received Vendor Invoice":"Travel Agent Invoice"} wide onClose={()=>setSelection(null)}>
      <div className="space-y-4">
        {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {notice&&<p role="status" className="rounded-xl bg-blue-50 p-3 text-sm text-blue-800">{notice}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
          <div><p className="text-lg font-bold text-slate-900">{selectedInvoice.invoiceNumber||selectedInvoice.vendorInvoiceNumber||"Draft"}</p><p className="mt-1 text-xs text-slate-500">{selectedInvoice.leadCode||selectedInvoice.leadId} · {selectedInvoice.recipient?.name||selectedInvoice.vendorName}</p></div>
          <div className="flex flex-wrap items-center gap-2"><Status value={selectedInvoice.status}/><span className="font-bold text-slate-900">{formatInvoiceMoney(selectedInvoice.total,selectedInvoice.currency)}</span></div>
        </div>
        {selectedInvoice.type==="outgoing"?<>
          <div className="flex flex-wrap gap-2">
            {selectedInvoice.status==="draft"&&canOutgoingCreate&&<button type="button" className={secondary} onClick={()=>{editDraft(selectedInvoice);setSelection(null);}}>Edit draft</button>}
            {selectedInvoice.status==="draft"&&canIssue&&<button type="button" className={primary} disabled={busy} onClick={()=>{if(window.confirm("Confirm the booking, billing currency, GST classification and any applicable IRN/e-invoicing requirement have been reviewed. A permanent invoice number will be assigned, and amounts cannot be edited.")){run(async()=>{const number=await issueOutgoingInvoice(selectedInvoice.id,user);setNotice(`Invoice ${number} issued. Download or email the PDF.`);});}}}><BadgeCheck size={16}/> Issue invoice</button>}
            <button type="button" className={secondary} disabled={busy} onClick={pdfDownload}><Download size={16}/> Download PDF</button>
            <button type="button" className={secondary} onClick={()=>window.print()}><Printer size={16}/> Print</button>
            {selectedInvoice.status==="issued"&&canIssue&&<button type="button" className={primary} disabled={busy} onClick={emailInvoice}><Mail size={16}/> Email PDF link</button>}
            {selectedInvoice.status==="issued"&&canIssue&&<button type="button" className={secondary} disabled={busy} onClick={shareWhatsApp}><MessageCircle size={16}/> WhatsApp PDF link</button>}
            {selectedInvoice.status==="issued"&&canAccess(user,"invoices.outgoing.void")&&<button type="button" className={danger} disabled={busy} onClick={()=>{const reason=window.prompt("Reason to void issued invoice (cannot reuse number):");if(reason!==null)run(async()=>{await voidOutgoingInvoice(selectedInvoice.id,reason,user);setNotice("Invoice voided. Number is preserved in the audit history.");});}}><ShieldAlert size={16}/> Void</button>}
          </div>
          {selectedInvoice.status==="draft"&&<p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800"><b>Draft:</b> This is not an issued invoice. Finance must verify tax, currency, agent billing details and booking confirmation before issuing.</p>}
          {selectedInvoice.status==="issued"&&<p className="rounded-xl bg-blue-50 p-3 text-xs text-blue-800">Email sends a hosted PDF link through Brevo. The provider accepting the message is not delivery confirmation. Download the PDF first if your agent requests an attachment.</p>}
          <div className="overflow-auto rounded-2xl border border-slate-200 bg-slate-200 p-2 sm:p-4"><div ref={paperRef} className="invoice-paper-target mx-auto bg-white shadow-sm"><InvoicePaper invoice={selectedInvoice}/></div></div>
        </>:<div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-3 text-xs text-slate-600">{selectedInvoice.vendorGstin&&<p><b>Vendor GSTIN:</b> {selectedInvoice.vendorGstin}</p>}{selectedInvoice.vendorAddress&&<p><b>Vendor address:</b> {selectedInvoice.vendorAddress}</p>}</div>
          <div className="grid gap-3 text-sm sm:grid-cols-3"><div><span className="text-xs text-slate-500">Vendor invoice date</span><p className="font-semibold">{selectedInvoice.vendorInvoiceDate}</p></div><div><span className="text-xs text-slate-500">Due date</span><p className="font-semibold">{selectedInvoice.dueDate||"Not specified"}</p></div><div><span className="text-xs text-slate-500">Internal INR value</span><p className="font-semibold">{formatInvoiceMoney(selectedInvoice.totalINR,"INR")}</p></div></div>
          <div className="flex flex-wrap gap-2">{selectedInvoice.originalFileUrl&&<a href={selectedInvoice.originalFileUrl} target="_blank" rel="noreferrer" className={secondary}><Download size={16}/> View vendor original ({selectedInvoice.originalFileName||"file"})</a>}
            {canVerify&&selectedInvoice.status!=="verified"&&<button className={primary} disabled={busy} onClick={()=>run(async()=>{await setVendorInvoiceReview(selectedInvoice.id,"verified","",user);setNotice("Vendor invoice verified.");})}><CheckCircle2 size={16}/> Mark verified</button>}
            {canVerify&&<button className={danger} disabled={busy} onClick={()=>{const reason=window.prompt("Vendor invoice dispute reason:");if(reason!==null)run(async()=>{await setVendorInvoiceReview(selectedInvoice.id,"disputed",reason,user);setNotice("Vendor invoice flagged for review.");});}}>Dispute</button>}
          </div>
          <table className="w-full text-sm"><thead><tr className="border-b text-left text-xs text-slate-500"><th className="py-2">Item</th><th className="py-2 text-right">Qty</th><th className="py-2 text-right">Value</th></tr></thead><tbody>{(selectedInvoice.lines||[]).map((line,index)=><tr key={index} className="border-b"><td className="py-2">{line.description}</td><td className="py-2 text-right">{line.quantity}</td><td className="py-2 text-right">{formatInvoiceMoney(line.total,selectedInvoice.currency)}</td></tr>)}</tbody></table>
          <div className="text-right text-sm font-semibold">Total: {formatInvoiceMoney(selectedInvoice.total,selectedInvoice.currency)}</div>
          {selectedInvoice.reviewReason&&<p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">Review note: {selectedInvoice.reviewReason}</p>}
        </div>}
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center gap-2"><Wallet size={17} className="text-blue-600"/><h3 className="text-sm font-bold text-slate-900">Payment reconciliation</h3></div>
          <p className="mb-3 text-xs text-slate-600">Only payments explicitly allocated to this invoice count toward its balance. Existing CRM payment entries are not duplicated. One whole payment entry can be assigned to one invoice.</p>
          <div className="grid gap-2 sm:grid-cols-3">{[["Invoice",formatInvoiceMoney(selectedInvoice.total,selectedInvoice.currency)],["Allocated",formatInvoiceMoney(paymentSummary?.received||0,selectedInvoice.currency)],["Outstanding",formatInvoiceMoney(paymentSummary?.balance||0,selectedInvoice.currency)]].map(([label,value])=><div key={label} className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">{label}</div><div className="mt-1 text-sm font-bold">{value}</div></div>)}</div>
          <div className="mt-3 text-xs font-semibold capitalize text-slate-600">Status: {paymentSummary?.status?.replaceAll("_"," ")||"unpaid"}</div>
          {allPayments.filter(payment=>payment.invoiceId===selectedInvoice.id).length>0&&<div className="mt-3 space-y-2"><p className="text-xs font-bold text-slate-600">Linked payment entries</p>{allPayments.filter(payment=>payment.invoiceId===selectedInvoice.id).map(payment=><div key={payment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-2 text-xs"><span>{formatInvoiceMoney(payment.amount,payment.currency)} · {payment.status} · {payment.transactionRef||payment.id}</span>{canAllocate&&<button className="font-semibold text-red-700 hover:underline" disabled={busy} onClick={()=>run(async()=>{await unallocateExistingPayment({invoice:selectedInvoice,paymentId:payment.id,user});setNotice("Payment unlinked from invoice. Original payment record was not deleted.");})}>Unlink</button>}</div>)}</div>}
          {canAllocate&&((selectedInvoice.type==="outgoing"&&selectedInvoice.status==="issued")||(selectedInvoice.type==="incoming"&&selectedInvoice.status==="verified"))&&<>
            <SectionTitle>Link an existing CRM payment</SectionTitle>
            <div className="space-y-2">{allPayments.filter(payment=>!payment.invoiceId && payment.status===(selectedInvoice.type==="outgoing"?"verified":"paid") && validCurrency(payment.currency) && normalizeCurrency(payment.currency)===normalizeCurrency(selectedInvoice.currency) && (selectedInvoice.type==="outgoing"||!text(payment.vendorId)||payment.vendorId===selectedInvoice.vendorId)).map(payment=><div key={payment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 p-2 text-xs"><div>{formatInvoiceMoney(payment.amount,payment.currency)} · {payment.paymentMode||"Payment"} · {payment.transactionRef||payment.id}</div><button className={secondary} disabled={busy||money(payment.amount)>money(paymentSummary?.balance)} onClick={()=>run(async()=>{await allocateExistingPayment({invoice:selectedInvoice,paymentId:payment.id,user});setNotice("Existing CRM payment linked to this invoice.");})}>Allocate</button></div>)}
              {!allPayments.some(payment=>!payment.invoiceId && payment.status===(selectedInvoice.type==="outgoing"?"verified":"paid") && validCurrency(payment.currency) && normalizeCurrency(payment.currency)===normalizeCurrency(selectedInvoice.currency))&&<p className="text-xs text-slate-500">No available verified/paid payments in this invoice currency. Record the payment from the Lead Payments tab first.</p>}
            </div>
          </>}
          <Link href={`/admin/leads/${selectedInvoice.leadId}`} className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-blue-700 hover:underline"><Banknote size={15}/> Open lead and existing payment ledger</Link>
        </section>
      </div>
    </Dialog>}
  </div>;
}
