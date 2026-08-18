"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";

import {
  AlertTriangle,
  Bold,
  CheckCircle2,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Loader2,
  Mail,
  MessageCircle,
  Pilcrow,
  Send,
  Underline,
  X
} from "lucide-react";

import { db } from "@/lib/firebase";
import {
  createLeadVendorRequest,
  markVendorWhatsappOpened
} from "@/lib/leadVendorRequests";
import VendorResponseTimelineFields from "@/components/vendors/VendorResponseTimelineFields";

/* =========================
   HELPERS
========================= */

function cleanString(value = "") {
  return String(value || "").trim();
}

function getLeadId(lead) {
  return lead?.id || lead?.leadId || "";
}

function getVendorName(vendor) {
  return (
    cleanString(vendor?.vendorName) ||
    cleanString(vendor?.name) ||
    cleanString(vendor?.agencyName) ||
    "Vendor"
  );
}

function getVendorEmail(vendor) {
  return cleanString(vendor?.email || vendor?.vendorEmail);
}

function getVendorMobile(vendor) {
  return cleanString(
    vendor?.whatsapp ||
    vendor?.mobile ||
    vendor?.phone ||
    vendor?.contactNumber
  );
}

function escapeHtml(value = "") {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function linesToHtml(text = "") {
  return String(text || "")
    .split("\n")
    .map(line => {
      if (!line.trim()) return "<p><br /></p>";
      return `<p>${escapeHtml(line)}</p>`;
    })
    .join("");
}

function htmlToText(html = "") {
  if (typeof window === "undefined") {
    return String(html || "").replace(/<[^>]+>/g, " ").trim();
  }

  const div = document.createElement("div");
  div.innerHTML = html || "";

  return div.innerText.replace(/\n{3,}/g, "\n\n").trim();
}

function sanitizeHtml(html = "") {
  if (typeof window === "undefined") return html;

  const wrapper = document.createElement("div");
  wrapper.innerHTML = html || "";

  wrapper
    .querySelectorAll("script, style, iframe, object, embed, link, meta")
    .forEach(node => node.remove());

  wrapper.querySelectorAll("*").forEach(node => {
    [...node.attributes].forEach(attr => {
      const name = attr.name.toLowerCase();
      const value = attr.value || "";

      if (name.startsWith("on")) {
        node.removeAttribute(attr.name);
      }

      if (
        ["href", "src"].includes(name) &&
        value.trim().toLowerCase().startsWith("javascript:")
      ) {
        node.removeAttribute(attr.name);
      }
    });
  });

  return wrapper.innerHTML.trim();
}

function getDefaultRequirementText(lead) {
  const destination =
    cleanString(lead?.destinationName) ||
    cleanString(lead?.destination) ||
    cleanString(lead?.city);

  const travelDate =
    cleanString(lead?.travelDate) ||
    cleanString(lead?.departureDate) ||
    cleanString(lead?.startDate);

  const nights =
    cleanString(lead?.nights) ||
    cleanString(lead?.numberOfNights) ||
    cleanString(lead?.duration);

  const pax =
    cleanString(lead?.pax) ||
    [
      lead?.adults ? `${lead.adults} Adult(s)` : "",
      lead?.children ? `${lead.children} Child(ren)` : "",
      lead?.infants ? `${lead.infants} Infant(s)` : ""
    ]
      .filter(Boolean)
      .join(", ");

  const lines = [
    destination ? `Destination: ${destination}` : "",
    travelDate ? `Travel Date: ${travelDate}` : "",
    nights ? `Nights / Duration: ${nights}` : "",
    pax ? `Pax: ${pax}` : "",
    "",
    "Please share your best costing, availability, inclusions, exclusions, payment terms and cancellation policy."
  ];

  return lines.filter(Boolean).join("\n");
}

function getDefaultRequirementHtml(lead) {
  return linesToHtml(getDefaultRequirementText(lead));
}

/* =========================
   RICH TEXT EDITOR
========================= */

function ToolbarButton({ icon: Icon, label, onClick, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className="
        h-8 min-w-8 inline-flex items-center justify-center rounded-lg
        border border-gray-200 bg-white px-2 text-gray-600
        hover:bg-gray-50 hover:text-gray-900
        disabled:opacity-50 disabled:cursor-not-allowed
      "
    >
      {Icon ? <Icon size={15} /> : label}
    </button>
  );
}

function RichTextEditor({
  value,
  onChange,
  disabled = false,
  placeholder = ""
}) {
  const editorRef = useRef(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    if (editor.innerHTML !== value) {
      editor.innerHTML = value || "";
    }
  }, [value]);

  const syncValue = () => {
    const html = sanitizeHtml(editorRef.current?.innerHTML || "");
    onChange?.(html);
  };

  const runCommand = (command, commandValue = null) => {
    if (disabled) return;

    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    syncValue();
  };

  const addLink = () => {
    if (disabled) return;

    const url = window.prompt("Enter link URL");

    if (!url) return;

    const safeUrl =
      url.startsWith("http://") || url.startsWith("https://")
        ? url
        : `https://${url}`;

    runCommand("createLink", safeUrl);
  };

  const clearFormat = () => {
    runCommand("removeFormat");
  };

  const handlePaste = event => {
    if (disabled) return;

    event.preventDefault();

    const html =
      event.clipboardData.getData("text/html") ||
      linesToHtml(event.clipboardData.getData("text/plain"));

    document.execCommand("insertHTML", false, sanitizeHtml(html));
    syncValue();
  };

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
      <div className="flex flex-wrap items-center gap-1 border-b border-gray-100 bg-gray-50 px-2 py-2">
        <ToolbarButton
          icon={Bold}
          label="Bold"
          disabled={disabled}
          onClick={() => runCommand("bold")}
        />

        <ToolbarButton
          icon={Italic}
          label="Italic"
          disabled={disabled}
          onClick={() => runCommand("italic")}
        />

        <ToolbarButton
          icon={Underline}
          label="Underline"
          disabled={disabled}
          onClick={() => runCommand("underline")}
        />

        <span className="h-5 w-px bg-gray-200 mx-1" />

        <ToolbarButton
          icon={List}
          label="Bullet List"
          disabled={disabled}
          onClick={() => runCommand("insertUnorderedList")}
        />

        <ToolbarButton
          icon={ListOrdered}
          label="Numbered List"
          disabled={disabled}
          onClick={() => runCommand("insertOrderedList")}
        />

        <span className="h-5 w-px bg-gray-200 mx-1" />

        <ToolbarButton
          icon={LinkIcon}
          label="Add Link"
          disabled={disabled}
          onClick={addLink}
        />

        <ToolbarButton
          icon={Pilcrow}
          label="Clear Format"
          disabled={disabled}
          onClick={clearFormat}
        />
      </div>

      <div
        ref={editorRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={syncValue}
        onBlur={syncValue}
        onPaste={handlePaste}
        data-placeholder={placeholder}
        className="
          min-h-[220px] max-h-[420px] overflow-y-auto
          px-4 py-3 text-sm leading-6 text-gray-800
          focus:outline-none
          empty:before:content-[attr(data-placeholder)]
          empty:before:text-gray-400
        "
      />
    </div>
  );
}

