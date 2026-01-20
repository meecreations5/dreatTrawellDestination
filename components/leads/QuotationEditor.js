  // componenets/leads/QuotationEditor

  "use client";

  import { useState } from "react";
  import dynamic from "next/dynamic";
  import { useAuth } from "@/hooks/useAuth";
  import { sendWhatsAppWeb } from "@/lib/whatsapp";
  import { sendEmailViaBrevo } from "@/lib/sendEmailViaBrevo";
  import { createQuotationRevision } from "@/lib/createQuotationRevision";
  import SelectableChip from "@/components/ui/SelectableChip";

  const ReactQuill = dynamic(() => import("react-quill-new"), {
    ssr: false
  });

  import "react-quill-new/dist/quill.snow.css";

  const inputClass = `
    w-full border border-gray-200 rounded-lg
    px-3 py-2 text-sm bg-white
    focus:outline-none focus:ring-2 focus:ring-blue-100
  `;

  export default function QuotationEditor({ lead, onClose }) {
    const { user } = useAuth();

    const [html, setHtml] = useState("");
    const [price, setPrice] = useState("");
    const [note, setNote] = useState("");
    const [sendEmail, setSendEmail] = useState(true);
    const [sendWhatsApp, setSendWhatsApp] = useState(false);
    const [saving, setSaving] = useState(false);

    if (!user) return null;

    const submit = async () => {
      if (saving) return;

      if (!html || !price)
        return alert("Itinerary & price required");

      if (!sendEmail && !sendWhatsApp)
        return alert("Select at least one channel");

      setSaving(true);

      try {
        const sendVia = [
          sendEmail && "email",
          sendWhatsApp && "whatsapp"
        ].filter(Boolean);

        const revision = await createQuotationRevision({
          leadId: lead.id,
          itineraryHtml: html,
          totalPrice: Number(price),
          note,
          sendVia,
          user
        });

        if (sendEmail && lead.spoc?.email) {
          sendEmailViaBrevo({
            toEmail: lead.spoc.email,
            toName: lead.spoc.name,
            subject: `Quotation ${lead.leadCode} (Rev ${revision})`,
            html
          }).catch(console.error);
        }

        if (sendWhatsApp && lead.spoc?.mobile) {
          sendWhatsAppWeb({
            mobile: lead.spoc.mobile,
            message: encodeURIComponent(
              `Quotation ${lead.leadCode} (Rev ${revision})\n₹${price}`
            )
          });
        }

        onClose();
      } finally {
        setSaving(false);
      }
    };

    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white max-w-4xl w-full rounded-xl p-6 space-y-4">

          <h2 className="text-sm font-semibold">
            Create Quotation
          </h2>

          {/* EDITOR */}
          <div className="border rounded-lg overflow-hidden">
            <ReactQuill
              value={html}
              onChange={setHtml}
              className="quotation-editor"
            />
          </div>

          {/* PRICE */}
          <input
            type="number"
            inputMode="numeric"
            className={inputClass}
            placeholder="Total Price (₹)"
            value={price}
            onChange={e => setPrice(e.target.value)}
          />

          {/* NOTE */}
          <textarea
            className={inputClass}
            rows={2}
            placeholder="Internal note"
            value={note}
            onChange={e => setNote(e.target.value)}
          />

          {/* CHANNEL BUTTONS */}
          <div className="flex gap-2">
            <SelectableChip
              label="Email"
              selected={sendEmail}
              disabled={!lead.spoc?.email}
              onClick={() =>
                lead.spoc?.email &&
                setSendEmail(v => !v)
              }
            />

            <SelectableChip
              label="WhatsApp"
              selected={sendWhatsApp}
              disabled={!lead.spoc?.mobile}
              onClick={() =>
                lead.spoc?.mobile &&
                setSendWhatsApp(v => !v)
              }
            />
          </div>

          {/* 🧾 SPOC DETAILS – MINIMAL + ICONS */}
          {(sendEmail || sendWhatsApp) && (
            <div className="text-sm text-gray-600 space-y-1 pl-1">

              {sendEmail && (
                <div className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path d="M4 4h16v16H4z" stroke="none" />
                    <path d="M4 4l8 8 8-8" />
                  </svg>
                  <span>{lead.spoc?.email || "Email not available"}</span>
                </div>
              )}

              {sendWhatsApp && (
                <div className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path d="M16.7 13.4c-.3-.2-1.8-.9-2.1-1s-.5-.2-.7.2-.8 1-.9 1.1-.3.2-.6 0a8.5 8.5 0 0 1-2.5-1.6 9.4 9.4 0 0 1-1.7-2.1c-.2-.3 0-.5.2-.7l.5-.6c.2-.2.2-.4.3-.6s0-.4 0-.6c0-.2-.7-1.7-.9-2.3-.2-.6-.4-.5-.7-.5h-.6a1.2 1.2 0 0 0-.9.4c-.3.3-1.2 1.2-1.2 3s1.2 3.5 1.4 3.7c.2.2 2.3 3.6 5.6 5a18.9 18.9 0 0 0 1.9.7 4.6 4.6 0 0 0 2.1.1c.6-.1 1.8-.7 2.1-1.4.3-.7.3-1.3.2-1.4-.1-.1-.3-.2-.6-.4z" />
                  </svg>
                  <span>{lead.spoc?.mobile || "WhatsApp not available"}</span>
                </div>
              )}

            </div>
          )}


          {/* ACTIONS */}
          <div className="flex gap-2 pt-3 border-t">
            <button
              onClick={onClose}
              disabled={saving}
              className="flex-1 border rounded-md py-2"
            >
              Cancel
            </button>

            <button
              onClick={submit}
              disabled={saving}
              className="flex-1 bg-blue-600 text-white rounded-md py-2 disabled:opacity-60"
            >
              {saving ? "Sending…" : "Send Quotation"}
            </button>
          </div>
        </div>

        {/* Quill height fix */}
        <style jsx global>{`
          .quotation-editor .ql-editor {
            min-height: 320px;
          }
        `}</style>
      </div>
    );
  }
