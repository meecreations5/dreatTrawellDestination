'use client';
import { collection, doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { isAdmin } from '@/lib/rolePermissions';
import { isCurrentWon, businessDateKey, getDealWonEventDate } from '@/lib/reporting/leadReportingDates.mjs';
import { getBookingFinance } from '@/lib/reporting/businessIntelligence.mjs';

/** Finance-only metadata update; never changes quote, invoice or payment entries. */
export async function verifyConfirmedBusiness({ leadId, sellingAmountInr, vendorCostInr, bookingReference, reason, user }) {
  if (!isAdmin(user)) throw new Error('Only Admin can verify closing financial amounts.');
  const id = String(leadId || '').trim();
  const ref = String(bookingReference || '').trim();
  const explanation = String(reason || '').trim();
  const selling = Number(sellingAmountInr), cost = Number(vendorCostInr);
  if (!id || !ref) throw new Error('Lead and booking confirmation reference are required.');
  if (explanation.length < 8) throw new Error('Enter an explanation of at least 8 characters.');
  if (!Number.isFinite(selling) || !Number.isFinite(cost) || selling <= 0 || cost < 0) {
    throw new Error('Enter the verified INR selling amount (>0) and vendor cost (>=0).');
  }
  if (Math.abs(Math.round(selling * 100) - selling * 100) > 0.000001 || Math.abs(Math.round(cost * 100) - cost * 100) > 0.000001) {
    throw new Error('INR amounts may have at most two decimal places.');
  }
  const leadRef = doc(db, 'leads', id);
  const auditRef = doc(collection(db, 'leads', id, 'confirmedBusinessAudit'));
  const actor = { uid: String(user.uid || ''), name: String(user.displayName || user.name || user.email || ''), email: String(user.email || '') };
  await runTransaction(db, async trx => {
    const snap = await trx.get(leadRef);
    if (!snap.exists()) throw new Error('Lead not found.');
    const lead = snap.data();
    if (!isCurrentWon(lead) || !getDealWonEventDate(lead)) throw new Error('Only a currently confirmed booking with a Deal Won date can be verified.');
    const existing = getBookingFinance(lead);
    if (existing.verified && existing.sellingInr === selling && existing.vendorCostInr === cost) throw new Error('These figures already match the verified snapshot.');
    const money = value => Math.round(value * 100) / 100;
    const closing = {
      version: 1, verified: true, needsReview: false, currency: 'INR', source: 'admin_verified',
      wonDateKey: businessDateKey(getDealWonEventDate(lead)),
      sellingAmountInr: money(selling), vendorCostInr: money(cost), grossProfitInr: money(selling - cost),
      originalSellingAmount: lead.confirmedBusiness?.originalSellingAmount ?? lead.finalQuotationAmount ?? null,
      originalSellingCurrency: lead.confirmedBusiness?.originalSellingCurrency || lead.finalCustomerQuoteCurrency || '',
      originalVendorAmount: lead.confirmedBusiness?.originalVendorAmount ?? lead.finalVendorCost ?? null,
      originalVendorCurrency: lead.confirmedBusiness?.originalVendorCurrency || lead.finalSelectedVendorCurrency || '',
      quotationId: String(lead.finalQuotationId || ''),
      bookingReference: ref,
      verifiedByUid: actor.uid, verifiedByName: actor.name, verifiedAt: new Date().toISOString(),
      note: explanation
    };
    trx.update(leadRef, { confirmedBusiness: closing, confirmedBusinessVerifiedAt: serverTimestamp() });
    trx.set(auditRef, { action: 'closing_finance_verified', leadId: id, before: lead.confirmedBusiness || null,
      after: closing, bookingReference: ref, reason: explanation, actor, changedAt: serverTimestamp() });
  });
  return { leadId: id, sellingAmountInr: selling, vendorCostInr: cost };
}
