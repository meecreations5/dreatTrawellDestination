"use client";
import {
  collection, doc, getDoc, onSnapshot, orderBy, query, runTransaction,
  serverTimestamp, setDoc, updateDoc, deleteField
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, db, storage } from "@/lib/firebase";
import { canAccess } from "@/lib/rolePermissions";
import { normalizeLeadStage } from "@/lib/leadStages";
import {
  text, money, normalizeCurrency, validCurrency, computeInvoiceTotals, validateOutgoingInvoice,
  validateIncomingInvoice, fiscalYearForDate, formatIssuedInvoiceNumber,
  vendorInvoiceDocId
} from "@/lib/invoiceCore.mjs";

export const INVOICE_COLLECTIONS = { outgoing: "travelAgentInvoices", incoming: "vendorInvoices" };
export const DEFAULT_INVOICE_SETTINGS = {
  name: "DreamTrawell Destination", address: "", gstin: "", pan: "", state: "",
  email: "", phone: "", bankName: "", accountName: "", accountNumber: "",
  ifsc: "", swift: "", upi: "", terms: "Payment as per confirmed booking terms."
};
const actor = user => ({ uid: text(user?.uid), name: text(user?.name || user?.displayName || user?.email), email: text(user?.email) });
const requireAccess = (user, action) => {
  if (!user || !canAccess(user, action)) throw new Error("Your role is not permitted to perform this invoice action.");
};
const stamp = () => serverTimestamp();
const safeDoc = snapshot => snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;

export function observeInvoices(type, onData, onError) {
  return onSnapshot(query(collection(db, INVOICE_COLLECTIONS[type]), orderBy("createdAt", "desc")),
    snapshot => onData(snapshot.docs.map(safeDoc)), onError);
}
export function observeLeadInvoices(type, leadId, onData, onError) {
  // One query without composite indexes. Lead filtering is client-side for the small per-lead panel.
  return observeInvoices(type, rows => onData(rows.filter(row => row.leadId === leadId)), onError);
}
export async function getInvoiceSettings() {
  const snapshot = await getDoc(doc(db, "settings", "invoicing"));
  return { ...DEFAULT_INVOICE_SETTINGS, ...(snapshot.exists() ? snapshot.data() : {}) };
}
export async function saveInvoiceSettings(form, user) {
  requireAccess(user, "invoices.configure");
  const data = Object.fromEntries(Object.keys(DEFAULT_INVOICE_SETTINGS).map(key => [key, text(form?.[key])]));
  if (!data.name || !data.address) throw new Error("Company legal name and registered address are required.");
  await setDoc(doc(db, "settings", "invoicing"), { ...data, updatedAt: stamp(), updatedBy: actor(user) }, { merge: true });
  return data;
}

export async function saveOutgoingInvoiceDraft(form, user, invoiceId = "") {
  requireAccess(user, "invoices.outgoing.create");
  const totals = validateOutgoingInvoice(form);
  const leadRef = doc(db, "leads", text(form.leadId));
  const reference = invoiceId
    ? doc(db, INVOICE_COLLECTIONS.outgoing, invoiceId)
    : doc(collection(db, INVOICE_COLLECTIONS.outgoing));
  // Keep the read and write in a single transaction: a concurrent issue action
  // must never be overwritten by someone saving an older draft screen.
  await runTransaction(db, async trx => {
    const [leadSnap, previous] = await Promise.all([
      trx.get(leadRef),
      ...(invoiceId ? [trx.get(reference)] : [])
    ]);
    if (!leadSnap.exists()) throw new Error("The selected lead could not be found.");
    if (invoiceId && (!previous.exists() || previous.data().status !== "draft")) {
      throw new Error("Only draft invoices can be edited. Refresh the invoice register.");
    }
    const existing = invoiceId ? previous.data() : {};
    const payload = {
      ...form, ...totals,
      leadId: text(form.leadId),
      leadCode: text(form.leadCode || leadSnap.data().leadCode),
      travelAgentId: text(form.travelAgentId),
      type: "outgoing", status: "draft", invoiceNumber: "",
      issueDate: text(form.issueDate), dueDate: text(form.dueDate),
      supplier: { ...form.supplier }, recipient: { ...form.recipient },
      stage: normalizeLeadStage(leadSnap.data().stage),
      updatedAt: stamp(), updatedBy: actor(user),
      ...(invoiceId ? {} : { createdAt: stamp(), createdBy: actor(user) }),
      ...(existing?.createdBy ? { createdBy: existing.createdBy } : {})
    };
    trx.set(reference, payload);
  });
  return reference.id;
}

