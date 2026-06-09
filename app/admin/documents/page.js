"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  doc as firestoreDoc,
  getDocs,
  serverTimestamp,
  updateDoc
} from "firebase/firestore";
import {
  getDownloadURL,
  getStorage,
  ref,
  uploadBytes
} from "firebase/storage";
import { useAuth } from "@/hooks/useAuth";
import CheckFiles from "./CheckFiles";
import AssetCategoryManager from "./AssetCategoryManager";
import {
  Archive,
  CheckCircle2,
  Download,
  Eye,
  Folder,
  RotateCcw,
  Search,
  Trash2,
  UploadCloud,
  X
} from "lucide-react";

const storage = getStorage();

const ASSET_TYPES = [
  { value: "document", label: "Document" },
  { value: "presentation", label: "Presentation" },
  { value: "spreadsheet", label: "Spreadsheet" },
  { value: "image", label: "Image" },
  { value: "video", label: "Video" },
  { value: "link", label: "Link" },
  { value: "other", label: "Other" }
];

const VISIBILITY_OPTIONS = [
  { value: "adminOnly", label: "Admin Only" },
  { value: "team", label: "Team" },
  { value: "sales", label: "Sales" },
  { value: "public", label: "Public Shareable" }
];

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "draft", label: "Draft" }
];

const ALLOWED_EXTENSIONS = [
  "pdf",
  "ppt",
  "pptx",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "mp4",
  "mov"
];

const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/* =========================
   UI HELPERS
========================= */
function Surface({ title, subtitle, action, children }) {
  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm">
      <div className="px-5 py-4 border-b border-gray-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-0.5">
              {subtitle}
            </p>
          )}
        </div>

        {action}
      </div>

      <div className="p-5">{children}</div>
    </section>
  );
}

