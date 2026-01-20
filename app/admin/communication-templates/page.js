"use client";

import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  getDocs,
  query,
  orderBy,
  serverTimestamp
} from "firebase/firestore";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import AdminGuard from "@/components/AdminGuard";

/* =========================
   STYLES
========================= */
const inputClass = `
  w-full border border-gray-200 rounded-lg
  px-3 py-2 text-sm bg-white
  focus:outline-none focus:ring-2 focus:ring-blue-100
`;

const errorText = "text-xs text-red-600 mt-1";


/* =========================
   MUI-STYLE CHANNEL CHIP
========================= */
const ChannelChip = ({ label, active, color }) => {
  if (!active) return null;

  const colorMap = {
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    green: "bg-green-50 text-green-700 border-green-100"
  };

  return (
    <span
      className={`
        inline-flex items-center gap-1.5
        px-2 py-0.5
        text-[11px] font-medium
        rounded-full border
        ${colorMap[color]}
      `}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {label}
    </span>
  );
};

/* =========================
   VIEW TOGGLE
========================= */
const ViewToggle = ({ view, setView }) => (
  <div className="flex border border-gray-200 rounded-lg overflow-hidden">
    {["table", "card"].map(v => (
      <button
        key={v}
        onClick={() => setView(v)}
        className={`px-3 py-1.5 text-xs transition
          ${view === v
            ? "bg-gray-100 text-gray-900"
            : "text-gray-500 hover:bg-gray-50"
          }`}
      >
        {v === "table" ? "Table" : "Cards"}
      </button>
    ))}
  </div>
);