export async function issueOutgoingInvoice(invoiceId, user) {
  requireAccess(user, "invoices.outgoing.issue");
  const refInvoice = doc(db, INVOICE_COLLECTIONS.outgoing, text(invoiceId));
  const issueDate = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const fy = fiscalYearForDate(issueDate);
  const refCounter = doc(db, "invoiceSequences", fy);
  return runTransaction(db, async trx => {
    const snapshot = await trx.get(refInvoice);
    if (!snapshot.exists()) throw new Error("Invoice not found.");
    const invoice = snapshot.data();
    if (invoice.status !== "draft") throw new Error("Invoice is no longer a draft.");
    const lead = await trx.get(doc(db, "leads", text(invoice.leadId)));
    if (!lead.exists()) throw new Error("Linked booking no longer exists.");
    const actualStage = normalizeLeadStage(lead.data().stage);
    const finalized = { ...invoice, stage: actualStage, issueDate };
    const totals = validateOutgoingInvoice(finalized, { issue: true });
    const counter = await trx.get(refCounter);
    const sequence = Number(counter.exists() ? counter.data().lastNumber || 0 : 0) + 1;
    const number = formatIssuedInvoiceNumber(fy, sequence);
    trx.set(refCounter, { financialYear: fy, lastNumber: sequence, lastNumberIssued: number, updatedAt: stamp() }, { merge: true });
    trx.update(refInvoice, {
      ...totals, stage: actualStage, status: "issued", invoiceNumber: number,
      financialYear: fy, issueDate, issuedAt: stamp(), issuedBy: actor(user), updatedAt: stamp()
    });
    return number;
  });
}
export async function voidOutgoingInvoice(invoiceId, reason, user) {
  requireAccess(user, "invoices.outgoing.void");
  if (text(reason).length < 8) throw new Error("Enter a void reason (at least 8 characters). Issued numbers cannot be reused.");
  const refInvoice = doc(db, INVOICE_COLLECTIONS.outgoing, text(invoiceId));
  await runTransaction(db, async trx => {
    const snap = await trx.get(refInvoice);
    if (!snap.exists() || snap.data().status !== "issued") throw new Error("Only issued invoices can be voided.");
    if (money(snap.data().allocatedTotal || 0) > 0) throw new Error("Payments are allocated to this invoice. Reverse/reconcile the receipts and use a finance-approved credit note process before voiding.");
    trx.update(refInvoice, { status: "void", voidReason: text(reason), voidedAt: stamp(), voidedBy: actor(user) });
  });
}

export async function saveIncomingVendorInvoice(form, user) {
  requireAccess(user, "invoices.vendor.create");
  const totals = validateIncomingInvoice(form);
  const leadRef = doc(db, "leads", text(form.leadId));
  const vendorRef = doc(db, "vendors", text(form.vendorId));
  const id = vendorInvoiceDocId(form.vendorId, form.vendorInvoiceNumber);
  const invoiceRef = doc(db, INVOICE_COLLECTIONS.incoming, id);
  await runTransaction(db, async trx => {
    const [lead, vendor, existing] = await Promise.all([trx.get(leadRef), trx.get(vendorRef), trx.get(invoiceRef)]);
    if (!lead.exists()) throw new Error("Linked lead not found.");
    if (!vendor.exists()) throw new Error("Vendor not found in Vendor Master.");
    if (existing.exists()) throw new Error("This vendor invoice number has already been registered for the selected vendor.");
    trx.set(invoiceRef, {
      ...form, ...totals,
      leadId: text(form.leadId), leadCode: text(form.leadCode || lead.data().leadCode),
      vendorId: text(form.vendorId), vendorName: text(vendor.data().vendorName),
      vendorGstin: text(form.vendorGstin || vendor.data().gstNumber),
      vendorAddress: text(form.vendorAddress || [vendor.data().address?.line1, vendor.data().city, vendor.data().state, vendor.data().country].filter(Boolean).join(', ')),
      vendorInvoiceNumber: text(form.vendorInvoiceNumber),
      vendorInvoiceDate: text(form.vendorInvoiceDate),
      type: "incoming", status: "received", createdAt: stamp(),
      receivedAt: stamp(), receivedBy: actor(user), updatedAt: stamp()
    });
  });
  return id;
}
export async function setVendorInvoiceReview(invoiceId, status, reason, user) {
  requireAccess(user, "invoices.vendor.verify");
  if (!["verified", "disputed", "received"].includes(status)) throw new Error("Unsupported vendor invoice review status.");
  if (status === "disputed" && text(reason).length < 5) throw new Error("Provide the dispute reason.");
  const target = doc(db, INVOICE_COLLECTIONS.incoming, text(invoiceId));
  await runTransaction(db, async trx => {
    const snap = await trx.get(target);
    if (!snap.exists()) throw new Error("Vendor invoice not found.");
    trx.update(target, { status, reviewReason: text(reason), reviewedAt: stamp(), reviewedBy: actor(user), updatedAt: stamp() });
  });
}

