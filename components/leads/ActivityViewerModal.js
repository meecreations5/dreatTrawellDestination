// componenets/leads/ActivityViewverModal

"use client";

import { sendEmailViaBrevo } from "@/lib/sendEmailViaBrevo";
import { sendWhatsAppWeb } from "@/lib/whatsapp";

export default function ActivityViewerModal({ activity, onClose }) {
  if (!activity) return null;

  /* =========================
     🔁 NORMALIZE DATA (PHASE 1 + 2 SAFE)
  ========================== */
  const meta = {
    amount:
      activity.metadata?.amount ??
      activity.totalPrice ??
      null,

    currency:
      activity.metadata?.currency ??
      "INR",

    revision:
      activity.metadata?.revision ??
      activity.revisionNumber ??
      null,

    sendVia:
      activity.metadata?.sendVia ??
      activity.sendVia ??
      [],

    itineraryHtml:
      activity.metadata?.itineraryHtml ??
      activity.itineraryHtml ??
      null,

    notes:
      activity.metadata?.notes ??
      activity.note ??
      null,

    toEmail:
      activity.metadata?.toEmail ??
      null,

    toMobile:
      activity.metadata?.toMobile ??
      null,

    toName:
      activity.metadata?.toName ??
      null
  };

  /* =========================
     ACTIONS
  ========================== */
  const resendEmail = async () => {
    if (!meta.toEmail || !meta.itineraryHtml) return;

    await sendEmailViaBrevo({
      toEmail: meta.toEmail,
      toName: meta.toName,
      subject: `Quotation Rev ${meta.revision || ""}`,
      html: meta.itineraryHtml
    });
  };

  const resendWhatsApp = () => {
    if (!meta.toMobile) return;

    sendWhatsAppWeb({
      mobile: meta.toMobile,
      message: `Quotation Rev ${meta.revision}\nAmount: ${meta.currency} ${meta.amount}`
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="
          bg-white w-full max-w-3xl
          rounded-xl shadow-xl
          flex flex-col
          max-h-[90vh]
        "
        onClick={e => e.stopPropagation()}
      >
        {/* ================= HEADER ================= */}
        <div className="px-6 py-4 border-b flex justify-between">
          <div>
            <h2 className="font-semibold text-lg">
              {activity.title}
            </h2>
            <p className="text-xs text-gray-500 capitalize">
              {activity.type?.replace("_", " ")}
            </p>
          </div>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-black text-lg"
          >
            ✕
          </button>
        </div>

        {/* ================= BODY ================= */}
        <div className="px-6 py-4 space-y-6 overflow-y-auto">

          {/* ===== QUOTATION DETAILS ===== */}
          {activity.type === "quotation" && (
            <>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-500">Total Amount</p>
                  <p className="font-semibold">
                    {meta.amount
                      ? `${meta.currency} ${meta.amount}`
                      : "—"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-500">Sent Via</p>
                  <p className="capitalize">
                    {meta.sendVia.length
                      ? meta.sendVia.join(", ")
                      : "—"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-500">Date</p>
                  <p>
                    {activity.createdAt?.toDate
                      ? activity.createdAt
                          .toDate()
                          .toLocaleString()
                      : "—"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-500">Revision</p>
                  <p>{meta.revision ? `v${meta.revision}` : "—"}</p>
                </div>
              </div>

              {/* ===== ACTIONS ===== */}
              <div className="flex gap-3">
                <button
                  onClick={resendEmail}
                  disabled={!meta.toEmail}
                  className="border border-blue-600 text-blue-600 px-4 py-2 rounded-md text-sm"
                >
                  📧 Resend Email
                </button>

                <button
                  onClick={resendWhatsApp}
                  disabled={!meta.toMobile}
                  className="border border-green-600 text-green-600 px-4 py-2 rounded-md text-sm"
                >
                  💬 Resend WhatsApp
                </button>
              </div>

              {/* ===== NOTES ===== */}
              {meta.notes && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Notes</p>
                  <p className="text-sm whitespace-pre-line">
                    {meta.notes}
                  </p>
                </div>
              )}
            </>
          )}

          {/* ===== DESCRIPTION ===== */}
          {activity.description && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 mb-1">
                Description
              </h4>
              <p className="text-sm whitespace-pre-line">
                {activity.description}
              </p>
            </div>
          )}

          {/* ===== ITINERARY PREVIEW ===== */}
          {meta.itineraryHtml && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 mb-2">
                Itinerary
              </h4>

              <div
                className="
                  prose prose-sm max-w-none
                  border rounded-md p-3
                  bg-gray-50
                  max-h-64 overflow-y-auto
                "
                dangerouslySetInnerHTML={{
                  __html: meta.itineraryHtml
                }}
              />
            </div>
          )}
        </div>

        {/* ================= FOOTER ================= */}
        <div className="px-6 py-3 border-t text-xs text-gray-500">
          Created by{" "}
          <span className="font-medium text-gray-700">
            {activity.createdByName ||
              activity.createdByEmail ||
              "System"}
          </span>
        </div>
      </div>
    </div>
  );
}
