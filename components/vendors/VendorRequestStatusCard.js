"use client";

function formatDate(value) {
  if (!value) return "—";

  const date = value?.toDate ? value.toDate() : new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
}

function StatusPill({ value }) {
  const status = value || "not_requested";
  const labels = {
    accepted: "Accepted by Brevo",
    delivered: "Delivered to mail server",
    deferred: "Delivery deferred",
    soft_bounce: "Email soft bounce",
    hard_bounce: "Email hard bounce",
    blocked: "Email blocked",
    invalid_email: "Invalid email",
    spam: "Spam complaint",
    submission_failed: "Email send failed",
    failed: "Email failed"
  };
  const label = labels[status] || status.replaceAll("_", " ");

  const style =
    status === "delivered" || status === "sent" || status === "prepared"
      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
      : ["failed", "send_failed", "submission_failed", "hard_bounce", "blocked", "invalid_email", "spam"].includes(status)
        ? "bg-rose-50 text-rose-700 border-rose-100"
        : ["deferred", "soft_bounce", "missing_email", "missing_number"].includes(status)
          ? "bg-amber-50 text-amber-700 border-amber-100"
          : status === "accepted"
            ? "bg-blue-50 text-blue-700 border-blue-100"
            : "bg-gray-50 text-gray-600 border-gray-100";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${style}`}>
      {label}
    </span>
  );
}

export default function VendorRequestStatusCard({
  request,
  onFollowUp,
  onViewQuotes,
  onAddPricing
}) {
  if (!request) return null;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-gray-900">
              {request.vendorName || "Vendor"}
            </h3>

            <StatusPill value={request.status || "sent"} />
          </div>

          <p className="mt-1 text-xs text-gray-500">
            Vendor Ref:{" "}
            <span className="font-semibold text-gray-800">
              {request.vendorLeadReference || request.emailVendorReference || "—"}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <StatusPill value={request.emailDeliveryStatus || request.emailStatus} />
          <StatusPill value={request.whatsappStatus} />
        </div>
      </div>

      {(request.emailDeliveryReason || request.emailError) && (
        <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Email: {request.emailDeliveryReason || request.emailError}
        </div>
      )}

      {(request.emailProviderMessageId || request.emailSendingIp) && (
        <div className="mt-2 text-[10px] leading-5 text-gray-500">
          {request.emailProviderMessageId ? <span className="mr-3 break-all">Brevo ID: {request.emailProviderMessageId}</span> : null}
          {request.emailSendingIp ? <span>Sending IP: {request.emailSendingIp}</span> : null}
        </div>
      )}

      {(request.emailDeliveryStatus === "delivered" || request.emailStatus === "delivered") && (
        <p className="mt-2 text-[11px] leading-5 text-gray-500">
          Delivered means the recipient mail server accepted the message; inbox/spam placement is decided by that mail provider.
        </p>
      )}

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-xl bg-gray-50 p-3">
          <p className="text-xs text-gray-500">Expected TAT</p>
          <p className="mt-1 text-sm font-semibold text-gray-900">
            {request.expectedTatLabel || "—"}
          </p>
        </div>

        <div className="rounded-xl bg-gray-50 p-3">
          <p className="text-xs text-gray-500">Expected Reply By</p>
          <p className="mt-1 text-sm font-semibold text-gray-900">
            {request.expectedReplyByText || formatDate(request.expectedReplyBy)}
          </p>
        </div>

        <div className="rounded-xl bg-gray-50 p-3">
          <p className="text-xs text-gray-500">Next Follow-up</p>
          <p className="mt-1 text-sm font-semibold text-gray-900">
            {formatDate(request.nextFollowUpAt)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onFollowUp}
          className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
        >
          Follow Up
        </button>

        <button
          type="button"
          onClick={onAddPricing}
          className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
        >
          Add Pricing
        </button>

        <button
          type="button"
          onClick={onViewQuotes}
          className="rounded-xl bg-[#1d4e89] px-3 py-2 text-xs font-semibold text-white hover:bg-[#173f70]"
        >
          View Quotes
        </button>
      </div>
    </div>
  );
}