export async function uploadInvoiceAttachment({ file, leadId, vendorId, kind = "vendor" }) {
  if (!file || !["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Choose a PDF, JPG, PNG or WebP invoice file.");
  }
  if (file.size > 10 * 1024 * 1024) throw new Error("Invoice attachment must be 10 MB or smaller.");
  const category = kind === "outgoing" ? "outgoing" : "vendor";
  const filename = text(file.name).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
  const path = `invoices/${category}/${text(leadId)}/${text(vendorId || "generated")}/${Date.now()}-${filename}`;
  const handle = ref(storage, path);
  await uploadBytes(handle, file, { contentType: file.type, customMetadata: { leadId: text(leadId), invoiceKind: category } });
  return { originalFilePath: path, originalFileUrl: await getDownloadURL(handle), originalFileName: text(file.name) };
}
export async function saveOutgoingPdfReference(invoiceId, pdf, user) {
  requireAccess(user, "invoices.outgoing.issue");
  const refInvoice = doc(db, INVOICE_COLLECTIONS.outgoing, text(invoiceId));
  await runTransaction(db, async trx => {
    const snap = await trx.get(refInvoice);
    if (!snap.exists() || snap.data().status !== "issued") throw new Error("A PDF can only be archived for an issued invoice.");
    trx.update(refInvoice, { pdfUrl: text(pdf.originalFileUrl), pdfStoragePath: text(pdf.originalFilePath), pdfGeneratedAt: stamp() });
  });
}
export async function markInvoiceEmailAccepted(invoiceId, meta, user) {
  requireAccess(user, "invoices.outgoing.issue");
  const invoiceRef = doc(db, INVOICE_COLLECTIONS.outgoing, text(invoiceId));
  const snap = await getDoc(invoiceRef);
  if (!snap.exists() || snap.data().status !== "issued") throw new Error("Invoice must be issued before emailing.");
  await updateDoc(invoiceRef, { lastEmailAcceptedAt: stamp(), lastEmailTo: text(meta.to), lastEmailMessageId: text(meta.messageId), lastEmailBy: actor(user) });
}

