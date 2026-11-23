"use client";
import { formatInvoiceMoney } from "@/lib/invoiceCore.mjs";
const show = value => String(value ?? "").trim();
const formatDate = date => date ? new Date(`${date}T12:00:00`).toLocaleDateString("en-IN", {day:"2-digit",month:"short",year:"numeric"}) : "Not issued";
function Block({ title, children }) {
  return <div style={{ flex: 1, minWidth: 220, fontSize: 12, lineHeight: 1.65 }}>
    <div style={{fontWeight:700,fontSize:10,letterSpacing:1,color:"#64748b",marginBottom:4}}>{title}</div>
    {children}
  </div>;
}
export default function InvoicePaper({ invoice }) {
  const data = invoice || {};
  const currency = data.currency || "INR";
  const supplier = data.supplier || {};
  const recipient = data.recipient || {};
  const lines = data.lines || [];
  return (
    <section className="invoice-print-sheet" style={{boxSizing:"border-box",background:"white",color:"#172033",width:"100%",maxWidth:790,padding:32,fontFamily:"Arial, sans-serif",fontSize:12,lineHeight:1.5}}>
      <header style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:22,borderBottom:"3px solid #2563eb",paddingBottom:18}}>
        <div style={{display:"flex",gap:12,alignItems:"flex-start",maxWidth:"55%"}}>
          <img src="/logo.png" alt="DreamTrawell" style={{width:54,height:54,objectFit:"contain"}} />
          <div>
          <div style={{fontSize:20,fontWeight:800,lineHeight:1.2}}>{show(supplier.name) || "DreamTrawell Destination"}</div>
          <div style={{marginTop:5,color:"#475569",whiteSpace:"pre-line"}}>{show(supplier.address)}</div>
          {supplier.gstin && <div>GSTIN: {show(supplier.gstin)}</div>}
          {supplier.pan && <div>PAN: {show(supplier.pan)}</div>}
          {(supplier.email || supplier.phone) && <div>{[supplier.email,supplier.phone].filter(Boolean).join(" | ")}</div>}
          </div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:23,fontWeight:800,color:"#2563eb"}}>{data.taxMode === "none" ? "INVOICE" : "TAX INVOICE"}</div>
          <div style={{fontSize:13,fontWeight:700,marginTop:5}}>{show(data.invoiceNumber) || "DRAFT / NOT ISSUED"}</div>
          <div style={{color:"#64748b",marginTop:4}}>Issue date: {formatDate(data.issueDate)}</div>
          <div style={{color:"#64748b"}}>Due date: {data.dueDate ? formatDate(data.dueDate) : "As agreed"}</div>
          {data.status === "void" && <div style={{color:"#dc2626",fontWeight:800}}>VOID - NOT PAYABLE</div>}
        </div>
      </header>
      <div style={{display:"flex",gap:36,justifyContent:"space-between",marginTop:22,padding:15,background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:8,flexWrap:"wrap"}}>
        <Block title="BILL TO / TRAVEL AGENT">
          <div style={{fontWeight:700,fontSize:14}}>{show(recipient.name) || "Travel Agent"}</div>
          <div style={{whiteSpace:"pre-line"}}>{show(recipient.address)}</div>
          {recipient.gstin && <div>GSTIN: {show(recipient.gstin)}</div>}
          {recipient.email && <div>{show(recipient.email)}</div>}
        </Block>
        <Block title="BOOKING REFERENCE">
          <div><b>Lead:</b> {show(data.leadCode) || show(data.leadId) || "-"}</div>
          <div><b>Destination:</b> {show(data.destination) || "-"}</div>
          {data.travelDates && <div><b>Travel dates:</b> {show(data.travelDates)}</div>}
          {data.placeOfSupply && <div><b>Place of supply:</b> {show(data.placeOfSupply)}</div>}
          <div><b>Reverse charge:</b> {data.reverseCharge ? "Yes" : "No"}</div>
        </Block>
      </div>
      <table style={{width:"100%",borderCollapse:"collapse",marginTop:22,fontSize:12}}>
        <thead><tr style={{background:"#eff6ff",color:"#1d4ed8"}}>
          {["Description / SAC", "Qty", "Unit price", "Discount", "Tax", "Amount"].map(t=><th key={t} style={{textAlign:t==="Description / SAC"?"left":"right",padding:"10px 7px",borderBottom:"1px solid #bfdbfe"}}>{t}</th>)}
        </tr></thead>
        <tbody>{lines.map((line,index)=><tr key={index} style={{borderBottom:"1px solid #e2e8f0"}}>
          <td style={{padding:"11px 7px",verticalAlign:"top"}}><div style={{fontWeight:600}}>{show(line.description)}</div><div style={{color:"#64748b",fontSize:11}}>{line.sac ? `SAC / HSN: ${show(line.sac)}` : ""}</div></td>
          <td style={{padding:"11px 7px",textAlign:"right",verticalAlign:"top"}}>{line.quantity}</td>
          <td style={{padding:"11px 7px",textAlign:"right",verticalAlign:"top"}}>{formatInvoiceMoney(line.unitPrice,currency)}</td>
          <td style={{padding:"11px 7px",textAlign:"right",verticalAlign:"top"}}>{line.discountRate || 0}%</td>
          <td style={{padding:"11px 7px",textAlign:"right",verticalAlign:"top"}}>{data.taxMode === "none" ? "-" : `${line.taxRate || 0}%`}</td>
          <td style={{padding:"11px 7px",textAlign:"right",verticalAlign:"top",fontWeight:600}}>{formatInvoiceMoney(line.total,currency)}</td>
        </tr>)}</tbody>
      </table>
      <div style={{display:"flex",justifyContent:"flex-end",marginTop:15}}>
        <table style={{width:300,fontSize:12,borderCollapse:"collapse"}}><tbody>
          {[["Subtotal",data.subtotal],["Discount",data.discount],["Taxable value",data.taxable],...(data.taxMode==="cgst_sgst"?[["CGST",data.cgst],["SGST",data.sgst]]:data.taxMode==="igst"?[["IGST",data.igst]]:[]),["Total tax",data.totalTax]].map(([label,value])=><tr key={label}><td style={{padding:"4px 6px",color:"#64748b"}}>{label}</td><td style={{padding:"4px 6px",textAlign:"right"}}>{formatInvoiceMoney(value,currency)}</td></tr>)}
          <tr style={{background:"#eff6ff",fontWeight:800,fontSize:16}}><td style={{padding:"10px 6px"}}>Total</td><td style={{padding:"10px 6px",textAlign:"right"}}>{formatInvoiceMoney(data.total,currency)}</td></tr>
        </tbody></table>
      </div>
      <div style={{display:"flex",gap:30,marginTop:25,paddingTop:16,borderTop:"1px solid #e2e8f0",flexWrap:"wrap"}}>
        <Block title="PAYMENT INSTRUCTIONS">
          {supplier.bankName && <div>Bank: {show(supplier.bankName)}</div>}
          {supplier.accountName && <div>Account name: {show(supplier.accountName)}</div>}
          {supplier.accountNumber && <div>Account no.: {show(supplier.accountNumber)}</div>}
          {supplier.ifsc && <div>IFSC: {show(supplier.ifsc)}</div>}
          {supplier.swift && <div>SWIFT: {show(supplier.swift)}</div>}
          {supplier.upi && <div>UPI: {show(supplier.upi)}</div>}
        </Block>
        <Block title="NOTES & TERMS">
          <div style={{whiteSpace:"pre-line"}}>{show(data.notes || supplier.terms || "Payment as per booking confirmation.")}</div>
        </Block>
      </div>
      <footer style={{marginTop:26,paddingTop:12,borderTop:"1px solid #e2e8f0",textAlign:"center",color:"#64748b",fontSize:10}}>
        Issued by {show(supplier.name) || "DreamTrawell Destination"}. {data.status === "draft" ? "Draft for review only. Not a valid tax invoice." : "Computer-generated invoice. Review statutory signature and e-invoicing requirements where applicable."}
      </footer>
    </section>
  );
}
