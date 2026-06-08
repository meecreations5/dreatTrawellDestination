"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { collection, getDocs } from "firebase/firestore";

import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";

import { sendEmailViaBrevo } from "@/lib/sendEmailViaBrevo";
import { sendWhatsAppWeb } from "@/lib/whatsapp";
import { createQuotationRevision } from "@/lib/createQuotationRevision";
import { getCommunicationSettings } from "@/lib/communicationSettings";

import SelectableChip from "@/components/ui/SelectableChip";

import {
  buildEmailSignatureHtml,
  buildWhatsAppSignatureText,
  escapeHtml,
  getFirstValue,
  getMemberEmail,
  getMemberMobile,
  getMemberName,
  getMemberRole,
  getMemberUid
} from "@/lib/signatureUtils";

const inputClass = `
  w-full border border-gray-200 rounded-lg
  px-3 py-2 text-sm bg-white
  focus:outline-none focus:ring-2 focus:ring-blue-100
`;

/* =========================
   HTML EDITOR HELPERS
========================= */
function stripHtml(html = "") {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, "")
    .trim();
}

function formatCurrency(value) {
  const amount = Number(value || 0);

  if (!Number.isFinite(amount)) return "₹0";

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(amount);
}

function convertPlainTextToHtml(text = "") {
  const trimmed = text.trimEnd();

  if (!trimmed) return "";

  if (trimmed.includes("\t")) {
    const rows = trimmed.split(/\r?\n/).map(row => row.split("\t"));

    return `
      <table>
        <tbody>
          ${rows
            .map(
              row => `
                <tr>
                  ${row
                    .map(
                      cell => `<td>${escapeHtml(cell) || "&nbsp;"}</td>`
                    )
                    .join("")}
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    `;
  }

  return escapeHtml(trimmed).replace(/\r?\n/g, "<br />");
}

function cleanStyle(styleValue = "") {
  const allowedStyleProps = new Set([
    "background",
    "background-color",
    "color",
    "font-weight",
    "font-style",
    "font-size",
    "font-family",
    "text-decoration",
    "text-align",
    "vertical-align",
    "border",
    "border-top",
    "border-right",
    "border-bottom",
    "border-left",
    "border-color",
    "border-width",
    "border-style",
    "border-collapse",
    "padding",
    "padding-top",
    "padding-right",
    "padding-bottom",
    "padding-left",
    "margin",
    "margin-top",
    "margin-right",
    "margin-bottom",
    "margin-left",
    "width",
    "min-width",
    "max-width",
    "height",
    "line-height",
    "white-space"
  ]);

  return styleValue
    .split(";")
    .map(rule => rule.trim())
    .filter(Boolean)
    .map(rule => {
      const [rawProp, ...rawValue] = rule.split(":");
      const prop = rawProp?.trim().toLowerCase();
      const value = rawValue.join(":").trim();

      if (!prop || !value) return "";
      if (!allowedStyleProps.has(prop)) return "";
      if (/javascript:|expression\(|url\(/i.test(value)) return "";

      return `${prop}: ${value}`;
    })
    .filter(Boolean)
    .join("; ");
}

function inlineClassStyles(doc) {
  const styleText = Array.from(doc.querySelectorAll("style"))
    .map(style => style.textContent || "")
    .join("\n")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  if (!styleText) return;

  const classStyleMap = {};
  const ruleRegex = /\.([a-zA-Z0-9_-]+)\s*\{([^}]+)\}/g;

  let match;

  while ((match = ruleRegex.exec(styleText))) {
    const className = match[1];
    const cssBody = cleanStyle(match[2]);

    if (cssBody) {
      classStyleMap[className] = cssBody;
    }
  }

  Object.entries(classStyleMap).forEach(([className, cssBody]) => {
    doc.querySelectorAll(`.${className}`).forEach(element => {
      const existing = element.getAttribute("style") || "";
      element.setAttribute("style", `${existing}; ${cssBody}`);
    });
  });
}

function sanitizeHtml(htmlString = "") {
  if (typeof window === "undefined") return htmlString;

  const allowedTags = new Set([
    "table",
    "thead",
    "tbody",
    "tfoot",
    "tr",
    "td",
    "th",
    "colgroup",
    "col",
    "p",
    "div",
    "span",
    "br",
    "b",
    "strong",
    "i",
    "em",
    "u",
    "ul",
    "ol",
    "li",
    "h1",
    "h2",
    "h3",
    "h4",
    "a"
  ]);

  const allowedAttrs = new Set([
    "style",
    "colspan",
    "rowspan",
    "width",
    "height",
    "align",
    "valign",
    "href",
    "target"
  ]);

  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, "text/html");

  inlineClassStyles(doc);

  function unwrapNode(node) {
    const parent = node.parentNode;
    if (!parent) return;

    while (node.firstChild) {
      parent.insertBefore(node.firstChild, node);
    }

    parent.removeChild(node);
  }

  function sanitizeNode(node) {
    if (node.nodeType === 8) {
      node.remove();
      return;
    }

    if (node.nodeType !== 1) return;

    const element = node;
    const tagName = element.tagName.toLowerCase();

    Array.from(element.childNodes).forEach(sanitizeNode);

    if (!allowedTags.has(tagName)) {
      unwrapNode(element);
      return;
    }

    Array.from(element.attributes).forEach(attr => {
      const attrName = attr.name.toLowerCase();
      const attrValue = attr.value;

      if (attrName.startsWith("on")) {
        element.removeAttribute(attr.name);
        return;
      }

      if (!allowedAttrs.has(attrName)) {
        element.removeAttribute(attr.name);
        return;
      }

      if (attrName === "style") {
        const cleaned = cleanStyle(attrValue);

        if (cleaned) {
          element.setAttribute("style", cleaned);
        } else {
          element.removeAttribute("style");
        }

        return;
      }

      if (attrName === "href" && /^javascript:/i.test(attrValue)) {
        element.removeAttribute(attr.name);
      }
    });

    element.removeAttribute("class");
    element.removeAttribute("id");
  }

  Array.from(doc.body.childNodes).forEach(sanitizeNode);

  return doc.body.innerHTML;
}

function addStyleIfMissing(element, property, value) {
  const currentStyle = element.getAttribute("style") || "";
  const hasProperty = new RegExp(`(^|;)\\s*${property}\\s*:`, "i").test(
    currentStyle
  );

  if (!hasProperty) {
    element.setAttribute(
      "style",
      `${currentStyle}; ${property}: ${value}`.trim()
    );
  }
}

function prepareQuotationHtmlForEmail(rawHtml = "") {
  if (typeof window === "undefined") return rawHtml;

  const cleanHtml = sanitizeHtml(rawHtml);
  const parser = new DOMParser();
  const doc = parser.parseFromString(cleanHtml, "text/html");

  doc.querySelectorAll("table").forEach(table => {
    addStyleIfMissing(table, "border-collapse", "collapse");
    addStyleIfMissing(table, "width", "100%");
  });

  doc.querySelectorAll("td, th").forEach(cell => {
    addStyleIfMissing(cell, "border", "1px solid #d1d5db");
    addStyleIfMissing(cell, "padding", "6px 8px");
    addStyleIfMissing(cell, "vertical-align", "top");
  });

  return doc.body.innerHTML;
}

function isInternalUser(member) {
  const role = String(member?.role || "").toLowerCase();

  const inactive =
    member?.disabled ||
    member?.isDisabled ||
    member?.deleted ||
    member?.isDeleted ||
    member?.status === "inactive";

  const excludedRoles = [
    "customer",
    "client",
    "vendor",
    "travel_agent",
    "travel-agent"
  ];

  return !inactive && !excludedRoles.includes(role);
}

/* =========================
   COMPONENT
========================= */
export default function QuotationEditor({ lead, onClose }) {
  const { user } = useAuth();
  const editorRef = useRef(null);

  const isAdminCreator = ["admin", "super_admin"].includes(user?.role);

  const [teamMembers, setTeamMembers] = useState([]);
  const [selectedSignatureUid, setSelectedSignatureUid] = useState("");

  const [html, setHtml] = useState("");
  const [customerQuotedAmount, setCustomerQuotedAmount] = useState("");
  const [vendorCost, setVendorCost] = useState("");
  const [note, setNote] = useState("");
  const [isFinalQuotation, setIsFinalQuotation] = useState(false);

  const recipient = useMemo(() => {
    const name = getFirstValue(
      lead?.spoc?.name,
      lead?.customerName,
      lead?.travellerName,
      lead?.guestName,
      lead?.contactName,
      lead?.customer?.name
    );

    const email = getFirstValue(
      lead?.spoc?.email,
      lead?.email,
      lead?.customerEmail,
      lead?.customer?.email
    );

    const mobile = getFirstValue(
      lead?.spoc?.mobile,
      lead?.mobile,
      lead?.phone,
      lead?.contactNumber,
      lead?.customerMobile,
      lead?.customer?.mobile
    );

    return {
      name,
      email,
      mobile
    };
  }, [lead]);

  const [sendEmail, setSendEmail] = useState(Boolean(recipient.email));
  const [sendWhatsApp, setSendWhatsApp] = useState(
    !recipient.email && Boolean(recipient.mobile)
  );
  const [saving, setSaving] = useState(false);

  /* =========================
     LOAD TEAM PROFILE SIGNATURES
  ========================== */
  useEffect(() => {
    let mounted = true;

    async function loadTeamMembers() {
      if (!user) return;

      try {
        const snap = await getDocs(collection(db, "users"));

        const rows = snap.docs
          .map(docSnap => ({
            id: docSnap.id,
            uid: docSnap.id,
            ...docSnap.data()
          }))
          .filter(isInternalUser);

        if (mounted) {
          setTeamMembers(rows);
        }
      } catch (error) {
        console.error("Failed to load team signatures:", error);
      }
    }

    loadTeamMembers();

    return () => {
      mounted = false;
    };
  }, [user]);

  const currentUserOption = useMemo(() => {
    const uid = user?.uid || user?.id || user?.email;

    const savedUserProfile = teamMembers.find(
      member => getMemberUid(member) === uid
    );

    if (savedUserProfile) return savedUserProfile;

    return {
      id: uid,
      uid,
      displayName: user?.displayName || user?.name || user?.email,
      name: user?.name || user?.displayName || user?.email,
      email: user?.email,
      mobile: user?.mobile || user?.phone,
      role: user?.role,
      designation: user?.designation,
      signatureHtml: user?.signatureHtml,
      emailSignatureHtml: user?.emailSignatureHtml,
      whatsappSignature: user?.whatsappSignature,
      signatureText: user?.signatureText,
      signatureEnabled: user?.signatureEnabled
    };
  }, [user, teamMembers]);

  const signatureOptions = useMemo(() => {
    const map = new Map();

    [...teamMembers, currentUserOption].forEach(member => {
      const uid = getMemberUid(member);

      if (uid && !map.has(uid)) {
        map.set(uid, member);
      }
    });

    return Array.from(map.values()).sort((a, b) =>
      getMemberName(a).localeCompare(getMemberName(b))
    );
  }, [teamMembers, currentUserOption]);

  useEffect(() => {
    if (!user || !signatureOptions.length || selectedSignatureUid) return;

    if (!isAdminCreator) {
      setSelectedSignatureUid(user.uid || user.id || user.email || "");
      return;
    }

    const assignedUid = getFirstValue(
      lead?.assignedTo,
      lead?.assignedToUid,
      lead?.teamLeadUid,
      lead?.ownerUid
    );

    const assignedMember = signatureOptions.find(
      member => getMemberUid(member) === assignedUid
    );

    if (assignedMember) {
      setSelectedSignatureUid(getMemberUid(assignedMember));
    }
  }, [
    user,
    lead,
    isAdminCreator,
    signatureOptions,
    selectedSignatureUid
  ]);

  const selectedSignatureUser = useMemo(() => {
    if (!selectedSignatureUid) return null;

    return (
      signatureOptions.find(
        member => getMemberUid(member) === selectedSignatureUid
      ) || null
    );
  }, [signatureOptions, selectedSignatureUid]);

  if (!user || !lead) return null;

  const hasEmail = Boolean(recipient.email);
  const hasWhatsApp = Boolean(recipient.mobile);
  const isEditorEmpty = !stripHtml(html);

  const customerAmountNumber = Number(customerQuotedAmount || 0);
  const vendorCostNumber = Number(vendorCost || 0);

  const grossProfit =
    vendorCost && Number.isFinite(vendorCostNumber)
      ? customerAmountNumber - vendorCostNumber
      : null;

  const syncEditorHtml = () => {
    setHtml(editorRef.current?.innerHTML || "");
  };

  const insertHtmlAtCursor = insertHtml => {
    const editor = editorRef.current;
    if (!editor) return;

    editor.focus();

    const selection = window.getSelection();

    if (!selection || !selection.rangeCount) {
      editor.insertAdjacentHTML("beforeend", insertHtml);
      syncEditorHtml();
      return;
    }

    const range = selection.getRangeAt(0);

    if (!editor.contains(range.commonAncestorContainer)) {
      editor.insertAdjacentHTML("beforeend", insertHtml);
      syncEditorHtml();
      return;
    }

    range.deleteContents();

    const template = document.createElement("template");
    template.innerHTML = insertHtml;

    const fragment = template.content;
    const lastNode = fragment.lastChild;

    range.insertNode(fragment);

    if (lastNode) {
      const nextRange = document.createRange();
      nextRange.setStartAfter(lastNode);
      nextRange.collapse(true);

      selection.removeAllRanges();
      selection.addRange(nextRange);
    }

    syncEditorHtml();
  };

  const handlePaste = event => {
    event.preventDefault();

    const clipboardHtml = event.clipboardData.getData("text/html");
    const clipboardText = event.clipboardData.getData("text/plain");

    if (clipboardHtml) {
      insertHtmlAtCursor(sanitizeHtml(clipboardHtml));
      return;
    }

    if (clipboardText) {
      insertHtmlAtCursor(convertPlainTextToHtml(clipboardText));
    }
  };

  const submit = async () => {
    if (saving) return;

    const rawEditorHtml = editorRef.current?.innerHTML || html;
    const cleanText = stripHtml(rawEditorHtml);

    if (!cleanText) {
      alert("Itinerary is required");
      return;
    }

    if (
      !customerQuotedAmount ||
      !Number.isFinite(customerAmountNumber) ||
      customerAmountNumber <= 0
    ) {
      alert("Valid internal quotation amount is required");
      return;
    }

    if (
      vendorCost &&
      (!Number.isFinite(vendorCostNumber) || vendorCostNumber < 0)
    ) {
      alert("Valid vendor cost is required");
      return;
    }

    if (!sendEmail && !sendWhatsApp) {
      alert("Select at least one channel");
      return;
    }

    if (sendEmail && !hasEmail) {
      alert("Email address is not available");
      return;
    }

    if (sendWhatsApp && !hasWhatsApp) {
      alert("WhatsApp number is not available");
      return;
    }

    if (isAdminCreator && !selectedSignatureUser) {
      alert("Please select team member signature");
      return;
    }

    const signatureUser = selectedSignatureUser || currentUserOption;

    if (signatureUser?.signatureEnabled === false) {
      alert("Selected team member signature is inactive");
      return;
    }

    setSaving(true);

    try {
      const itineraryHtml = prepareQuotationHtmlForEmail(rawEditorHtml);

      const emailSignatureHtml = buildEmailSignatureHtml(signatureUser);
      const whatsappSignatureText = buildWhatsAppSignatureText(signatureUser);

      const sendVia = [
        sendEmail ? "email" : null,
        sendWhatsApp ? "whatsapp" : null
      ].filter(Boolean);

      const quotationResult = await createQuotationRevision({
        leadId: lead.id,
        itineraryHtml,

        // Internal values only. These are not added to email or WhatsApp.
        totalPrice: customerAmountNumber,
        customerQuotedAmount: customerAmountNumber,
        vendorCost: vendorCost ? vendorCostNumber : null,
        grossProfit,
        pricingVisibleToCustomer: false,

        note,
        sendVia,
        isFinalQuotation,

        signatureUser: {
          uid: getMemberUid(signatureUser),
          name: getMemberName(signatureUser),
          email: getMemberEmail(signatureUser),
          mobile: getMemberMobile(signatureUser),
          role: getMemberRole(signatureUser),
          signatureHtml: emailSignatureHtml,
          signatureText: whatsappSignatureText
        },

        user
      });

      const revision =
        typeof quotationResult === "object"
          ? quotationResult?.revision
          : quotationResult;

      const subject = `Quotation ${lead.leadCode || ""}${
        revision ? ` (Rev ${revision})` : ""
      }`;

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
          <p style="margin: 0 0 12px;">
            Dear ${escapeHtml(recipient.name || "Guest")},
          </p>

          <p style="margin: 0 0 16px;">
            Greetings from DreamTrawell.
          </p>

          <p style="margin: 0 0 16px;">
            Please find below the quotation details for your travel enquiry.
          </p>

          <div style="margin: 16px 0;">
            ${itineraryHtml}
          </div>

          ${emailSignatureHtml}
        </div>
      `;

      let communicationSettings = {
        quotationManagementBcc: [],
        quotationCcSelectedTeamMember: true,
        quotationBccManagement: false
      };

      try {
        communicationSettings = await getCommunicationSettings();
      } catch (error) {
        console.warn("Communication settings not found:", error);
      }

      const selectedTeamEmail = getMemberEmail(signatureUser);
      const selectedTeamName = getMemberName(signatureUser);

      const cc = [];

      if (
        sendEmail &&
        communicationSettings.quotationCcSelectedTeamMember &&
        selectedTeamEmail
      ) {
        cc.push({
          email: selectedTeamEmail,
          name: selectedTeamName
        });
      }

      const bcc =
        sendEmail && communicationSettings.quotationBccManagement
          ? (communicationSettings.quotationManagementBcc || []).map(email => ({
              email
            }))
          : [];

      if (sendEmail && hasEmail) {
        await sendEmailViaBrevo({
          toEmail: recipient.email,
          toName: recipient.name || "Guest",
          subject,
          html: emailHtml,
          cc,
          bcc,
          replyTo: selectedTeamEmail
            ? {
                email: selectedTeamEmail,
                name: selectedTeamName
              }
            : null
        });
      }

      if (sendWhatsApp && hasWhatsApp) {
        const whatsappMessage = [
          `Dear ${recipient.name || "Guest"},`,
          "",
          "Greetings from DreamTrawell.",
          "",
          `Your quotation for ${
            lead.destinationName || "your travel enquiry"
          } has been prepared.`,
          lead.leadCode || revision
            ? `Quotation Ref: ${[
                lead.leadCode || "",
                revision ? `Rev ${revision}` : ""
              ]
                .filter(Boolean)
                .join(" / ")}`
            : "",
          "",
          "Please review the itinerary details shared with you and let us know if you would like any changes.",
          "",
          whatsappSignatureText
        ]
          .filter(Boolean)
          .join("\n");

        sendWhatsAppWeb({
          mobile: recipient.mobile,
          message: whatsappMessage
        });
      }

      onClose();
    } catch (error) {
      console.error("Quotation send failed:", error);
      alert(error?.message || "Failed to create quotation. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white max-w-5xl w-full rounded-xl flex flex-col max-h-[90vh]">

        {/* HEADER */}
        <div className="p-6 border-b">
          <h2 className="text-sm font-semibold text-gray-900">
            Create Quotation
          </h2>

          <p className="text-xs text-gray-500 mt-1">
            {lead.leadCode || "Lead"}{" "}
            {lead.destinationName ? `• ${lead.destinationName}` : ""}
          </p>
        </div>

        {/* CONTENT */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">

          {/* RECIPIENT */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">
              Recipient
            </p>

            <p className="text-sm font-medium text-gray-900">
              {recipient.name || "—"}
            </p>

            <div className="text-xs text-gray-600 mt-1 space-y-0.5">
              <p>📧 {recipient.email || "Email not available"}</p>
              <p>📱 {recipient.mobile || "Mobile not available"}</p>
            </div>
          </div>

          {/* SIGNATURE */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-2">
            <p className="text-xs text-gray-500">
              Communication Signature
            </p>

            {isAdminCreator ? (
              <select
                value={selectedSignatureUid}
                onChange={e => setSelectedSignatureUid(e.target.value)}
                className={inputClass}
              >
                <option value="">Select team member signature</option>

                {signatureOptions.map(member => {
                  const uid = getMemberUid(member);

                  return (
                    <option key={uid} value={uid}>
                      {getMemberName(member)}
                      {getMemberRole(member)
                        ? ` — ${getMemberRole(member)}`
                        : ""}
                    </option>
                  );
                })}
              </select>
            ) : (
              <div className="text-sm text-gray-800">
                {getMemberName(currentUserOption) || "Current User"}
              </div>
            )}

            <p className="text-xs text-gray-500">
              This signature comes from profile management and will be added in
              email and WhatsApp communication.
            </p>

            {selectedSignatureUser && (
              <div className="text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-md p-3">
                <p className="font-medium text-gray-800">
                  {getMemberName(selectedSignatureUser)}
                </p>
                <p>{getMemberRole(selectedSignatureUser) || "—"}</p>
                <p>{getMemberEmail(selectedSignatureUser) || "Email not set"}</p>
                <p>{getMemberMobile(selectedSignatureUser) || "Mobile not set"}</p>
              </div>
            )}
          </div>

          {/* EDITOR */}
          <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
            <div className="border-b border-gray-100 px-4 py-2 bg-gray-50">
              <p className="text-xs text-gray-500">
                Paste itinerary from Excel / Google Sheets. Tables, columns,
                borders and cell background colors will be preserved.
              </p>
            </div>

            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              role="textbox"
              aria-multiline="true"
              data-empty={isEditorEmpty ? "true" : "false"}
              data-placeholder="Write itinerary, inclusions, exclusions, hotel details, payment terms..."
              onInput={syncEditorHtml}
              onPaste={handlePaste}
              className="quotation-html-editor min-h-[260px] p-4 text-sm outline-none overflow-x-auto"
            />
          </div>

          {/* INTERNAL COMMERCIALS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                className={inputClass}
                placeholder="Quotation Amount - Internal Only (₹)"
                value={customerQuotedAmount}
                onChange={e => setCustomerQuotedAmount(e.target.value)}
              />

              <p className="text-[11px] text-gray-500 mt-1">
                Saved internally only. It will not go in email or WhatsApp.
              </p>
            </div>

            <div>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                className={inputClass}
                placeholder="Vendor Cost - Internal Only (₹)"
                value={vendorCost}
                onChange={e => setVendorCost(e.target.value)}
              />

              <p className="text-[11px] text-gray-500 mt-1">
                Vendor cost is internal and never shared with customer.
              </p>
            </div>
          </div>

          {(customerQuotedAmount || vendorCost) && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-700">
              <div className="flex flex-wrap gap-4">
                <span>
                  Quote: <b>{formatCurrency(customerAmountNumber)}</b>
                </span>

                <span>
                  Vendor Cost:{" "}
                  <b>{vendorCost ? formatCurrency(vendorCostNumber) : "—"}</b>
                </span>

                <span>
                  Gross Profit:{" "}
                  <b>
                    {grossProfit === null
                      ? "—"
                      : formatCurrency(grossProfit)}
                  </b>
                </span>
              </div>
            </div>
          )}

          {/* FINAL QUOTATION */}
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={isFinalQuotation}
              onChange={e => setIsFinalQuotation(e.target.checked)}
              className="rounded border-gray-300"
            />

            Mark this as final quotation
          </label>

          {/* NOTE */}
          <textarea
            className={inputClass}
            rows={2}
            placeholder="Internal note"
            value={note}
            onChange={e => setNote(e.target.value)}
          />

          {/* CHANNELS */}
          <div className="space-y-2">
            <p className="text-xs text-gray-500">
              Send quotation via
            </p>

            <div className="flex flex-wrap gap-2">
              <SelectableChip
                label="Email"
                selected={sendEmail}
                disabled={!hasEmail}
                onClick={() => {
                  if (hasEmail) setSendEmail(value => !value);
                }}
              />

              <SelectableChip
                label="WhatsApp"
                selected={sendWhatsApp}
                disabled={!hasWhatsApp}
                onClick={() => {
                  if (hasWhatsApp) setSendWhatsApp(value => !value);
                }}
              />
            </div>
          </div>

          {!hasEmail && !hasWhatsApp && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-700">
              Email and WhatsApp are not available for this lead. Please update
              the customer or SPOC contact details before sending quotation.
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="flex gap-2 p-6 border-t">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 border border-gray-200 rounded-md py-2 text-sm disabled:opacity-60"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={submit}
            disabled={saving || (!hasEmail && !hasWhatsApp)}
            className="flex-1 bg-blue-600 text-white rounded-md py-2 text-sm disabled:opacity-60"
          >
            {saving ? "Sending..." : "Send Quotation"}
          </button>
        </div>
      </div>

      <style jsx global>{`
        .quotation-html-editor:focus {
          box-shadow: inset 0 0 0 2px rgba(59, 130, 246, 0.12);
        }

        .quotation-html-editor[data-empty="true"]::before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
          display: block;
        }

        .quotation-html-editor table {
          border-collapse: collapse;
          max-width: 100%;
          margin: 8px 0;
        }

        .quotation-html-editor td,
        .quotation-html-editor th {
          border: 1px solid #d1d5db;
          padding: 6px 8px;
          min-width: 80px;
          vertical-align: top;
        }

        .quotation-html-editor th {
          font-weight: 600;
        }

        .quotation-html-editor p {
          margin: 6px 0;
        }

        .quotation-html-editor ul,
        .quotation-html-editor ol {
          padding-left: 20px;
          margin: 6px 0;
        }
      `}</style>
    </div>
  );
}