export function observeLeadPayments(invoice, onData, onError) {
  const sub = invoice.type === "incoming" ? "vendorPayments" : "customerPayments";
  return onSnapshot(collection(db, "leads", invoice.leadId, sub), snap => {
    onData(snap.docs.map(s => ({ id: s.id, ...s.data() })));
  }, onError);
}
export async function allocateExistingPayment({ invoice, paymentId, user }) {
  requireAccess(user, "invoices.allocate");
  if (invoice.status === "void") throw new Error("Cannot allocate payments to a void invoice.");
  if (invoice.type === "outgoing" && invoice.status !== "issued") throw new Error("Issue the customer invoice before allocating receipts.");
  if (invoice.type === "incoming" && invoice.status !== "verified") throw new Error("Verify the vendor invoice before allocating payments.");
  const sub = invoice.type === "incoming" ? "vendorPayments" : "customerPayments";
  const refPayment = doc(db, "leads", invoice.leadId, sub, text(paymentId));
  const refInvoice = doc(db, INVOICE_COLLECTIONS[invoice.type], invoice.id);
  await runTransaction(db, async trx => {
    const [inv, payment] = await Promise.all([trx.get(refInvoice), trx.get(refPayment)]);
    if (!inv.exists() || !payment.exists()) throw new Error("Invoice or payment no longer exists.");
    if (inv.data().status !== invoice.status) throw new Error("Invoice status changed; refresh before allocating.");
    const row = payment.data();
    const allowed = invoice.type === "incoming" ? "paid" : "verified";
    if (row.status !== allowed) throw new Error(`Only ${allowed} payment records can be allocated.`);
    if (text(row.invoiceId)) throw new Error("Payment has already been allocated to an invoice.");
    if (!validCurrency(row.currency) || normalizeCurrency(row.currency) !== normalizeCurrency(inv.data().currency)) throw new Error("Payment currency is missing or does not match invoice currency. Reconcile the currency before allocation.");
    if (invoice.type === "incoming" && text(row.vendorId) && row.vendorId !== invoice.vendorId) throw new Error("Vendor payment belongs to a different vendor.");
    const allocated = money(inv.data().allocatedTotal || 0);
    const amount = money(row.amount);
    if (amount <= 0 || money(allocated + amount) > money(inv.data().total)) throw new Error("Allocation would exceed invoice balance. Split the source payment in the Payments module before allocating.");
    trx.update(refPayment, { invoiceId: invoice.id, invoiceNumber: text(inv.data().invoiceNumber || inv.data().vendorInvoiceNumber), allocatedAt: stamp(), allocatedBy: actor(user) });
    trx.update(refInvoice, { allocatedTotal: money(allocated + amount), allocationUpdatedAt: stamp() });
  });
}
export async function unallocateExistingPayment({ invoice, paymentId, user }) {
  requireAccess(user, "invoices.allocate");
  const sub = invoice.type === "incoming" ? "vendorPayments" : "customerPayments";
  const refPayment = doc(db, "leads", invoice.leadId, sub, text(paymentId));
  const refInvoice = doc(db, INVOICE_COLLECTIONS[invoice.type], invoice.id);
  await runTransaction(db, async trx => {
    const [inv, payment] = await Promise.all([trx.get(refInvoice), trx.get(refPayment)]);
    if (!inv.exists() || !payment.exists()) throw new Error("Invoice or payment no longer exists.");
    if (payment.data().invoiceId !== invoice.id) throw new Error("Payment is no longer allocated to this invoice.");
    const current = money(inv.data().allocatedTotal || 0);
    const amount = money(payment.data().amount);
    trx.update(refPayment, {
      invoiceId: deleteField(), invoiceNumber: deleteField(),
      allocatedAt: deleteField(), allocatedBy: deleteField()
    });
    trx.update(refInvoice, {
      allocatedTotal: money(Math.max(0, current - amount)),
      allocationUpdatedAt: stamp()
    });
  });
}

export async function sendIssuedInvoiceEmail({ invoice, pdfUrl, user }) {
  requireAccess(user, "invoices.outgoing.issue");
  if (invoice.status !== "issued" || !text(pdfUrl)) throw new Error("Issue the invoice and archive its PDF before emailing.");
  const recipientEmail = text(invoice.recipient?.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) throw new Error("Travel agent billing email is missing or invalid.");
  const token = await auth?.currentUser?.getIdToken();
  if (!token) throw new Error("Sign in to send invoice email.");
  const escaped = value => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const subject = `Invoice ${text(invoice.invoiceNumber)} | DreamTrawell Destination`;
  const html = `<p>Dear ${escaped(invoice.recipient?.contactName || invoice.recipient?.name || "Travel Partner")},</p><p>Please find the invoice for your confirmed booking <strong>${escaped(invoice.leadCode || invoice.leadId)}</strong>.</p><p><strong>Invoice:</strong> ${escaped(invoice.invoiceNumber)}<br><strong>Amount:</strong> ${escaped(invoice.currency)} ${money(invoice.total)}<br><strong>Due:</strong> ${escaped(invoice.dueDate || "As agreed")}</p><p><a href="${escaped(pdfUrl)}">View or download invoice PDF</a></p><p>Regards,<br>DreamTrawell Destination</p>`;
  const response = await fetch("/api/send-email", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ emailType: "transactional", toEmail: recipientEmail, toName: text(invoice.recipient?.name), subject, html, tags: ["crm_invoice"] })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.accepted) throw new Error(data.error || "Invoice email was not accepted by the mail provider.");
  try {
    await markInvoiceEmailAccepted(invoice.id, { to: recipientEmail, messageId: data.messageId }, user);
  } catch (auditError) {
    // The mail provider accepted the message. Never present this as a failed send
    // that might cause a second invoice email on retry.
    console.error("Invoice email accepted but CRM audit write failed", auditError);
    return { ...data, auditWarning: "Email was accepted but the CRM could not save its audit marker." };
  }
  return data;
}
