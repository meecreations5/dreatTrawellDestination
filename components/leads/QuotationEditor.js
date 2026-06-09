// components/leads/QuotationEditor.jsx

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  arrayUnion,
  collection,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";

import { sendEmailViaBrevo } from "@/lib/sendEmailViaBrevo";
import { sendWhatsAppWeb } from "@/lib/whatsapp";
import { createQuotationRevision } from "@/lib/createQuotationRevision";
import { saveQuotationDraft } from "@/lib/saveQuotationDraft";

import { getCommunicationSettings } from "@/lib/communicationSettings";
import { getBrandingSettings } from "@/lib/brandingSettings";
import { getUserProfileByUid } from "@/lib/userProfileRef";

import {
  logLeadAction,
  LEAD_TIMELINE_TYPES
} from "@/lib/logLeadAction";

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
   BASIC HELPERS
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

function htmlContainsGreeting(html = "") {
  const text = String(html)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  return (
    text.includes("dear ") ||
    text.includes("greetings from") ||
    text.includes("thank you for giving us") ||
    text.includes("thank you for giving") ||
    text.includes("kindly check the above quotation") ||
    text.includes("looking forward to your confirmation")
  );
}

function mergeSignatureUserWithProfile(signatureUser, profileData) {
  return {
    ...signatureUser,
    ...(profileData || {}),

    uid:
      signatureUser?.uid ||
      profileData?.uid ||
      signatureUser?.id ||
      profileData?.id,

    id:
      signatureUser?.id ||
      profileData?.id ||
      signatureUser?.uid ||
      profileData?.uid
  };
}

function getSignaturePriority(member) {
  let score = 0;

  if (member?.signatureHtml || member?.emailSignatureHtml) score += 20;
  if (member?.whatsappSignature || member?.signatureText) score += 20;
  if (member?.profileUpdatedAt) score += 10;
  if (member?.designation) score += 5;
  if (member?.mobile) score += 5;
  if (member?.email) score += 5;
  if (member?.name || member?.displayName) score += 5;
  if (member?.signatureEnabled === false) score -= 20;

  return score;
}