export default function CommunicationTemplates() {
  const { user, loading } = useAuth(true);
  const router = useRouter();

  const [templates, setTemplates] = useState([]);
  const [view, setView] = useState("table");

  const [form, setForm] = useState({
    name: "",
    category: "",
    channels: {
      email: true,
      whatsapp: false
    }
  });

  const [errors, setErrors] = useState({});
  const [creating, setCreating] = useState(false);

  /* =========================
     LOAD
  ========================= */
  const fetchTemplates = async () => {
    const q = query(
      collection(db, "communicationTemplates"),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    setTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => {
    if (user) fetchTemplates();
  }, [user]);

  if (loading) return <p className="p-6">Loading…</p>;
  if (!user) return null;

  /* =========================
     VALIDATION
  ========================= */
  const validate = () => {
    const e = {};
    if (!form.name) e.name = "Template name is required";
    if (!form.category) e.category = "Category is required";
    if (!form.channels.email && !form.channels.whatsapp) {
      e.channels = "Select at least one channel";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  /* =========================
     CREATE
  ========================= */
  const createTemplate = async () => {
    if (!validate()) return;

    try {
      setCreating(true);

      const ref = await addDoc(
        collection(db, "communicationTemplates"),
        {
          name: form.name.trim(),
          category: form.category,
          channels: form.channels,

          emailSubject: "",
          emailHtml: "",
          whatsappText: "",
          attachments: [],

          signatureType: "company",
          signatureText: "",

          active: false,
          createdBy: user.email,
          createdAt: serverTimestamp()
        }
      );

      router.push(`/admin/communication-templates/${ref.id}`);
    } catch (err) {
      setErrors({ form: err.message || "Failed to create template" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <AdminGuard>
      <main className="p-6 w-full">

        {/* HEADER */}
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-800">
            Communication Templates
          </h1>
          <p className="text-sm text-gray-500">
            Email & WhatsApp templates
          </p>
        </div>

        {/* 2 COLUMN FULL WIDTH */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* =========================
              LEFT – LIST
          ========================= */}
          <div className="lg:col-span-8 space-y-4">

            <div className="flex justify-between items-center">
              <h2 className="text-sm font-semibold text-gray-700">
                Templates
              </h2>
              <ViewToggle view={view} setView={setView} />
            </div>

            {!templates.length && (
              <div className="border border-gray-100 rounded-xl bg-white py-14 text-center text-sm text-gray-500">
                No communication templates created yet
              </div>
            )}

            {/* TABLE VIEW */}
            {view === "table" && templates.length > 0 && (
              <div className="border border-gray-100 rounded-xl bg-white overflow-hidden">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50/60 text-xs text-gray-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Template</th>
                      <th className="px-4 py-3 text-left">Category</th>
                      <th className="px-4 py-3 text-left">Channels</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>

                  <tbody>
                    {templates.map(t => (
                      <tr
                        key={t.id}
                        className="border-b border-gray-100 hover:bg-gray-50/60 transition"
                      >
                        <td className="px-4 py-3 font-medium text-gray-800">
                          {t.name}
                        </td>

                        <td className="px-4 py-3 text-xs text-gray-600">
                          {t.category}
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            <ChannelChip
                              label="Email"
                              active={t.channels?.email}
                              color="blue"
                            />
                            <ChannelChip
                              label="WhatsApp"
                              active={t.channels?.whatsapp}
                              color="green"
                            />
                          </div>
                        </td>

                        <td className="px-4 py-3 text-xs text-gray-600">
                          {t.active ? "Active" : "Draft"}
                        </td>

                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-3 text-xs">
                            <button
                              onClick={() =>
                                router.push(
                                  `/admin/communication-templates/${t.id}?mode=view`
                                )
                              }
                              className="text-gray-600 hover:text-gray-900"
                            >
                              View
                            </button>

                            <button
                              onClick={() =>
                                router.push(
                                  `/admin/communication-templates/${t.id}`
                                )
                              }
                              className="text-blue-600 hover:underline"
                            >
                              Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}


            {/* CARD VIEW */}
            {view === "card" && templates.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map(t => (
                  <div
                    key={t.id}
                    className="border border-gray-100 rounded-xl p-4 bg-white hover:bg-gray-50"
                  >
                    <p className="font-semibold">{t.name}</p>
                    <p className="text-xs text-gray-500">{t.category}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <ChannelChip
                        label="Email"
                        active={t.channels?.email}
                        color="blue"
                      />
                      <ChannelChip
                        label="WhatsApp"
                        active={t.channels?.whatsapp}
                        color="green"
                      />
                    </div>
                    <button
                      onClick={() =>
                        router.push(
                          `/admin/communication-templates/${t.id}`
                        )
                      }
                      className="mt-3 text-xs text-blue-600 hover:underline"
                    >
                      Edit
                    </button>
                  </div>
                ))}
              </div>
            )}

          </div>

          {/* =========================
              RIGHT – CREATE (STICKY)
          ========================= */}
          <div className="lg:col-span-4">
            <div className="sticky top-6 border border-gray-100 rounded-xl bg-white p-6 space-y-4">

              <h2 className="text-sm font-semibold text-gray-700">
                Create Template
              </h2>

              {errors.form && (
                <p className="text-sm text-red-600">{errors.form}</p>
              )}

              <div>
                <label className="text-xs text-gray-500">Template Name</label>
                <input
                  className={inputClass}
                  value={form.name}
                  onChange={e => {
                    setForm({ ...form, name: e.target.value });
                    setErrors({ ...errors, name: null });
                  }}
                />
                {errors.name && <p className={errorText}>{errors.name}</p>}
              </div>

              <div>
                <label className="text-xs text-gray-500">Category</label>
                <select
                  className={inputClass}
                  value={form.category}
                  onChange={e => {
                    setForm({ ...form, category: e.target.value });
                    setErrors({ ...errors, category: null });
                  }}
                >
                  <option value="">Select category</option>
                  <option value="welcome">Welcome</option>
                  <option value="companyProfile">Company Profile</option>
                  <option value="pitchDeck">Pitch Deck</option>
                  <option value="thankYou">Thank You</option>
                  <option value="followUp">Follow Up</option>
                </select>
                {errors.category && (
                  <p className={errorText}>{errors.category}</p>
                )}
              </div>

              <div>
                <label className="text-xs text-gray-500">Channels</label>
                <div className="flex gap-6 mt-2">
                  {["email", "whatsapp"].map(c => (
                    <label key={c} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.channels[c]}
                        onChange={e => {
                          setForm({
                            ...form,
                            channels: {
                              ...form.channels,
                              [c]: e.target.checked
                            }
                          });
                          setErrors({ ...errors, channels: null });
                        }}
                      />
                      {c === "email" ? "Email" : "WhatsApp"}
                    </label>
                  ))}
                </div>
                {errors.channels && (
                  <p className={errorText}>{errors.channels}</p>
                )}
              </div>

              <button
                disabled={creating}
                onClick={createTemplate}
                className="w-full px-4 py-2 text-sm rounded-md bg-blue-600 text-white disabled:opacity-60"
              >
                {creating ? "Creating…" : "Create & Edit"}
              </button>

            </div>
          </div>
        </div>
      </main>
    </AdminGuard>
  );
}
