"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
  serverTimestamp
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import dynamic from "next/dynamic";
import AdminGuard from "@/components/AdminGuard";
import "react-quill-new/dist/quill.snow.css";

/* =========================
   VARIABLES
========================= */
const VARIABLES = [
  { key: "spocName", desc: "Recipient SPOC name" },
  { key: "destination", desc: "Selected destination(s)" },
  { key: "teamMemberName", desc: "Sender name" },
  { key: "companyName", desc: "Company name" }
];

const ReactQuill = dynamic(
  () => import("react-quill-new"),
  { ssr: false }
);

/* =========================
   EMPTY
========================= */
const EMPTY_TEMPLATE = {
  name: "",
  category: "",
  channels: { email: true, whatsapp: false },

  emailSubject: "",
  emailHtml: "",
  whatsappText: "",

  attachments: [],

  signatureType: "company",
  signatureText: "",

  active: false
};

/* =========================
   HELPERS
========================= */
const extractVars = text =>
  (text || "")
    .match(/{{(.*?)}}/g)
    ?.map(v => v.replace(/[{}]/g, "")) || [];

const highlightVars = html =>
  (html || "").replace(
    /{{(.*?)}}/g,
    `<span class="template-var">{{$&}}</span>`
  );

/* =========================
   COMPONENT
========================= */
export default function TemplateEditorPage() {
  const { id } = useParams();
  const search = useSearchParams();
  const isViewOnly = search.get("mode") === "view";

  const [form, setForm] = useState(EMPTY_TEMPLATE);
  const [documents, setDocuments] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const dirtyRef = useRef(false);

  const quillRef = useRef(null);
  const whatsappRef = useRef(null);
  const [activeField, setActiveField] = useState(null);

  /* =========================
     LOAD
  ========================= */
  useEffect(() => {
    const load = async () => {
      const snap = await getDoc(
        doc(db, "communicationTemplates", id)
      );
      if (snap.exists()) {
        setForm({ ...EMPTY_TEMPLATE, ...snap.data() });
      }

      const docsSnap = await getDocs(collection(db, "documents"));
      setDocuments(
        docsSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(d => d.active)
      );

      setLoading(false);
    };
    load();
  }, [id]);

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
    return () =>
      window.removeEventListener("beforeunload", handler);
  }, []);

  /* =========================
     UPDATE
  ========================= */
  const update = (key, value) => {
    dirtyRef.current = true;
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => {
      if (!prev[key]) return prev;
      const c = { ...prev };
      delete c[key];
      return c;
    });
  };

  /* =========================
     VALIDATE
  ========================= */
  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Template name is required";
    if (!form.category.trim())
      e.category = "Category is required";

    const usedVars = [
      ...extractVars(form.emailHtml),
      ...extractVars(form.whatsappText)
    ];
    const invalid = usedVars.filter(
      v => !VARIABLES.some(x => x.key === v)
    );
    if (invalid.length) {
      e.variables =
        "Invalid variables: " +
        invalid.map(v => `{{${v}}}`).join(", ");
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  /* =========================
     SAVE
  ========================= */
  const save = async () => {
    if (!validate()) return;

    await updateDoc(
      doc(db, "communicationTemplates", id),
      {
        ...form,
        updatedAt: serverTimestamp()
      }
    );
    dirtyRef.current = false;
  };

  /* =========================
     INSERT VARIABLE
  ========================= */
  const insertVariable = value => {
    if (isViewOnly) return;

    if (activeField === "email") {
      const editor = quillRef.current?.getEditor();
      const pos = editor?.getSelection()?.index ?? 0;
      editor?.insertText(pos, value);
      editor?.setSelection(pos + value.length);
    }

    if (activeField === "whatsapp") {
      const el = whatsappRef.current;
      const start = el.selectionStart;
      const text = form.whatsappText || "";
      update(
        "whatsappText",
        text.slice(0, start) + value + text.slice(start)
      );
    }
  };

  if (loading) return <p className="p-6">Loading…</p>;

  return (
    <AdminGuard>
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-5xl mx-auto space-y-8">

          {/* HEADER */}
          <div>
            <h1 className="text-2xl font-semibold">
              {isViewOnly ? "View Template" : "Edit Template"}
            </h1>
          </div>

          {/* BASIC */}
          <Surface title="Basic Information">
            <Input
              label="Template Name"
              value={form.name}
              error={errors.name}
              onChange={v => update("name", v)}
              disabled={isViewOnly}
            />

            <Input
              label="Category"
              value={form.category}
              error={errors.category}
              onChange={v => update("category", v)}
              disabled={isViewOnly}
            />
          </Surface>

          {/* VARIABLES */}
          <Surface title="Variables">
            <div className="flex flex-wrap gap-2">
              {VARIABLES.map(v => (
                <button
                  key={v.key}
                  disabled={isViewOnly}
                  onClick={() =>
                    insertVariable(`{{${v.key}}}`)
                  }
                  className="text-xs px-2 py-1 border rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
                >
                  {`{{${v.key}}}`}
                </button>
              ))}
            </div>
            {errors.variables && (
              <p className="text-xs text-red-600">
                {errors.variables}
              </p>
            )}
          </Surface>

          {/* EMAIL */}
          {form.channels.email && (
            <Surface title="Email">
              <Input
                label="Email Subject"
                value={form.emailSubject}
                onChange={v => update("emailSubject", v)}
                disabled={isViewOnly}
              />

              <ReactQuill
                ref={quillRef}
                readOnly={isViewOnly}
                value={form.emailHtml}
                onFocus={() => setActiveField("email")}
                onChange={v => update("emailHtml", v)}
              />

              <div
                className="border p-3 rounded bg-gray-50 text-sm break-words"
                dangerouslySetInnerHTML={{
                  __html: highlightVars(form.emailHtml)
                }}
              />
            </Surface>
          )}

          {/* WHATSAPP */}
          {form.channels.whatsapp && (
            <Surface title="WhatsApp">
              <Textarea
                label="WhatsApp Text"
                value={form.whatsappText}
                onChange={v => update("whatsappText", v)}
                disabled={isViewOnly}
                inputRef={whatsappRef}
                onFocus={() => setActiveField("whatsapp")}
              />

              {/* WHATSAPP PREVIEW */}
              <div className="border p-3 rounded bg-gray-50 text-sm break-words min-h-[60px]">
                {(form.whatsappText || "").length === 0 ? (
                  <span className="text-gray-400 italic">
                    WhatsApp preview will appear here
                  </span>
                ) : (
                  (form.whatsappText || "")
                    .split(/({{.*?}})/g)
                    .map((p, i) =>
                      p.startsWith("{{") ? (
                        <span
                          key={i}
                          className="bg-indigo-100 text-indigo-700 px-1 rounded"
                        >
                          {p}
                        </span>
                      ) : (
                        <span key={i}>{p}</span>
                      )
                    )
                )}
              </div>

            </Surface>

          )}

          {/* ATTACHMENT */}
          <Surface title="Attachment">
            <select
              className="mui-input"
              disabled={isViewOnly}
              value={form.attachments?.[0]?.documentId || ""}
              onChange={e => {
                const d = documents.find(
                  x => x.id === e.target.value
                );
                update(
                  "attachments",
                  d
                    ? [{ documentId: d.id, name: d.name }]
                    : []
                );
              }}
            >
              <option value="">No attachment</option>
              {documents.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Surface>

          {/* SIGNATURE */}
          <Surface title="Signature">
            <select
              className="mui-input"
              disabled={isViewOnly}
              value={form.signatureType}
              onChange={e =>
                update("signatureType", e.target.value)
              }
            >
              <option value="company">Company</option>
              <option value="agent">Travel Agent</option>
              <option value="spoc">SPOC</option>
            </select>

            <Textarea
              label="Custom Signature"
              value={form.signatureText}
              onChange={v => update("signatureText", v)}
              disabled={isViewOnly}
            />
          </Surface>

          {/* VISIBILITY */}
          <Surface title="Visibility">
            <label className="flex gap-2 items-center text-sm">
              <input
                type="checkbox"
                disabled={isViewOnly}
                checked={form.active}
                onChange={e =>
                  update("active", e.target.checked)
                }
              />
              Active Template
            </label>
          </Surface>

          {/* SAVE */}
          {!isViewOnly && (
            <div className="flex justify-end">
              <button
                onClick={save}
                className="bg-blue-600 text-white px-6 py-2.5 rounded-md shadow-mui hover:bg-blue-700"
              >
                Save Template
              </button>
            </div>
          )}
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
      `}</style>
    </AdminGuard>
  );
}

/* =========================
   SHARED UI
========================= */

function Surface({ title, children }) {
  return (
    <section className="bg-white rounded-xl shadow-mui p-6 space-y-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Input({ label, value, onChange, error, disabled }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-700">
        {label}
      </label>
      <input
        value={value ?? ""}
        disabled={disabled}
        onChange={e => onChange(e.target.value)}
        className={`mui-input ${error
          ? "border-red-500 focus:border-red-500 focus:ring-red-200"
          : ""
          }`}
      />
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}

function Textarea({
  label,
  value,
  onChange,
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
        className="mui-input min-h-[90px]"
      />
    </div>
  );
}