/* =========================
   COMPONENT
========================= */

export default function LeadVendorRequestForm({
  lead,
  vendors: vendorsProp,
  vendorRequests: vendorRequestsProp,
  user,
  onClose,
  onCreated
}) {
  const leadId = getLeadId(lead);

  const [vendors, setVendors] = useState([]);
  const [vendorRequests, setVendorRequests] = useState([]);

  const [loadingVendors, setLoadingVendors] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);

  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState("error");

  const [form, setForm] = useState({
    vendorId: "",
    requirementSubject: "Travel requirement for quotation",
    requirementHtml: getDefaultRequirementHtml(lead),
    sendEmail: true,
    sendWhatsapp: true,
    nextFollowUpAt: "",

    travelDates: "",
    paxText: ""
  });

  const [expectedTat, setExpectedTat] = useState("within_4_working_hours");
  const [expectedReplyBy, setExpectedReplyBy] = useState("");
  const [
    autoFollowUpFromExpectedReply,
    setAutoFollowUpFromExpectedReply
  ] = useState(true);

  useEffect(() => {
    setForm(prev => ({
      ...prev,
      requirementHtml:
        cleanString(prev.requirementHtml) ||
        getDefaultRequirementHtml(lead)
    }));
  }, [lead]);

  /* =========================
     LOAD VENDORS
  ========================== */

  useEffect(() => {
    if (Array.isArray(vendorsProp)) {
      setVendors(vendorsProp);
      setLoadingVendors(false);
      return;
    }

    const unsub = onSnapshot(
      collection(db, "vendors"),
      snap => {
        const rows = snap.docs
          .map(docSnap => ({
            id: docSnap.id,
            vendorId: docSnap.id,
            ...docSnap.data()
          }))
          .filter(vendor => vendor.active !== false)
          .sort((a, b) =>
            getVendorName(a).localeCompare(getVendorName(b))
          );

        setVendors(rows);
        setLoadingVendors(false);
      },
      () => {
        setVendors([]);
        setLoadingVendors(false);
      }
    );

    return () => unsub();
  }, [vendorsProp]);

  /* =========================
     LOAD EXISTING REQUESTS
  ========================== */

  useEffect(() => {
    if (Array.isArray(vendorRequestsProp)) {
      setVendorRequests(vendorRequestsProp);
      setLoadingRequests(false);
      return;
    }

    if (!leadId) {
      setVendorRequests([]);
      setLoadingRequests(false);
      return;
    }

    const unsub = onSnapshot(
      collection(db, "leads", leadId, "vendorRequests"),
      snap => {
        const rows = snap.docs.map(docSnap => ({
          id: docSnap.id,
          vendorRequestId: docSnap.id,
          ...docSnap.data()
        }));

        setVendorRequests(rows);
        setLoadingRequests(false);
      },
      () => {
        setVendorRequests([]);
        setLoadingRequests(false);
      }
    );

    return () => unsub();
  }, [leadId, vendorRequestsProp]);

  /* =========================
     DERIVED
  ========================== */

  const requestedVendorIds = useMemo(() => {
    return new Set(
      vendorRequests
        .map(request => request.vendorId)
        .filter(Boolean)
    );
  }, [vendorRequests]);

  const selectedVendor = useMemo(() => {
    return vendors.find(vendor => vendor.id === form.vendorId) || null;
  }, [vendors, form.vendorId]);

  const selectedVendorAlreadyRequested = Boolean(
    form.vendorId && requestedVendorIds.has(form.vendorId)
  );

  const existingRequestForSelectedVendor = useMemo(() => {
    if (!form.vendorId) return null;

    return (
      vendorRequests.find(
        request => request.vendorId === form.vendorId
      ) || null
    );
  }, [form.vendorId, vendorRequests]);

  const sendVia = useMemo(() => {
    const channels = [];

    if (form.sendEmail) channels.push("email");
    if (form.sendWhatsapp) channels.push("whatsapp");

    return channels;
  }, [form.sendEmail, form.sendWhatsapp]);

  const plainRequirementText = useMemo(() => {
    return htmlToText(form.requirementHtml);
  }, [form.requirementHtml]);

  const canSubmit =
    !saving &&
    leadId &&
    form.vendorId &&
    cleanString(plainRequirementText) &&
    sendVia.length > 0 &&
    !selectedVendorAlreadyRequested;

  function updateField(key, value) {
    setForm(prev => ({
      ...prev,
      [key]: value
    }));

    setNotice("");
  }

  /* =========================
     SUBMIT
  ========================== */

  const handleSubmit = async event => {
    event.preventDefault();

    if (!form.vendorId) {
      setNoticeType("warning");
      setNotice("Please select a vendor.");
      return;
    }

    if (!plainRequirementText) {
      setNoticeType("warning");
      setNotice("Please enter requirement details.");
      return;
    }

    const selectedChannels = [
      form.sendEmail ? "email" : "",
      form.sendWhatsapp ? "whatsapp" : ""
    ].filter(Boolean);

    if (!selectedChannels.length) {
      setNoticeType("warning");
      setNotice("Please select Email or WhatsApp.");
      return;
    }

    /*
      Important:
      Open blank WhatsApp tab immediately from user click.
      If we wait until after email/API work, browser may block popup.
    */
    let whatsappWindow = null;

    if (form.sendWhatsapp && typeof window !== "undefined") {
      whatsappWindow = window.open("about:blank", "_blank");
    }

    try {
      setSaving(true);
      setNotice("");

      const result = await createLeadVendorRequest({
        leadId,
        vendorId: form.vendorId,

        requirementSubject: form.requirementSubject,
        requirementHtml: form.requirementHtml,
        requirementText: plainRequirementText,

        travelDates: form.travelDates,
        paxText: form.paxText,

        sendVia: selectedChannels,

        expectedTat,
        expectedReplyBy,
        autoFollowUpFromExpectedReply,

        nextFollowUpAt: autoFollowUpFromExpectedReply
          ? expectedReplyBy
          : form.nextFollowUpAt,

        user
      });

      if (form.sendWhatsapp) {
        if (result?.whatsappUrl) {
          if (whatsappWindow && !whatsappWindow.closed) {
            whatsappWindow.location.href = result.whatsappUrl;
          } else if (typeof window !== "undefined") {
            window.open(result.whatsappUrl, "_blank", "noopener,noreferrer");
          }

          await markVendorWhatsappOpened({
            leadId,
            vendorRequestId: result.vendorRequestId
          });
        } else {
          if (whatsappWindow && !whatsappWindow.closed) {
            whatsappWindow.close();
          }

          setNoticeType("warning");
          setNotice(
            result?.whatsappStatus === "missing_number"
              ? "Vendor request saved and email sent, but WhatsApp number is missing."
              : "Vendor request saved, but WhatsApp could not be opened."
          );

          setSaving(false);
          return;
        }
      }

      setNoticeType("success");
      setNotice("Vendor request sent successfully.");

      if (typeof onCreated === "function") {
        onCreated(result);
      }

      if (typeof onClose === "function") {
        onClose();
      }
    } catch (error) {
      console.error("Vendor request failed:", error);

      if (whatsappWindow && !whatsappWindow.closed) {
        whatsappWindow.close();
      }

      setNoticeType("error");
      setNotice(error?.message || "Failed to send vendor request.");
    } finally {
      setSaving(false);
    }
  };

  /* =========================
     UI
  ========================== */

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        {/* HEADER */}
        <div className="shrink-0 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-blue-50 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Send Vendor Quote Request
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                Travel agent name/code is not sent to vendor. Vendor will receive a masked reference.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="
            flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white
            text-gray-500 hover:text-gray-900 disabled:opacity-50
          "
            >
              <X size={17} />
            </button>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          {/* BODY */}
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {/* NOTICE */}
            {notice && (
              <div
                className={`
              flex items-start gap-2 rounded-xl border px-4 py-3 text-sm
              ${noticeType === "success"
                    ? "border-green-200 bg-green-50 text-green-800"
                    : noticeType === "warning"
                      ? "border-amber-200 bg-amber-50 text-amber-800"
                      : "border-red-200 bg-red-50 text-red-700"
                  }
            `}
              >
                {noticeType === "success" ? (
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                ) : (
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                )}

                <span>{notice}</span>
              </div>
            )}

            {/* TOP GRID */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
              {/* VENDOR */}
              <div className="lg:col-span-3">
                <label className="mb-1.5 block text-xs font-semibold text-gray-500">
                  Vendor *
                </label>

                <select
                  value={form.vendorId}
                  disabled={saving || loadingVendors}
                  onChange={event =>
                    updateField("vendorId", event.target.value)
                  }
                  className="
                w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm
                focus:outline-none focus:ring-2 focus:ring-purple-500
                disabled:bg-gray-100 disabled:text-gray-500
              "
                >
                  <option value="">
                    {loadingVendors ? "Loading vendors..." : "Select vendor"}
                  </option>

                  {vendors.map(vendor => {
                    const alreadyRequested = requestedVendorIds.has(vendor.id);

                    return (
                      <option
                        key={vendor.id}
                        value={vendor.id}
                        disabled={alreadyRequested}
                      >
                        {getVendorName(vendor)}
                        {vendor.vendorCode ? ` (${vendor.vendorCode})` : ""}
                        {alreadyRequested ? " — Already requested" : ""}
                      </option>
                    );
                  })}
                </select>

                {loadingRequests && (
                  <p className="mt-1.5 text-xs text-gray-400">
                    Checking existing vendor requests...
                  </p>
                )}

                {selectedVendorAlreadyRequested && (
                  <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Quote request already sent to this vendor for this lead.
                    Please use Follow Up, Add Pricing, or View Quotes instead.
                  </div>
                )}
              </div>

              {/* SEND VIA */}
              <div className="lg:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold text-gray-500">
                  Send Via *
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <label
                    className={`
                  flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5
                  ${form.sendEmail
                        ? "border-blue-200 bg-blue-50"
                        : "border-gray-200 bg-white"
                      }
                `}
                  >
                    <input
                      type="checkbox"
                      checked={form.sendEmail}
                      onChange={event =>
                        updateField("sendEmail", event.target.checked)
                      }
                      disabled={saving}
                    />

                    <Mail size={15} className="text-blue-700" />

                    <span className="text-sm font-medium text-gray-800">
                      Email
                    </span>
                  </label>

                  <label
                    className={`
                  flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5
                  ${form.sendWhatsapp
                        ? "border-green-200 bg-green-50"
                        : "border-gray-200 bg-white"
                      }
                `}
                  >
                    <input
                      type="checkbox"
                      checked={form.sendWhatsapp}
                      onChange={event =>
                        updateField("sendWhatsapp", event.target.checked)
                      }
                      disabled={saving}
                    />

                    <MessageCircle size={15} className="text-green-700" />

                    <span className="text-sm font-medium text-gray-800">
                      WhatsApp
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* SELECTED VENDOR INFO */}
            {selectedVendor && !selectedVendorAlreadyRequested && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                  <p className="text-[11px] font-semibold text-gray-400">
                    Email
                  </p>

                  <p className="truncate text-xs text-gray-700">
                    {getVendorEmail(selectedVendor) || "Email missing"}
                  </p>
                </div>

                <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                  <p className="text-[11px] font-semibold text-gray-400">
                    WhatsApp / Mobile
                  </p>

                  <p className="truncate text-xs text-gray-700">
                    {getVendorMobile(selectedVendor) || "Number missing"}
                  </p>
                </div>
              </div>
            )}

            {/* SUBJECT */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-500">
                Subject
              </label>

              <input
                value={form.requirementSubject}
                onChange={event =>
                  updateField("requirementSubject", event.target.value)
                }
                placeholder="Travel requirement for quotation"
                disabled={saving}
                className="
              w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm
              focus:outline-none focus:ring-2 focus:ring-purple-500
              disabled:bg-gray-100
            "
              />
            </div>

            {/* TRAVEL SNAPSHOT */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-500">
                  Travel Dates
                </label>

                <input
                  value={form.travelDates}
                  onChange={event =>
                    updateField("travelDates", event.target.value)
                  }
                  placeholder="Example: 20 Jul - 25 Jul 2026"
                  disabled={saving}
                  className="
        w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm
        focus:outline-none focus:ring-2 focus:ring-purple-500
        disabled:bg-gray-100
      "
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-500">
                  Pax Details
                </label>

                <input
                  value={form.paxText}
                  onChange={event =>
                    updateField("paxText", event.target.value)
                  }
                  placeholder="Example: 2 Adults + 1 Child"
                  disabled={saving}
                  className="
        w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm
        focus:outline-none focus:ring-2 focus:ring-purple-500
        disabled:bg-gray-100
      "
                />
              </div>
            </div>

            {/* RESPONSE TIMELINE */}
            <VendorResponseTimelineFields
              expectedTat={expectedTat}
              setExpectedTat={setExpectedTat}
              expectedReplyBy={expectedReplyBy}
              setExpectedReplyBy={setExpectedReplyBy}
              autoFollowUpFromExpectedReply={autoFollowUpFromExpectedReply}
              setAutoFollowUpFromExpectedReply={
                setAutoFollowUpFromExpectedReply
              }
            />

            {/* RICH REQUIREMENT */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-500">
                Requirement Details *
              </label>

              <RichTextEditor
                value={form.requirementHtml}
                disabled={saving}
                placeholder="Enter vendor requirement details..."
                onChange={html => updateField("requirementHtml", html)}
              />

              <p className="mt-1.5 text-xs text-gray-400">
                This content will be used for vendor email. Plain text is auto-generated for WhatsApp.
              </p>
            </div>

            {/* ADVANCED FOLLOW-UP */}
            <details className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <summary className="cursor-pointer text-sm font-bold text-gray-900">
                Advanced Follow-up
              </summary>

              <div className="mt-4">
                <label className="mb-1.5 block text-xs font-semibold text-gray-500">
                  Manual Next Vendor Follow-up
                </label>

                <input
                  type="datetime-local"
                  value={form.nextFollowUpAt}
                  onChange={event =>
                    updateField("nextFollowUpAt", event.target.value)
                  }
                  disabled={saving || autoFollowUpFromExpectedReply}
                  className="
                w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm
                focus:outline-none focus:ring-2 focus:ring-purple-500
                disabled:bg-gray-100 disabled:text-gray-400
              "
                />

                {autoFollowUpFromExpectedReply && (
                  <p className="mt-1.5 text-xs text-gray-400">
                    Manual follow-up is disabled because auto follow-up is linked with Expected Reply By.
                  </p>
                )}
              </div>
            </details>
          </div>

          {/* FOOTER */}
          <div className="shrink-0 border-t border-gray-100 bg-white px-5 py-4">
            <div className="flex flex-col justify-end gap-3 sm:flex-row">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={!canSubmit}
                className="
              inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600
              px-5 py-2.5 text-sm font-semibold text-white hover:bg-purple-700
              disabled:cursor-not-allowed disabled:opacity-50
            "
              >
                {saving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}

                {saving ? "Sending..." : "Send Request"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}