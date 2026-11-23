// Financial correction primitives. Never delete or rewrite a bank transfer.
export const VOID_PAYMENT_STATUS = "voided";

export function validVoidReason(reason) {
  return typeof reason === "string" && reason.trim().length >= 8 && reason.trim().length <= 500;
}

export function paymentIsVoided(payment) {
  return Boolean(payment?.voided === true || payment?.status === VOID_PAYMENT_STATUS);
}

export function invoiceAllocationAfterVoid(allocatedTotal, paymentAmount) {
  const total = Number(allocatedTotal);
  const amount = Number(paymentAmount);
  if (!Number.isFinite(total) || !Number.isFinite(amount) || amount <= 0 || total < amount - 0.011) {
    throw new Error("Invoice allocation does not match this payment. Reconcile the invoice before voiding.");
  }
  return Math.round((total - amount) * 100) / 100;
}
