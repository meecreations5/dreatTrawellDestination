"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  FileText,
  IndianRupee,
  Loader2,
  ReceiptText,
  UploadCloud,
  Wallet,
  X
} from "lucide-react";

import {
  getDownloadURL,
  ref,
  uploadBytes
} from "firebase/storage";

import { storage } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";

import createCustomerPayment from "@/lib/leadCustomerPayments";

import {
  CUSTOMER_PAYMENT_TYPE_OPTIONS,
  CUSTOMER_PAYMENT_STATUS_OPTIONS,
  DEFAULT_CURRENCY,
  DEFAULT_CUSTOMER_PAYMENT_FORM,
  PAYMENT_MODE_OPTIONS,
  PAYMENT_MODES,
  PAYMENT_STORAGE_PATHS,
  PAYER_TYPE_OPTIONS,
  requiresBankName,
  requiresTransactionRef
} from "@/lib/paymentConstants";

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

function getTodayInputDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const localDate = new Date(now.getTime() - offset * 60 * 1000);

  return localDate.toISOString().slice(0, 10);
}

function getDefaultPayerName(lead = {}) {
  return cleanString(
    lead.travelAgentName ||
      lead.agencyName ||
      lead.agentName ||
      lead.customerName ||
      lead.travellerName ||
      lead.guestName
  );
}

function getDefaultPayerMobile(lead = {}) {
  return cleanString(
    lead.travelAgentMobile ||
      lead.agentMobile ||
      lead.customerMobile ||
      lead.mobile ||
      lead.phone ||
      lead.contactNumber ||
      lead.spoc?.mobile
  );
}

function getDefaultPayerEmail(lead = {}) {
  return cleanString(
    lead.travelAgentEmail ||
      lead.agentEmail ||
      lead.customerEmail ||
      lead.email ||
      lead.spoc?.email
  );
}

function getCurrency(lead = {}) {
  return (
    cleanString(
      lead.finalCustomerQuoteCurrency ||
        lead.latestCustomerQuoteCurrency ||
        lead.customerQuoteCurrency
    ) || DEFAULT_CURRENCY
  );
}

function getReceivableAmount(lead = {}) {
  return getNumber(
    lead.totalReceivableAmount ??
      lead.finalCustomerQuoteAmount ??
      lead.finalQuotationAmount ??
      lead.latestCustomerQuoteAmount ??
      lead.latestQuotationAmount ??
      lead.customerQuoteAmount ??
      lead.customerQuotedAmount ??
      0,
    0
  );
}

function getReceivedAmount(lead = {}) {
  return getNumber(lead.totalPaymentReceived, 0);
}

