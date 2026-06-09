"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import {
  Archive,
  CheckCircle2,
  Edit2,
  Folder,
  Plus,
  RotateCcw,
  Save,
  X
} from "lucide-react";

/* =========================
   HELPERS
========================= */
function createSlug(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function CategoryStatusBadge({ active, archived }) {
  if (archived) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
        <Archive className="h-3.5 w-3.5" />
        Archived
      </span>
    );
  }

  if (!active) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700">
        <X className="h-3.5 w-3.5" />
        Disabled
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
      <CheckCircle2 className="h-3.5 w-3.5" />
      Active
    </span>
  );
}

export default function AssetCategoryManager() {
  const { user } = useAuth(true);

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    name: "",
    description: "",
    sortOrder: ""
  });

  const [errors, setErrors] = useState({});
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState("");
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    sortOrder: ""
  });

  const [savingId, setSavingId] = useState("");
  const [pageError, setPageError] = useState("");

  const actor =
    user?.email || user?.displayName || user?.uid || "system";

  /* =========================
     LOAD CATEGORIES
  ========================= */
  const fetchCategories = async () => {
    setLoading(true);
    setPageError("");

    try {
      const snap = await getDocs(collection(db, "asset_categories"));

      const rows = snap.docs.map(item => ({
        id: item.id,
        ...item.data()
      }));

      rows.sort((a, b) => {
        const orderA = Number(a.sortOrder || 9999);
        const orderB = Number(b.sortOrder || 9999);

        if (orderA !== orderB) return orderA - orderB;

        return String(a.name || "").localeCompare(String(b.name || ""));
      });

      setCategories(rows);
    } catch (error) {
      console.error(error);
      setPageError("Unable to load categories.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.isAdmin) {
      fetchCategories();
    }
  }, [user?.isAdmin]);

  /* =========================
     STATS
  ========================= */
  const stats = useMemo(() => {
    return {
      total: categories.length,
      active: categories.filter(c => c.active !== false && !c.archived).length,
      disabled: categories.filter(c => c.active === false && !c.archived).length,
      archived: categories.filter(c => c.archived).length
    };
  }, [categories]);

  /* =========================
     CREATE CATEGORY
  ========================= */
  const createCategory = async () => {
    const nextErrors = {};

    const name = form.name.trim();
    const description = form.description.trim();
    const sortOrder = form.sortOrder
      ? Number(form.sortOrder)
      : categories.length + 1;

    if (!name) {
      nextErrors.name = "Category name is required";
    }

    if (Number.isNaN(sortOrder) || sortOrder < 1) {
      nextErrors.sortOrder = "Sort order must be a valid number";
    }

    const duplicate = categories.some(
      c =>
        !c.archived &&
        String(c.name || "").trim().toLowerCase() === name.toLowerCase()
    );

    if (duplicate) {
      nextErrors.name = "Category already exists";
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length) return;

    setCreating(true);
    setPageError("");

    try {
      await addDoc(collection(db, "asset_categories"), {
        name,
        slug: createSlug(name),
        description,
        active: true,
        archived: false,
        sortOrder,
        createdBy: actor,
        createdAt: serverTimestamp(),
        updatedBy: actor,
        updatedAt: serverTimestamp()
      });

      setForm({
        name: "",
        description: "",
        sortOrder: ""
      });

      setErrors({});
      await fetchCategories();
    } catch (error) {
      console.error(error);
      setPageError("Unable to create category.");
    } finally {
      setCreating(false);
    }
  };

  /* =========================
     EDIT CATEGORY
  ========================= */
  const startEdit = category => {
    setEditingId(category.id);
    setEditForm({
      name: category.name || "",
      description: category.description || "",
      sortOrder: category.sortOrder || ""
    });
  };

  const cancelEdit = () => {
    setEditingId("");
    setEditForm({
      name: "",
      description: "",
      sortOrder: ""
    });
  };

  const saveCategory = async category => {
    const name = editForm.name.trim();
    const description = editForm.description.trim();
    const sortOrder = editForm.sortOrder
      ? Number(editForm.sortOrder)
      : Number(category.sortOrder || 1);

    if (!name) {
      setPageError("Category name cannot be empty.");
      return;
    }

    if (Number.isNaN(sortOrder) || sortOrder < 1) {
      setPageError("Sort order must be a valid number.");
      return;
    }

    const duplicate = categories.some(
      c =>
        c.id !== category.id &&
        !c.archived &&
        String(c.name || "").trim().toLowerCase() === name.toLowerCase()
    );

    if (duplicate) {
      setPageError("Another category with this name already exists.");
      return;
    }

    setSavingId(category.id);
    setPageError("");

    try {
      await updateDoc(doc(db, "asset_categories", category.id), {
        name,
        slug: createSlug(name),
        description,
        sortOrder,
        updatedBy: actor,
        updatedAt: serverTimestamp()
      });

      cancelEdit();
      await fetchCategories();
    } catch (error) {
      console.error(error);
      setPageError("Unable to update category.");
    } finally {
      setSavingId("");
    }
  };

  /* =========================
     STATUS ACTIONS
  ========================= */
  const updateCategoryStatus = async (category, updates) => {
    setSavingId(category.id);
    setPageError("");

    try {
      await updateDoc(doc(db, "asset_categories", category.id), {
        ...updates,
        updatedBy: actor,
        updatedAt: serverTimestamp()
      });

      await fetchCategories();
    } catch (error) {
      console.error(error);
      setPageError("Unable to update category status.");
    } finally {
      setSavingId("");
    }
  };

  if (!user?.isAdmin) return null;

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm">
      <div className="px-5 py-4 border-b border-gray-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">
            Repository Categories
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Create reusable categories for documents, files, creatives, contracts, and assets.
          </p>
        </div>

        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="rounded-lg bg-gray-50 px-3 py-2">
            <p className="text-[11px] text-gray-500">Total</p>
            <p className="text-sm font-semibold text-gray-900">{stats.total}</p>
          </div>

          <div className="rounded-lg bg-green-50 px-3 py-2">
            <p className="text-[11px] text-green-600">Active</p>
            <p className="text-sm font-semibold text-green-700">{stats.active}</p>
          </div>

          <div className="rounded-lg bg-orange-50 px-3 py-2">
            <p className="text-[11px] text-orange-600">Disabled</p>
            <p className="text-sm font-semibold text-orange-700">{stats.disabled}</p>
          </div>

          <div className="rounded-lg bg-gray-100 px-3 py-2">
            <p className="text-[11px] text-gray-500">Archived</p>
            <p className="text-sm font-semibold text-gray-700">{stats.archived}</p>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {pageError && (
          <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {pageError}
          </div>
        )}

        {/* CREATE CATEGORY */}
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            <div className="lg:col-span-4 space-y-1">
              <label className="text-xs font-medium text-gray-600">
                Category Name <span className="text-red-500">*</span>
              </label>
              <input
                value={form.name}
                onChange={e =>
                  setForm(prev => ({
                    ...prev,
                    name: e.target.value
                  }))
                }
                placeholder="Example: Company Profile"
                className={`mui-input ${
                  errors.name ? "border-red-500" : ""
                }`}
              />
              {errors.name && (
                <p className="text-xs text-red-600">{errors.name}</p>
              )}
            </div>

            <div className="lg:col-span-5 space-y-1">
              <label className="text-xs font-medium text-gray-600">
                Description
              </label>
              <input
                value={form.description}
                onChange={e =>
                  setForm(prev => ({
                    ...prev,
                    description: e.target.value
                  }))
                }
                placeholder="Short description"
                className="mui-input"
              />
            </div>

            <div className="lg:col-span-1 space-y-1">
              <label className="text-xs font-medium text-gray-600">
                Order
              </label>
              <input
                type="number"
                min="1"
                value={form.sortOrder}
                onChange={e =>
                  setForm(prev => ({
                    ...prev,
                    sortOrder: e.target.value
                  }))
                }
                placeholder="1"
                className={`mui-input ${
                  errors.sortOrder ? "border-red-500" : ""
                }`}
              />
            </div>

            <div className="lg:col-span-2 flex items-end">
              <button
                onClick={createCategory}
                disabled={creating}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                {creating ? "Adding..." : "Add Category"}
              </button>
            </div>
          </div>
        </div>

        {/* CATEGORY LIST */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(item => (
              <div
                key={item}
                className="h-20 rounded-xl bg-gray-100 animate-pulse"
              />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center">
            <Folder className="h-8 w-8 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-800">
              No categories created yet
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Create your first repository category above.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {categories.map(category => {
              const isEditing = editingId === category.id;
              const isSaving = savingId === category.id;

              return (
                <div
                  key={category.id}
                  className={`rounded-xl border p-4 ${
                    category.archived
                      ? "border-gray-100 bg-gray-50"
                      : "border-gray-100 bg-white"
                  }`}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex gap-3 min-w-0 flex-1">
                      <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                        <Folder className="h-5 w-5" />
                      </div>

                      <div className="min-w-0 flex-1">
                        {isEditing ? (
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                            <div className="md:col-span-4">
                              <input
                                value={editForm.name}
                                onChange={e =>
                                  setEditForm(prev => ({
                                    ...prev,
                                    name: e.target.value
                                  }))
                                }
                                className="mui-input"
                              />
                            </div>

                            <div className="md:col-span-6">
                              <input
                                value={editForm.description}
                                onChange={e =>
                                  setEditForm(prev => ({
                                    ...prev,
                                    description: e.target.value
                                  }))
                                }
                                className="mui-input"
                              />
                            </div>

                            <div className="md:col-span-2">
                              <input
                                type="number"
                                min="1"
                                value={editForm.sortOrder}
                                onChange={e =>
                                  setEditForm(prev => ({
                                    ...prev,
                                    sortOrder: e.target.value
                                  }))
                                }
                                className="mui-input"
                              />
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-sm font-semibold text-gray-900">
                                {category.name}
                              </h3>
                              <CategoryStatusBadge
                                active={category.active}
                                archived={category.archived}
                              />
                              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">
                                Order: {category.sortOrder || "—"}
                              </span>
                            </div>

                            <p className="text-xs text-gray-500 mt-1">
                              {category.description || "No description added"}
                            </p>

                            <p className="text-[11px] text-gray-400 mt-1">
                              Slug: {category.slug || "-"}
                            </p>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => saveCategory(category)}
                            disabled={isSaving}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                          >
                            <Save className="h-3.5 w-3.5" />
                            {isSaving ? "Saving..." : "Save"}
                          </button>

                          <button
                            onClick={cancelEdit}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            <X className="h-3.5 w-3.5" />
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          {!category.archived && (
                            <button
                              onClick={() => startEdit(category)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                              Edit
                            </button>
                          )}

                          {!category.archived && (
                            <button
                              onClick={() =>
                                updateCategoryStatus(category, {
                                  active: category.active === false
                                })
                              }
                              disabled={isSaving}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                            >
                              {category.active === false ? "Enable" : "Disable"}
                            </button>
                          )}

                          {category.archived ? (
                            <button
                              onClick={() =>
                                updateCategoryStatus(category, {
                                  archived: false,
                                  active: true
                                })
                              }
                              disabled={isSaving}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-2 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-60"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              Restore
                            </button>
                          ) : (
                            <button
                              onClick={() =>
                                updateCategoryStatus(category, {
                                  archived: true,
                                  active: false
                                })
                              }
                              disabled={isSaving}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-60"
                            >
                              <Archive className="h-3.5 w-3.5" />
                              Archive
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}