function Input({ label, value, onChange, error, required, ...props }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-gray-600">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        {...props}
        className={`mui-input ${
          error
            ? "border-red-500 focus:border-red-500 focus:ring-red-200"
            : ""
        }`}
      />

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function Textarea({ label, value, onChange, error, required, ...props }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-gray-600">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        {...props}
        className={`mui-input min-h-[90px] resize-none ${
          error
            ? "border-red-500 focus:border-red-500 focus:ring-red-200"
            : ""
        }`}
      />

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function Select({ label, value, onChange, error, required, children, ...props }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-gray-600">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        {...props}
        className={`mui-input ${
          error
            ? "border-red-500 focus:border-red-500 focus:ring-red-200"
            : ""
        }`}
      >
        {children}
      </select>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function StatusBadge({ status }) {
  if (status === "archived") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
        <Archive className="h-3.5 w-3.5" />
        Archived
      </span>
    );
  }

  if (status === "draft") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700">
        Draft
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

/* =========================
   HELPERS
========================= */
function createSlug(value = "") {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function safeFileName(name = "") {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function getFileExtension(fileName = "") {
  return fileName.split(".").pop()?.toLowerCase() || "";
}

function validateFile(file) {
  if (!file) return "File required";

  const extension = getFileExtension(file.name);

  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return `Allowed files: ${ALLOWED_EXTENSIONS.join(", ")}`;
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `File size should be less than ${MAX_FILE_SIZE_MB} MB`;
  }

  return "";
}

function parseTags(value = "") {
  return value
    .split(",")
    .map(tag => tag.trim().toLowerCase())
    .filter(Boolean);
}

function formatTags(tags = []) {
  if (!Array.isArray(tags)) return "";
  return tags.join(", ");
}

function formatBytes(bytes) {
  if (!bytes) return "—";

  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDate(value) {
  if (!value) return "—";

  try {
    const date = value?.toDate ? value.toDate() : new Date(value);

    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return "—";
  }
}

function getEffectiveStatus(asset) {
  if (asset.status) return asset.status;
  if (asset.active === false) return "draft";
  return "active";
}

function getAssetTypeLabel(value) {
  return ASSET_TYPES.find(type => type.value === value)?.label || "Other";
}

function getVisibilityLabel(value) {
  return (
    VISIBILITY_OPTIONS.find(option => option.value === value)?.label ||
    "Team"
  );
}

function isImageAsset(asset) {
  const extension = String(asset.currentFileExtension || "").toLowerCase();
  const fileType = String(asset.currentFileType || "").toLowerCase();

  return (
    asset.assetType === "image" ||
    fileType.startsWith("image/") ||
    ["jpg", "jpeg", "png", "webp"].includes(extension)
  );
}

export default function DocumentsPage() {
  const { user } = useAuth(true);

  const [documents, setDocuments] = useState([]);
  const [categories, setCategories] = useState([]);

  const [loading, setLoading] = useState(true);
  const [categoryLoading, setCategoryLoading] = useState(true);

  const [form, setForm] = useState({
    name: "",
    description: "",
    categoryId: "",
    assetType: "document",
    visibility: "team",
    status: "active",
    tagsText: "",
    versionNote: "",
    file: null
  });

  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState("");

  const [versionFiles, setVersionFiles] = useState({});
  const [versionNotes, setVersionNotes] = useState({});
  const [uploadingDocId, setUploadingDocId] = useState("");
  const [deletingDocId, setDeletingDocId] = useState("");
  const [previewAsset, setPreviewAsset] = useState(null);

  const [filters, setFilters] = useState({
    search: "",
    categoryId: "all",
    status: "all",
    assetType: "all",
    visibility: "all"
  });

  const actor =
    user?.email || user?.displayName || user?.uid || "system";

  /* =========================
     LOAD CATEGORIES
  ========================= */
  const fetchCategories = async () => {
    setCategoryLoading(true);

    try {
      const snap = await getDocs(collection(db, "asset_categories"));

      const rows = snap.docs
        .map(item => ({
          id: item.id,
          ...item.data()
        }))
        .filter(category => category.archived !== true)
        .sort((a, b) => {
          const orderA = Number(a.sortOrder || 9999);
          const orderB = Number(b.sortOrder || 9999);

          if (orderA !== orderB) return orderA - orderB;

          return String(a.name || "").localeCompare(String(b.name || ""));
        });

      setCategories(rows);

      const firstActive = rows.find(category => category.active !== false);

      setForm(prev => ({
        ...prev,
        categoryId: prev.categoryId || firstActive?.id || ""
      }));
    } catch (error) {
      console.error(error);
      setPageError("Unable to load categories.");
    } finally {
      setCategoryLoading(false);
    }
  };

  /* =========================
     LOAD ASSETS
  ========================= */
  const fetchDocs = async () => {
    setLoading(true);

    try {
      const snap = await getDocs(collection(db, "documents"));

      const rows = snap.docs
        .map(item => ({
          id: item.id,
          ...item.data()
        }))
        .filter(item => item.deleted !== true);

      rows.sort((a, b) => {
        const aTime =
          a.updatedAt?.toMillis?.() ||
          a.createdAt?.toMillis?.() ||
          0;

        const bTime =
          b.updatedAt?.toMillis?.() ||
          b.createdAt?.toMillis?.() ||
          0;

        return bTime - aTime;
      });

      setDocuments(rows);
    } catch (error) {
      console.error(error);
      setPageError("Unable to load assets.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.isAdmin) return;

    fetchCategories();
    fetchDocs();
  }, [user?.isAdmin]);

  const activeCategories = useMemo(() => {
    return categories.filter(
      category => category.active !== false && category.archived !== true
    );
  }, [categories]);

  const selectedCategory = useMemo(() => {
    return categories.find(category => category.id === form.categoryId) || null;
  }, [categories, form.categoryId]);

  /* =========================
     STATS
  ========================= */
  const stats = useMemo(() => {
    return {
      total: documents.length,
      active: documents.filter(item => getEffectiveStatus(item) === "active")
        .length,
      draft: documents.filter(item => getEffectiveStatus(item) === "draft")
        .length,
      archived: documents.filter(
        item => getEffectiveStatus(item) === "archived"
      ).length
    };
  }, [documents]);

  /* =========================
     UPLOAD VERSION
  ========================= */
  const uploadVersion = async ({
    documentId,
    version,
    file,
    category,
    versionNote
  }) => {
    const cleanedName = safeFileName(file.name);
    const categorySlug =
      category?.slug || createSlug(category?.name || "uncategorized");

    const storagePath = `repository-assets/${categorySlug}/${documentId}/v${version}/${Date.now()}-${cleanedName}`;
    const storageRef = ref(storage, storagePath);

    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);

    await addDoc(collection(db, "documents", documentId, "versions"), {
      version,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type || "",
      fileExtension: getFileExtension(file.name),
      storagePath,
      url,
      versionNote: versionNote?.trim() || "",
      createdBy: actor,
      createdAt: serverTimestamp()
    });

    await updateDoc(firestoreDoc(db, "documents", documentId), {
      currentVersion: version,
      currentUrl: url,
      currentFileName: file.name,
      currentFileSize: file.size,
      currentFileType: file.type || "",
      currentFileExtension: getFileExtension(file.name),
      currentStoragePath: storagePath,
      updatedBy: actor,
      updatedAt: serverTimestamp()
    });

    return url;
  };

  /* =========================
     CREATE ASSET
  ========================= */
  const createDocument = async () => {
    const nextErrors = {};

    const name = form.name.trim();
    const description = form.description.trim();
    const tags = parseTags(form.tagsText);
    const category = categories.find(item => item.id === form.categoryId);

    if (!name) nextErrors.name = "Asset title is required";
    if (!form.categoryId) nextErrors.categoryId = "Category is required";
    if (form.categoryId && !category) nextErrors.categoryId = "Category not found";

    const fileError = validateFile(form.file);
    if (fileError) nextErrors.file = fileError;

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    setPageError("");

    try {
      const categorySlug = category.slug || createSlug(category.name);

      const refDoc = await addDoc(collection(db, "documents"), {
        name,
        title: name,
        description,

        categoryId: category.id,
        categoryName: category.name,
        categorySlug,

        type: categorySlug,
        assetType: form.assetType,

        visibility: form.visibility,
        status: form.status,
        active: form.status === "active",
        archived: false,
        deleted: false,

        tags,

        currentVersion: 0,
        currentUrl: "",
        currentFileName: "",
        currentFileSize: null,
        currentFileType: "",
        currentFileExtension: "",
        currentStoragePath: "",

        downloadCount: 0,

        createdBy: actor,
        createdAt: serverTimestamp(),
        updatedBy: actor,
        updatedAt: serverTimestamp()
      });

      await uploadVersion({
        documentId: refDoc.id,
        version: 1,
        file: form.file,
        category,
        versionNote: form.versionNote
      });

      setForm({
        name: "",
        description: "",
        categoryId: activeCategories[0]?.id || "",
        assetType: "document",
        visibility: "team",
        status: "active",
        tagsText: "",
        versionNote: "",
        file: null
      });

      setErrors({});
      await fetchDocs();
    } catch (error) {
      console.error(error);
      setPageError("Unable to create asset.");
    } finally {
      setSaving(false);
    }
  };

  /* =========================
     UPDATE META
  ========================= */
  const saveMeta = async (asset, updates) => {
    setPageError("");

    try {
      const payload = {
        ...updates,
        updatedBy: actor,
        updatedAt: serverTimestamp()
      };

      if (updates.name !== undefined) {
        payload.name = updates.name.trim();
        payload.title = updates.name.trim();
      }

      if (updates.status !== undefined) {
        payload.active = updates.status === "active";
        payload.archived = updates.status === "archived";
      }

      await updateDoc(firestoreDoc(db, "documents", asset.id), payload);

      await fetchDocs();
    } catch (error) {
      console.error(error);
      setPageError("Unable to update asset.");
    }
  };

  /* =========================
     DELETE ASSET
     Soft delete only
  ========================= */
  const deleteAsset = async asset => {
    const assetName = asset.title || asset.name || "this asset";

    const confirmed = window.confirm(
      `Delete "${assetName}"?\n\nThis will remove it from the repository. File/version history will remain safely stored.`
    );

    if (!confirmed) return;

    setDeletingDocId(asset.id);
    setPageError("");

    try {
      await updateDoc(firestoreDoc(db, "documents", asset.id), {
        deleted: true,
        deletedBy: actor,
        deletedAt: serverTimestamp(),

        status: "deleted",
        active: false,
        archived: true,

        updatedBy: actor,
        updatedAt: serverTimestamp()
      });

      await fetchDocs();
    } catch (error) {
      console.error(error);
      setPageError("Unable to delete asset.");
    } finally {
      setDeletingDocId("");
    }
  };

  const updateDocumentCategory = async (asset, categoryId) => {
    const category = categories.find(item => item.id === categoryId);
    if (!category) return;

    const categorySlug = category.slug || createSlug(category.name);

    await saveMeta(asset, {
      categoryId: category.id,
      categoryName: category.name,
      categorySlug,
      type: categorySlug
    });
  };

  /* =========================
     NEW VERSION
  ========================= */
  const uploadNewVersion = async asset => {
    const file = versionFiles[asset.id];
    const fileError = validateFile(file);

    if (fileError) {
      setPageError(fileError);
      return;
    }

    const category =
      categories.find(item => item.id === asset.categoryId) || {
        name: asset.categoryName || "Uncategorized",
        slug: asset.categorySlug || "uncategorized"
      };

    setUploadingDocId(asset.id);
    setPageError("");

    try {
      await uploadVersion({
        documentId: asset.id,
        version: Number(asset.currentVersion || 0) + 1,
        file,
        category,
        versionNote: versionNotes[asset.id] || ""
      });

      setVersionFiles(prev => {
        const copy = { ...prev };
        delete copy[asset.id];
        return copy;
      });

      setVersionNotes(prev => {
        const copy = { ...prev };
        delete copy[asset.id];
        return copy;
      });

      await fetchDocs();
    } catch (error) {
      console.error(error);
      setPageError("Unable to upload new version.");
    } finally {
      setUploadingDocId("");
    }
  };

  /* =========================
     FILTER ASSETS
  ========================= */
  const filteredDocuments = useMemo(() => {
    const search = filters.search.trim().toLowerCase();

    return documents.filter(asset => {
      const status = getEffectiveStatus(asset);
      const tags = Array.isArray(asset.tags) ? asset.tags : [];

      const matchesSearch =
        !search ||
        asset.name?.toLowerCase().includes(search) ||
        asset.title?.toLowerCase().includes(search) ||
        asset.description?.toLowerCase().includes(search) ||
        asset.categoryName?.toLowerCase().includes(search) ||
        asset.currentFileName?.toLowerCase().includes(search) ||
        tags.some(tag => tag.toLowerCase().includes(search));

      const matchesCategory =
        filters.categoryId === "all" ||
        asset.categoryId === filters.categoryId;

      const matchesStatus =
        filters.status === "all" || status === filters.status;

      const matchesAssetType =
        filters.assetType === "all" ||
        asset.assetType === filters.assetType;

      const matchesVisibility =
        filters.visibility === "all" ||
        asset.visibility === filters.visibility;

      return (
        matchesSearch &&
        matchesCategory &&
        matchesStatus &&
        matchesAssetType &&
        matchesVisibility
      );
    });
  }, [documents, filters]);

  if (!user || !user.isAdmin) return null;

  return (
    <main className="min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* HEADER */}
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Repository & Asset Library
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Create categories and store documents, presentations, images, contracts, templates, and other company assets.
          </p>
        </div>

        {pageError && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {pageError}
          </div>
        )}

        {/* KPI */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-gray-500">Total Assets</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">
              {stats.total}
            </p>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-gray-500">Active</p>
            <p className="text-2xl font-semibold text-green-700 mt-1">
              {stats.active}
            </p>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-gray-500">Draft</p>
            <p className="text-2xl font-semibold text-orange-700 mt-1">
              {stats.draft}
            </p>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-gray-500">Archived</p>
            <p className="text-2xl font-semibold text-gray-700 mt-1">
              {stats.archived}
            </p>
          </div>
        </div>

        {/* CATEGORY MANAGER */}
        <AssetCategoryManager />

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* CREATE ASSET */}
          <Surface
            title="Upload Asset"
            subtitle="Upload the first version of a new repository asset."
          >
            <div className="space-y-4">
              <Input
                label="Asset Title"
                required
                value={form.name}
                error={errors.name}
                placeholder="Example: DreamTrawell Company Profile 2026"
                onChange={value =>
                  setForm(prev => ({
                    ...prev,
                    name: value
                  }))
                }
              />

              <Textarea
                label="Description"
                value={form.description}
                placeholder="Short description about this asset"
                onChange={value =>
                  setForm(prev => ({
                    ...prev,
                    description: value
                  }))
                }
              />

              <Select
                label="Category"
                required
                value={form.categoryId}
                error={errors.categoryId}
                disabled={categoryLoading || activeCategories.length === 0}
                onChange={value =>
                  setForm(prev => ({
                    ...prev,
                    categoryId: value
                  }))
                }
              >
                <option value="">
                  {categoryLoading ? "Loading categories..." : "Select category"}
                </option>

                {activeCategories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>

              {selectedCategory?.description && (
                <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3">
                  <p className="text-xs font-medium text-blue-800">
                    Selected Category
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    {selectedCategory.description}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Select
                  label="Asset Type"
                  value={form.assetType}
                  onChange={value =>
                    setForm(prev => ({
                      ...prev,
                      assetType: value
                    }))
                  }
                >
                  {ASSET_TYPES.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </Select>

                <Select
                  label="Visibility"
                  value={form.visibility}
                  onChange={value =>
                    setForm(prev => ({
                      ...prev,
                      visibility: value
                    }))
                  }
                >
                  {VISIBILITY_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>

              <Select
                label="Status"
                value={form.status}
                onChange={value =>
                  setForm(prev => ({
                    ...prev,
                    status: value
                  }))
                }
              >
                {STATUS_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>

              <Input
                label="Tags"
                value={form.tagsText}
                placeholder="Example: bali, honeymoon, sales-kit"
                onChange={value =>
                  setForm(prev => ({
                    ...prev,
                    tagsText: value
                  }))
                }
              />

              <Textarea
                label="Version Note"
                value={form.versionNote}
                placeholder="Example: Initial upload"
                onChange={value =>
                  setForm(prev => ({
                    ...prev,
                    versionNote: value
                  }))
                }
              />

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600">
                  Upload File <span className="text-red-500">*</span>
                </label>

                <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center hover:bg-gray-100">
                  <UploadCloud className="h-7 w-7 text-gray-400 mb-2" />

                  <span className="text-sm font-medium text-gray-700">
                    {form.file ? form.file.name : "Choose file"}
                  </span>

                  <span className="text-xs text-gray-500 mt-1">
                    PDF, PPT, DOC, Excel, images, videos up to {MAX_FILE_SIZE_MB} MB
                  </span>

                  <input
                    type="file"
                    accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.mp4,.mov"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0] || null;
                      const fileError = file ? validateFile(file) : "File required";

                      setForm(prev => ({
                        ...prev,
                        file: fileError ? null : file
                      }));

                      setErrors(prev => ({
                        ...prev,
                        file: fileError
                      }));
                    }}
                  />
                </label>

                {errors.file && (
                  <p className="text-xs text-red-600">{errors.file}</p>
                )}
              </div>

              <button
                onClick={createDocument}
                disabled={saving || activeCategories.length === 0}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                <UploadCloud className="h-4 w-4" />
                {saving ? "Uploading..." : "Create Asset v1"}
              </button>

              {!categoryLoading && activeCategories.length === 0 && (
                <p className="text-xs text-orange-600">
                  Create at least one active category before uploading assets.
                </p>
              )}
            </div>
          </Surface>

          {/* ASSET LIBRARY */}
          <div className="xl:col-span-2">
            <Surface
              title="Asset Library"
              subtitle="Search, filter, preview, download, update and archive repository assets."
              action={
                <span className="text-xs text-gray-500">
                  Showing {filteredDocuments.length} of {documents.length}
                </span>
              }
            >
              {/* FILTERS */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-5">
                <div className="relative md:col-span-2">
                  <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />

                  <input
                    value={filters.search}
                    onChange={e =>
                      setFilters(prev => ({
                        ...prev,
                        search: e.target.value
                      }))
                    }
                    placeholder="Search title, tag, file"
                    className="mui-input pl-9"
                  />
                </div>

                <select
                  value={filters.categoryId}
                  onChange={e =>
                    setFilters(prev => ({
                      ...prev,
                      categoryId: e.target.value
                    }))
                  }
                  className="mui-input"
                >
                  <option value="all">All Categories</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>

                <select
                  value={filters.status}
                  onChange={e =>
                    setFilters(prev => ({
                      ...prev,
                      status: e.target.value
                    }))
                  }
                  className="mui-input"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Archived</option>
                </select>

                <select
                  value={filters.assetType}
                  onChange={e =>
                    setFilters(prev => ({
                      ...prev,
                      assetType: e.target.value
                    }))
                  }
                  className="mui-input"
                >
                  <option value="all">All Types</option>
                  {ASSET_TYPES.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(item => (
                    <div
                      key={item}
                      className="h-32 rounded-xl bg-gray-100 animate-pulse"
                    />
                  ))}
                </div>
              ) : filteredDocuments.length === 0 ? (
                <div className="border border-dashed border-gray-200 rounded-xl p-8 text-center">
                  <Folder className="h-8 w-8 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-gray-800">
                    No assets found
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Upload your first asset or adjust filters.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredDocuments.map(asset => {
                    const status = getEffectiveStatus(asset);
                    const isArchived = status === "archived";
                    const isUploading = uploadingDocId === asset.id;
                    const isDeleting = deletingDocId === asset.id;
                    const canPreviewImage =
                      isImageAsset(asset) && Boolean(asset.currentUrl);

                    return (
                      <div
                        key={asset.id}
                        className={`rounded-2xl border p-4 ${
                          isArchived
                            ? "border-gray-100 bg-gray-50"
                            : "border-gray-100 bg-white"
                        }`}
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0 flex-1 space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <StatusBadge status={status} />

                              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                                {asset.categoryName || "Uncategorized"}
                              </span>

                              <span className="rounded-full bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700">
                                {getAssetTypeLabel(asset.assetType)}
                              </span>

                              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                                {getVisibilityLabel(asset.visibility)}
                              </span>

                              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                                v{asset.currentVersion || 1}
                              </span>
                            </div>

                            <input
                              defaultValue={asset.title || asset.name}
                              disabled={isArchived}
                              onBlur={e => {
                                const nextName = e.target.value.trim();

                                if (
                                  nextName &&
                                  nextName !== (asset.title || asset.name)
                                ) {
                                  saveMeta(asset, {
                                    name: nextName
                                  });
                                }
                              }}
                              className="w-full border-0 border-b border-transparent bg-transparent px-0 py-1 text-base font-semibold text-gray-900 outline-none focus:border-blue-500 disabled:text-gray-500"
                            />

                            <textarea
                              defaultValue={asset.description || ""}
                              disabled={isArchived}
                              onBlur={e =>
                                saveMeta(asset, {
                                  description: e.target.value.trim()
                                })
                              }
                              placeholder="No description added"
                              className="w-full min-h-[56px] resize-none rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-600 outline-none focus:border-blue-300 disabled:text-gray-400"
                            />

                            {canPreviewImage && (
                              <button
                                type="button"
                                onClick={() => setPreviewAsset(asset)}
                                className="group w-full max-w-sm overflow-hidden rounded-xl border border-gray-100 bg-gray-50 text-left"
                              >
                                <div className="aspect-video bg-gray-100 overflow-hidden">
                                  <img
                                    src={asset.currentUrl}
                                    alt={asset.title || asset.name || "Asset preview"}
                                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                                  />
                                </div>

                                <div className="flex items-center justify-between px-3 py-2">
                                  <span className="text-xs font-medium text-gray-700">
                                    Image Preview
                                  </span>

                                  <span className="inline-flex items-center gap-1 text-xs text-blue-600">
                                    <Eye className="h-3.5 w-3.5" />
                                    View
                                  </span>
                                </div>
                              </button>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                              <div>
                                <p className="text-gray-500">Current File</p>
                                <p className="font-medium text-gray-800 truncate">
                                  {asset.currentFileName || "No file name"}
                                </p>
                              </div>

                              <div>
                                <p className="text-gray-500">File Size</p>
                                <p className="font-medium text-gray-800">
                                  {formatBytes(asset.currentFileSize)}
                                </p>
                              </div>

                              <div>
                                <p className="text-gray-500">Updated</p>
                                <p className="font-medium text-gray-800">
                                  {formatDate(asset.updatedAt || asset.createdAt)}
                                </p>
                              </div>

                              <div>
                                <p className="text-gray-500">Updated By</p>
                                <p className="font-medium text-gray-800 truncate">
                                  {asset.updatedBy || asset.createdBy || "—"}
                                </p>
                              </div>
                            </div>

                            {Array.isArray(asset.tags) && asset.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {asset.tags.map(tag => (
                                  <span
                                    key={tag}
                                    className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600"
                                  >
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col gap-2 lg:w-56">
                            <select
                              value={asset.categoryId || ""}
                              disabled={isArchived}
                              onChange={e =>
                                updateDocumentCategory(asset, e.target.value)
                              }
                              className="mui-input text-xs"
                            >
                              <option value="">
                                {asset.categoryName || "Uncategorized"}
                              </option>

                              {activeCategories.map(category => (
                                <option key={category.id} value={category.id}>
                                  {category.name}
                                </option>
                              ))}
                            </select>

                            <select
                              value={asset.assetType || "document"}
                              disabled={isArchived}
                              onChange={e =>
                                saveMeta(asset, {
                                  assetType: e.target.value
                                })
                              }
                              className="mui-input text-xs"
                            >
                              {ASSET_TYPES.map(type => (
                                <option key={type.value} value={type.value}>
                                  {type.label}
                                </option>
                              ))}
                            </select>

                            <select
                              value={asset.visibility || "team"}
                              disabled={isArchived}
                              onChange={e =>
                                saveMeta(asset, {
                                  visibility: e.target.value
                                })
                              }
                              className="mui-input text-xs"
                            >
                              {VISIBILITY_OPTIONS.map(option => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>

                            <select
                              value={status}
                              disabled={isArchived}
                              onChange={e =>
                                saveMeta(asset, {
                                  status: e.target.value
                                })
                              }
                              className="mui-input text-xs"
                            >
                              <option value="active">Active</option>
                              <option value="draft">Draft</option>
                              <option value="archived">Archived</option>
                            </select>

                            <input
                              defaultValue={formatTags(asset.tags)}
                              disabled={isArchived}
                              onBlur={e =>
                                saveMeta(asset, {
                                  tags: parseTags(e.target.value)
                                })
                              }
                              placeholder="tags comma separated"
                              className="mui-input text-xs"
                            />

                            {asset.currentUrl ? (
                              <>
                                {canPreviewImage && (
                                  <button
                                    type="button"
                                    onClick={() => setPreviewAsset(asset)}
                                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-100"
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                    View Image
                                  </button>
                                )}

                                <a
                                  href={asset.currentUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                  Download
                                </a>
                              </>
                            ) : (
                              <button
                                disabled
                                className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-400"
                              >
                                No Download URL
                              </button>
                            )}

                            {isArchived ? (
                              <button
                                onClick={() =>
                                  saveMeta(asset, {
                                    status: "active"
                                  })
                                }
                                className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-xs font-medium text-green-700 hover:bg-green-100"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                Restore
                              </button>
                            ) : (
                              <button
                                onClick={() =>
                                  saveMeta(asset, {
                                    status: "archived"
                                  })
                                }
                                className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-200"
                              >
                                <Archive className="h-3.5 w-3.5" />
                                Archive
                              </button>
                            )}

                            <button
                              onClick={() => deleteAsset(asset)}
                              disabled={isDeleting}
                              className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              {isDeleting ? "Deleting..." : "Delete"}
                            </button>
                          </div>
                        </div>

                        {!isArchived && (
                          <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-3">
                            <div className="flex flex-col gap-3">
                              <div>
                                <p className="text-xs font-medium text-gray-700">
                                  Upload New Version
                                </p>
                                <p className="text-xs text-gray-500">
                                  The new file will become the latest version.
                                </p>
                              </div>

                              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                                <input
                                  type="file"
                                  accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.mp4,.mov"
                                  onChange={e =>
                                    setVersionFiles(prev => ({
                                      ...prev,
                                      [asset.id]: e.target.files?.[0] || null
                                    }))
                                  }
                                  className="text-xs text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-gray-700 hover:file:bg-gray-100"
                                />

                                <input
                                  value={versionNotes[asset.id] || ""}
                                  onChange={e =>
                                    setVersionNotes(prev => ({
                                      ...prev,
                                      [asset.id]: e.target.value
                                    }))
                                  }
                                  placeholder="Version note"
                                  className="mui-input text-xs"
                                />

                                <button
                                  onClick={() => uploadNewVersion(asset)}
                                  disabled={isUploading}
                                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                                >
                                  <UploadCloud className="h-3.5 w-3.5" />
                                  {isUploading ? "Uploading..." : "Upload Version"}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Surface>
          </div>
        </div>

        {/* IMAGE PREVIEW MODAL */}
        {previewAsset && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-5xl rounded-2xl bg-white shadow-xl overflow-hidden">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-gray-900">
                    {previewAsset.title || previewAsset.name || "Image Preview"}
                  </h3>
                  <p className="truncate text-xs text-gray-500">
                    {previewAsset.currentFileName || "Image asset"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setPreviewAsset(null)}
                  className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="max-h-[75vh] overflow-auto bg-gray-950 p-4">
                <img
                  src={previewAsset.currentUrl}
                  alt={previewAsset.title || previewAsset.name || "Image Preview"}
                  className="mx-auto max-h-[70vh] max-w-full rounded-lg object-contain"
                />
              </div>

              <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
                <p className="text-xs text-gray-500">
                  {formatBytes(previewAsset.currentFileSize)}
                </p>

                <a
                  href={previewAsset.currentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download Image
                </a>
              </div>
            </div>
          </div>
        )}

        <CheckFiles />
      </div>
    </main>
  );
}