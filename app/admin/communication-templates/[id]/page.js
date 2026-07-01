"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
  serverTimestamp,
  deleteField
} from "firebase/firestore";
import dynamic from "next/dynamic";

import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import AdminGuard from "@/components/AdminGuard";
import AssetPickerModal from "@/components/documents/AssetPickerModal";

import "react-quill-new/dist/quill.snow.css";

/* =========================
   EDITOR
========================= */

const ReactQuill = dynamic(() => import("react-quill-new"), {
  ssr: false,
  loading: () => (
    <div className="border border-gray-200 rounded-lg bg-white px-4 py-10 text-center text-sm text-gray-500">
      Loading editor...
    </div>
  )
});

/* =========================
   VARIABLES
========================= */

const VARIABLES = [
  { key: "spocName", desc: "Recipient SPOC name" },
  { key: "agencyName", desc: "Travel agent / agency name" },
  { key: "agentCode", desc: "Travel agent code" },
  { key: "destination", desc: "Selected destination(s)" },
  { key: "teamMemberName", desc: "Sender name" },
  { key: "companyName", desc: "Company name" },
  { key: "companyEmail", desc: "Company email" },
  { key: "companyPhone", desc: "Company phone" },
  { key: "companyLogoUrl", desc: "Company logo public URL" },
  { key: "assetLinks", desc: "Selected asset links for WhatsApp / plain text" },
  { key: "assetLinksHtml", desc: "Selected asset links as HTML block for email" }
];

/* =========================
   DEFAULTS
========================= */

const EMPTY_TEMPLATE = {
  name: "",

  category: "",
  categoryId: "",
  categoryName: "",
  categoryCode: "",
  categoryRequireAttachment: false,

  channels: {
    email: true,
    whatsapp: false
  },

  emailSubject: "",
  emailHtml: "",
  whatsappText: "",

  attachments: [],

  defaultAssets: [],
  defaultAssetIds: [],
  defaultAssetTitles: [],
  hasDefaultAssets: false,

  active: false,
  status: "draft",
  version: 1
};

const EMPTY_BRANDING = {
  companyName: "DreamTrawell",
  companyEmail: "",
  companyPhone: "",
  companyLogoUrl: "",
  websiteUrl: "",
  emailAssetBaseUrl: ""
};

/* =========================
   STYLES
========================= */

const inputClass =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed";

const errorText = "text-xs text-red-600 mt-1";

/* =========================
   HELPERS
========================= */

const getParamValue = value => {
  if (Array.isArray(value)) return value[0];
  return value;
};