function getBalanceAmount(lead = {}) {
  const savedBalance = lead.paymentBalance;

  if (savedBalance !== null && savedBalance !== undefined && savedBalance !== "") {
    return getNumber(savedBalance, 0);
  }

  return getReceivableAmount(lead) - getReceivedAmount(lead);
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

function safeFileName(name = "") {
  return cleanString(name)
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
}

async function uploadReceiptFile({
  leadId,
  file
}) {
  if (!file) {
    return {
      receiptUrl: "",
      receiptFileName: ""
    };
  }

  const fileName = `${Date.now()}-${safeFileName(file.name)}`;

  const fileRef = ref(
    storage,
    `${PAYMENT_STORAGE_PATHS.CUSTOMER_RECEIPTS}/${leadId}/${fileName}`
  );

  await uploadBytes(fileRef, file);

  const receiptUrl = await getDownloadURL(fileRef);

  return {
    receiptUrl,
    receiptFileName: file.name
  };
}

/* =========================
   SMALL COMPONENTS
========================= */

function FieldLabel({
  children,
  required = false
}) {
  return (
    <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
      {children}
      {required && <span className="text-red-500"> *</span>}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder = "",
  type = "text",
  disabled = false
}) {
  return (
    <input
      type={type}
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      onChange={event => onChange(event.target.value)}
      className="
        w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5
        text-sm text-gray-900 outline-none transition
        focus:border-blue-400 focus:ring-2 focus:ring-blue-100
        disabled:bg-gray-100 disabled:text-gray-500
      "
    />
  );
}

function SelectInput({
  value,
  onChange,
  options = [],
  disabled = false
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={event => onChange(event.target.value)}
      className="
        w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5
        text-sm text-gray-900 outline-none transition
        focus:border-blue-400 focus:ring-2 focus:ring-blue-100
        disabled:bg-gray-100 disabled:text-gray-500
      "
    >
      {options.map(item => (
        <option key={item.value} value={item.value}>
          {item.label}
        </option>
      ))}
    </select>
  );
}

function SummaryBox({
  icon: Icon,
  label,
  value,
  tone = "gray"
}) {
  const toneClass =
    tone === "green"
      ? "bg-green-50 border-green-100 text-green-700"
      : tone === "blue"
        ? "bg-blue-50 border-blue-100 text-blue-700"
        : tone === "amber"
          ? "bg-amber-50 border-amber-100 text-amber-700"
          : "bg-gray-50 border-gray-100 text-gray-600";

  return (
    <div className={`rounded-2xl border p-3 ${toneClass}`}>
      <div className="flex items-center gap-1.5">
        {Icon && <Icon size={14} />}
        <p className="text-[11px] font-semibold uppercase tracking-wide">
          {label}
        </p>
      </div>

      <p className="mt-1 text-sm font-bold text-gray-950">
        {value}
      </p>
    </div>
  );
}

/* =========================
   MAIN COMPONENT
========================= */

export default function AddCustomerPaymentModal({
  open = true,
  lead,
  onClose,
  onSaved
}) {
  const { user } = useAuth();

  const leadId = getLeadId(lead);
  const currency = getCurrency(lead);

  const receivableAmount = getReceivableAmount(lead);
  const receivedAmount = getReceivedAmount(lead);
  const balanceAmount = getBalanceAmount(lead);

  const initialForm = useMemo(() => {
    return {
      ...DEFAULT_CUSTOMER_PAYMENT_FORM,

      payerName: getDefaultPayerName(lead),
      payerMobile: getDefaultPayerMobile(lead),
      payerEmail: getDefaultPayerEmail(lead),

      currency,
      amount: balanceAmount > 0 ? String(balanceAmount) : "",
      paymentDate: getTodayInputDate(),

      quotationId: cleanString(
        lead?.finalQuotationId ||
          lead?.latestQuotationId
      ),
      quotationRevision:
        lead?.finalQuotationRevision ||
        lead?.latestQuotationRevision ||
        ""
    };
  }, [lead, currency, balanceAmount]);

  const [form, setForm] = useState(initialForm);
  const [receiptFile, setReceiptFile] = useState(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const transactionRefRequired = requiresTransactionRef(form.paymentMode);
  const bankNameRequired = requiresBankName(form.paymentMode);

  const isCash = form.paymentMode === PAYMENT_MODES.CASH;

  const updateForm = (field, value) => {
    setForm(current => ({
      ...current,
      [field]: value
    }));
  };

  const handleSubmit = async event => {
    event.preventDefault();

    if (!leadId) {
      setError("Lead ID is missing.");
      return;
    }

    if (!user) {
      setError("User session is missing.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const receiptPayload = await uploadReceiptFile({
        leadId,
        file: receiptFile
      });

      const result = await createCustomerPayment({
        leadId,
        form: {
          ...form,
          ...receiptPayload
        },
        user
      });

      onSaved?.(result);
      onClose?.();
    } catch (err) {
      setError(err?.message || "Failed to save customer payment.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] bg-black/50 p-4 flex items-center justify-center">
      <form
        onSubmit={handleSubmit}
        className="
          w-full max-w-4xl max-h-[92vh] overflow-hidden
          rounded-3xl bg-white shadow-2xl flex flex-col
        "
      >
        {/* HEADER */}
        <div className="border-b border-gray-100 bg-gradient-to-r from-green-50 to-emerald-50 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-green-700">
                <ReceiptText size={20} />

                <p className="text-xs font-semibold uppercase tracking-wide">
                  Payment Received
                </p>
              </div>

              <h2 className="mt-1 text-lg font-semibold text-gray-950">
                Add Travel Agent / Customer Payment
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Record cash or bank transfer received from travel agent or customer.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="
                flex h-9 w-9 items-center justify-center rounded-xl
                border border-gray-200 bg-white text-gray-500
                hover:text-gray-900 disabled:opacity-50
              "
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {error && (
            <div className="flex items-start gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertTriangle size={17} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* SUMMARY */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <SummaryBox
              icon={IndianRupee}
              label="Receivable"
              value={formatMoney(receivableAmount, currency)}
              tone="blue"
            />

            <SummaryBox
              icon={Wallet}
              label="Already Received"
              value={formatMoney(receivedAmount, currency)}
              tone="green"
            />

            <SummaryBox
              icon={Banknote}
              label="Current Balance"
              value={formatMoney(balanceAmount, currency)}
              tone={balanceAmount > 0 ? "amber" : "green"}
            />
          </div>

          {/* PAYER */}
          <section className="rounded-3xl border border-gray-100 bg-gray-50 p-4">
            <div className="flex items-center gap-2">
              <Wallet size={17} className="text-gray-600" />
              <h3 className="font-semibold text-gray-900">
                Payer Details
              </h3>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <FieldLabel required>Payer Type</FieldLabel>
                <SelectInput
                  value={form.payerType}
                  options={PAYER_TYPE_OPTIONS}
                  onChange={value => updateForm("payerType", value)}
                  disabled={saving}
                />
              </div>

              <div className="space-y-1.5">
                <FieldLabel required>Payer Name</FieldLabel>
                <TextInput
                  value={form.payerName}
                  onChange={value => updateForm("payerName", value)}
                  placeholder="Travel agent / customer name"
                  disabled={saving}
                />
              </div>

              <div className="space-y-1.5">
                <FieldLabel>Mobile</FieldLabel>
                <TextInput
                  value={form.payerMobile}
                  onChange={value => updateForm("payerMobile", value)}
                  placeholder="Mobile number"
                  disabled={saving}
                />
              </div>

              <div className="space-y-1.5">
                <FieldLabel>Email</FieldLabel>
                <TextInput
                  value={form.payerEmail}
                  onChange={value => updateForm("payerEmail", value)}
                  placeholder="Email address"
                  disabled={saving}
                />
              </div>
            </div>
          </section>

          {/* PAYMENT */}
          <section className="rounded-3xl border border-gray-100 bg-white p-4">
            <div className="flex items-center gap-2">
              <ReceiptText size={17} className="text-gray-600" />
              <h3 className="font-semibold text-gray-900">
                Payment Details
              </h3>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <FieldLabel required>Payment Type</FieldLabel>
                <SelectInput
                  value={form.paymentType}
                  options={CUSTOMER_PAYMENT_TYPE_OPTIONS}
                  onChange={value => updateForm("paymentType", value)}
                  disabled={saving}
                />
              </div>

              <div className="space-y-1.5">
                <FieldLabel required>Status</FieldLabel>
                <SelectInput
                  value={form.status}
                  options={CUSTOMER_PAYMENT_STATUS_OPTIONS}
                  onChange={value => updateForm("status", value)}
                  disabled={saving}
                />
              </div>

              <div className="space-y-1.5">
                <FieldLabel required>Amount</FieldLabel>
                <div className="flex">
                  <span className="inline-flex items-center rounded-l-xl border border-r-0 border-gray-200 bg-gray-50 px-3 text-sm font-semibold text-gray-600">
                    {currency}
                  </span>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.amount}
                    disabled={saving}
                    onChange={event => updateForm("amount", event.target.value)}
                    placeholder="0"
                    className="
                      w-full rounded-r-xl border border-gray-200 bg-white px-3 py-2.5
                      text-sm text-gray-900 outline-none transition
                      focus:border-blue-400 focus:ring-2 focus:ring-blue-100
                      disabled:bg-gray-100 disabled:text-gray-500
                    "
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <FieldLabel required>Payment Date</FieldLabel>
                <div className="relative">
                  <CalendarDays
                    size={15}
                    className="absolute left-3 top-3 text-gray-400"
                  />

                  <input
                    type="date"
                    value={form.paymentDate}
                    disabled={saving}
                    onChange={event =>
                      updateForm("paymentDate", event.target.value)
                    }
                    className="
                      w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 py-2.5
                      text-sm text-gray-900 outline-none transition
                      focus:border-blue-400 focus:ring-2 focus:ring-blue-100
                      disabled:bg-gray-100 disabled:text-gray-500
                    "
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <FieldLabel required>Payment Mode</FieldLabel>
                <SelectInput
                  value={form.paymentMode}
                  options={PAYMENT_MODE_OPTIONS}
                  onChange={value => {
                    updateForm("paymentMode", value);

                    if (value === PAYMENT_MODES.CASH) {
                      updateForm("transactionRef", "");
                      updateForm("bankName", "");
                    }
                  }}
                  disabled={saving}
                />
              </div>

              <div className="space-y-1.5">
                <FieldLabel required={transactionRefRequired}>
                  Transaction Ref / UTR
                </FieldLabel>
                <TextInput
                  value={form.transactionRef}
                  onChange={value => updateForm("transactionRef", value)}
                  placeholder={isCash ? "Not required for cash" : "UTR / Ref No."}
                  disabled={saving || isCash}
                />
              </div>

              <div className="space-y-1.5">
                <FieldLabel required={bankNameRequired}>
                  Bank Name
                </FieldLabel>
                <TextInput
                  value={form.bankName}
                  onChange={value => updateForm("bankName", value)}
                  placeholder={isCash ? "Not required for cash" : "Bank name"}
                  disabled={saving || isCash}
                />
              </div>

              <div className="space-y-1.5">
                <FieldLabel>Receipt Upload</FieldLabel>

                <label
                  className="
                    flex cursor-pointer items-center gap-3 rounded-xl border border-dashed
                    border-gray-300 bg-gray-50 px-3 py-2.5 text-sm text-gray-600
                    hover:border-green-300 hover:bg-green-50
                  "
                >
                  <UploadCloud size={17} />

                  <span className="truncate">
                    {receiptFile ? receiptFile.name : "Upload receipt / screenshot"}
                  </span>

                  <input
                    type="file"
                    className="hidden"
                    accept="image/*,application/pdf"
                    disabled={saving}
                    onChange={event => {
                      const file = event.target.files?.[0] || null;
                      setReceiptFile(file);
                    }}
                  />
                </label>
              </div>
            </div>
          </section>

          {/* NOTE */}
          <section className="rounded-3xl border border-gray-100 bg-white p-4">
            <div className="flex items-center gap-2">
              <FileText size={17} className="text-gray-600" />
              <h3 className="font-semibold text-gray-900">
                Remark
              </h3>
            </div>

            <textarea
              value={form.remark}
              disabled={saving}
              onChange={event => updateForm("remark", event.target.value)}
              rows={3}
              placeholder="Add internal payment note..."
              className="
                mt-4 w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2.5
                text-sm text-gray-900 outline-none transition
                focus:border-blue-400 focus:ring-2 focus:ring-blue-100
                disabled:bg-gray-100 disabled:text-gray-500
              "
            />
          </section>
        </div>

        {/* FOOTER */}
        <div className="border-t border-gray-100 bg-white px-5 py-4">
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="
                rounded-xl border border-gray-200 bg-white px-4 py-2.5
                text-sm font-semibold text-gray-700 hover:bg-gray-50
                disabled:opacity-50
              "
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="
                inline-flex items-center justify-center gap-2 rounded-xl bg-green-600
                px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700
                disabled:opacity-50
              "
            >
              {saving && <Loader2 size={16} className="animate-spin" />}
              Save Payment Received
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}