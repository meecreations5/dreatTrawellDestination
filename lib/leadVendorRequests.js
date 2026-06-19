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
  Phone,
  Pilcrow,
  Send,
  Underline,
  UserRound,
  X
} from "lucide-react";

import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
// import createLeadVendorRequest from "@/lib/leadVendorRequests";

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

function getVendorContactPerson(vendor) {
  return (
    cleanString(vendor?.contactPerson) ||
    cleanString(vendor?.contactName) ||
    cleanString(vendor?.spocName) ||
    "Not added"
  );
}

function getVendorEmail(vendor) {
  return cleanString(
    vendor?.email ||
      vendor?.vendorEmail ||
      vendor?.contactEmail ||
      vendor?.officialEmail
  );
}

function getVendorMobile(vendor) {
  return cleanString(
    vendor?.whatsapp ||
      vendor?.mobile ||
      vendor?.phone ||
      vendor?.contactNumber ||
      vendor?.vendorMobile
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

  const hotelCategory =
    cleanString(lead?.hotelCategory) ||
    cleanString(lead?.starCategory) ||
    cleanString(lead?.category);

  const mealPlan =
    cleanString(lead?.mealPlan) ||
    cleanString(lead?.meal);

  const roomRequirement =
    cleanString(lead?.roomRequirement) ||
    cleanString(lead?.rooms) ||
    cleanString(lead?.roomType);

  const lines = [
    destination ? `Destination: ${destination}` : "",
    travelDate ? `Travel Date: ${travelDate}` : "",
    nights ? `Nights / Duration: ${nights}` : "",
    pax ? `Pax: ${pax}` : "",
    hotelCategory ? `Hotel Category: ${hotelCategory}` : "",
    mealPlan ? `Meal Plan: ${mealPlan}` : "",
    roomRequirement ? `Room Requirement: ${roomRequirement}` : "",
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

function ToolbarButton({ icon: Icon, label, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className="
        h-8 min-w-8 inline-flex items-center justify-center
        rounded-lg border border-gray-200 bg-white px-2
        text-gray-600 hover:bg-gray-50 hover:text-gray-900
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
  onClose,
  onCreated
}) {
  const { user } = useAuth(true);

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
    nextFollowUpAt: ""
  });

  /* =========================
     SYNC DEFAULT REQUIREMENT
  ========================== */

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

  const selectedVendorEmail = getVendorEmail(selectedVendor);
  const selectedVendorMobile = getVendorMobile(selectedVendor);

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

    setNotice("");
    setNoticeType("error");

    const safeRequirementHtml = sanitizeHtml(form.requirementHtml);
    const safeRequirementText = htmlToText(safeRequirementHtml);

    if (!leadId) {
      setNotice("Lead ID is missing.");
      return;
    }

    if (!form.vendorId) {
      setNotice("Please select vendor.");
      return;
    }

    if (selectedVendorAlreadyRequested) {
      setNoticeType("warning");
      setNotice(
        `Quote request already sent to ${
          existingRequestForSelectedVendor?.vendorName ||
          getVendorName(selectedVendor)
        } for this lead. Please use Follow Up, Add Pricing, or View Quotes instead.`
      );
      return;
    }

    if (!cleanString(safeRequirementText)) {
      setNotice("Please enter requirement details.");
      return;
    }

    if (sendVia.length === 0) {
      setNotice("Please select at least one sending option.");
      return;
    }

    setSaving(true);

    try {
      const result = await createLeadVendorRequest({
        leadId,
        vendorId: form.vendorId,

        requirementSubject:
          cleanString(form.requirementSubject) ||
          "Travel requirement for quotation",

        requirementHtml: safeRequirementHtml,
        requirementText: safeRequirementText,

        sendVia,

        nextFollowUpAt: form.nextFollowUpAt || null,

        user
      });

      setNoticeType("success");
      setNotice("Vendor quote request sent successfully.");

      onCreated?.(result);
      onClose?.();
    } catch (error) {
      if (
        error?.code === "duplicate_vendor_request" ||
        error?.name === "DuplicateVendorRequestError"
      ) {
        setNoticeType("warning");
        setNotice(
          error?.message ||
            "Quote request already sent to this vendor for this lead. Please use Follow Up, Add Pricing, or View Quotes instead."
        );

        return;
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
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-3xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
        {/* HEADER */}
        <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-blue-50">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Send Vendor Quote Request
              </h2>

              <p className="text-xs text-gray-500 mt-1">
                Select vendor, confirm contact details, and send formatted requirement.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="h-9 w-9 rounded-xl border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:text-gray-900"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* NOTICE */}
          {notice && (
            <div
              className={`
                rounded-xl border px-4 py-3 text-sm flex items-start gap-2
                ${
                  noticeType === "success"
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

          {/* VENDOR */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">
              Vendor *
            </label>

            <select
              value={form.vendorId}
              disabled={saving || loadingVendors}
              onChange={event =>
                updateField("vendorId", event.target.value)
              }
              className="
                w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm
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
              <p className="text-xs text-gray-400 mt-1.5">
                Checking existing vendor requests...
              </p>
            )}

            {selectedVendorAlreadyRequested && (
              <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Quote request already sent to this vendor for this lead.
                Please use Follow Up, Add Pricing, or View Quotes instead.
              </div>
            )}

            {selectedVendor && !selectedVendorAlreadyRequested && (
              <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                      Sending To
                    </p>

                    <h4 className="text-sm font-semibold text-gray-900 mt-1">
                      {getVendorName(selectedVendor)}
                      {selectedVendor.vendorCode ? (
                        <span className="ml-1 text-xs font-medium text-gray-500">
                          ({selectedVendor.vendorCode})
                        </span>
                      ) : null}
                    </h4>
                  </div>

                  <span className="rounded-full bg-white border border-blue-100 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                    Vendor Contact
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-xl bg-white border border-blue-100 px-3 py-2.5">
                    <div className="flex items-center gap-2 text-[11px] font-semibold text-gray-400">
                      <UserRound size={13} />
                      Contact Person
                    </div>

                    <p className="mt-1 text-sm font-medium text-gray-800 truncate">
                      {getVendorContactPerson(selectedVendor)}
                    </p>
                  </div>

                  <div className="rounded-xl bg-white border border-blue-100 px-3 py-2.5">
                    <div className="flex items-center gap-2 text-[11px] font-semibold text-gray-400">
                      <Mail size={13} />
                      Email ID
                    </div>

                    <p
                      className={`mt-1 text-sm font-medium truncate ${
                        selectedVendorEmail
                          ? "text-gray-800"
                          : "text-amber-700"
                      }`}
                    >
                      {selectedVendorEmail || "Email missing"}
                    </p>
                  </div>

                  <div className="rounded-xl bg-white border border-blue-100 px-3 py-2.5">
                    <div className="flex items-center gap-2 text-[11px] font-semibold text-gray-400">
                      <Phone size={13} />
                      Mobile / WhatsApp
                    </div>

                    <p
                      className={`mt-1 text-sm font-medium truncate ${
                        selectedVendorMobile
                          ? "text-gray-800"
                          : "text-amber-700"
                      }`}
                    >
                      {selectedVendorMobile || "Number missing"}
                    </p>
                  </div>
                </div>

                {(!selectedVendorEmail || !selectedVendorMobile) && (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    {!selectedVendorEmail && !selectedVendorMobile
                      ? "Vendor email and mobile number are missing. Email/WhatsApp may not be sent."
                      : !selectedVendorEmail
                        ? "Vendor email is missing. Email will not be sent."
                        : "Vendor mobile/WhatsApp number is missing. WhatsApp message cannot be prepared."}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SUBJECT */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">
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
                w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm
                focus:outline-none focus:ring-2 focus:ring-purple-500
                disabled:bg-gray-100
              "
            />
          </div>

          {/* RICH REQUIREMENT */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">
              Requirement Details *
            </label>

            <RichTextEditor
              value={form.requirementHtml}
              disabled={saving}
              placeholder="Enter vendor requirement details..."
              onChange={html => updateField("requirementHtml", html)}
            />

            <p className="text-xs text-gray-400 mt-1.5">
              HTML content will be used in email. Plain text is auto-generated for WhatsApp.
              Travel agent name/code is not sent to vendor.
            </p>
          </div>

          {/* SEND VIA */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-2">
              Send Via *
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                className={`
                  flex items-center gap-3 rounded-xl border p-3 cursor-pointer
                  ${
                    form.sendEmail
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

                <Mail size={16} className="text-blue-700" />

                <span className="text-sm font-medium text-gray-800">
                  Email
                </span>
              </label>

              <label
                className={`
                  flex items-center gap-3 rounded-xl border p-3 cursor-pointer
                  ${
                    form.sendWhatsapp
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

                <MessageCircle size={16} className="text-green-700" />

                <span className="text-sm font-medium text-gray-800">
                  WhatsApp
                </span>
              </label>
            </div>
          </div>

          {/* NEXT FOLLOW UP */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">
              Next Vendor Follow-up
            </label>

            <input
              type="datetime-local"
              value={form.nextFollowUpAt}
              onChange={event =>
                updateField("nextFollowUpAt", event.target.value)
              }
              disabled={saving}
              className="
                w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm
                focus:outline-none focus:ring-2 focus:ring-purple-500
                disabled:bg-gray-100
              "
            />
          </div>

          {/* FOOTER */}
          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={!canSubmit}
              className="
                inline-flex items-center justify-center gap-2
                px-5 py-2.5 rounded-xl bg-purple-600 text-white
                text-sm font-semibold hover:bg-purple-700
                disabled:opacity-50 disabled:cursor-not-allowed
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
        </form>
      </div>
    </div>
  );
}