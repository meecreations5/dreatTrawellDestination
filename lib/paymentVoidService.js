"use client";

import {
  collection, doc, runTransaction, serverTimestamp, deleteField
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { canAccessRecord, resolveUserRole } from "@/lib/rolePermissions";
import { PAYMENT_COLLECTIONS } from "@/lib/paymentConstants";
import { paymentIsVoided, validVoidReason, VOID_PAYMENT_STATUS, invoiceAllocationAfterVoid } from "@/lib/paymentVoidCore.mjs";
import { recalculateVendorPaymentSummary } from "@/lib/leadVendorPayments";
import { recalculateCustomerPaymentSummary } from "@/lib/leadCustomerPayments";

const clean = value => String(value || "").trim();

/**
 * Voids a mistakenly entered CRM payment. This NEVER cancels an actual bank
 * transfer. Audit and invoice unallocation are atomic with the payment update.
 * No payment document, receipt or bank reference is physically deleted.
 */
export async function voidLeadPayment({ leadId, paymentId, direction, reason, user }) {
  const id = clean(leadId), payment = clean(paymentId), why = clean(reason);
  if (!id || !payment) throw new Error("Lead and payment IDs are required.");
  if (!validVoidReason(why)) throw new Error("Enter a correction reason of 8–500 characters.");
  if (!["admin", "super_admin"].includes(resolveUserRole(user)) || user?.active === false) {
    throw new Error("Only Admin / Super Admin can void a payment.");
  }
  const vendor = direction === "vendor";
  if (!vendor && direction !== "customer") throw new Error("Invalid payment direction.");
  const kind = vendor ? PAYMENT_COLLECTIONS.VENDOR_PAYMENTS : PAYMENT_COLLECTIONS.CUSTOMER_PAYMENTS;
  const leadRef = doc(db, "leads", id);
  const paymentRef = doc(db, "leads", id, kind, payment);
  const auditRef = doc(collection(db, "leads", id, "paymentVoidAudit"));
  const auditUser = { uid: clean(user.uid), name: clean(user.name || user.displayName || user.email), email: clean(user.email) };

  await runTransaction(db, async trx => {
    // All reads occur before any writes. Another admin cannot double-void.
    const [leadSnap, paymentSnap] = await Promise.all([trx.get(leadRef), trx.get(paymentRef)]);
    if (!leadSnap.exists() || !paymentSnap.exists()) throw new Error("Lead or payment no longer exists.");
    if (!canAccessRecord(user, "payments.void", { id, ...leadSnap.data() }, "lead")) throw new Error("You cannot void payments on this lead.");
    const original = paymentSnap.data();
    if (paymentIsVoided(original)) throw new Error("This payment is already voided.");
    if (original.leadId && original.leadId !== id) throw new Error("Payment belongs to another lead.");
    let invoiceRef = null, invoiceSnap = null;
    if (clean(original.invoiceId)) {
      invoiceRef = doc(db, vendor ? "vendorInvoices" : "travelAgentInvoices", clean(original.invoiceId));
      invoiceSnap = await trx.get(invoiceRef);
      if (!invoiceSnap.exists()) throw new Error("Linked invoice is missing. Finance must reconcile the invoice before voiding.");
      if (invoiceSnap.data().leadId !== id) throw new Error("Invoice belongs to a different lead.");
    }
    const snapshot = {
      ...original,
      paymentId: payment,
      leadId: id,
      direction,
      auditAction: "payment_voided",
      reason: why,
      voidedBy: auditUser,
      voidedAt: serverTimestamp()
    };
    trx.set(auditRef, snapshot);
    trx.update(paymentRef, {
      statusBeforeVoid: clean(original.status),
      status: VOID_PAYMENT_STATUS,
      voided: true,
      voidReason: why,
      voidedAt: serverTimestamp(),
      voidedByUid: auditUser.uid,
      voidedByName: auditUser.name,
      voidAuditId: auditRef.id,
      updatedAt: serverTimestamp(),
      ...(invoiceRef ? {
        invoiceId: deleteField(), invoiceNumber: deleteField(),
        allocatedAt: deleteField(), allocatedBy: deleteField(),
        invoiceAllocatedBeforeVoid: clean(original.invoiceId)
      } : {})
    });
    if (invoiceRef) {
      trx.update(invoiceRef, {
        allocatedTotal: invoiceAllocationAfterVoid(invoiceSnap.data().allocatedTotal, original.amount),
        allocationUpdatedAt: serverTimestamp()
      });
    }
  });

  // The existing lead summary is denormalized; recompute both sides in order.
  // A recompute failure is surfaced: the void is still committed, and the action
  // must be retried by an administrator, not repeated as another void.
  try {
    await recalculateVendorPaymentSummary({ leadId: id });
    await recalculateCustomerPaymentSummary({ leadId: id, user });
  } catch (error) {
    throw new Error(`Payment voided and audited, but the summary refresh failed: ${error?.message || "Unknown error"}. Refresh and recalculate the payment summary; do not void this entry again.`);
  }
  return { id: payment, leadId: id, auditId: auditRef.id, status: VOID_PAYMENT_STATUS };
}
