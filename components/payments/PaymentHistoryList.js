"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query
} from "firebase/firestore";

import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Ban,
  Banknote,
  CalendarClock,
  CheckCircle,
  Eye,
  FileText,
  Loader2,
  Mail,
  MessageCircle,
  ReceiptText,
  RefreshCcw,
  UserRound,
  Wallet,
  XCircle
} from "lucide-react";

import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";

import {
  cancelCustomerPayment,
  rejectCustomerPayment,
  verifyCustomerPayment
} from "@/lib/leadCustomerPayments";

import {
  cancelVendorPayment,
  markVendorPaymentPaid
} from "@/lib/leadVendorPayments";

import {
  CUSTOMER_PAYMENT_STATUS,
  PAYMENT_COLLECTIONS,
  PAYMENT_DIRECTION,
  VENDOR_PAYMENT_STATUS,
  getCustomerPaymentTypeLabel,
  getPaymentModeLabel,
  getVendorPaymentTypeLabel
} from "@/lib/paymentConstants";

import {
  CustomerPaymentStatusChip,
  PaymentDirectionChip,
  VendorPaymentStatusChip
} from "@/components/payments/PaymentStatusChip";

/* =========================
   HELPERS
========================= */

function cleanString(value = "") {
  return String(value || "").trim();
}

function getLeadId(lead) {
  return cleanString(lead?.id || lead?.leadId);
}

function getNumber(value, fallback = 0) {
  const number = Number(value);

  if (!Number.isFinite(number)) return fallback;

  return number;
}

function toDate(value) {
  if (!value) return null;
  if (value?.toDate) return value.toDate();
  if (value instanceof Date) return value;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateTime(value) {
  const date = toDate(value);

  if (!date) return "—";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatMoney(value, currency = "INR") {
  const amount = Number(value);

  if (!Number.isFinite(amount)) return "—";

  try {
    return amount.toLocaleString("en-IN", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: 0
    });
  } catch {
    return `${currency || "INR"} ${amount.toLocaleString("en-IN")}`;
  }
}

function getPaymentDate(payment = {}) {
  return (
    payment.paymentDate ||
    payment.verifiedAt ||
    payment.paidAt ||
    payment.createdAt ||
    payment.updatedAt ||
    null
  );
}

function getCreatedBy(payment = {}) {
  return cleanString(
    payment.createdByName ||
      payment.verifiedByName ||
      payment.paidByName ||
      payment.updatedByName ||
      "System User"
  );
}

function getPartyName(payment = {}) {
  if (payment.paymentDirection === PAYMENT_DIRECTION.OUTBOUND) {
    return cleanString(
      payment.vendorName ||
        payment.payeeName ||
        payment.payeeType ||
        "Vendor"
    );
  }

  return cleanString(
    payment.payerName ||
      payment.payerType ||
      "Travel Agent / Customer"
  );
}

function getAttachmentUrl(payment = {}) {
  return cleanString(
    payment.receiptUrl ||
      payment.paymentProofUrl ||
      payment.attachmentUrl ||
      ""
  );
}

function getAttachmentName(payment = {}) {
  return cleanString(
    payment.receiptFileName ||
      payment.paymentProofFileName ||
      payment.attachmentFileName ||
      "View attachment"
  );
}

function getPaymentTypeLabel(payment = {}) {
  if (payment.paymentDirection === PAYMENT_DIRECTION.OUTBOUND) {
    return getVendorPaymentTypeLabel(payment.paymentType);
  }

  return getCustomerPaymentTypeLabel(payment.paymentType);
}

function getPaymentTitle(payment = {}) {
  if (payment.paymentDirection === PAYMENT_DIRECTION.OUTBOUND) {
    return "Vendor Payment Sent";
  }

  return "Payment Received";
}

function sortPaymentsByLatest(a, b) {
  const dateA = toDate(getPaymentDate(a))?.getTime() || 0;
  const dateB = toDate(getPaymentDate(b))?.getTime() || 0;

  return dateB - dateA;
}

/* =========================
   SMALL COMPONENTS
========================= */

function EmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-gray-400 shadow-sm">
        <ReceiptText size={24} />
      </div>

      <h3 className="mt-4 text-base font-semibold text-gray-900">
        No payment entries yet
      </h3>

      <p className="mt-1 text-sm text-gray-500">
        Customer receipts and vendor payments will appear here after you add them.
      </p>
    </div>
  );
}

