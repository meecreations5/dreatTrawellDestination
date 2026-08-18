"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Mail, MessageCircle, X } from "lucide-react";
import { sendWhatsAppWeb } from "@/lib/whatsapp";
import {
  getMeetingNotificationEventLabel,
  logMeetingWhatsAppOpened
} from "@/lib/meetingNotifications";

function recipientLabel(type) {
  return type === "team_member" ? "Team Member" : "Travel Agent";
}

function statusText(result) {
  if (!result) return "Not available";
  if (result.status === "sent") return "Sent";
  if (result.status === "prepared") return "Ready to open";
  if (result.status === "opened") return "WhatsApp opened";
  if (result.status === "missing_contact") return "Contact missing";
  if (result.status === "failed") return result.error || "Failed";
  return result.status || "Unknown";
}

export default function MeetingNotificationActionsModal({
  open,
  onClose,
  meetingId = "",
  eventType = "scheduled",
  notificationResult = null,
  user
}) {
  const [openedKeys, setOpenedKeys] = useState({});
  const [popupError, setPopupError] = useState("");

  useEffect(() => {
    if (!open) return;
    setOpenedKeys({});
    setPopupError("");
  }, [open, meetingId, eventType]);

  const grouped = useMemo(() => {
    const rows = {
      travel_agent: { email: null, whatsapp: null },
      team_member: { email: null, whatsapp: null }
    };
    for (const item of notificationResult?.results || []) {
      if (!rows[item.recipientType]) continue;
      rows[item.recipientType][item.channel] = item;
    }
    return rows;
  }, [notificationResult]);

  if (!open || !notificationResult) return null;

  const handleOpenWhatsApp = async result => {
    setPopupError("");
    if (!result?.whatsapp || !result?.message) return;
    const opened = sendWhatsAppWeb({ mobile: result.whatsapp, message: result.message });
    if (!opened) {
      setPopupError("WhatsApp could not be opened. Allow pop-ups for this site and try again.");
      return;
    }

    const key = `${result.recipientType}:whatsapp`;
    setOpenedKeys(current => ({ ...current, [key]: true }));
    try {
      await logMeetingWhatsAppOpened({
        meetingId,
        eventType,
        recipient: {
          type: result.recipientType,
          name: result.recipientName || "",
          email: "",
          whatsapp: result.whatsapp
        },
        user
      });
    } catch (error) {
      console.warn("Unable to log WhatsApp open:", error);
    }
  };

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-950/45 p-4">
      <div className="w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <div className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 size={18} />
              <p className="text-sm font-semibold">{getMeetingNotificationEventLabel(eventType)}</p>
            </div>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">Notify both participants</h2>
            <p className="mt-1 text-xs text-slate-500">
              Email is sent automatically. WhatsApp opens with a pre-filled message; review it and press Send in WhatsApp.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 p-5">
          {popupError ? (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-700">
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              <span>{popupError}</span>
            </div>
          ) : null}

          {["travel_agent", "team_member"].map(type => {
            const row = grouped[type] || {};
            const email = row.email;
            const whatsapp = row.whatsapp;
            const opened = openedKeys[`${type}:whatsapp`];
            return (
              <section key={type} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{recipientLabel(type)}</p>
                    <p className="text-xs text-slate-500">{email?.recipientName || whatsapp?.recipientName || "Recipient"}</p>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                      <Mail size={14} /> Email
                    </div>
                    <p className={`mt-1 text-xs ${email?.status === "sent" ? "text-emerald-700" : email?.status === "failed" ? "text-rose-700" : "text-slate-500"}`}>
                      {statusText(email)}
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                      <MessageCircle size={14} /> WhatsApp
                    </div>
                    {whatsapp?.status === "prepared" ? (
                      <button
                        type="button"
                        onClick={() => handleOpenWhatsApp(whatsapp)}
                        className="mt-2 inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        <MessageCircle size={14} />
                        {opened ? "Open Again" : "Open WhatsApp"}
                      </button>
                    ) : (
                      <p className={`mt-1 text-xs ${whatsapp?.status === "sent" ? "text-emerald-700" : whatsapp?.status === "failed" ? "text-rose-700" : "text-slate-500"}`}>
                        {opened ? "WhatsApp opened" : statusText(whatsapp)}
                      </p>
                    )}
                    {opened ? <p className="mt-1 text-[11px] text-emerald-700">Opened. Press Send in WhatsApp to deliver the message.</p> : null}
                  </div>
                </div>
              </section>
            );
          })}

          {notificationResult.whatsappMode === "cloud" ? (
            <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5 text-xs text-blue-700">
              WhatsApp Cloud API mode is enabled. WhatsApp messages are sent automatically instead of opening WhatsApp Web.
            </div>
          ) : (
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
              WhatsApp is manual by default. Opening the message is logged, but the CRM cannot confirm that you pressed Send inside WhatsApp.
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-100 px-5 py-4">
          <button type="button" onClick={onClose} className="h-10 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