function getFirstValue(...values) {
  return (
    values.find(
      value => typeof value === "string" && value.trim().length > 0
    )?.trim() || ""
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

const stripHtml = html => {
  return (html || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
};

const hasEmailContent = html => {
  const value = html || "";

  if (stripHtml(value)) return true;

  return /<(table|tbody|thead|tr|td|th|div|img|a|p|span|body|html|section|article|header|footer|h1|h2|h3)/i.test(
    value
  );
};

const extractVars = text => {
  return [
    ...new Set(
      (text || "")
        .match(/{{(.*?)}}/g)
        ?.map(v => v.replace(/[{}]/g, "").trim())
        .filter(Boolean) || []
    )
  ];
};

const renderTemplate = (content = "", variables = {}) => {
  return content.replace(/{{\s*(.*?)\s*}}/g, (_, key) => {
    return variables[key] ?? "";
  });
};

function getAssetTitle(asset) {
  return getFirstValue(
    asset?.title,
    asset?.name,
    asset?.fileName,
    asset?.currentFileName,
    "Asset"
  );
}

function getAssetUrl(asset) {
  return getFirstValue(
    asset?.url,
    asset?.currentUrl,
    asset?.externalUrl,
    asset?.downloadUrl,
    asset?.fileUrl
  );
}

function normalizeAssetForTemplate(asset) {
  return {
    assetId: asset.assetId || asset.id || asset.documentId || "",
    title: getAssetTitle(asset),
    url: getAssetUrl(asset),

    categoryId: asset.categoryId || "",
    categoryName: asset.categoryName || "",
    categorySlug: asset.categorySlug || "",

    assetType: asset.assetType || asset.documentType || "document",
    usageType: asset.usageType || "",

    currentVersion: asset.currentVersion || asset.version || 1,

    fileName: asset.fileName || asset.currentFileName || "",
    fileSize: asset.fileSize || asset.currentFileSize || null,
    fileType: asset.fileType || asset.currentFileType || "",
    fileExtension: asset.fileExtension || asset.currentFileExtension || "",

    sharedAs: asset.sharedAs || "file_link"
  };
}

function buildAssetLinksText(assets = []) {
  const usableAssets = assets.filter(asset => getAssetUrl(asset));

  if (!usableAssets.length) return "";

  return [
    "Shared Assets:",
    ...usableAssets.map((asset, index) => {
      return `${index + 1}. ${getAssetTitle(asset)}\n${getAssetUrl(asset)}`;
    })
  ].join("\n");
}

function buildAssetLinksHtml(assets = []) {
  const usableAssets = assets.filter(asset => getAssetUrl(asset));

  if (!usableAssets.length) return "";

  const rows = usableAssets
    .map(asset => {
      const title = escapeHtml(getAssetTitle(asset));
      const category = escapeHtml(
        getFirstValue(asset?.categoryName, asset?.assetType, "Asset")
      );
      const url = escapeHtml(getAssetUrl(asset));

      return `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;">
            <div style="font-size:14px;font-weight:600;color:#111827;">
              ${title}
            </div>
            <div style="font-size:12px;color:#6b7280;margin-top:2px;">
              ${category}
            </div>
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;text-align:right;">
            <a href="${url}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-size:12px;font-weight:600;padding:8px 12px;border-radius:8px;">
              View Asset
            </a>
          </td>
        </tr>
      `;
    })
    .join("");

  return `
    <div style="margin:18px 0;padding:14px;border:1px solid #e5e7eb;border-radius:12px;background:#f9fafb;">
      <div style="font-size:15px;font-weight:700;color:#111827;margin-bottom:8px;">
        Shared Assets
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;">
        ${rows}
      </table>
    </div>
  `;
}

const hasAttachment = attachments => {
  return (
    Array.isArray(attachments) &&
    attachments.some(
      a =>
        a?.documentId ||
        a?.assetId ||
        a?.url ||
        a?.fileUrl ||
        a?.currentUrl
    )
  );
};

const normalizeTemplateWithCategory = (template, categories) => {
  const normalizedDefaultAssets = Array.isArray(template?.defaultAssets)
    ? template.defaultAssets.map(normalizeAssetForTemplate)
    : Array.isArray(template?.attachments)
      ? template.attachments.map(normalizeAssetForTemplate)
      : [];

  const base = {
    ...EMPTY_TEMPLATE,
    ...template,
    channels: {
      ...EMPTY_TEMPLATE.channels,
      ...(template?.channels || {})
    },
    attachments: Array.isArray(template?.attachments)
      ? template.attachments
      : [],
    defaultAssets: normalizedDefaultAssets,
    defaultAssetIds: Array.isArray(template?.defaultAssetIds)
      ? template.defaultAssetIds
      : normalizedDefaultAssets.map(asset => asset.assetId).filter(Boolean),
    defaultAssetTitles: Array.isArray(template?.defaultAssetTitles)
      ? template.defaultAssetTitles
      : normalizedDefaultAssets.map(asset => asset.title).filter(Boolean),
    hasDefaultAssets: Boolean(
      template?.hasDefaultAssets || normalizedDefaultAssets.length
    )
  };

  const matchedCategory =
    categories.find(c => c.id === base.categoryId) ||
    categories.find(c => c.code === base.categoryCode) ||
    categories.find(c => c.code === base.category);

  if (!matchedCategory) return base;

  return {
    ...base,
    category: matchedCategory.code || "",
    categoryId: matchedCategory.id || "",
    categoryName: matchedCategory.name || "",
    categoryCode: matchedCategory.code || "",
    categoryRequireAttachment: Boolean(
      matchedCategory.rules?.requireAttachment
    )
  };
};

/* =========================
   PAGE
========================= */

export default function TemplateEditorPage() {
  const { user, loading: authLoading } = useAuth(true);
  const params = useParams();
  const router = useRouter();

  const templateId = getParamValue(params?.id);

  const [isViewOnly, setIsViewOnly] = useState(false);

  const [form, setForm] = useState(EMPTY_TEMPLATE);
  const [categories, setCategories] = useState([]);
  const [branding, setBranding] = useState(EMPTY_BRANDING);

  const [errors, setErrors] = useState({});
  const [pageError, setPageError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [activeField, setActiveField] = useState(null);
  const [previewMode, setPreviewMode] = useState("email");
  const [emailEditorMode, setEmailEditorMode] = useState("design");
  const [isDirty, setIsDirty] = useState(false);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);

  const dirtyRef = useRef(false);
  const quillRef = useRef(null);
  const whatsappRef = useRef(null);
  const subjectRef = useRef(null);
  const emailHtmlRef = useRef(null);

  /* =========================
     VIEW MODE
  ========================= */
  useEffect(() => {
    if (typeof window === "undefined") return;

    const search = new URLSearchParams(window.location.search);
    setIsViewOnly(search.get("mode") === "view");
  }, []);

  /* =========================
     LOAD
  ========================= */
  useEffect(() => {
    if (!user || !templateId) return;

    const load = async () => {
      try {
        setLoading(true);
        setPageError("");

        const [templateSnap, categorySnap, brandingSnap] = await Promise.all([
          getDoc(doc(db, "communicationTemplates", templateId)),
          getDocs(collection(db, "templateCategories")),
          getDoc(doc(db, "settings", "branding"))
        ]);

        if (!templateSnap.exists()) {
          setPageError("Template not found");
          setLoading(false);
          return;
        }

        const categoryRows = categorySnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

        const normalizedTemplate = normalizeTemplateWithCategory(
          templateSnap.data(),
          categoryRows
        );

        setCategories(categoryRows);
        setForm(normalizedTemplate);

        if (brandingSnap.exists()) {
          const data = brandingSnap.data();

          setBranding({
            companyName: data.companyName || "DreamTrawell",
            companyEmail: data.companyEmail || data.supportEmail || "",
            companyPhone: data.companyPhone || data.supportMobile || "",
            companyLogoUrl: data.companyLogoUrl || "",
            websiteUrl: data.websiteUrl || "",
            emailAssetBaseUrl: data.emailAssetBaseUrl || ""
          });
        } else {
          setBranding(EMPTY_BRANDING);
        }
      } catch (err) {
        setPageError(err.message || "Failed to load template");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user, templateId]);

  /* =========================
     UNSAVED WARNING
  ========================= */
  useEffect(() => {
    const handler = e => {
      if (!dirtyRef.current) return;

      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);

    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  /* =========================
     PREVIEW MODE SYNC
  ========================= */
  useEffect(() => {
    if (previewMode === "email" && !form.channels?.email) {
      setPreviewMode(form.channels?.whatsapp ? "whatsapp" : "email");
    }

    if (previewMode === "whatsapp" && !form.channels?.whatsapp) {
      setPreviewMode(form.channels?.email ? "email" : "whatsapp");
    }
  }, [form.channels, previewMode]);

  /* =========================
     DERIVED
  ========================= */
  const selectedCategory = useMemo(() => {
    return (
      categories.find(c => c.id === form.categoryId) ||
      categories.find(c => c.code === form.categoryCode) ||
      categories.find(c => c.code === form.category) ||
      null
    );
  }, [categories, form.categoryId, form.categoryCode, form.category]);

  const categoryRequiresAttachment = Boolean(
    selectedCategory?.rules?.requireAttachment ||
    form.categoryRequireAttachment
  );

  const selectedAssets = useMemo(() => {
    return Array.isArray(form.defaultAssets)
      ? form.defaultAssets.map(normalizeAssetForTemplate)
      : [];
  }, [form.defaultAssets]);

  const assetLinksText = useMemo(() => {
    return buildAssetLinksText(selectedAssets);
  }, [selectedAssets]);

  const assetLinksHtml = useMemo(() => {
    return buildAssetLinksHtml(selectedAssets);
  }, [selectedAssets]);

  const usedVariables = useMemo(() => {
    return [
      ...new Set([
        ...extractVars(form.emailSubject),
        ...extractVars(form.emailHtml),
        ...extractVars(form.whatsappText)
      ])
    ];
  }, [form.emailSubject, form.emailHtml, form.whatsappText]);

  const invalidVariables = useMemo(() => {
    return usedVariables.filter(
      v => !VARIABLES.some(item => item.key === v)
    );
  }, [usedVariables]);

  const previewVariables = useMemo(() => {
    return {
      spocName: "Sample SPOC",
      agencyName: "Sample Travel Agency",
      agentCode: "DT-TA-0001",
      destination: "Dubai, Singapore",
      teamMemberName: user?.displayName || user?.email || "Team Member",

      companyName: branding.companyName || "DreamTrawell",
      companyEmail: branding.companyEmail || "",
      companyPhone: branding.companyPhone || "",
      companyLogoUrl: branding.companyLogoUrl || "",

      assetLinks: assetLinksText,
      assetLinksHtml
    };
  }, [branding, user, assetLinksText, assetLinksHtml]);

  const renderedEmailSubject = useMemo(() => {
    return renderTemplate(form.emailSubject || "", previewVariables);
  }, [form.emailSubject, previewVariables]);

  const renderedEmailHtml = useMemo(() => {
    return renderTemplate(form.emailHtml || "", previewVariables);
  }, [form.emailHtml, previewVariables]);

  const renderedWhatsappText = useMemo(() => {
    return renderTemplate(form.whatsappText || "", previewVariables);
  }, [form.whatsappText, previewVariables]);

  const logoVariableUsed = usedVariables.includes("companyLogoUrl");
  const logoConfigured = Boolean(branding.companyLogoUrl);

  const readiness = useMemo(() => {
    const checks = [
      {
        key: "basic",
        label: "Template name added",
        done: Boolean(form.name.trim())
      },
      {
        key: "category",
        label: "Category selected",
        done: Boolean(form.categoryId)
      },
      {
        key: "channel",
        label: "At least one channel selected",
        done: Boolean(form.channels?.email || form.channels?.whatsapp)
      }
    ];

    if (form.channels?.email) {
      checks.push(
        {
          key: "emailSubject",
          label: "Email subject added",
          done: Boolean(form.emailSubject.trim())
        },
        {
          key: "emailBody",
          label: "Email body added",
          done: hasEmailContent(form.emailHtml)
        }
      );
    }

    if (form.channels?.whatsapp) {
      checks.push({
        key: "whatsapp",
        label: "WhatsApp message added",
        done: Boolean(form.whatsappText.trim())
      });
    }

    if (categoryRequiresAttachment) {
      checks.push({
        key: "attachment",
        label: "Required default asset selected",
        done:
          hasAttachment(form.attachments) ||
          hasAttachment(form.defaultAssets)
      });
    }

    if (logoVariableUsed) {
      checks.push({
        key: "companyLogoUrl",
        label: "Company logo URL configured",
        done: logoConfigured
      });
    }

    checks.push({
      key: "variables",
      label: "Variables are valid",
      done: invalidVariables.length === 0
    });

    return checks;
  }, [
    form.name,
    form.categoryId,
    form.channels,
    form.emailSubject,
    form.emailHtml,
    form.whatsappText,
    form.attachments,
    form.defaultAssets,
    categoryRequiresAttachment,
    invalidVariables,
    logoVariableUsed,
    logoConfigured
  ]);

  const activationReady = readiness.every(item => item.done);
  const displayActive = Boolean(form.active && activationReady);

  /* =========================
     UPDATE HELPERS
  ========================= */
  const markDirty = () => {
    dirtyRef.current = true;
    setIsDirty(true);
    setSuccessMessage("");
  };

  const clearError = key => {
    setErrors(prev => {
      if (!prev[key]) return prev;

      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  };

  const update = (key, value) => {
    if (isViewOnly) return;

    markDirty();

    setForm(prev => ({
      ...prev,
      [key]: value
    }));

    clearError(key);
  };

  const updateChannel = (key, value) => {
    if (isViewOnly) return;

    markDirty();

    setForm(prev => ({
      ...prev,
      channels: {
        ...prev.channels,
        [key]: value
      }
    }));

    clearError("channels");
  };

  const updateCategory = categoryId => {
    if (isViewOnly) return;

    const category = categories.find(c => c.id === categoryId);

    markDirty();

    setForm(prev => ({
      ...prev,
      category: category?.code || "",
      categoryId: category?.id || "",
      categoryName: category?.name || "",
      categoryCode: category?.code || "",
      categoryRequireAttachment: Boolean(
        category?.rules?.requireAttachment
      )
    }));

    clearError("categoryId");
    clearError("attachments");
  };

  /* =========================
     VALIDATE
  ========================= */
  const validate = () => {
    const e = {};

    if (!form.name.trim()) {
      e.name = "Template name is required";
    }

    if (!form.categoryId) {
      e.categoryId = "Category is required";
    }

    if (!form.channels?.email && !form.channels?.whatsapp) {
      e.channels = "Select at least one channel";
    }

    if (invalidVariables.length) {
      e.variables =
        "Invalid variables: " +
        invalidVariables.map(v => `{{${v}}}`).join(", ");
    }

    if (form.active) {
      if (selectedCategory?.active === false) {
        e.categoryId =
          "Inactive category cannot be used for active template";
      }

      if (form.channels?.email) {
        if (!form.emailSubject.trim()) {
          e.emailSubject =
            "Email subject is required before activation";
        }

        if (!hasEmailContent(form.emailHtml)) {
          e.emailHtml = "Email body is required before activation";
        }
      }

      if (form.channels?.whatsapp && !form.whatsappText.trim()) {
        e.whatsappText =
          "WhatsApp message is required before activation";
      }

      if (
        categoryRequiresAttachment &&
        !hasAttachment(form.attachments) &&
        !hasAttachment(form.defaultAssets)
      ) {
        e.attachments =
          "This category requires at least one default asset before activation";
      }

      if (logoVariableUsed && !logoConfigured) {
        e.variables =
          "Company logo URL is used in this template, but settings/branding.companyLogoUrl is missing.";
      }
    }

    setErrors(e);

    return Object.keys(e).length === 0;
  };

  /* =========================
     SAVE
  ========================= */
  const save = async () => {
    if (isViewOnly) return;
    if (!validate()) return;

    try {
      setSaving(true);
      setPageError("");
      setSuccessMessage("");

      const category = selectedCategory;
      const canSaveAsActive = Boolean(form.active && activationReady);

      const defaultAssets = selectedAssets.map(normalizeAssetForTemplate);

      const legacyAttachments = defaultAssets.map(asset => ({
        documentId: asset.assetId,
        assetId: asset.assetId,
        name: asset.title,
        fileUrl: asset.url,
        url: asset.url,
        documentType: asset.assetType || "",
        categoryName: asset.categoryName || "",
        version: asset.currentVersion || 1
      }));

      await updateDoc(doc(db, "communicationTemplates", templateId), {
        ...form,

        name: form.name.trim(),
        nameLower: form.name.trim().toLowerCase(),

        category: category?.code || form.category || "",
        categoryId: category?.id || form.categoryId || "",
        categoryName: category?.name || form.categoryName || "",
        categoryCode: category?.code || form.categoryCode || "",
        categoryRequireAttachment: Boolean(categoryRequiresAttachment),

        channels: {
          email: Boolean(form.channels?.email),
          whatsapp: Boolean(form.channels?.whatsapp)
        },

        emailSubject: form.emailSubject || "",
        emailHtml: form.emailHtml || "",
        whatsappText: form.whatsappText || "",

        defaultAssets,
        defaultAssetIds: defaultAssets
          .map(asset => asset.assetId)
          .filter(Boolean),
        defaultAssetTitles: defaultAssets
          .map(asset => asset.title)
          .filter(Boolean),
        hasDefaultAssets: defaultAssets.length > 0,

        attachments: legacyAttachments,

        active: canSaveAsActive,
        status: canSaveAsActive ? "active" : "draft",

        signatureType: deleteField(),
        signatureText: deleteField(),

        updatedByUid: user?.uid || "",
        updatedByEmail: user?.email || "",
        updatedAt: serverTimestamp()
      });

      setForm(prev => ({
        ...prev,
        defaultAssets,
        defaultAssetIds: defaultAssets
          .map(asset => asset.assetId)
          .filter(Boolean),
        defaultAssetTitles: defaultAssets
          .map(asset => asset.title)
          .filter(Boolean),
        hasDefaultAssets: defaultAssets.length > 0,
        attachments: legacyAttachments,
        active: canSaveAsActive,
        status: canSaveAsActive ? "active" : "draft"
      }));

      dirtyRef.current = false;
      setIsDirty(false);
      setSuccessMessage("Template saved successfully");
    } catch (err) {
      setPageError(err.message || "Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  /* =========================
     INSERT VARIABLE
  ========================= */
  const insertVariable = variable => {
    if (isViewOnly) return;

    if (activeField === "emailSubject") {
      const el = subjectRef.current;
      const start = el?.selectionStart ?? form.emailSubject.length;
      const text = form.emailSubject || "";
      const nextValue =
        text.slice(0, start) + variable + text.slice(start);

      update("emailSubject", nextValue);

      requestAnimationFrame(() => {
        el?.focus();
        el?.setSelectionRange(
          start + variable.length,
          start + variable.length
        );
      });

      return;
    }

    if (activeField === "emailHtml" || emailEditorMode === "html") {
      const el = emailHtmlRef.current;
      const start = el?.selectionStart ?? form.emailHtml.length;
      const text = form.emailHtml || "";
      const nextValue =
        text.slice(0, start) + variable + text.slice(start);

      update("emailHtml", nextValue);

      requestAnimationFrame(() => {
        el?.focus();
        el?.setSelectionRange(
          start + variable.length,
          start + variable.length
        );
      });

      return;
    }

    if (activeField === "whatsapp") {
      const el = whatsappRef.current;
      const start = el?.selectionStart ?? form.whatsappText.length;
      const text = form.whatsappText || "";
      const nextValue =
        text.slice(0, start) + variable + text.slice(start);

      update("whatsappText", nextValue);

      requestAnimationFrame(() => {
        el?.focus();
        el?.setSelectionRange(
          start + variable.length,
          start + variable.length
        );
      });

      return;
    }

    const editor = quillRef.current?.getEditor?.();
    const position = editor?.getSelection()?.index ?? 0;

    editor?.insertText(position, variable);
    editor?.setSelection(position + variable.length);

    markDirty();
  };

  /* =========================
     LOADING
  ========================= */
  if (authLoading || loading) {
    return (
      <AdminGuard>
        <main className="p-6 bg-white">
          <p className="text-sm text-gray-500">Loading template...</p>
        </main>
      </AdminGuard>
    );
  }

  if (!user) return null;

  return (
    <AdminGuard>
      <main className="min-h-screen">
        <div className="max-w-7xl mx-auto space-y-5">
          {/* HEADER */}
          <div className="bg-white border border-gray-100 rounded-xl px-5 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <button
                type="button"
                onClick={() =>
                  router.push("/admin/communication-templates")
                }
                className="text-xs text-gray-500 hover:text-gray-800 mb-2"
              >
                ← Back to templates
              </button>

              <div className="flex items-center gap-3">
                <h1 className="text-xl font-semibold text-gray-900">
                  {isViewOnly ? "View Template" : "Edit Template"}
                </h1>

                <span
                  className={`text-xs rounded-full px-3 py-1 border ${displayActive
                      ? "bg-green-50 text-green-700 border-green-100"
                      : "bg-amber-50 text-amber-700 border-amber-100"
                    }`}
                >
                  {displayActive ? "Active" : "Draft"}
                </span>

                {isDirty && !isViewOnly && (
                  <span className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-3 py-1">
                    Unsaved changes
                  </span>
                )}
              </div>

              <p className="text-sm text-gray-500 mt-1">
                Build reusable Email and WhatsApp templates for agent
                communication.
              </p>
            </div>

            {!isViewOnly && (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() =>
                    router.push("/admin/communication-templates")
                  }
                  className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {saving ? "Saving..." : "Save Template"}
                </button>
              </div>
            )}
          </div>

          {pageError && (
            <div className="border border-red-100 bg-red-50 text-red-700 rounded-xl px-4 py-3 text-sm">
              {pageError}
            </div>
          )}

          {successMessage && (
            <div className="border border-green-100 bg-green-50 text-green-700 rounded-xl px-4 py-3 text-sm">
              {successMessage}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* LEFT */}
            <div className="lg:col-span-8 space-y-5">
              <Surface
                title="Template Setup"
                subtitle="Choose basic details, category rules, and communication channels."
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Template Name"
                    value={form.name}
                    error={errors.name}
                    onChange={v => update("name", v)}
                    disabled={isViewOnly}
                  />

                  <div>
                    <label className="text-xs font-medium text-gray-700">
                      Category
                    </label>

                    <select
                      className={`${inputClass} ${errors.categoryId
                          ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                          : ""
                        }`}
                      disabled={isViewOnly}
                      value={form.categoryId || ""}
                      onChange={e => updateCategory(e.target.value)}
                    >
                      <option value="">Select category</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                          {cat.active === false ? " (Inactive)" : ""}
                        </option>
                      ))}
                    </select>

                    {errors.categoryId && (
                      <p className={errorText}>{errors.categoryId}</p>
                    )}

                    {categoryRequiresAttachment && (
                      <p className="text-[11px] text-amber-700 mt-1">
                        Default asset is mandatory for this category.
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-700">
                    Channels
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                    <ChannelCard
                      label="Email"
                      desc="Subject + rich HTML body"
                      active={Boolean(form.channels?.email)}
                      disabled={isViewOnly}
                      onClick={() =>
                        updateChannel(
                          "email",
                          !Boolean(form.channels?.email)
                        )
                      }
                    />

                    <ChannelCard
                      label="WhatsApp"
                      desc="Plain text message"
                      active={Boolean(form.channels?.whatsapp)}
                      disabled={isViewOnly}
                      onClick={() =>
                        updateChannel(
                          "whatsapp",
                          !Boolean(form.channels?.whatsapp)
                        )
                      }
                    />
                  </div>

                  {errors.channels && (
                    <p className={errorText}>{errors.channels}</p>
                  )}
                </div>
              </Surface>

              {/* EMAIL */}
              {form.channels?.email && (
                <Surface
                  title="Email Content"
                  subtitle="Use Design Editor for simple content or HTML Source for full email templates."
                >
                  <Input
                    label="Email Subject"
                    value={form.emailSubject}
                    error={errors.emailSubject}
                    onChange={v => update("emailSubject", v)}
                    disabled={isViewOnly}
                    inputRef={subjectRef}
                    onFocus={() => setActiveField("emailSubject")}
                  />

                  <div>
                    <label className="text-xs font-medium text-gray-700">
                      Email Body Mode
                    </label>

                    <div className="mt-2 inline-flex border border-gray-200 rounded-lg overflow-hidden bg-white">
                      <button
                        type="button"
                        disabled={isViewOnly}
                        onClick={() => setEmailEditorMode("design")}
                        className={`px-4 py-2 text-xs font-medium ${emailEditorMode === "design"
                            ? "bg-blue-50 text-blue-700"
                            : "text-gray-500 hover:bg-gray-50"
                          }`}
                      >
                        Design Editor
                      </button>

                      <button
                        type="button"
                        disabled={isViewOnly}
                        onClick={() => setEmailEditorMode("html")}
                        className={`px-4 py-2 text-xs font-medium border-l border-gray-200 ${emailEditorMode === "html"
                            ? "bg-blue-50 text-blue-700"
                            : "text-gray-500 hover:bg-gray-50"
                          }`}
                      >
                        HTML Source
                      </button>
                    </div>

                    <p className="text-[11px] text-gray-500 mt-1">
                      Use HTML Source for full email templates with table
                      layout, inline CSS, buttons, banners, branded designs,
                      and images.
                    </p>
                  </div>

                  {emailEditorMode === "design" && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-700">
                        Email Body
                      </label>

                      <div
                        className={`bg-white rounded-lg ${errors.emailHtml ? "border border-red-500" : ""
                          }`}
                        onFocus={() => setActiveField("email")}
                      >
                        <ReactQuill
                          ref={quillRef}
                          readOnly={isViewOnly}
                          value={form.emailHtml || ""}
                          onFocus={() => setActiveField("email")}
                          onChange={value => update("emailHtml", value)}
                        />
                      </div>

                      {errors.emailHtml && (
                        <p className={errorText}>{errors.emailHtml}</p>
                      )}
                    </div>
                  )}

                  {emailEditorMode === "html" && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-700">
                        HTML Source
                      </label>

                      <textarea
                        ref={emailHtmlRef}
                        disabled={isViewOnly}
                        value={form.emailHtml || ""}
                        onFocus={() => setActiveField("emailHtml")}
                        onChange={e => update("emailHtml", e.target.value)}
                        spellCheck={false}
                        placeholder={`Example:
<table width="100%" cellpadding="0" cellspacing="0" style="font-family: Arial, sans-serif;">
  <tr>
    <td align="center">
      <img src="{{companyLogoUrl}}" width="160" alt="{{companyName}}" style="display:block;border:0;outline:none;text-decoration:none;" />
    </td>
  </tr>
  <tr>
    <td>
      <h2>Hello {{spocName}}</h2>
      <p>We are happy to connect with {{agencyName}}.</p>
      {{assetLinksHtml}}
    </td>
  </tr>
</table>`}
                        className={`${inputClass} min-h-[360px] resize-y font-mono text-xs leading-5 ${errors.emailHtml
                            ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                            : ""
                          }`}
                      />

                      {errors.emailHtml && (
                        <p className={errorText}>{errors.emailHtml}</p>
                      )}

                      <p className="text-[11px] text-gray-500">
                        For images or asset links in email, use public absolute
                        URLs. Firebase Storage download URLs are supported.
                      </p>
                    </div>
                  )}
                </Surface>
              )}

              {/* WHATSAPP */}
              {form.channels?.whatsapp && (
                <Surface
                  title="WhatsApp Content"
                  subtitle="Keep WhatsApp content short, clear, and action-oriented."
                >
                  <Textarea
                    label="WhatsApp Text"
                    value={form.whatsappText}
                    error={errors.whatsappText}
                    onChange={v => update("whatsappText", v)}
                    disabled={isViewOnly}
                    inputRef={whatsappRef}
                    onFocus={() => setActiveField("whatsapp")}
                  />
                </Surface>
              )}

              {/* DEFAULT ASSETS */}
              <Surface
                title="Default Assets"
                subtitle="Select assets from Document Library that should auto-load when this template is used."
              >
                {selectedAssets.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-5 text-center">
                    <p className="text-sm font-medium text-gray-700">
                      No default assets selected
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Add company profile, promotional packages, destination images,
                      or other approved assets.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedAssets.map(asset => (
                      <div
                        key={asset.assetId}
                        className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-800">
                            {asset.title}
                          </p>

                          <p className="text-xs text-gray-500 truncate">
                            {asset.categoryName || asset.assetType || "Asset"} · v
                            {asset.currentVersion || 1}
                          </p>

                          {asset.url && (
                            <p className="text-[11px] text-gray-400 truncate mt-0.5">
                              {asset.url}
                            </p>
                          )}
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          {asset.url && (
                            <a
                              href={asset.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline"
                            >
                              View
                            </a>
                          )}

                          {!isViewOnly && (
                            <button
                              type="button"
                              onClick={() => {
                                const nextAssets = selectedAssets.filter(
                                  item => item.assetId !== asset.assetId
                                );

                                update("defaultAssets", nextAssets);
                              }}
                              className="text-xs text-red-600 hover:underline"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!isViewOnly && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setAssetPickerOpen(true)}
                      className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                    >
                      Select Assets from Library
                    </button>

                    {selectedAssets.length > 0 && (
                      <>
                        {form.channels?.email && (
                          <button
                            type="button"
                            onClick={() => {
                              update(
                                "emailHtml",
                                form.emailHtml
                                  ? `${form.emailHtml}<br/>{{assetLinksHtml}}`
                                  : "{{assetLinksHtml}}"
                              );
                            }}
                            className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200"
                          >
                            Insert Email Asset Block
                          </button>
                        )}

                        {form.channels?.whatsapp && (
                          <button
                            type="button"
                            onClick={() => {
                              update(
                                "whatsappText",
                                form.whatsappText
                                  ? `${form.whatsappText}\n\n{{assetLinks}}`
                                  : "{{assetLinks}}"
                              );
                            }}
                            className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200"
                          >
                            Insert WhatsApp Asset Links
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}

                {errors.attachments && (
                  <p className={errorText}>{errors.attachments}</p>
                )}

                <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                  Use <strong>{"{{assetLinksHtml}}"}</strong> inside Email
                  templates and <strong>{"{{assetLinks}}"}</strong> inside
                  WhatsApp templates.
                </div>
              </Surface>
            </div>

            {/* RIGHT */}
            <aside className="lg:col-span-4 space-y-5 lg:sticky lg:top-6 self-start">
              <Surface
                title="Readiness Checklist"
                subtitle="Complete all checks before activating this template."
              >
                <div className="space-y-2">
                  {readiness.map(item => (
                    <div
                      key={item.key}
                      className="flex items-center justify-between gap-3 border border-gray-100 rounded-lg px-3 py-2"
                    >
                      <span className="text-sm text-gray-700">
                        {item.label}
                      </span>

                      <span
                        className={`text-[11px] rounded-full px-2 py-0.5 ${item.done
                            ? "bg-green-50 text-green-700"
                            : "bg-gray-100 text-gray-500"
                          }`}
                      >
                        {item.done ? "Done" : "Pending"}
                      </span>
                    </div>
                  ))}
                </div>

                {!isViewOnly && (
                  <div className="pt-3 border-t border-gray-100">
                    <button
                      type="button"
                      disabled={!form.active && !activationReady}
                      onClick={() => update("active", !form.active)}
                      className={`w-full rounded-lg px-4 py-2.5 text-sm font-medium transition ${form.active
                          ? "bg-amber-50 text-amber-700 border border-amber-100 hover:bg-amber-100"
                          : activationReady
                            ? "bg-green-600 text-white hover:bg-green-700"
                            : "bg-gray-100 text-gray-400 cursor-not-allowed"
                        }`}
                    >
                      {form.active
                        ? "Move to Draft"
                        : activationReady
                          ? "Activate Template"
                          : "Complete Checklist to Activate"}
                    </button>

                    <p className="text-[11px] text-gray-500 mt-2">
                      Draft templates are hidden from the send communication
                      flow.
                    </p>
                  </div>
                )}
              </Surface>

              <Surface title="Live Preview">
                <div className="flex border border-gray-200 rounded-lg overflow-hidden mb-3">
                  {form.channels?.email && (
                    <button
                      type="button"
                      onClick={() => setPreviewMode("email")}
                      className={`flex-1 px-3 py-2 text-xs ${previewMode === "email"
                          ? "bg-gray-100 text-gray-900"
                          : "text-gray-500 hover:bg-gray-50"
                        }`}
                    >
                      Email
                    </button>
                  )}

                  {form.channels?.whatsapp && (
                    <button
                      type="button"
                      onClick={() => setPreviewMode("whatsapp")}
                      className={`flex-1 px-3 py-2 text-xs ${previewMode === "whatsapp"
                          ? "bg-gray-100 text-gray-900"
                          : "text-gray-500 hover:bg-gray-50"
                        }`}
                    >
                      WhatsApp
                    </button>
                  )}
                </div>

                {previewMode === "email" && form.channels?.email && (
                  <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
                    <div className="bg-white border-b border-gray-200 px-4 py-3">
                      <p className="text-[11px] text-gray-400">
                        Subject
                      </p>
                      <p className="text-sm font-medium text-gray-800 break-words">
                        {renderedEmailSubject ||
                          "Email subject will appear here"}
                      </p>
                    </div>

                    {form.emailHtml ? (
                      <iframe
                        title="Email HTML Preview"
                        sandbox=""
                        srcDoc={renderedEmailHtml}
                        className="w-full min-h-[360px] bg-white"
                      />
                    ) : (
                      <div className="p-4 text-sm text-gray-400 italic min-h-[160px]">
                        Email body preview will appear here
                      </div>
                    )}
                  </div>
                )}

                {previewMode === "whatsapp" &&
                  form.channels?.whatsapp && (
                    <div className="rounded-xl bg-[#e7ffdb] border border-green-100 p-3">
                      <div className="bg-white rounded-xl px-3 py-2 text-sm whitespace-pre-wrap break-words shadow-sm min-h-[120px]">
                        {(renderedWhatsappText || "").length === 0 ? (
                          <span className="text-gray-400 italic">
                            WhatsApp preview will appear here
                          </span>
                        ) : (
                          renderedWhatsappText
                        )}
                      </div>
                    </div>
                  )}
              </Surface>

              <Surface
                title="Variables"
                subtitle="Click a variable to insert it into the active field."
              >
                {logoVariableUsed && !logoConfigured && (
                  <div className="border border-amber-100 bg-amber-50 text-amber-700 rounded-lg px-3 py-2 text-xs">
                    companyLogoUrl is used, but company logo URL is not
                    configured in settings/branding.
                  </div>
                )}

                <div className="grid grid-cols-1 gap-2">
                  {VARIABLES.map(v => (
                    <button
                      key={v.key}
                      type="button"
                      disabled={isViewOnly}
                      onClick={() => insertVariable(`{{${v.key}}}`)}
                      className="text-left border border-gray-200 rounded-lg px-3 py-2 bg-white hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <p className="text-xs font-semibold text-indigo-700">
                        {`{{${v.key}}}`}
                      </p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {v.desc}
                      </p>
                    </button>
                  ))}
                </div>

                {usedVariables.length > 0 && (
                  <div className="border border-gray-100 rounded-lg bg-white px-3 py-2 mt-3">
                    <p className="text-xs text-gray-500 mb-1">
                      Used variables
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {usedVariables.map(v => (
                        <span
                          key={v}
                          className="text-[11px] bg-indigo-50 text-indigo-700 rounded px-2 py-0.5"
                        >
                          {`{{${v}}}`}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {errors.variables && (
                  <p className={errorText}>{errors.variables}</p>
                )}
              </Surface>
            </aside>
          </div>
        </div>
      </main>

      <AssetPickerModal
        open={assetPickerOpen}
        onClose={() => setAssetPickerOpen(false)}
        selectedAssets={selectedAssets}
        title="Select Default Assets for Template"
        onConfirm={assets => {
          const normalizedAssets = assets.map(normalizeAssetForTemplate);
          update("defaultAssets", normalizedAssets);
        }}
      />

      <style jsx global>{`
        .ql-container {
          min-height: 220px;
          font-size: 14px;
          border-bottom-left-radius: 0.5rem;
          border-bottom-right-radius: 0.5rem;
        }

        .ql-toolbar {
          border-top-left-radius: 0.5rem;
          border-top-right-radius: 0.5rem;
          background: #ffffff;
        }

        .ql-editor {
          min-height: 220px;
          background: #ffffff;
        }
      `}</style>
    </AdminGuard>
  );
}

/* =========================
   SHARED UI
========================= */

function Surface({ title, subtitle, children }) {
  return (
    <section className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-gray-800">
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
        )}
      </div>

      {children}
    </section>
  );
}

function Input({
  label,
  value,
  onChange,
  error,
  disabled,
  inputRef,
  onFocus
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-700">
        {label}
      </label>

      <input
        ref={inputRef}
        value={value ?? ""}
        disabled={disabled}
        onFocus={onFocus}
        onChange={e => onChange(e.target.value)}
        className={`${inputClass} ${error
            ? "border-red-500 focus:border-red-500 focus:ring-red-200"
            : ""
          }`}
      />

      {error && <p className={errorText}>{error}</p>}
    </div>
  );
}

function Textarea({
  label,
  value,
  onChange,
  error,
  disabled,
  inputRef,
  onFocus
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-700">
        {label}
      </label>

      <textarea
        ref={inputRef}
        disabled={disabled}
        value={value ?? ""}
        onFocus={onFocus}
        onChange={e => onChange(e.target.value)}
        className={`${inputClass} min-h-[150px] resize-y ${error
            ? "border-red-500 focus:border-red-500 focus:ring-red-200"
            : ""
          }`}
      />

      {error && <p className={errorText}>{error}</p>}
    </div>
  );
}

function ChannelCard({ label, desc, active, disabled, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`text-left border rounded-xl px-4 py-3 transition disabled:opacity-60 disabled:cursor-not-allowed ${active
          ? "border-blue-200 bg-blue-50"
          : "border-gray-200 bg-white hover:bg-gray-50"
        }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p
          className={`text-sm font-medium ${active ? "text-blue-800" : "text-gray-800"
            }`}
        >
          {label}
        </p>

        <span
          className={`w-3 h-3 rounded-full border ${active
              ? "border-blue-600 bg-blue-600"
              : "border-gray-300 bg-white"
            }`}
        />
      </div>

      <p className="text-xs text-gray-500 mt-1">{desc}</p>
    </button>
  );
}