function FilterButton({
  active,
  label,
  count,
  onClick
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        inline-flex items-center gap-2 rounded-full border px-3 py-1.5
        text-xs font-semibold transition
        ${
          active
            ? "border-gray-950 bg-gray-950 text-white"
            : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
        }
      `}
    >
      {label}

      <span
        className={`
          rounded-full px-1.5 py-0.5 text-[10px]
          ${
            active
              ? "bg-white/15 text-white"
              : "bg-gray-100 text-gray-600"
          }
        `}
      >
        {count}
      </span>
    </button>
  );
}

function InfoLine({
  icon: Icon,
  label,
  value
}) {
  if (!value) return null;

  return (
    <div className="flex items-start gap-2 text-xs text-gray-500">
      {Icon && <Icon size={13} className="mt-0.5 shrink-0" />}

      <span className="min-w-0">
        <span className="font-semibold text-gray-600">{label}: </span>
        <span className="break-words">{value}</span>
      </span>
    </div>
  );
}

function PaymentAmountBlock({ payment }) {
  const isOutbound =
    payment.paymentDirection === PAYMENT_DIRECTION.OUTBOUND;

  const amount = getNumber(payment.amount, 0);
  const currency = payment.currency || "INR";

  return (
    <div
      className={`
        rounded-2xl border px-4 py-3 text-right
        ${
          isOutbound
            ? "border-purple-100 bg-purple-50"
            : "border-green-100 bg-green-50"
        }
      `}
    >
      <p
        className={`
          text-[11px] font-semibold uppercase tracking-wide
          ${isOutbound ? "text-purple-700" : "text-green-700"}
        `}
      >
        {isOutbound ? "Paid" : "Received"}
      </p>

      <p className="mt-1 text-lg font-bold text-gray-950">
        {formatMoney(amount, currency)}
      </p>
    </div>
  );
}

function PaymentStatusBlock({ payment }) {
  if (payment.paymentDirection === PAYMENT_DIRECTION.OUTBOUND) {
    return (
      <VendorPaymentStatusChip
        status={payment.status}
        size="sm"
      />
    );
  }

  return (
    <CustomerPaymentStatusChip
      status={payment.status}
      size="sm"
    />
  );
}

function PaymentActions({
  payment,
  savingId,
  onVerifyCustomer,
  onRejectCustomer,
  onCancelCustomer,
  onMarkVendorPaid,
  onCancelVendor
}) {
  const isSaving = savingId === payment.id;
  const isOutbound =
    payment.paymentDirection === PAYMENT_DIRECTION.OUTBOUND;

  if (isOutbound) {
    const isPending = payment.status === VENDOR_PAYMENT_STATUS.PENDING;
    const isPaid = payment.status === VENDOR_PAYMENT_STATUS.PAID;
    const isCancelled = payment.status === VENDOR_PAYMENT_STATUS.CANCELLED;

    if (isCancelled) return null;

    return (
      <div className="flex flex-wrap gap-2">
        {isPending && (
          <button
            type="button"
            disabled={isSaving}
            onClick={() => onMarkVendorPaid(payment)}
            className="
              inline-flex items-center gap-1.5 rounded-xl bg-green-600
              px-3 py-2 text-xs font-semibold text-white hover:bg-green-700
              disabled:opacity-50
            "
          >
            {isSaving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <CheckCircle size={14} />
            )}
            Mark Paid
          </button>
        )}

        {!isPaid && (
          <button
            type="button"
            disabled={isSaving}
            onClick={() => onCancelVendor(payment)}
            className="
              inline-flex items-center gap-1.5 rounded-xl border border-gray-200
              bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50
              disabled:opacity-50
            "
          >
            <Ban size={14} />
            Cancel
          </button>
        )}
      </div>
    );
  }

  const isPending =
    payment.status === CUSTOMER_PAYMENT_STATUS.PENDING_VERIFICATION;
  const isRejected = payment.status === CUSTOMER_PAYMENT_STATUS.REJECTED;
  const isCancelled = payment.status === CUSTOMER_PAYMENT_STATUS.CANCELLED;
  const isVerified = payment.status === CUSTOMER_PAYMENT_STATUS.VERIFIED;

  if (isCancelled) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {(isPending || isRejected) && (
        <button
          type="button"
          disabled={isSaving}
          onClick={() => onVerifyCustomer(payment)}
          className="
            inline-flex items-center gap-1.5 rounded-xl bg-green-600
            px-3 py-2 text-xs font-semibold text-white hover:bg-green-700
            disabled:opacity-50
          "
        >
          {isSaving ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <CheckCircle size={14} />
          )}
          Verify
        </button>
      )}

      {isPending && (
        <button
          type="button"
          disabled={isSaving}
          onClick={() => onRejectCustomer(payment)}
          className="
            inline-flex items-center gap-1.5 rounded-xl bg-red-600
            px-3 py-2 text-xs font-semibold text-white hover:bg-red-700
            disabled:opacity-50
          "
        >
          <XCircle size={14} />
          Reject
        </button>
      )}

      {!isVerified && (
        <button
          type="button"
          disabled={isSaving}
          onClick={() => onCancelCustomer(payment)}
          className="
            inline-flex items-center gap-1.5 rounded-xl border border-gray-200
            bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50
            disabled:opacity-50
          "
        >
          <Ban size={14} />
          Cancel
        </button>
      )}
    </div>
  );
}

function PaymentCard({
  payment,
  savingId,
  onVerifyCustomer,
  onRejectCustomer,
  onCancelCustomer,
  onMarkVendorPaid,
  onCancelVendor
}) {
  const isOutbound =
    payment.paymentDirection === PAYMENT_DIRECTION.OUTBOUND;

  const attachmentUrl = getAttachmentUrl(payment);
  const attachmentName = getAttachmentName(payment);

  const directionTone = isOutbound
    ? "from-purple-50 to-blue-50 border-purple-100"
    : "from-green-50 to-emerald-50 border-green-100";

  return (
    <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
      <div className={`border-b bg-gradient-to-r px-4 py-4 ${directionTone}`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <PaymentDirectionChip
                type="direction"
                status={payment.paymentDirection}
                label={isOutbound ? "Vendor Payment" : "Payment Received"}
              />

              <PaymentStatusBlock payment={payment} />

              <span className="rounded-full border border-white/60 bg-white/80 px-2.5 py-1 text-xs font-semibold text-gray-700">
                {getPaymentTypeLabel(payment)}
              </span>
            </div>

            <div className="mt-3 flex items-start gap-3">
              <div
                className={`
                  flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl
                  ${
                    isOutbound
                      ? "bg-purple-100 text-purple-700"
                      : "bg-green-100 text-green-700"
                  }
                `}
              >
                {isOutbound ? (
                  <ArrowUpCircle size={20} />
                ) : (
                  <ArrowDownCircle size={20} />
                )}
              </div>

              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-gray-950">
                  {getPaymentTitle(payment)}
                </h3>

                <p className="mt-1 truncate text-sm text-gray-600">
                  {getPartyName(payment)}
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  Added by {getCreatedBy(payment)} ·{" "}
                  {formatDateTime(getPaymentDate(payment))}
                </p>
              </div>
            </div>
          </div>

          <PaymentAmountBlock payment={payment} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-3">
        <div className="space-y-2">
          <InfoLine
            icon={Banknote}
            label="Payment Mode"
            value={getPaymentModeLabel(payment.paymentMode)}
          />

          <InfoLine
            icon={ReceiptText}
            label="Transaction Ref"
            value={payment.transactionRef}
          />

          <InfoLine
            icon={Wallet}
            label="Bank"
            value={payment.bankName}
          />
        </div>

        <div className="space-y-2">
          {isOutbound ? (
            <>
              <InfoLine
                icon={UserRound}
                label="Vendor"
                value={payment.vendorName}
              />

              <InfoLine
                icon={ReceiptText}
                label="Vendor Quote"
                value={payment.vendorQuoteId}
              />

              <InfoLine
                icon={ReceiptText}
                label="Vendor Request"
                value={payment.vendorRequestId}
              />
            </>
          ) : (
            <>
              <InfoLine
                icon={UserRound}
                label="Payer"
                value={payment.payerName}
              />

              <InfoLine
                icon={MessageCircle}
                label="Mobile"
                value={payment.payerMobile}
              />

              <InfoLine
                icon={Mail}
                label="Email"
                value={payment.payerEmail}
              />
            </>
          )}
        </div>

        <div className="space-y-2">
          <InfoLine
            icon={CalendarClock}
            label="Payment Date"
            value={formatDateTime(payment.paymentDate)}
          />

          {attachmentUrl && (
            <a
              href={attachmentUrl}
              target="_blank"
              rel="noreferrer"
              className="
                inline-flex items-center gap-2 rounded-xl border border-gray-200
                bg-gray-50 px-3 py-2 text-xs font-semibold text-blue-700
                hover:bg-blue-50
              "
            >
              <Eye size={14} />
              {attachmentName}
            </a>
          )}

          {payment.remark && (
            <InfoLine
              icon={FileText}
              label="Remark"
              value={payment.remark}
            />
          )}
        </div>
      </div>

      <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-gray-500">
            Payment ID:{" "}
            <span className="font-mono text-gray-700">
              {payment.id || payment.paymentId}
            </span>
          </p>

          <PaymentActions
            payment={payment}
            savingId={savingId}
            onVerifyCustomer={onVerifyCustomer}
            onRejectCustomer={onRejectCustomer}
            onCancelCustomer={onCancelCustomer}
            onMarkVendorPaid={onMarkVendorPaid}
            onCancelVendor={onCancelVendor}
          />
        </div>
      </div>
    </div>
  );
}

/* =========================
   MAIN COMPONENT
========================= */

export default function PaymentHistoryList({
  lead,
  onUpdated
}) {
  const { user } = useAuth();
  const leadId = getLeadId(lead);

  const [customerPayments, setCustomerPayments] = useState([]);
  const [vendorPayments, setVendorPayments] = useState([]);

  const [loadingCustomer, setLoadingCustomer] = useState(true);
  const [loadingVendor, setLoadingVendor] = useState(true);

  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [savingId, setSavingId] = useState("");

  useEffect(() => {
    if (!leadId) {
      setCustomerPayments([]);
      setLoadingCustomer(false);
      return;
    }

    setLoadingCustomer(true);
    setError("");

    const paymentsRef = collection(
      db,
      "leads",
      leadId,
      PAYMENT_COLLECTIONS.CUSTOMER_PAYMENTS
    );

    const q = query(paymentsRef, orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      q,
      snapshot => {
        const rows = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          paymentId: docSnap.id,
          paymentDirection: PAYMENT_DIRECTION.INBOUND,
          ...docSnap.data()
        }));

        setCustomerPayments(rows);
        setLoadingCustomer(false);
      },
      err => {
        setError(err?.message || "Failed to load customer payments.");
        setLoadingCustomer(false);
      }
    );

    return () => unsub();
  }, [leadId]);

  useEffect(() => {
    if (!leadId) {
      setVendorPayments([]);
      setLoadingVendor(false);
      return;
    }

    setLoadingVendor(true);
    setError("");

    const paymentsRef = collection(
      db,
      "leads",
      leadId,
      PAYMENT_COLLECTIONS.VENDOR_PAYMENTS
    );

    const q = query(paymentsRef, orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      q,
      snapshot => {
        const rows = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          paymentId: docSnap.id,
          paymentDirection: PAYMENT_DIRECTION.OUTBOUND,
          ...docSnap.data()
        }));

        setVendorPayments(rows);
        setLoadingVendor(false);
      },
      err => {
        setError(err?.message || "Failed to load vendor payments.");
        setLoadingVendor(false);
      }
    );

    return () => unsub();
  }, [leadId]);

  const allPayments = useMemo(() => {
    return [...customerPayments, ...vendorPayments].sort(sortPaymentsByLatest);
  }, [customerPayments, vendorPayments]);

  const filteredPayments = useMemo(() => {
    if (filter === "customer") return customerPayments.sort(sortPaymentsByLatest);
    if (filter === "vendor") return vendorPayments.sort(sortPaymentsByLatest);

    if (filter === "pending") {
      return allPayments.filter(payment => {
        return (
          payment.status === CUSTOMER_PAYMENT_STATUS.PENDING_VERIFICATION ||
          payment.status === VENDOR_PAYMENT_STATUS.PENDING
        );
      });
    }

    return allPayments;
  }, [allPayments, customerPayments, vendorPayments, filter]);

  const loading = loadingCustomer || loadingVendor;

  const handleVerifyCustomer = async payment => {
    const remark = window.prompt("Verification remark optional") || "";

    setSavingId(payment.id);
    setError("");

    try {
      await verifyCustomerPayment({
        leadId,
        paymentId: payment.id,
        remark,
        user
      });

      onUpdated?.();
    } catch (err) {
      setError(err?.message || "Failed to verify payment.");
    } finally {
      setSavingId("");
    }
  };

  const handleRejectCustomer = async payment => {
    const remark = window.prompt("Reason for rejecting payment");

    if (!remark?.trim()) return;

    setSavingId(payment.id);
    setError("");

    try {
      await rejectCustomerPayment({
        leadId,
        paymentId: payment.id,
        remark,
        user
      });

      onUpdated?.();
    } catch (err) {
      setError(err?.message || "Failed to reject payment.");
    } finally {
      setSavingId("");
    }
  };

  const handleCancelCustomer = async payment => {
    const remark = window.prompt("Reason for cancelling payment");

    if (!remark?.trim()) return;

    setSavingId(payment.id);
    setError("");

    try {
      await cancelCustomerPayment({
        leadId,
        paymentId: payment.id,
        remark,
        user
      });

      onUpdated?.();
    } catch (err) {
      setError(err?.message || "Failed to cancel payment.");
    } finally {
      setSavingId("");
    }
  };

  const handleMarkVendorPaid = async payment => {
    const remark = window.prompt("Payment paid remark optional") || "";

    setSavingId(payment.id);
    setError("");

    try {
      await markVendorPaymentPaid({
        leadId,
        paymentId: payment.id,
        remark,
        user
      });

      onUpdated?.();
    } catch (err) {
      setError(err?.message || "Failed to mark vendor payment paid.");
    } finally {
      setSavingId("");
    }
  };

  const handleCancelVendor = async payment => {
    const remark = window.prompt("Reason for cancelling vendor payment");

    if (!remark?.trim()) return;

    setSavingId(payment.id);
    setError("");

    try {
      await cancelVendorPayment({
        leadId,
        paymentId: payment.id,
        remark,
        user
      });

      onUpdated?.();
    } catch (err) {
      setError(err?.message || "Failed to cancel vendor payment.");
    } finally {
      setSavingId("");
    }
  };

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Payment Ledger
            </p>

            <h3 className="mt-1 font-semibold text-gray-950">
              Customer Receipts & Vendor Payments
            </h3>

            <p className="mt-1 text-sm text-gray-500">
              View all inbound payments received and outbound payments sent for this lead.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <FilterButton
              active={filter === "all"}
              label="All"
              count={allPayments.length}
              onClick={() => setFilter("all")}
            />

            <FilterButton
              active={filter === "customer"}
              label="Received"
              count={customerPayments.length}
              onClick={() => setFilter("customer")}
            />

            <FilterButton
              active={filter === "vendor"}
              label="Vendor Paid"
              count={vendorPayments.length}
              onClick={() => setFilter("vendor")}
            />

            <FilterButton
              active={filter === "pending"}
              label="Pending"
              count={
                allPayments.filter(payment => {
                  return (
                    payment.status === CUSTOMER_PAYMENT_STATUS.PENDING_VERIFICATION ||
                    payment.status === VENDOR_PAYMENT_STATUS.PENDING
                  );
                }).length
              }
              onClick={() => setFilter("pending")}
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle size={17} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(item => (
            <div
              key={item}
              className="h-48 animate-pulse rounded-3xl bg-gray-100"
            />
          ))}
        </div>
      ) : filteredPayments.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-4">
          {filteredPayments.map(payment => (
            <PaymentCard
              key={`${payment.paymentDirection}-${payment.id}`}
              payment={payment}
              savingId={savingId}
              onVerifyCustomer={handleVerifyCustomer}
              onRejectCustomer={handleRejectCustomer}
              onCancelCustomer={handleCancelCustomer}
              onMarkVendorPaid={handleMarkVendorPaid}
              onCancelVendor={handleCancelVendor}
            />
          ))}
        </div>
      )}

      {!loading && allPayments.length > 0 && (
        <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
          <RefreshCcw size={13} />
          Payment ledger updates in real time.
        </div>
      )}
    </div>
  );
}