function isInternalUser(member) {
  const role = String(member?.role || "").toLowerCase();

  const inactive =
    member?.disabled ||
    member?.isDisabled ||
    member?.deleted ||
    member?.isDeleted ||
    member?.status === "inactive" ||
    member?.active === false;

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
   TIMELINE HELPERS
========================= */
async function updateQuotationSentStatus({
  leadId,
  quotationId,
  channel,
  user
}) {
  if (!leadId || !quotationId || !channel) return;

  try {
    await updateDoc(
      doc(db, "leads", leadId, "quotations", quotationId),
      {
        sentVia: arrayUnion(channel),
        updatedAt: serverTimestamp(),

        ...(channel === "email"
          ? {
            emailSentAt: serverTimestamp(),
            emailSentByUid: user?.uid || "",
            emailSentByName:
              user?.displayName || user?.name || user?.email || ""
          }
          : {}),

        ...(channel === "whatsapp"
          ? {
            whatsappSentAt: serverTimestamp(),
            whatsappSentByUid: user?.uid || "",
            whatsappSentByName:
              user?.displayName || user?.name || user?.email || ""
          }
          : {})
      }
    );
  } catch (error) {
    console.warn("Quotation sent status update skipped:", error);
  }
}

async function logQuotationCommunication({
  leadId,
  channel,
  quotationId,
  revision,
  recipient,
  signatureUser,
  user,

  customerAmountNumber,
  vendorCost,
  vendorCostNumber,
  grossProfit,
  marginPercent,
  itineraryHtml,
  isFinalQuotation
}) {
  if (!leadId || !channel) return;

  const hasVendorCost =
    vendorCost !== "" &&
    vendorCost !== null &&
    vendorCost !== undefined;

  const isBoth = channel === "email_whatsapp";

  const title = isBoth
    ? "Quotation sent via Email & WhatsApp"
    : channel === "email"
      ? "Quotation sent via Email"
      : "Quotation sent via WhatsApp";

  const action = isBoth
    ? "quotation_sent_email_whatsapp"
    : channel === "email"
      ? "quotation_sent_email"
      : "quotation_sent_whatsapp";

  const sentVia = isBoth ? ["email", "whatsapp"] : [channel];

  try {
    await logLeadAction({
      leadId,
      type: LEAD_TIMELINE_TYPES.QUOTATION,
      title,
      description: isBoth
        ? `Quotation Rev ${revision || ""} sent via Email & WhatsApp`
        : channel === "email"
          ? `Quotation Rev ${revision || ""} sent to ${recipient?.email || ""}`
          : `Quotation Rev ${revision || ""} shared on WhatsApp`,
      metadata: {
        action,
        channel,
        sentVia,
        status: isFinalQuotation ? "final" : "sent",

        leadId,
        quotationId: quotationId || "",
        revision: revision || "",

        itineraryHtml: itineraryHtml || "",

        totalAmount: customerAmountNumber,
        customerQuotedAmount: customerAmountNumber,
        vendorCost: hasVendorCost ? vendorCostNumber : null,
        grossProfit,
        marginPercent:
          marginPercent === null || marginPercent === undefined
            ? null
            : Number(marginPercent.toFixed(2)),

        pricingVisibleToCustomer: false,
        isFinalQuotation: Boolean(isFinalQuotation),

        toEmail: recipient?.email || "",
        mobile: recipient?.mobile || "",

        signatureUser: {
          uid: getMemberUid(signatureUser),
          name: getMemberName(signatureUser),
          email: getMemberEmail(signatureUser),
          mobile: getMemberMobile(signatureUser),
          role: getMemberRole(signatureUser)
        }
      },
      user
    });
  } catch (error) {
    console.warn("Timeline log skipped:", error);
  }
}

/* =========================
   HTML / PASTE HELPERS
========================= */
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

/* =========================
   UI HELPERS
========================= */
function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 text-xs font-medium rounded-lg border transition ${active
        ? "bg-blue-600 text-white border-blue-600"
        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
        }`}
    >
      {children}
    </button>
  );
}

function InfoRow({ label, value }) {
  return (
    <div>
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className="text-sm font-medium text-gray-900 break-all">
        {value || "—"}
      </p>
    </div>
  );
}

function ConfirmSendModal({
  open,
  onClose,
  onConfirm,
  saving,
  recipient,
  sendEmail,
  sendWhatsApp,
  selectedSignatureName,
  isFinalQuotation,
  customerAmount,
  vendorCost,
  grossProfit,
  marginPercent,
  isDraftSend
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-lg w-full shadow-xl">
        <div className="p-5 border-b">
          <h3 className="text-base font-semibold text-gray-900">
            {isDraftSend ? "Confirm Send Draft" : "Confirm Send Quotation"}
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Please verify the recipient, channels and internal commercial
            details before sending.
          </p>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <InfoRow label="Recipient" value={recipient?.name} />
            <InfoRow label="Signature" value={selectedSignatureName} />
            <InfoRow
              label="Email"
              value={sendEmail ? recipient?.email : "Off"}
            />
            <InfoRow
              label="WhatsApp"
              value={sendWhatsApp ? recipient?.mobile : "Off"}
            />
            <InfoRow
              label="Final Quotation"
              value={isFinalQuotation ? "Yes" : "No"}
            />
            <InfoRow label="Pricing Visibility" value="Internal only" />
          </div>

          <div className="bg-orange-50 border border-orange-100 rounded-lg p-3">
            <p className="text-xs font-semibold text-orange-700 mb-2">
              Internal Commercials
            </p>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-gray-500">Quote</span>
                <p className="font-semibold text-gray-900">{customerAmount}</p>
              </div>

              <div>
                <span className="text-gray-500">Vendor Cost</span>
                <p className="font-semibold text-gray-900">{vendorCost}</p>
              </div>

              <div>
                <span className="text-gray-500">Gross Profit</span>
                <p className="font-semibold text-gray-900">{grossProfit}</p>
              </div>

              <div>
                <span className="text-gray-500">Margin</span>
                <p className="font-semibold text-gray-900">{marginPercent}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 border-t flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 border border-gray-200 rounded-lg py-2 text-sm disabled:opacity-60"
          >
            Back
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm disabled:opacity-60"
          >
            {saving ? "Sending..." : "Confirm & Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================
   COMPONENT
========================= */
export default function QuotationEditor({
  lead,
  onClose,
  initialQuotation = null
}) {
  const { user } = useAuth();
  const editorRef = useRef(null);
  const pendingEditorHydrateRef = useRef(false);
  const loadedQuotationKeyRef = useRef("");

  const [teamMembers, setTeamMembers] = useState([]);
  const [selectedSignatureUid, setSelectedSignatureUid] = useState("");

  const [html, setHtml] = useState("");
  const [customerQuotedAmount, setCustomerQuotedAmount] = useState("");
  const [vendorCost, setVendorCost] = useState("");
  const [note, setNote] = useState("");
  const [isFinalQuotation, setIsFinalQuotation] = useState(false);

  const [activeTab, setActiveTab] = useState("edit");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [previewSignatureUser, setPreviewSignatureUser] = useState(null);

  const [saving, setSaving] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftQuotationId, setDraftQuotationId] = useState("");
  const [draftRevision, setDraftRevision] = useState(null);

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

    return { name, email, mobile };
  }, [lead]);

  const [sendEmail, setSendEmail] = useState(Boolean(recipient.email));
  const [sendWhatsApp, setSendWhatsApp] = useState(
    !recipient.email && Boolean(recipient.mobile)
  );

  useEffect(() => {
    let mounted = true;

    async function loadTeamMembers() {
      if (!user) return;

      try {
        const snap = await getDocs(collection(db, "users"));

        const rows = snap.docs
          .map(docSnap => ({
            id: docSnap.id,
            uid: docSnap.data()?.uid || docSnap.id,
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

    const savedProfile = teamMembers.find(
      member => getMemberUid(member) === uid
    );

    if (savedProfile) return savedProfile;

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
      if (!uid) return;

      const existing = map.get(uid);

      if (!existing) {
        map.set(uid, member);
        return;
      }

      if (getSignaturePriority(member) > getSignaturePriority(existing)) {
        map.set(uid, member);
      }
    });

    return Array.from(map.values()).sort((a, b) =>
      getMemberName(a).localeCompare(getMemberName(b))
    );
  }, [teamMembers, currentUserOption]);

  useEffect(() => {
    if (!user || !signatureOptions.length || selectedSignatureUid) return;

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
      return;
    }

    const currentUid = user.uid || user.id || user.email || "";
    const currentMember = signatureOptions.find(
      member => getMemberUid(member) === currentUid
    );

    if (currentMember) {
      setSelectedSignatureUid(getMemberUid(currentMember));
    }
  }, [user, lead, signatureOptions, selectedSignatureUid]);

  const selectedSignatureUser = useMemo(() => {
    if (!selectedSignatureUid) return null;

    return (
      signatureOptions.find(
        member => getMemberUid(member) === selectedSignatureUid
      ) || null
    );
  }, [signatureOptions, selectedSignatureUid]);

  useEffect(() => {
    let mounted = true;

    async function loadPreviewSignature() {
      const baseUser = selectedSignatureUser || currentUserOption;
      const uid = getMemberUid(baseUser);

      if (!uid) {
        setPreviewSignatureUser(baseUser || null);
        return;
      }

      try {
        let profileData = {};
        let brandingData = {};

        try {
          const profile = await getUserProfileByUid(uid);
          profileData = profile?.data || {};
        } catch (error) {
          console.warn("Preview profile load skipped:", error);
        }

        try {
          brandingData = await getBrandingSettings();
        } catch (error) {
          console.warn("Preview branding load skipped:", error);
        }

        const mergedUser = {
          ...mergeSignatureUserWithProfile(baseUser, profileData),
          ...brandingData
        };

        if (mounted) {
          setPreviewSignatureUser(mergedUser);
        }
      } catch (error) {
        console.warn("Signature preview load skipped:", error);
        if (mounted) setPreviewSignatureUser(baseUser || null);
      }
    }

    loadPreviewSignature();

    return () => {
      mounted = false;
    };
  }, [selectedSignatureUser, currentUserOption]);


  useEffect(() => {
    if (activeTab !== "edit") return;

    const editor = editorRef.current;
    if (!editor) return;

    const shouldHydrate =
      pendingEditorHydrateRef.current ||
      editor.innerHTML.trim() === "";

    if (!shouldHydrate) return;

    editor.innerHTML = html || "";
    pendingEditorHydrateRef.current = false;
  }, [activeTab, html]);

  useEffect(() => {
    if (!initialQuotation) {
      loadedQuotationKeyRef.current = "";
      pendingEditorHydrateRef.current = true;
      setHtml("");
      setDraftQuotationId("");
      setDraftRevision(null);

      if (editorRef.current) {
        editorRef.current.innerHTML = "";
      }

      return;
    }

    const quotationKey =
      initialQuotation.id ||
      initialQuotation.quotationId ||
      `${initialQuotation.leadId || ""}-${initialQuotation.revision || ""}`;

    if (loadedQuotationKeyRef.current === quotationKey) return;

    loadedQuotationKeyRef.current = quotationKey;
    pendingEditorHydrateRef.current = true;

    const draftHtml =
      initialQuotation.itineraryHtml ||
      initialQuotation.html ||
      initialQuotation.contentHtml ||
      initialQuotation.metadata?.itineraryHtml ||
      "";

    setActiveTab("edit");
    setHtml(draftHtml);

    setCustomerQuotedAmount(
      initialQuotation.customerQuotedAmount ??
      initialQuotation.totalAmount ??
      initialQuotation.totalPrice ??
      initialQuotation.metadata?.customerQuotedAmount ??
      initialQuotation.metadata?.totalAmount ??
      ""
    );

    setVendorCost(
      initialQuotation.vendorCost === null ||
        initialQuotation.vendorCost === undefined
        ? initialQuotation.metadata?.vendorCost === null ||
          initialQuotation.metadata?.vendorCost === undefined
          ? ""
          : String(initialQuotation.metadata.vendorCost)
        : String(initialQuotation.vendorCost)
    );

    setNote(initialQuotation.note || initialQuotation.metadata?.note || "");
    setIsFinalQuotation(Boolean(initialQuotation.isFinalQuotation));

    setDraftQuotationId(
      initialQuotation.id ||
      initialQuotation.quotationId ||
      initialQuotation.metadata?.quotationId ||
      ""
    );

    setDraftRevision(
      initialQuotation.revision ||
      initialQuotation.metadata?.revision ||
      null
    );

    const signatureUid =
      initialQuotation.signatureUser?.uid ||
      initialQuotation.signatureUser?.id ||
      initialQuotation.metadata?.signatureUser?.uid ||
      initialQuotation.metadata?.signatureUser?.id ||
      "";

    if (signatureUid) {
      setSelectedSignatureUid(signatureUid);
    }
  }, [initialQuotation]);

  if (!user || !lead) return null;

  const hasEmail = Boolean(recipient.email);
  const hasWhatsApp = Boolean(recipient.mobile);
  const isEditorEmpty = !stripHtml(html);

  const customerAmountNumber = Number(customerQuotedAmount || 0);
  const vendorCostNumber = Number(vendorCost || 0);
  const hasVendorCost = vendorCost !== "";

  const grossProfit =
    hasVendorCost && Number.isFinite(vendorCostNumber)
      ? customerAmountNumber - vendorCostNumber
      : null;

  const marginPercent =
    customerAmountNumber > 0 && grossProfit !== null
      ? (grossProfit / customerAmountNumber) * 100
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

  const validateBeforeSend = () => {
    const rawEditorHtml = editorRef.current?.innerHTML || html;
    const cleanText = stripHtml(rawEditorHtml);

    if (!cleanText) {
      alert("Itinerary is required");
      return false;
    }

    if (
      !customerQuotedAmount ||
      !Number.isFinite(customerAmountNumber) ||
      customerAmountNumber <= 0
    ) {
      alert("Valid internal quotation amount is required");
      return false;
    }

    if (
      hasVendorCost &&
      (!Number.isFinite(vendorCostNumber) || vendorCostNumber < 0)
    ) {
      alert("Valid vendor cost is required");
      return false;
    }

    if (!sendEmail && !sendWhatsApp) {
      alert("Select at least one channel");
      return false;
    }

    if (sendEmail && !hasEmail) {
      alert("Email address is not available");
      return false;
    }

    if (sendWhatsApp && !hasWhatsApp) {
      alert("WhatsApp number is not available");
      return false;
    }

    if (!selectedSignatureUid) {
      alert("Please select team member signature");
      return false;
    }

    return true;
  };

  const saveDraft = async () => {
    if (saving || savingDraft) return;

    const rawEditorHtml = editorRef.current?.innerHTML || html;
    const cleanText = stripHtml(rawEditorHtml);

    if (!cleanText) {
      alert("Add itinerary or quotation content before saving draft");
      return;
    }

    const selectedSignatureBaseUser =
      selectedSignatureUser || currentUserOption;

    const selectedUid = getMemberUid(selectedSignatureBaseUser);

    setSavingDraft(true);

    try {
      let profileSignatureData = {};

      try {
        if (selectedUid) {
          const profile = await getUserProfileByUid(selectedUid);
          profileSignatureData = profile?.data || {};
        }
      } catch (error) {
        console.warn("Could not load selected signature profile:", error);
      }

      let branding = {};

      try {
        branding = await getBrandingSettings();
      } catch (error) {
        console.warn("Branding settings not found:", error);
      }

      const signatureUser = mergeSignatureUserWithProfile(
        selectedSignatureBaseUser,
        profileSignatureData
      );

      const signatureUserWithBranding = {
        ...signatureUser,
        ...branding
      };

      const itineraryHtml = prepareQuotationHtmlForEmail(rawEditorHtml);

      const emailSignatureHtml =
        buildEmailSignatureHtml(signatureUserWithBranding);

      const whatsappSignatureText =
        buildWhatsAppSignatureText(signatureUserWithBranding);

      const result = await saveQuotationDraft({
        leadId: lead.id,

        quotationId: draftQuotationId,
        revision: draftRevision,

        itineraryHtml,

        customerQuotedAmount: customerAmountNumber || 0,
        vendorCost: hasVendorCost ? vendorCostNumber : null,
        grossProfit,
        marginPercent:
          marginPercent === null ? null : Number(marginPercent.toFixed(2)),

        note,

        signatureUser: {
          uid: getMemberUid(signatureUser),
          name: getMemberName(signatureUser),
          email: getMemberEmail(signatureUser),
          mobile: getMemberMobile(signatureUser),
          role: getMemberRole(signatureUser),

          companyName: branding.companyName || "",
          companyLogoUrl: branding.companyLogoUrl || "",
          websiteUrl: branding.websiteUrl || "",
          emailAssetBaseUrl: branding.emailAssetBaseUrl || "",
          facebookUrl: branding.facebookUrl || "",
          instagramUrl: branding.instagramUrl || "",
          linkedinUrl: branding.linkedinUrl || "",
          youtubeUrl: branding.youtubeUrl || "",
          supportEmail: branding.supportEmail || "",
          supportMobile: branding.supportMobile || "",
          emailFooterLine: branding.emailFooterLine || "",
          quotationClosingLine: branding.quotationClosingLine || "",
          emailDisclaimer: branding.emailDisclaimer || "",
          whatsappFooterLine: branding.whatsappFooterLine || "",

          signatureHtml: emailSignatureHtml,
          signatureText: whatsappSignatureText
        },

        user
      });

      setDraftQuotationId(result.quotationId || "");
      setDraftRevision(result.revision || null);

      alert(
        result.revision
          ? `Draft saved successfully - Rev ${result.revision}`
          : "Draft saved successfully"
      );
    } catch (error) {
      console.error("Draft save failed:", error);
      alert(error?.message || "Failed to save draft");
    } finally {
      setSavingDraft(false);
    }
  };

  const updateExistingDraftAsSent = async ({
    quotationId,
    revision,
    itineraryHtml,
    sendVia,
    signatureUser,
    emailSignatureHtml,
    whatsappSignatureText,
    branding
  }) => {
    if (!quotationId) {
      throw new Error("Draft quotation ID missing");
    }

    const safeRevision = revision || draftRevision || initialQuotation?.revision || "";
    const finalStatus = isFinalQuotation ? "final" : "sent";

    const signaturePayload = {
      uid: getMemberUid(signatureUser),
      name: getMemberName(signatureUser),
      email: getMemberEmail(signatureUser),
      mobile: getMemberMobile(signatureUser),
      role: getMemberRole(signatureUser),

      companyName: branding.companyName || "",
      companyLogoUrl: branding.companyLogoUrl || "",
      websiteUrl: branding.websiteUrl || "",
      emailAssetBaseUrl: branding.emailAssetBaseUrl || "",
      facebookUrl: branding.facebookUrl || "",
      instagramUrl: branding.instagramUrl || "",
      linkedinUrl: branding.linkedinUrl || "",
      youtubeUrl: branding.youtubeUrl || "",
      supportEmail: branding.supportEmail || "",
      supportMobile: branding.supportMobile || "",
      emailFooterLine: branding.emailFooterLine || "",
      quotationClosingLine: branding.quotationClosingLine || "",
      emailDisclaimer: branding.emailDisclaimer || "",
      whatsappFooterLine: branding.whatsappFooterLine || "",

      signatureHtml: emailSignatureHtml,
      signatureText: whatsappSignatureText
    };

    await updateDoc(
      doc(db, "leads", lead.id, "quotations", quotationId),
      {
        status: finalStatus,
        isDraft: false,
        isFinalQuotation: Boolean(isFinalQuotation),

        itineraryHtml,

        totalPrice: customerAmountNumber,
        totalAmount: customerAmountNumber,
        customerQuotedAmount: customerAmountNumber,
        vendorCost: hasVendorCost ? vendorCostNumber : null,
        grossProfit,
        marginPercent:
          marginPercent === null
            ? null
            : Number(marginPercent.toFixed(2)),
        pricingVisibleToCustomer: false,

        note,
        sendVia,
        sentVia: sendVia,

        signatureUser: signaturePayload,

        sentAt: serverTimestamp(),
        sentByUid: user?.uid || "",
        sentByName: user?.displayName || user?.name || user?.email || "",

        updatedAt: serverTimestamp()
      }
    );

    await updateDoc(doc(db, "leads", lead.id), {
      latestQuotationId: quotationId,
      latestQuotationRevision: safeRevision,
      latestQuotationStatus: finalStatus,

      latestQuotationAmount: customerAmountNumber,
      latestVendorCost: hasVendorCost ? vendorCostNumber : null,
      latestGrossProfit: grossProfit,
      latestMarginPercent:
        marginPercent === null
          ? null
          : Number(marginPercent.toFixed(2)),

      stage: "quoted",
      updatedAt: serverTimestamp(),

      ...(isFinalQuotation
        ? {
          finalQuotationId: quotationId,
          finalQuotationRevision: safeRevision,
          finalQuotationAmount: customerAmountNumber,
          finalVendorCost: hasVendorCost ? vendorCostNumber : null,
          finalGrossProfit: grossProfit,
          finalMarginPercent:
            marginPercent === null
              ? null
              : Number(marginPercent.toFixed(2)),
          finalQuotationAt: serverTimestamp(),
          finalQuotationByUid: user?.uid || "",
          finalQuotationByName:
            user?.displayName || user?.name || user?.email || ""
        }
        : {})
    });

    return {
      quotationId,
      revision: safeRevision
    };
  };

  const openSendConfirmation = () => {
    if (saving || savingDraft) return;
    if (!validateBeforeSend()) return;
    setConfirmOpen(true);
  };

  const submit = async () => {
    if (saving) return;
    if (!validateBeforeSend()) return;

    const rawEditorHtml = editorRef.current?.innerHTML || html;

    const selectedSignatureBaseUser =
      selectedSignatureUser || currentUserOption;

    const selectedUid = getMemberUid(selectedSignatureBaseUser);

    if (!selectedUid) {
      alert("Please select team member signature");
      return;
    }

    setSaving(true);

    try {
      setConfirmOpen(false);

      let profileSignatureData = {};

      try {
        const profile = await getUserProfileByUid(selectedUid);
        profileSignatureData = profile?.data || {};
      } catch (error) {
        console.warn("Could not load selected signature profile:", error);
      }

      let branding = {};

      try {
        branding = await getBrandingSettings();
      } catch (error) {
        console.warn("Branding settings not found:", error);
      }

      const signatureUser = mergeSignatureUserWithProfile(
        selectedSignatureBaseUser,
        profileSignatureData
      );

      const signatureUserWithBranding = {
        ...signatureUser,
        ...branding
      };

      if (signatureUserWithBranding?.signatureEnabled === false) {
        alert("Selected team member signature is inactive");
        setSaving(false);
        return;
      }

      const itineraryHtml = prepareQuotationHtmlForEmail(rawEditorHtml);

      const emailSignatureHtml =
        buildEmailSignatureHtml(signatureUserWithBranding);

      const whatsappSignatureText =
        buildWhatsAppSignatureText(signatureUserWithBranding);

      const sendVia = [
        sendEmail ? "email" : null,
        sendWhatsApp ? "whatsapp" : null
      ].filter(Boolean);

      let quotationResult;

      if (draftQuotationId) {
        quotationResult = await updateExistingDraftAsSent({
          quotationId: draftQuotationId,
          revision: draftRevision,
          itineraryHtml,
          sendVia,
          signatureUser,
          emailSignatureHtml,
          whatsappSignatureText,
          branding
        });
      } else {
        quotationResult = await createQuotationRevision({
          leadId: lead.id,
          itineraryHtml,

          totalPrice: customerAmountNumber,
          customerQuotedAmount: customerAmountNumber,
          vendorCost: hasVendorCost ? vendorCostNumber : null,
          grossProfit,
          marginPercent:
            marginPercent === null
              ? null
              : Number(marginPercent.toFixed(2)),
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

            companyName: branding.companyName || "",
            companyLogoUrl: branding.companyLogoUrl || "",
            websiteUrl: branding.websiteUrl || "",
            emailAssetBaseUrl: branding.emailAssetBaseUrl || "",
            facebookUrl: branding.facebookUrl || "",
            instagramUrl: branding.instagramUrl || "",
            linkedinUrl: branding.linkedinUrl || "",
            youtubeUrl: branding.youtubeUrl || "",
            supportEmail: branding.supportEmail || "",
            supportMobile: branding.supportMobile || "",
            emailFooterLine: branding.emailFooterLine || "",
            quotationClosingLine: branding.quotationClosingLine || "",
            emailDisclaimer: branding.emailDisclaimer || "",
            whatsappFooterLine: branding.whatsappFooterLine || "",

            signatureHtml: emailSignatureHtml,
            signatureText: whatsappSignatureText
          },

          // This prevents duplicate "Quotation Created" timeline log
          skipTimelineLog: true,

          user
        });
      }

      const revision =
        typeof quotationResult === "object"
          ? quotationResult?.revision
          : quotationResult;

      const quotationId =
        typeof quotationResult === "object"
          ? quotationResult?.quotationId || quotationResult?.id || ""
          : "";

      const subject = `Quotation ${lead.leadCode || ""}${revision ? ` (Rev ${revision})` : ""
        }`;

      const itineraryAlreadyHasGreeting =
        htmlContainsGreeting(itineraryHtml);

      const emailHtml = itineraryAlreadyHasGreeting
        ? `
          <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
            <div style="margin: 0 0 16px;">
              ${itineraryHtml}
            </div>

            ${emailSignatureHtml}
          </div>
        `
        : `
          <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
            <p style="margin: 0 0 12px;">
              Dear ${escapeHtml(recipient.name || "Guest")},
            </p>

            <p style="margin: 0 0 16px;">
              Greetings from DreamTrawell Destination.
            </p>

            <p style="margin: 0 0 16px;">
              Please find below the quotation details for your travel enquiry.
            </p>

            <div style="margin: 16px 0;">
              ${itineraryHtml}
            </div>

            ${branding.quotationClosingLine
          ? `
                  <p style="margin: 16px 0;">
                    ${escapeHtml(branding.quotationClosingLine)}
                  </p>
                `
          : ""
        }

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

      let emailSent = false;
      let whatsappSent = false;

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

        emailSent = true;

        await updateQuotationSentStatus({
          leadId: lead.id,
          quotationId,
          channel: "email",
          user
        });
      }

      if (sendWhatsApp && hasWhatsApp) {
        const whatsappMessage = [
          `Dear ${recipient.name || "Guest"},`,
          "",
          "Greetings from DreamTrawell Destination.",
          "",
          `Your quotation for ${lead.destinationName || "your travel enquiry"
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

        whatsappSent = true;

        await updateQuotationSentStatus({
          leadId: lead.id,
          quotationId,
          channel: "whatsapp",
          user
        });
      }

      if (emailSent || whatsappSent) {
        const sentChannel =
          emailSent && whatsappSent
            ? "email_whatsapp"
            : emailSent
              ? "email"
              : "whatsapp";

        await logQuotationCommunication({
          leadId: lead.id,
          channel: sentChannel,
          quotationId,
          revision,
          recipient,
          signatureUser,
          user,

          customerAmountNumber,
          vendorCost,
          vendorCostNumber,
          grossProfit,
          marginPercent,
          itineraryHtml,
          isFinalQuotation
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

  const previewItineraryHtml = prepareQuotationHtmlForEmail(html);
  const previewSignature =
    previewSignatureUser || selectedSignatureUser || currentUserOption;

  const previewEmailSignatureHtml = previewSignature
    ? buildEmailSignatureHtml(previewSignature)
    : "";

  const previewWhatsappSignatureText = previewSignature
    ? buildWhatsAppSignatureText(previewSignature)
    : "";

  const previewAlreadyHasGreeting =
    htmlContainsGreeting(previewItineraryHtml);

  const previewEmailHtml = previewAlreadyHasGreeting
    ? `
      <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
        <div style="margin: 0 0 16px;">
          ${previewItineraryHtml || "<p>No quotation content added yet.</p>"}
        </div>
        ${previewEmailSignatureHtml}
      </div>
    `
    : `
      <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
        <p style="margin: 0 0 12px;">
          Dear ${escapeHtml(recipient.name || "Guest")},
        </p>

        <p style="margin: 0 0 16px;">
          Greetings from DreamTrawell Destination.
        </p>

        <p style="margin: 0 0 16px;">
          Please find below the quotation details for your travel enquiry.
        </p>

        <div style="margin: 16px 0;">
          ${previewItineraryHtml || "<p>No quotation content added yet.</p>"}
        </div>

        ${previewSignature?.quotationClosingLine
      ? `
              <p style="margin: 16px 0;">
                ${escapeHtml(previewSignature.quotationClosingLine)}
              </p>
            `
      : ""
    }

        ${previewEmailSignatureHtml}
      </div>
    `;

  const previewWhatsappMessage = [
    `Dear ${recipient.name || "Guest"},`,
    "",
    "Greetings from DreamTrawell Destination.",
    "",
    `Your quotation for ${lead.destinationName || "your travel enquiry"
    } has been prepared.`,
    lead.leadCode ? `Quotation Ref: ${lead.leadCode}` : "",
    "",
    "Please review the itinerary details shared with you and let us know if you would like any changes.",
    "",
    previewWhatsappSignatureText
  ]
    .filter(Boolean)
    .join("\n");

  const selectedSignatureName =
    getMemberName(previewSignature) ||
    getMemberName(selectedSignatureUser) ||
    "Not selected";

  return (
    <>
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white max-w-7xl w-full rounded-xl flex flex-col max-h-[92vh] shadow-xl">
          <div className="p-5 border-b flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                {draftQuotationId ? "Edit Draft Quotation" : "Create Quotation"}
              </h2>

              <p className="text-xs text-gray-500 mt-1">
                {lead.leadCode || "Lead"}{" "}
                {lead.destinationName ? `• ${lead.destinationName}` : ""}
                {draftRevision ? ` • Draft Rev ${draftRevision}` : ""}
              </p>
            </div>

            <div className="hidden md:flex items-center gap-2 text-xs">
              <span className="bg-green-50 text-green-700 border border-green-100 px-2 py-1 rounded-full">
                Customer visible editor
              </span>

              <span className="bg-orange-50 text-orange-700 border border-orange-100 px-2 py-1 rounded-full">
                Internal pricing hidden
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-y-auto flex-1">
            <div className="lg:col-span-8 p-5 space-y-4 border-r border-gray-100">
              <div className="flex flex-wrap gap-2">
                <TabButton
                  active={activeTab === "edit"}
                  onClick={() => setActiveTab("edit")}
                >
                  Edit Quotation
                </TabButton>

                <TabButton
                  active={activeTab === "email"}
                  onClick={() => setActiveTab("email")}
                >
                  Email Preview
                </TabButton>

                <TabButton
                  active={activeTab === "whatsapp"}
                  onClick={() => setActiveTab("whatsapp")}
                >
                  WhatsApp Preview
                </TabButton>
              </div>

              {previewAlreadyHasGreeting && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
                  Greeting detected in quotation body. System greeting will not
                  be added again in email preview.
                </div>
              )}

              {activeTab === "edit" && (
                <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                  <div className="border-b border-gray-100 px-4 py-2 bg-gray-50 flex items-center justify-between gap-3">
                    <p className="text-xs text-gray-500">
                      Paste itinerary from Excel / Google Sheets. Tables,
                      columns, borders and cell background colors will be
                      preserved.
                    </p>

                    <span className="text-[11px] bg-green-50 text-green-700 border border-green-100 px-2 py-1 rounded-full">
                      Customer Visible
                    </span>
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
                    onFocus={() => {
                      if (
                        pendingEditorHydrateRef.current &&
                        editorRef.current
                      ) {
                        editorRef.current.innerHTML = html || "";
                        pendingEditorHydrateRef.current = false;
                      }
                    }}
                    className="quotation-html-editor min-h-[420px] p-4 text-sm outline-none overflow-x-auto"
                  />
                </div>
              )}

              {activeTab === "email" && (
                <div className="border border-gray-200 rounded-lg bg-gray-50 overflow-hidden">
                  <div className="px-4 py-3 border-b bg-white">
                    <p className="text-sm font-semibold text-gray-900">
                      Email Preview
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      This is how the quotation email body will look before
                      sending.
                    </p>
                  </div>

                  <div className="p-4">
                    <div className="bg-white border border-gray-200 rounded-lg p-5 overflow-x-auto">
                      <div
                        className="text-sm"
                        dangerouslySetInnerHTML={{
                          __html: previewEmailHtml
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "whatsapp" && (
                <div className="border border-gray-200 rounded-lg bg-gray-50 overflow-hidden">
                  <div className="px-4 py-3 border-b bg-white">
                    <p className="text-sm font-semibold text-gray-900">
                      WhatsApp Preview
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      This text will open in WhatsApp Web.
                    </p>
                  </div>

                  <div className="p-4">
                    <pre className="bg-white border border-gray-200 rounded-lg p-4 text-sm whitespace-pre-wrap text-gray-800">
                      {previewWhatsappMessage}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            <div className="lg:col-span-4 p-5 space-y-4 bg-gray-50">
              <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    Recipient
                  </p>
                  <p className="text-xs text-gray-500">
                    Customer or travel agent contact.
                  </p>
                </div>

                <InfoRow label="Name" value={recipient.name} />
                <InfoRow
                  label="Email"
                  value={recipient.email || "Email not available"}
                />
                <InfoRow
                  label="Mobile"
                  value={recipient.mobile || "Mobile not available"}
                />
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    Communication Signature
                  </p>
                  <p className="text-xs text-gray-500">
                    Pulled from profile and admin branding.
                  </p>
                </div>

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

                {previewSignature && (
                  <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-xs text-gray-700 space-y-1">
                    <p className="font-semibold text-gray-900">
                      {getMemberName(previewSignature)}
                    </p>
                    <p>{getMemberRole(previewSignature) || "Role not set"}</p>
                    <p>{getMemberEmail(previewSignature) || "Email not set"}</p>
                    <p>
                      {getMemberMobile(previewSignature) || "Mobile not set"}
                    </p>

                    <div className="pt-2 mt-2 border-t border-gray-200">
                      <p>
                        Branding:{" "}
                        <b>
                          {previewSignature.companyName ||
                            "DreamTrawell Destination"}
                        </b>
                      </p>
                      <p>
                        Signature:{" "}
                        <b>
                          {previewSignature.signatureEnabled === false
                            ? "Inactive"
                            : "Active"}
                        </b>
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-orange-50 border border-orange-100 rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      Internal Commercials
                    </p>
                    <p className="text-xs text-gray-500">
                      Never sent to customer.
                    </p>
                  </div>

                  <span className="text-[11px] bg-orange-100 text-orange-700 px-2 py-1 rounded-full">
                    Internal Only
                  </span>
                </div>

                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  className={inputClass}
                  placeholder="Quotation Amount (₹)"
                  value={customerQuotedAmount}
                  onChange={e => setCustomerQuotedAmount(e.target.value)}
                />

                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  className={inputClass}
                  placeholder="Vendor Cost (₹)"
                  value={vendorCost}
                  onChange={e => setVendorCost(e.target.value)}
                />

                {(customerQuotedAmount || hasVendorCost) && (
                  <div className="bg-white border border-orange-100 rounded-lg p-3 text-xs text-gray-700 space-y-2">
                    <div className="flex justify-between">
                      <span>Quote</span>
                      <b>{formatCurrency(customerAmountNumber)}</b>
                    </div>

                    <div className="flex justify-between">
                      <span>Vendor Cost</span>
                      <b>
                        {hasVendorCost
                          ? formatCurrency(vendorCostNumber)
                          : "—"}
                      </b>
                    </div>

                    <div className="flex justify-between">
                      <span>Gross Profit</span>
                      <b>
                        {grossProfit === null
                          ? "—"
                          : formatCurrency(grossProfit)}
                      </b>
                    </div>

                    <div className="flex justify-between">
                      <span>Margin</span>
                      <b>
                        {marginPercent === null
                          ? "—"
                          : `${marginPercent.toFixed(1)}%`}
                      </b>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                <p className="text-sm font-semibold text-gray-900">
                  Send Settings
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

                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={isFinalQuotation}
                    onChange={e => setIsFinalQuotation(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  Mark this as final quotation
                </label>

                <textarea
                  className={inputClass}
                  rows={3}
                  placeholder="Internal note"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                />
              </div>

              {!hasEmail && !hasWhatsApp && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-700">
                  Email and WhatsApp are not available for this lead. Please
                  update the customer or SPOC contact details before sending.
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center gap-3 p-5 border-t bg-white">
            <div className="text-xs text-gray-500 flex-1">
              Email: <b>{sendEmail ? "On" : "Off"}</b> · WhatsApp:{" "}
              <b>{sendWhatsApp ? "On" : "Off"}</b> · Final:{" "}
              <b>{isFinalQuotation ? "Yes" : "No"}</b> · Signature:{" "}
              <b>{selectedSignatureName}</b>
              {draftRevision ? (
                <>
                  {" "}· Draft: <b>Rev {draftRevision}</b>
                </>
              ) : null}
            </div>

            <div className="flex gap-2 w-full md:w-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={saving || savingDraft}
                className="flex-1 md:flex-none border border-gray-200 rounded-md px-5 py-2 text-sm disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={saveDraft}
                disabled={saving || savingDraft}
                className="flex-1 md:flex-none border border-blue-200 text-blue-700 bg-blue-50 rounded-md px-5 py-2 text-sm disabled:opacity-60"
              >
                {savingDraft
                  ? "Saving Draft..."
                  : draftQuotationId
                    ? "Update Draft"
                    : "Save Draft"}
              </button>

              <button
                type="button"
                onClick={openSendConfirmation}
                disabled={saving || savingDraft || (!hasEmail && !hasWhatsApp)}
                className="flex-1 md:flex-none bg-blue-600 text-white rounded-md px-5 py-2 text-sm disabled:opacity-60"
              >
                {saving
                  ? "Sending..."
                  : draftQuotationId
                    ? "Send Draft"
                    : "Send Quotation"}
              </button>
            </div>
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

      <ConfirmSendModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={submit}
        saving={saving}
        recipient={recipient}
        sendEmail={sendEmail}
        sendWhatsApp={sendWhatsApp}
        selectedSignatureName={selectedSignatureName}
        isFinalQuotation={isFinalQuotation}
        customerAmount={formatCurrency(customerAmountNumber)}
        vendorCost={
          hasVendorCost ? formatCurrency(vendorCostNumber) : "—"
        }
        grossProfit={
          grossProfit === null ? "—" : formatCurrency(grossProfit)
        }
        marginPercent={
          marginPercent === null ? "—" : `${marginPercent.toFixed(1)}%`
        }
        isDraftSend={Boolean(draftQuotationId)}
      />
    </>
  );
}