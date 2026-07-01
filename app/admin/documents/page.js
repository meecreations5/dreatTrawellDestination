"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  doc as firestoreDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  updateDoc,
  where
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
  Check,
  CheckCircle2,
  Copy,
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

const USAGE_TYPES = [
  { value: "", label: "Select Usage Type" },
  { value: "company_profile", label: "Company Profile" },
  { value: "logo", label: "Logo" },
  { value: "branding_document", label: "Branding Document" },
  { value: "destination_image", label: "Destination Image" },
  { value: "destination_video", label: "Destination Video" },
  { value: "promotional_package", label: "Promotional Package" },
  { value: "ongoing_promotion", label: "Ongoing Promotion" },
  { value: "hotel_image", label: "Hotel Image" },
  { value: "rate_sheet", label: "Rate Sheet" },
  { value: "terms_conditions", label: "Terms & Conditions" },
  { value: "payment_details", label: "Payment Details" },
  { value: "agent_onboarding", label: "Agent Onboarding Kit" },
  { value: "quotation_attachment", label: "Quotation Attachment" },
  { value: "social_media_creative", label: "Social Media Creative" },
  { value: "festival_creative", label: "Festival Creative" },
  { value: "vendor_contract", label: "Vendor Contract" },
  { value: "training_sop", label: "Training / SOP" },
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

const AUDIENCE_OPTIONS = [
  { value: "travel_agent", label: "Travel Agent" },
  { value: "internal_team", label: "Internal Team" },
  { value: "vendor", label: "Vendor" },
  { value: "customer", label: "Customer" },
  { value: "all", label: "All" }
];

const CHANNEL_USAGE_OPTIONS = [
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "quotation", label: "Quotation" },
  { value: "engagement", label: "Engagement" },
  { value: "social", label: "Social Media" }
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

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime"
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

function Select({
  label,
  value,
  onChange,
  error,
  required,
  children,
  ...props
}) {
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

  if (status === "deleted") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
        Deleted
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

function ApprovalBadge({ approved }) {
  if (approved === false) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700">
        Not Approved
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
      <CheckCircle2 className="h-3.5 w-3.5" />
      Approved
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

function isValidUrl(value = "") {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function validateFile(file, assetType = "document") {
  if (assetType === "link") return "";

  if (!file) return "File required";

  const extension = getFileExtension(file.name);

  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return `Allowed files: ${ALLOWED_EXTENSIONS.join(", ")}`;
  }

  if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) {
    return "Invalid file type selected.";
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

function formatDateOnly(value) {
  if (!value) return "—";

  try {
    const date = value?.toDate ? value.toDate() : new Date(`${value}T00:00:00`);

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
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

function getUsageTypeLabel(value) {
  return USAGE_TYPES.find(type => type.value === value)?.label || "Not Set";
}

function getVisibilityLabel(value) {
  return (
    VISIBILITY_OPTIONS.find(option => option.value === value)?.label ||
    "Team"
  );
}

function getAudienceLabel(value) {
  return (
    AUDIENCE_OPTIONS.find(option => option.value === value)?.label ||
    "Travel Agent"
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

function isExpired(asset) {
  if (!asset.validTo) return false;

  const endDate = new Date(`${asset.validTo}T23:59:59`);
  if (Number.isNaN(endDate.getTime())) return false;

  return endDate < new Date();
}

function getDestinationLabel(asset) {
  return asset.destinationName || "All Destinations";
}

function getChannelUsage(asset) {
  return Array.isArray(asset.channelUsage) ? asset.channelUsage : [];
}

function defaultFormState(categoryId = "") {
  return {
    name: "",
    description: "",
    categoryId,
    assetType: "document",
    usageType: "",
    visibility: "team",
    status: "active",
    tagsText: "",
    versionNote: "",
    file: null,

    destinationId: "",
    destinationName: "",
    validFrom: "",
    validTo: "",
    approvedForUse: true,
    channelUsage: ["email", "whatsapp", "engagement"],
    audience: "travel_agent",
    priority: "",
    externalUrl: ""
  };
}

export default function DocumentsPage() {
  const { user } = useAuth(true);

  const [documents, setDocuments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [destinations, setDestinations] = useState([]);

  const [loading, setLoading] = useState(true);
  const [categoryLoading, setCategoryLoading] = useState(true);
  const [destinationLoading, setDestinationLoading] = useState(true);

  const [form, setForm] = useState(defaultFormState());

  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState("");

  const [versionFiles, setVersionFiles] = useState({});
  const [versionNotes, setVersionNotes] = useState({});
  const [uploadingDocId, setUploadingDocId] = useState("");
  const [deletingDocId, setDeletingDocId] = useState("");
  const [previewAsset, setPreviewAsset] = useState(null);
  const [copiedAssetId, setCopiedAssetId] = useState("");

  const [filters, setFilters] = useState({
    search: "",
    categoryId: "all",
    status: "all",
    assetType: "all",
    usageType: "all",
    visibility: "all",
    destinationId: "all",
    approval: "all",
    channelUsage: "all"
  });

  const actor =
    user?.email || user?.displayName || user?.uid || "system";

  const isDevelopment = process.env.NODE_ENV === "development";

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
        .filter(
          category =>
            category.deleted !== true &&
            category.isDeleted !== true &&
            category.archived !== true
        )
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
     LOAD DESTINATIONS
  ========================= */
  const fetchDestinations = async () => {
    setDestinationLoading(true);

    try {
      const snap = await getDocs(
        query(collection(db, "destinations"), where("active", "==", true))
      );

      const rows = snap.docs
        .map(item => ({
          id: item.id,
          ...item.data()
        }))
        .filter(item => item.deleted !== true && item.isDeleted !== true)
        .sort((a, b) =>
          String(a.name || "").localeCompare(String(b.name || ""))
        );

      setDestinations(rows);
    } catch (error) {
      console.error(error);
      setPageError("Unable to load destinations.");
    } finally {
      setDestinationLoading(false);
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
        .filter(item => item.deleted !== true && item.isDeleted !== true);

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
    fetchDestinations();
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

  const selectedDestination = useMemo(() => {
    return destinations.find(item => item.id === form.destinationId) || null;
  }, [destinations, form.destinationId]);

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
      ).length,
      approved: documents.filter(item => item.approvedForUse !== false).length,
      expired: documents.filter(item => isExpired(item)).length
    };
  }, [documents]);

  /* =========================
     CHANNEL TOGGLES
  ========================= */
  const toggleFormChannelUsage = value => {
    setForm(prev => {
      const current = Array.isArray(prev.channelUsage)
        ? prev.channelUsage
        : [];

      const exists = current.includes(value);

      return {
        ...prev,
        channelUsage: exists
          ? current.filter(item => item !== value)
          : [...current, value]
      };
    });
  };

  const toggleAssetChannelUsage = async (asset, value) => {
    const current = getChannelUsage(asset);
    const exists = current.includes(value);

    const next = exists
      ? current.filter(item => item !== value)
      : [...current, value];

    await saveMeta(asset, {
      channelUsage: next
    });
  };

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
      isExternalLink: false,
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
      isExternalLink: false,
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
    const isLink = form.assetType === "link";

    if (!name) nextErrors.name = "Asset title is required";
    if (!form.categoryId) nextErrors.categoryId = "Category is required";
    if (form.categoryId && !category) {
      nextErrors.categoryId = "Category not found";
    }

    if (form.validFrom && form.validTo) {
      const from = new Date(`${form.validFrom}T00:00:00`);
      const to = new Date(`${form.validTo}T23:59:59`);

      if (from > to) {
        nextErrors.validTo = "Valid To cannot be before Valid From";
      }
    }

    if (isLink) {
      if (!form.externalUrl.trim()) {
        nextErrors.externalUrl = "External URL is required";
      } else if (!isValidUrl(form.externalUrl.trim())) {
        nextErrors.externalUrl = "Enter a valid http/https URL";
      }
    } else {
      const fileError = validateFile(form.file, form.assetType);
      if (fileError) nextErrors.file = fileError;
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    setPageError("");

    try {
      const categorySlug = category.slug || createSlug(category.name);
      const destinationName = selectedDestination?.name || "";

      const basePayload = {
        name,
        title: name,
        description,

        categoryId: category.id,
        categoryName: category.name,
        categorySlug,

        type: categorySlug,
        assetType: form.assetType,
        usageType: form.usageType,

        visibility: form.visibility,
        status: form.status,
        active: form.status === "active",
        archived: false,
        deleted: false,
        isDeleted: false,

        destinationId: form.destinationId || "",
        destinationName,

        validFrom: form.validFrom || "",
        validTo: form.validTo || "",

        approvedForUse: Boolean(form.approvedForUse),
        channelUsage: Array.isArray(form.channelUsage)
          ? form.channelUsage
          : [],

        audience: form.audience || "travel_agent",
        priority: form.priority ? Number(form.priority) : null,

        tags,

        downloadCount: 0,

        createdBy: actor,
        createdAt: serverTimestamp(),
        updatedBy: actor,
        updatedAt: serverTimestamp()
      };

      const refDoc = await addDoc(collection(db, "documents"), {
        ...basePayload,

        currentVersion: isLink ? 1 : 0,
        currentUrl: isLink ? form.externalUrl.trim() : "",
        currentFileName: isLink ? name : "",
        currentFileSize: isLink ? null : null,
        currentFileType: isLink ? "external/link" : "",
        currentFileExtension: isLink ? "url" : "",
        currentStoragePath: "",

        externalUrl: isLink ? form.externalUrl.trim() : "",
        isExternalLink: isLink
      });

      if (isLink) {
        await addDoc(collection(db, "documents", refDoc.id, "versions"), {
          version: 1,
          fileName: name,
          fileSize: null,
          fileType: "external/link",
          fileExtension: "url",
          storagePath: "",
          url: form.externalUrl.trim(),
          versionNote: form.versionNote?.trim() || "Initial link",
          isExternalLink: true,
          createdBy: actor,
          createdAt: serverTimestamp()
        });
      } else {
        await uploadVersion({
          documentId: refDoc.id,
          version: 1,
          file: form.file,
          category,
          versionNote: form.versionNote
        });
      }

      setForm(defaultFormState(activeCategories[0]?.id || ""));

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

      if (updates.destinationId !== undefined) {
        const destination = destinations.find(
          item => item.id === updates.destinationId
        );

        payload.destinationName = destination?.name || "";
      }

      if (updates.currentUrl !== undefined && asset.assetType === "link") {
        payload.externalUrl = updates.currentUrl;
        payload.currentFileName = asset.title || asset.name || "External Link";
        payload.currentFileType = "external/link";
        payload.currentFileExtension = "url";
        payload.isExternalLink = true;
      }

      await updateDoc(firestoreDoc(db, "documents", asset.id), payload);

      await fetchDocs();
    } catch (error) {
      console.error(error);
      setPageError("Unable to update asset.");
    }
  };

  /* =========================
     DOWNLOAD TRACKING
  ========================= */
  const handleDownload = async asset => {
    if (!asset.currentUrl) return;

    window.open(asset.currentUrl, "_blank", "noopener,noreferrer");

    try {
      await updateDoc(firestoreDoc(db, "documents", asset.id), {
        downloadCount: increment(1),
        lastDownloadedAt: serverTimestamp(),
        lastDownloadedBy: actor,
        updatedAt: serverTimestamp()
      });

      await fetchDocs();
    } catch (error) {
      console.error("Download count update failed:", error);
    }
  };

  const copyAssetLink = async asset => {
    if (!asset.currentUrl) return;

    try {
      await navigator.clipboard.writeText(asset.currentUrl);
      setCopiedAssetId(asset.id);

      window.setTimeout(() => {
        setCopiedAssetId("");
      }, 1600);
    } catch (error) {
      console.error(error);
      alert("Unable to copy link.");
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
        isDeleted: true,
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
    const fileError = validateFile(file, asset.assetType);

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
      const channelUsage = getChannelUsage(asset);

      const matchesSearch =
        !search ||
        asset.name?.toLowerCase().includes(search) ||
        asset.title?.toLowerCase().includes(search) ||
        asset.description?.toLowerCase().includes(search) ||
        asset.categoryName?.toLowerCase().includes(search) ||
        asset.currentFileName?.toLowerCase().includes(search) ||
        asset.usageType?.toLowerCase().includes(search) ||
        asset.destinationName?.toLowerCase().includes(search) ||
        asset.currentUrl?.toLowerCase().includes(search) ||
        tags.some(tag => tag.toLowerCase().includes(search));

      const matchesCategory =
        filters.categoryId === "all" ||
        asset.categoryId === filters.categoryId;

      const matchesStatus =
        filters.status === "all" || status === filters.status;

      const matchesAssetType =
        filters.assetType === "all" ||
        asset.assetType === filters.assetType;

      const matchesUsageType =
        filters.usageType === "all" ||
        asset.usageType === filters.usageType;

      const matchesVisibility =
        filters.visibility === "all" ||
        asset.visibility === filters.visibility;

      const matchesDestination =
        filters.destinationId === "all" ||
        asset.destinationId === filters.destinationId;

      const matchesApproval =
        filters.approval === "all" ||
        (filters.approval === "approved" && asset.approvedForUse !== false) ||
        (filters.approval === "notApproved" && asset.approvedForUse === false);

      const matchesChannelUsage =
        filters.channelUsage === "all" ||
        channelUsage.includes(filters.channelUsage);

      return (
        matchesSearch &&
        matchesCategory &&
        matchesStatus &&
        matchesAssetType &&
        matchesUsageType &&
        matchesVisibility &&
        matchesDestination &&
        matchesApproval &&
        matchesChannelUsage
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
            Store approved sales assets, branding documents, promotional packages,
            destination images, rate sheets, and shareable campaign files.
          </p>
        </div>

        {pageError && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {pageError}
          </div>
        )}

        {/* KPI */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
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

          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-gray-500">Approved</p>
            <p className="text-2xl font-semibold text-emerald-700 mt-1">
              {stats.approved}
            </p>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-gray-500">Expired</p>
            <p className="text-2xl font-semibold text-red-700 mt-1">
              {stats.expired}
            </p>
          </div>
        </div>

        {/* CATEGORY MANAGER */}
        <AssetCategoryManager onChange={fetchCategories} />

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* CREATE ASSET */}
          <Surface
            title="Upload Asset"
            subtitle="Upload a new sales, branding, destination, or promotion asset."
          >
            <div className="space-y-4">
              <Input
                label="Asset Title"
                required
                value={form.name}
                error={errors.name}
                placeholder="Example: Dubai Summer Offer 2026"
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
                      assetType: value,
                      file: value === "link" ? null : prev.file
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
                  label="Usage Type"
                  value={form.usageType}
                  onChange={value =>
                    setForm(prev => ({
                      ...prev,
                      usageType: value
                    }))
                  }
                >
                  {USAGE_TYPES.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </Select>
              </div>

              <Select
                label="Destination"
                value={form.destinationId}
                disabled={destinationLoading}
                onChange={value => {
                  const destination = destinations.find(item => item.id === value);

                  setForm(prev => ({
                    ...prev,
                    destinationId: value,
                    destinationName: destination?.name || ""
                  }));
                }}
              >
                <option value="">All Destinations</option>

                {destinations.map(destination => (
                  <option key={destination.id} value={destination.id}>
                    {destination.name}
                  </option>
                ))}
              </Select>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

                <Select
                  label="Audience"
                  value={form.audience}
                  onChange={value =>
                    setForm(prev => ({
                      ...prev,
                      audience: value
                    }))
                  }
                >
                  {AUDIENCE_OPTIONS.map(option => (
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Valid From"
                  type="date"
                  value={form.validFrom}
                  onChange={value =>
                    setForm(prev => ({
                      ...prev,
                      validFrom: value
                    }))
                  }
                />

                <Input
                  label="Valid To"
                  type="date"
                  value={form.validTo}
                  error={errors.validTo}
                  onChange={value =>
                    setForm(prev => ({
                      ...prev,
                      validTo: value
                    }))
                  }
                />
              </div>

              <Input
                label="Priority"
                type="number"
                min="1"
                value={form.priority}
                placeholder="Example: 1"
                onChange={value =>
                  setForm(prev => ({
                    ...prev,
                    priority: value
                  }))
                }
              />

              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-gray-800">
                      Approved for Team Use
                    </p>
                    <p className="text-[11px] text-gray-500">
                      Only approved active assets should be used in templates and communication.
                    </p>
                  </div>

                  <input
                    type="checkbox"
                    checked={form.approvedForUse}
                    onChange={e =>
                      setForm(prev => ({
                        ...prev,
                        approvedForUse: e.target.checked
                      }))
                    }
                    className="h-4 w-4"
                  />
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-800 mb-2">
                    Allowed Channels
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {CHANNEL_USAGE_OPTIONS.map(option => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => toggleFormChannelUsage(option.value)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium ${
                          form.channelUsage.includes(option.value)
                            ? "border-blue-200 bg-blue-50 text-blue-700"
                            : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

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

              {form.assetType === "link" ? (
                <Input
                  label="External URL"
                  required
                  value={form.externalUrl}
                  error={errors.externalUrl}
                  placeholder="https://..."
                  onChange={value =>
                    setForm(prev => ({
                      ...prev,
                      externalUrl: value
                    }))
                  }
                />
              ) : (
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
                        const fileError = file
                          ? validateFile(file, form.assetType)
                          : "File required";

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
              )}

              <button
                onClick={createDocument}
                disabled={saving || activeCategories.length === 0}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                <UploadCloud className="h-4 w-4" />
                {saving ? "Uploading..." : "Create Asset"}
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
              <div className="grid grid-cols-1 md:grid-cols-4 xl:grid-cols-8 gap-3 mb-5">
                <div className="relative md:col-span-2 xl:col-span-2">
                  <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />

                  <input
                    value={filters.search}
                    onChange={e =>
                      setFilters(prev => ({
                        ...prev,
                        search: e.target.value
                      }))
                    }
                    placeholder="Search title, tag, destination, package"
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

                <select
                  value={filters.usageType}
                  onChange={e =>
                    setFilters(prev => ({
                      ...prev,
                      usageType: e.target.value
                    }))
                  }
                  className="mui-input"
                >
                  <option value="all">All Usage</option>
                  {USAGE_TYPES.filter(item => item.value).map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>

                <select
                  value={filters.destinationId}
                  onChange={e =>
                    setFilters(prev => ({
                      ...prev,
                      destinationId: e.target.value
                    }))
                  }
                  className="mui-input"
                >
                  <option value="all">All Destinations</option>
                  {destinations.map(destination => (
                    <option key={destination.id} value={destination.id}>
                      {destination.name}
                    </option>
                  ))}
                </select>

                <select
                  value={filters.approval}
                  onChange={e =>
                    setFilters(prev => ({
                      ...prev,
                      approval: e.target.value
                    }))
                  }
                  className="mui-input"
                >
                  <option value="all">All Approval</option>
                  <option value="approved">Approved</option>
                  <option value="notApproved">Not Approved</option>
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
                    const expired = isExpired(asset);
                    const channelUsage = getChannelUsage(asset);
                    const copied = copiedAssetId === asset.id;

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
                              <ApprovalBadge approved={asset.approvedForUse} />

                              {expired && (
                                <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                                  Expired
                                </span>
                              )}

                              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                                {asset.categoryName || "Uncategorized"}
                              </span>

                              <span className="rounded-full bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700">
                                {getAssetTypeLabel(asset.assetType)}
                              </span>

                              <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
                                {getUsageTypeLabel(asset.usageType)}
                              </span>

                              <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-medium text-cyan-700">
                                {getDestinationLabel(asset)}
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

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                              <div>
                                <p className="text-gray-500">Current File / Link</p>
                                <p className="font-medium text-gray-800 truncate">
                                  {asset.currentFileName || asset.currentUrl || "No file name"}
                                </p>
                              </div>

                              <div>
                                <p className="text-gray-500">File Size</p>
                                <p className="font-medium text-gray-800">
                                  {formatBytes(asset.currentFileSize)}
                                </p>
                              </div>

                              <div>
                                <p className="text-gray-500">Downloads</p>
                                <p className="font-medium text-gray-800">
                                  {asset.downloadCount || 0}
                                </p>
                              </div>

                              <div>
                                <p className="text-gray-500">Valid From</p>
                                <p className="font-medium text-gray-800">
                                  {formatDateOnly(asset.validFrom)}
                                </p>
                              </div>

                              <div>
                                <p className="text-gray-500">Valid To</p>
                                <p className="font-medium text-gray-800">
                                  {formatDateOnly(asset.validTo)}
                                </p>
                              </div>

                              <div>
                                <p className="text-gray-500">Updated</p>
                                <p className="font-medium text-gray-800">
                                  {formatDate(asset.updatedAt || asset.createdAt)}
                                </p>
                              </div>

                              <div>
                                <p className="text-gray-500">Audience</p>
                                <p className="font-medium text-gray-800">
                                  {getAudienceLabel(asset.audience)}
                                </p>
                              </div>

                              <div>
                                <p className="text-gray-500">Updated By</p>
                                <p className="font-medium text-gray-800 truncate">
                                  {asset.updatedBy || asset.createdBy || "—"}
                                </p>
                              </div>

                              <div>
                                <p className="text-gray-500">Priority</p>
                                <p className="font-medium text-gray-800">
                                  {asset.priority || "—"}
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

                            {channelUsage.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {channelUsage.map(channel => (
                                  <span
                                    key={channel}
                                    className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700"
                                  >
                                    {channel}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col gap-2 lg:w-64">
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
                              value={asset.usageType || ""}
                              disabled={isArchived}
                              onChange={e =>
                                saveMeta(asset, {
                                  usageType: e.target.value
                                })
                              }
                              className="mui-input text-xs"
                            >
                              {USAGE_TYPES.map(type => (
                                <option key={type.value} value={type.value}>
                                  {type.label}
                                </option>
                              ))}
                            </select>

                            <select
                              value={asset.destinationId || ""}
                              disabled={isArchived}
                              onChange={e =>
                                saveMeta(asset, {
                                  destinationId: e.target.value
                                })
                              }
                              className="mui-input text-xs"
                            >
                              <option value="">All Destinations</option>

                              {destinations.map(destination => (
                                <option key={destination.id} value={destination.id}>
                                  {destination.name}
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
                              value={asset.audience || "travel_agent"}
                              disabled={isArchived}
                              onChange={e =>
                                saveMeta(asset, {
                                  audience: e.target.value
                                })
                              }
                              className="mui-input text-xs"
                            >
                              {AUDIENCE_OPTIONS.map(option => (
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

                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="date"
                                value={asset.validFrom || ""}
                                disabled={isArchived}
                                onChange={e =>
                                  saveMeta(asset, {
                                    validFrom: e.target.value
                                  })
                                }
                                className="mui-input text-xs"
                              />

                              <input
                                type="date"
                                value={asset.validTo || ""}
                                disabled={isArchived}
                                onChange={e =>
                                  saveMeta(asset, {
                                    validTo: e.target.value
                                  })
                                }
                                className="mui-input text-xs"
                              />
                            </div>

                            <input
                              type="number"
                              min="1"
                              defaultValue={asset.priority || ""}
                              disabled={isArchived}
                              onBlur={e =>
                                saveMeta(asset, {
                                  priority: e.target.value
                                    ? Number(e.target.value)
                                    : null
                                })
                              }
                              placeholder="Priority"
                              className="mui-input text-xs"
                            />

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

                            {asset.assetType === "link" && (
                              <input
                                defaultValue={asset.currentUrl || ""}
                                disabled={isArchived}
                                onBlur={e => {
                                  const nextUrl = e.target.value.trim();

                                  if (!nextUrl) return;

                                  if (!isValidUrl(nextUrl)) {
                                    setPageError("Enter a valid http/https URL.");
                                    return;
                                  }

                                  if (nextUrl !== asset.currentUrl) {
                                    saveMeta(asset, {
                                      currentUrl: nextUrl
                                    });
                                  }
                                }}
                                placeholder="External URL"
                                className="mui-input text-xs"
                              />
                            )}

                            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-2">
                              <label className="flex items-center justify-between gap-3 text-xs text-gray-700">
                                <span>Approved for Use</span>
                                <input
                                  type="checkbox"
                                  checked={asset.approvedForUse !== false}
                                  disabled={isArchived}
                                  onChange={e =>
                                    saveMeta(asset, {
                                      approvedForUse: e.target.checked
                                    })
                                  }
                                />
                              </label>

                              <div className="flex flex-wrap gap-1.5">
                                {CHANNEL_USAGE_OPTIONS.map(option => (
                                  <button
                                    key={option.value}
                                    type="button"
                                    disabled={isArchived}
                                    onClick={() =>
                                      toggleAssetChannelUsage(asset, option.value)
                                    }
                                    className={`rounded-full border px-2 py-0.5 text-[11px] font-medium disabled:opacity-60 ${
                                      getChannelUsage(asset).includes(option.value)
                                        ? "border-blue-200 bg-blue-50 text-blue-700"
                                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                                    }`}
                                  >
                                    {option.label}
                                  </button>
                                ))}
                              </div>
                            </div>

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

                                <button
                                  type="button"
                                  onClick={() => handleDownload(asset)}
                                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                  Open / Download
                                </button>

                                <button
                                  type="button"
                                  onClick={() => copyAssetLink(asset)}
                                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                                >
                                  {copied ? (
                                    <>
                                      <Check className="h-3.5 w-3.5 text-green-600" />
                                      Copied
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="h-3.5 w-3.5" />
                                      Copy Link
                                    </>
                                  )}
                                </button>
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

                        {!isArchived && asset.assetType !== "link" && (
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

                <button
                  type="button"
                  onClick={() => handleDownload(previewAsset)}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
                >
                  <Download className="h-3.5 w-3.5" />
                  Open / Download Image
                </button>
              </div>
            </div>
          </div>
        )}

        {isDevelopment && <CheckFiles />}
      </div>
    </main>
  );
}