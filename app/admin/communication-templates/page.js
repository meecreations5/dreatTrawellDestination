"use client";

import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import AdminGuard from "@/components/AdminGuard";

/* =========================
   STYLES
========================= */

const inputClass = `
  w-full border border-gray-200 rounded-lg
  px-3 py-2 text-sm bg-white
  focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300
  disabled:bg-gray-50 disabled:text-gray-400
`;

const errorText = "text-xs text-red-600 mt-1";

/* =========================
   HELPERS
========================= */

const toMillis = value => {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  return 0;
};

const getTemplateStatus = template => {
  if (template.status) return template.status;
  return template.active ? "active" : "draft";
};

const formatStatusLabel = status => {
  if (status === "active") return "Active";
  if (status === "inactive") return "Inactive";
  if (status === "deleted") return "Deleted";
  return "Draft";
};

/* =========================
   UI COMPONENTS
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

const StatusChip = ({ status }) => {
  const toneMap = {
    active: "bg-green-50 text-green-700 border-green-100",
    draft: "bg-amber-50 text-amber-700 border-amber-100",
    inactive: "bg-red-50 text-red-700 border-red-100",
    deleted: "bg-gray-100 text-gray-500 border-gray-200"
  };

  return (
    <span
      className={`
        inline-flex items-center px-2 py-0.5 rounded-full border
        text-[11px] font-medium
        ${toneMap[status] || toneMap.draft}
      `}
    >
      {formatStatusLabel(status)}
    </span>
  );
};

const ViewToggle = ({ view, setView }) => (
  <div className="flex border border-gray-200 rounded-lg overflow-hidden">
    {["table", "card"].map(v => (
      <button
        key={v}
        onClick={() => setView(v)}
        className={`px-3 py-1.5 text-xs transition ${
          view === v
            ? "bg-gray-100 text-gray-900"
            : "text-gray-500 hover:bg-gray-50"
        }`}
      >
        {v === "table" ? "Table" : "Cards"}
      </button>
    ))}
  </div>
);

const StatCard = ({ label, value }) => (
  <div className="bg-white border border-gray-100 rounded-xl px-4 py-3">
    <p className="text-xs text-gray-500">{label}</p>
    <p className="text-lg font-semibold text-gray-900 mt-1">{value}</p>
  </div>
);

export default function CommunicationTemplates() {
  const { user, loading: authLoading } = useAuth(true);
  const router = useRouter();

  const [templates, setTemplates] = useState([]);
  const [categories, setCategories] = useState([]);

  const [view, setView] = useState("table");
  const [loadingData, setLoadingData] = useState(true);
  const [pageError, setPageError] = useState("");

  const [filters, setFilters] = useState({
    search: "",
    status: "all",
    channel: "all",
    categoryId: "all"
  });

  const [form, setForm] = useState({
    name: "",
    categoryId: "",
    channels: {
      email: true,
      whatsapp: false
    }
  });

  const [errors, setErrors] = useState({});
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState("");

  /* =========================
     LOAD DATA
  ========================= */
  const loadData = async () => {
    try {
      setLoadingData(true);
      setPageError("");

      const [categorySnap, templateSnap] = await Promise.all([
        getDocs(collection(db, "templateCategories")),
        getDocs(collection(db, "communicationTemplates"))
      ]);

      const categoryRows = categorySnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(c => c.active !== false)
        .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

      const templateRows = templateSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(t => t.deleted !== true)
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));

      setCategories(categoryRows);
      setTemplates(templateRows);
    } catch (err) {
      setPageError(err.message || "Failed to load communication templates");
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  /* =========================
     DERIVED DATA
  ========================= */
  const selectedCategory = useMemo(() => {
    return categories.find(c => c.id === form.categoryId) || null;
  }, [categories, form.categoryId]);

  const stats = useMemo(() => {
    return {
      total: templates.length,
      active: templates.filter(t => getTemplateStatus(t) === "active").length,
      draft: templates.filter(t => getTemplateStatus(t) === "draft").length,
      whatsapp: templates.filter(t => t.channels?.whatsapp).length
    };
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    const q = filters.search.trim().toLowerCase();

    return templates.filter(t => {
      const status = getTemplateStatus(t);

      const name = t.name?.toLowerCase() || "";
      const categoryName = t.categoryName?.toLowerCase() || "";
      const categoryCode = t.categoryCode?.toLowerCase() || "";
      const legacyCategory = t.category?.toLowerCase() || "";

      if (
        q &&
        !name.includes(q) &&
        !categoryName.includes(q) &&
        !categoryCode.includes(q) &&
        !legacyCategory.includes(q)
      ) {
        return false;
      }

      if (filters.status !== "all" && status !== filters.status) {
        return false;
      }

      if (
        filters.channel !== "all" &&
        !t.channels?.[filters.channel]
      ) {
        return false;
      }

      if (filters.categoryId !== "all") {
        const matchById = t.categoryId === filters.categoryId;
        const selected = categories.find(c => c.id === filters.categoryId);
        const matchByCode =
          selected?.code &&
          (t.categoryCode === selected.code || t.category === selected.code);

        if (!matchById && !matchByCode) return false;
      }

      return true;
    });
  }, [templates, filters, categories]);

  /* =========================
     VALIDATION
  ========================= */
  const validate = () => {
    const e = {};

    if (!form.name.trim()) {
      e.name = "Template name is required";
    }

    if (!form.categoryId) {
      e.categoryId = "Category is required";
    }

    if (!form.channels.email && !form.channels.whatsapp) {
      e.channels = "Select at least one channel";
    }

    const duplicate = templates.some(t => {
      const sameName =
        (t.name || "").trim().toLowerCase() ===
        form.name.trim().toLowerCase();

      const sameCategory =
        t.categoryId === form.categoryId ||
        (selectedCategory?.code &&
          (t.categoryCode === selectedCategory.code ||
            t.category === selectedCategory.code));

      return sameName && sameCategory;
    });

    if (duplicate) {
      e.name = "A template with this name already exists in this category";
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  /* =========================
     DELETE TEMPLATE
  ========================= */
  const deleteTemplate = async template => {
    if (!template?.id) return;

    const confirmed = window.confirm(
      `Delete template "${template.name || "Untitled Template"}"?\n\nThis will hide it from the template list and send communication flow.`
    );

    if (!confirmed) return;

    try {
      setDeletingId(template.id);
      setPageError("");

      await updateDoc(doc(db, "communicationTemplates", template.id), {
        deleted: true,
        active: false,
        status: "deleted",

        deletedAt: serverTimestamp(),
        deletedByUid: user?.uid || "",
        deletedByEmail: user?.email || "",
        deletedByName: user?.displayName || user?.email || "",

        updatedAt: serverTimestamp()
      });

      setTemplates(prev => prev.filter(t => t.id !== template.id));
    } catch (err) {
      setPageError(err.message || "Failed to delete template");
    } finally {
      setDeletingId("");
    }
  };

  /* =========================
     CREATE
  ========================= */
  const createTemplate = async () => {
    if (!validate()) return;

    try {
      setCreating(true);
      setPageError("");

      const category = selectedCategory;

      const ref = await addDoc(collection(db, "communicationTemplates"), {
        name: form.name.trim(),
        nameLower: form.name.trim().toLowerCase(),

        category: category?.code || "",

        categoryId: category?.id || "",
        categoryName: category?.name || "",
        categoryCode: category?.code || "",
        categoryRequireAttachment: Boolean(
          category?.rules?.requireAttachment
        ),

        channels: {
          email: Boolean(form.channels.email),
          whatsapp: Boolean(form.channels.whatsapp)
        },

        emailSubject: "",
        emailHtml: "",
        whatsappText: "",

        attachments: [],

        active: false,
        status: "draft",
        version: 1,

        createdByUid: user?.uid || "",
        createdByEmail: user?.email || "",
        createdBy: user?.email || "",

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      router.push(`/admin/communication-templates/${ref.id}`);
    } catch (err) {
      setErrors({
        form: err.message || "Failed to create template"
      });
    } finally {
      setCreating(false);
    }
  };

  if (authLoading) {
    return (
      <main className="p-6">
        <p className="text-sm text-gray-500">Loading...</p>
      </main>
    );
  }

  if (!user) return null;

  return (
    <AdminGuard>
      <main className="p-6 w-full space-y-5 bg-white">
        {/* =========================
           HEADER
        ========================= */}
        <div>
          <h1 className="text-xl font-semibold text-gray-800">
            Communication Templates
          </h1>
          <p className="text-sm text-gray-500">
            Manage Email and WhatsApp templates for travel agent communication.
          </p>
        </div>

        {/* =========================
           PAGE ERROR
        ========================= */}
        {pageError && (
          <div className="border border-red-100 bg-red-50 text-red-700 rounded-xl px-4 py-3 text-sm">
            {pageError}
          </div>
        )}

        {/* =========================
           STATS
        ========================= */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <StatCard label="Total Templates" value={stats.total} />
          <StatCard label="Active" value={stats.active} />
          <StatCard label="Draft" value={stats.draft} />
          <StatCard label="WhatsApp Enabled" value={stats.whatsapp} />
        </div>

        {/* =========================
           2 COLUMN FULL WIDTH
        ========================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* =========================
              LEFT: LIST
          ========================= */}
          <div className="lg:col-span-8 space-y-4">
            <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-gray-700">
                    Templates
                  </h2>
                  <p className="text-xs text-gray-500">
                    Showing {filteredTemplates.length} of {templates.length}
                  </p>
                </div>

                <ViewToggle view={view} setView={setView} />
              </div>

              {/* FILTERS */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input
                  value={filters.search}
                  onChange={e =>
                    setFilters(prev => ({
                      ...prev,
                      search: e.target.value
                    }))
                  }
                  placeholder="Search template/category"
                  className={inputClass}
                />

                <select
                  value={filters.status}
                  onChange={e =>
                    setFilters(prev => ({
                      ...prev,
                      status: e.target.value
                    }))
                  }
                  className={inputClass}
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="inactive">Inactive</option>
                </select>

                <select
                  value={filters.channel}
                  onChange={e =>
                    setFilters(prev => ({
                      ...prev,
                      channel: e.target.value
                    }))
                  }
                  className={inputClass}
                >
                  <option value="all">All Channels</option>
                  <option value="email">Email</option>
                  <option value="whatsapp">WhatsApp</option>
                </select>

                <select
                  value={filters.categoryId}
                  onChange={e =>
                    setFilters(prev => ({
                      ...prev,
                      categoryId: e.target.value
                    }))
                  }
                  className={inputClass}
                >
                  <option value="all">All Categories</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {loadingData ? (
              <div className="border border-gray-100 rounded-xl bg-white py-14 text-center text-sm text-gray-500">
                Loading templates...
              </div>
            ) : !templates.length ? (
              <div className="border border-gray-100 rounded-xl bg-white py-14 text-center text-sm text-gray-500">
                No communication templates created yet
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="border border-gray-100 rounded-xl bg-white py-14 text-center text-sm text-gray-500">
                No templates match your filters
              </div>
            ) : (
              <>
                {/* TABLE VIEW */}
                {view === "table" && (
                  <div className="border border-gray-100 rounded-xl bg-white overflow-hidden">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50/60 text-xs text-gray-500">
                        <tr>
                          <th className="px-4 py-3 text-left">Template</th>
                          <th className="px-4 py-3 text-left">Category</th>
                          <th className="px-4 py-3 text-left">Channels</th>
                          <th className="px-4 py-3 text-left">Status</th>
                          <th className="px-4 py-3 text-right">Action</th>
                        </tr>
                      </thead>

                      <tbody>
                        {filteredTemplates.map(t => {
                          const status = getTemplateStatus(t);

                          return (
                            <tr
                              key={t.id}
                              className="border-b border-gray-100 hover:bg-gray-50/60 transition"
                            >
                              <td className="px-4 py-3">
                                <p className="font-medium text-gray-800">
                                  {t.name || "Untitled Template"}
                                </p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                  Version {t.version || 1}
                                </p>
                              </td>

                              <td className="px-4 py-3">
                                <p className="text-xs font-medium text-gray-700">
                                  {t.categoryName || t.category || "-"}
                                </p>
                                {t.categoryCode && (
                                  <p className="text-[11px] text-gray-400 mt-0.5">
                                    {t.categoryCode}
                                  </p>
                                )}
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

                              <td className="px-4 py-3">
                                <StatusChip status={status} />
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

                                  <button
                                    disabled={deletingId === t.id}
                                    onClick={() => deleteTemplate(t)}
                                    className="text-red-600 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {deletingId === t.id
                                      ? "Deleting..."
                                      : "Delete"}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* CARD VIEW */}
                {view === "card" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredTemplates.map(t => {
                      const status = getTemplateStatus(t);

                      return (
                        <div
                          key={t.id}
                          className="border border-gray-100 rounded-xl p-4 bg-white hover:bg-gray-50 transition"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-gray-800">
                                {t.name || "Untitled Template"}
                              </p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {t.categoryName || t.category || "-"}
                              </p>
                            </div>

                            <StatusChip status={status} />
                          </div>

                          <div className="flex flex-wrap gap-1.5 mt-3">
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

                          {t.categoryRequireAttachment && (
                            <p className="text-[11px] text-amber-700 bg-amber-50 rounded-md px-2 py-1 mt-3 inline-block">
                              Attachment required
                            </p>
                          )}

                          <div className="flex justify-end gap-3 mt-4 text-xs">
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

                            <button
                              disabled={deletingId === t.id}
                              onClick={() => deleteTemplate(t)}
                              className="text-red-600 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {deletingId === t.id
                                ? "Deleting..."
                                : "Delete"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          {/* =========================
              RIGHT: CREATE
          ========================= */}
          <div className="lg:col-span-4">
            <div className="sticky top-6 border border-gray-100 rounded-xl bg-white p-6 space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-700">
                  Create Template
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Select category and channel first. Content will be added in
                  the editor.
                </p>
              </div>

              {errors.form && (
                <p className="text-sm text-red-600">{errors.form}</p>
              )}

              {!categories.length && !loadingData && (
                <div className="bg-amber-50 border border-amber-100 text-amber-700 rounded-lg px-3 py-2 text-xs">
                  Create at least one active template category before creating a
                  template.
                </div>
              )}

              <div>
                <label className="text-xs text-gray-500">
                  Template Name
                </label>
                <input
                  className={inputClass}
                  placeholder="Example: Welcome message for new agent"
                  value={form.name}
                  onChange={e => {
                    setForm(prev => ({
                      ...prev,
                      name: e.target.value
                    }));
                    setErrors(prev => ({
                      ...prev,
                      name: null
                    }));
                  }}
                />
                {errors.name && <p className={errorText}>{errors.name}</p>}
              </div>

              <div>
                <label className="text-xs text-gray-500">Category</label>
                <select
                  className={inputClass}
                  value={form.categoryId}
                  disabled={!categories.length}
                  onChange={e => {
                    setForm(prev => ({
                      ...prev,
                      categoryId: e.target.value
                    }));
                    setErrors(prev => ({
                      ...prev,
                      categoryId: null
                    }));
                  }}
                >
                  <option value="">Select category</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                {errors.categoryId && (
                  <p className={errorText}>{errors.categoryId}</p>
                )}

                {selectedCategory?.rules?.requireAttachment && (
                  <p className="text-[11px] text-amber-700 mt-1">
                    This category requires an attachment before activation.
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs text-gray-500">Channels</label>

                <div className="flex gap-6 mt-2">
                  {["email", "whatsapp"].map(c => (
                    <label
                      key={c}
                      className="flex items-center gap-2 text-sm text-gray-700"
                    >
                      <input
                        type="checkbox"
                        checked={form.channels[c]}
                        onChange={e => {
                          setForm(prev => ({
                            ...prev,
                            channels: {
                              ...prev.channels,
                              [c]: e.target.checked
                            }
                          }));
                          setErrors(prev => ({
                            ...prev,
                            channels: null
                          }));
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
                disabled={creating || !categories.length}
                onClick={createTemplate}
                className="w-full px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {creating ? "Creating..." : "Create & Edit"}
              </button>
            </div>
          </div>
        </div>
      </main>
    </AdminGuard>
  );
}