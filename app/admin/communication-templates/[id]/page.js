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

import "react-quill-new/dist/quill.snow.css";

/* =========================
   EDITOR
========================= */

const ReactQuill = dynamic(() => import("react-quill-new"), {
  ssr: false,
  loading: () => (
    <div className="border border-gray-200 rounded-lg bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
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
  { key: "companyPhone", desc: "Company phone" }
];

/* =========================
   DEFAULT
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

  active: false,
  status: "draft",
  version: 1
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

const stripHtml = html => {
  return (html || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
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

const highlightVars = html => {
  return (html || "").replace(
    /{{(.*?)}}/g,
    match => `<span class="template-var">${match}</span>`
  );
};

const hasAttachment = attachments => {
  return Array.isArray(attachments) && attachments.some(a => a?.documentId);
};

const normalizeTemplateWithCategory = (template, categories) => {
  const base = {
    ...EMPTY_TEMPLATE,
    ...template,
    channels: {
      ...EMPTY_TEMPLATE.channels,
      ...(template?.channels || {})
    },
    attachments: Array.isArray(template?.attachments)
      ? template.attachments
      : []
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
  const [documents, setDocuments] = useState([]);

  const [errors, setErrors] = useState({});
  const [pageError, setPageError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [activeField, setActiveField] = useState(null);
  const [previewMode, setPreviewMode] = useState("email");
  const [isDirty, setIsDirty] = useState(false);

  const dirtyRef = useRef(false);
  const quillRef = useRef(null);
  const whatsappRef = useRef(null);
  const subjectRef = useRef(null);

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

        const [templateSnap, categorySnap, documentSnap] = await Promise.all([
          getDoc(doc(db, "communicationTemplates", templateId)),
          getDocs(collection(db, "templateCategories")),
          getDocs(collection(db, "documents"))
        ]);

        if (!templateSnap.exists()) {
          setPageError("Template not found");
          setLoading(false);
          return;
        }

        const categoryRows = categorySnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

        const documentRows = documentSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(d => d.active !== false)
          .sort((a, b) =>
            (a.name || a.title || "").localeCompare(b.name || b.title || "")
          );

        const normalizedTemplate = normalizeTemplateWithCategory(
          templateSnap.data(),
          categoryRows
        );

        setCategories(categoryRows);
        setDocuments(documentRows);
        setForm(normalizedTemplate);
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
          done: Boolean(stripHtml(form.emailHtml))
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
        label: "Required attachment selected",
        done: hasAttachment(form.attachments)
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
    categoryRequiresAttachment,
    invalidVariables
  ]);

  const activationReady = readiness.every(item => item.done);

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

        if (!stripHtml(form.emailHtml)) {
          e.emailHtml = "Email body is required before activation";
        }
      }

      if (form.channels?.whatsapp && !form.whatsappText.trim()) {
        e.whatsappText =
          "WhatsApp message is required before activation";
      }

      if (
        categoryRequiresAttachment &&
        !hasAttachment(form.attachments)
      ) {
        e.attachments =
          "This category requires an attachment before activation";
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

        active: Boolean(form.active),
        status: form.active ? "active" : "draft",

        // Remove old signature fields from Firestore.
        signatureType: deleteField(),
        signatureText: deleteField(),

        updatedByUid: user?.uid || "",
        updatedByEmail: user?.email || "",
        updatedAt: serverTimestamp()
      });

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
        <main className="p-6">
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
          {/* =========================
             HEADER
          ========================= */}
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
                  className={`text-xs rounded-full px-3 py-1 border ${
                    form.active
                      ? "bg-green-50 text-green-700 border-green-100"
                      : "bg-amber-50 text-amber-700 border-amber-100"
                  }`}
                >
                  {form.active ? "Active" : "Draft"}
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

          {/* =========================
             MESSAGES
          ========================= */}
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

          {/* =========================
             BODY
          ========================= */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* LEFT */}
            <div className="lg:col-span-8 space-y-5">
              {/* SETUP */}
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
                      className={`${inputClass} ${
                        errors.categoryId
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
                        Attachment is mandatory for this category.
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-gray-700">
                      Channels
                    </label>

                    <div className="flex flex-wrap gap-3 mt-2">
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

                  <div>
                    <label className="text-xs font-medium text-gray-700">
                      Visibility
                    </label>

                    <button
                      type="button"
                      disabled={isViewOnly}
                      onClick={() => update("active", !form.active)}
                      className={`mt-2 w-full text-left border rounded-xl px-4 py-3 transition disabled:opacity-60 ${
                        form.active
                          ? "border-green-200 bg-green-50"
                          : "border-gray-200 bg-gray-50 hover:bg-gray-100"
                      }`}
                    >
                      <p
                        className={`text-sm font-medium ${
                          form.active ? "text-green-800" : "text-gray-800"
                        }`}
                      >
                        {form.active ? "Active Template" : "Draft Template"}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {form.active
                          ? "Available in send communication flow after save."
                          : "Hidden from send flow until activated."}
                      </p>
                    </button>

                    {form.active && !activationReady && (
                      <p className="text-[11px] text-amber-700 mt-1">
                        Complete readiness checklist before saving as active.
                      </p>
                    )}
                  </div>
                </div>
              </Surface>

              {/* EMAIL */}
              {form.channels?.email && (
                <Surface
                  title="Email Content"
                  subtitle="Use variables for personalization. Preview is available on the right."
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

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-700">
                      Email Body
                    </label>

                    <div
                      className={`bg-white rounded-lg ${
                        errors.emailHtml ? "border border-red-500" : ""
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

              {/* ATTACHMENT */}
              <Surface
                title="Attachment"
                subtitle="Attach documents like company profile, pitch deck, or offer PDF."
              >
                <div>
                  <label className="text-xs font-medium text-gray-700">
                    Select Document
                  </label>

                  <select
                    className={`${inputClass} ${
                      errors.attachments
                        ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                        : ""
                    }`}
                    disabled={isViewOnly}
                    value={form.attachments?.[0]?.documentId || ""}
                    onChange={e => {
                      const selectedDocument = documents.find(
                        x => x.id === e.target.value
                      );

                      update(
                        "attachments",
                        selectedDocument
                          ? [
                              {
                                documentId: selectedDocument.id,
                                name:
                                  selectedDocument.name ||
                                  selectedDocument.title ||
                                  "Document",
                                fileUrl:
                                  selectedDocument.fileUrl ||
                                  selectedDocument.url ||
                                  "",
                                documentType:
                                  selectedDocument.type ||
                                  selectedDocument.documentType ||
                                  ""
                              }
                            ]
                          : []
                      );
                    }}
                  >
                    <option value="">No attachment</option>
                    {documents.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.name || d.title || "Untitled Document"}
                      </option>
                    ))}
                  </select>

                  {errors.attachments && (
                    <p className={errorText}>{errors.attachments}</p>
                  )}
                </div>
              </Surface>
            </div>

            {/* RIGHT */}
            <aside className="lg:col-span-4 space-y-5 lg:sticky lg:top-6 self-start">
              <Surface
                title="Readiness Checklist"
                subtitle="Template must pass these checks before activation."
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
                        className={`text-[11px] rounded-full px-2 py-0.5 ${
                          item.done
                            ? "bg-green-50 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {item.done ? "Done" : "Pending"}
                      </span>
                    </div>
                  ))}
                </div>
              </Surface>

              <Surface
                title="Variables"
                subtitle="Click a variable to insert it into the active field."
              >
                <div className="grid grid-cols-1 gap-2">
                  {VARIABLES.map(v => (
                    <button
                      key={v.key}
                      type="button"
                      disabled={isViewOnly}
                      onClick={() => insertVariable(`{{${v.key}}}`)}
                      className="text-left border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 hover:bg-gray-100 disabled:opacity-60 disabled:cursor-not-allowed"
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
                  <div className="border border-gray-100 rounded-lg bg-gray-50 px-3 py-2 mt-3">
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

              <Surface title="Live Preview">
                <div className="flex border border-gray-200 rounded-lg overflow-hidden mb-3">
                  {form.channels?.email && (
                    <button
                      type="button"
                      onClick={() => setPreviewMode("email")}
                      className={`flex-1 px-3 py-2 text-xs ${
                        previewMode === "email"
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
                      className={`flex-1 px-3 py-2 text-xs ${
                        previewMode === "whatsapp"
                          ? "bg-gray-100 text-gray-900"
                          : "text-gray-500 hover:bg-gray-50"
                      }`}
                    >
                      WhatsApp
                    </button>
                  )}
                </div>

                {previewMode === "email" && form.channels?.email && (
                  <div className="border border-gray-200 rounded-xl bg-gray-50 overflow-hidden">
                    <div className="bg-white border-b border-gray-200 px-4 py-3">
                      <p className="text-[11px] text-gray-400">
                        Subject
                      </p>
                      <p className="text-sm font-medium text-gray-800 break-words">
                        {form.emailSubject || "Email subject will appear here"}
                      </p>
                    </div>

                    <div
                      className="p-4 text-sm break-words min-h-[160px]"
                      dangerouslySetInnerHTML={{
                        __html:
                          highlightVars(form.emailHtml) ||
                          '<span class="text-gray-400 italic">Email body preview will appear here</span>'
                      }}
                    />
                  </div>
                )}

                {previewMode === "whatsapp" &&
                  form.channels?.whatsapp && (
                    <div className="rounded-xl bg-[#e7ffdb] border border-green-100 p-3">
                      <div className="bg-white rounded-xl px-3 py-2 text-sm whitespace-pre-wrap break-words shadow-sm min-h-[120px]">
                        {(form.whatsappText || "").length === 0 ? (
                          <span className="text-gray-400 italic">
                            WhatsApp preview will appear here
                          </span>
                        ) : (
                          (form.whatsappText || "")
                            .split(/({{.*?}})/g)
                            .map((part, index) =>
                              part.startsWith("{{") &&
                              part.endsWith("}}") ? (
                                <span
                                  key={`${part}-${index}`}
                                  className="bg-indigo-100 text-indigo-700 px-1 rounded"
                                >
                                  {part}
                                </span>
                              ) : (
                                <span key={`${part}-${index}`}>
                                  {part}
                                </span>
                              )
                            )
                        )}
                      </div>
                    </div>
                  )}
              </Surface>
            </aside>
          </div>
        </div>
      </main>

      <style jsx global>{`
        .template-var {
          background: #eef2ff;
          color: #3730a3;
          padding: 0 4px;
          border-radius: 4px;
          font-weight: 500;
        }

        .ql-container {
          min-height: 220px;
          font-size: 14px;
          border-bottom-left-radius: 0.5rem;
          border-bottom-right-radius: 0.5rem;
        }

        .ql-toolbar {
          border-top-left-radius: 0.5rem;
          border-top-right-radius: 0.5rem;
          background: #f9fafb;
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
        className={`${inputClass} ${
          error
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
        className={`${inputClass} min-h-[150px] resize-y ${
          error
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
      className={`flex-1 min-w-[150px] text-left border rounded-xl px-4 py-3 transition disabled:opacity-60 disabled:cursor-not-allowed ${
        active
          ? "border-blue-200 bg-blue-50"
          : "border-gray-200 bg-gray-50 hover:bg-gray-100"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p
          className={`text-sm font-medium ${
            active ? "text-blue-800" : "text-gray-800"
          }`}
        >
          {label}
        </p>

        <span
          className={`w-3 h-3 rounded-full border ${
            active
              ? "border-blue-600 bg-blue-600"
              : "border-gray-300 bg-white"
          }`}
        />
      </div>

      <p className="text-xs text-gray-500 mt-1">{desc}</p>
    </button>
  );
}