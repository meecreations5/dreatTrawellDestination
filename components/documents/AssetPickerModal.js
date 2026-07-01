"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  FileText,
  Folder,
  Image as ImageIcon,
  Loader2,
  Package,
  Search,
  X
} from "lucide-react";

import { db } from "@/lib/firebase";

/* =========================
   OPTIONS
========================= */

const ASSET_TYPES = [
  { value: "all", label: "All Types" },
  { value: "document", label: "Document" },
  { value: "presentation", label: "Presentation" },
  { value: "spreadsheet", label: "Spreadsheet" },
  { value: "image", label: "Image" },
  { value: "video", label: "Video" },
  { value: "link", label: "Link" },
  { value: "other", label: "Other" }
];

const USAGE_TYPES = [
  { value: "all", label: "All Usage" },
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

const CHANNEL_USAGE_OPTIONS = [
  { value: "all", label: "All Channels" },
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "quotation", label: "Quotation" },
  { value: "engagement", label: "Engagement" },
  { value: "social", label: "Social Media" }
];

const APPROVAL_OPTIONS = [
  { value: "approved", label: "Approved Only" },
  { value: "all", label: "All Approval" },
  { value: "notApproved", label: "Not Approved" }
];

const VALIDITY_OPTIONS = [
  { value: "valid", label: "Valid Only" },
  { value: "all", label: "All Validity" },
  { value: "expired", label: "Expired" }
];

/* =========================
   HELPERS
========================= */

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function getFirstValue(...values) {
  return (
    values.find(
      value => typeof value === "string" && value.trim().length > 0
    )?.trim() || ""
  );
}

function getAssetTitle(asset) {
  return getFirstValue(
    asset?.title,
    asset?.name,
    asset?.fileName,
    asset?.currentFileName,
    "Untitled Asset"
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

function getAssetId(asset) {
  return getFirstValue(asset?.assetId, asset?.id, asset?.documentId, getAssetUrl(asset));
}

function getAssetType(asset) {
  return asset?.assetType || asset?.documentType || "document";
}

function getUsageTypeLabel(value) {
  return (
    USAGE_TYPES.find(item => item.value === value)?.label ||
    value ||
    "Not Set"
  );
}

function getAssetTypeLabel(value) {
  return (
    ASSET_TYPES.find(item => item.value === value)?.label ||
    value ||
    "Asset"
  );
}

function getChannelUsage(asset) {
  return Array.isArray(asset?.channelUsage) ? asset.channelUsage : [];
}

function isExpired(asset) {
  if (!asset?.validTo) return false;

  const endDate = new Date(`${asset.validTo}T23:59:59`);
  if (Number.isNaN(endDate.getTime())) return false;

  return endDate < new Date();
}

function isNotYetValid(asset) {
  if (!asset?.validFrom) return false;

  const startDate = new Date(`${asset.validFrom}T00:00:00`);
  if (Number.isNaN(startDate.getTime())) return false;

  return startDate > new Date();
}

function isCurrentlyValid(asset) {
  return !isExpired(asset) && !isNotYetValid(asset);
}

function getEffectiveStatus(asset) {
  if (asset?.status) return asset.status;
  if (asset?.active === false) return "draft";
  return "active";
}

function isImageAsset(asset) {
  const type = normalize(getAssetType(asset));
  const fileType = normalize(asset?.currentFileType || asset?.fileType);
  const extension = normalize(
    asset?.currentFileExtension || asset?.fileExtension
  );

  return (
    type === "image" ||
    fileType.startsWith("image/") ||
    ["jpg", "jpeg", "png", "webp"].includes(extension)
  );
}

function formatBytes(bytes) {
  if (!bytes) return "—";

  const units = ["B", "KB", "MB", "GB"];
  let size = Number(bytes || 0);
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDateOnly(value) {
  if (!value) return "";

  try {
    const date = new Date(`${value}T00:00:00`);

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  } catch {
    return "";
  }
}

function normalizeAssetForSelection(asset) {
  return {
    assetId: getAssetId(asset),
    title: getAssetTitle(asset),
    url: getAssetUrl(asset),

    categoryId: asset?.categoryId || "",
    categoryName: asset?.categoryName || "",
    categorySlug: asset?.categorySlug || "",

    assetType: getAssetType(asset),
    usageType: asset?.usageType || "",
    visibility: asset?.visibility || "team",

    currentVersion: asset?.currentVersion || asset?.version || 1,

    fileName: asset?.fileName || asset?.currentFileName || "",
    fileSize: asset?.fileSize || asset?.currentFileSize || null,
    fileType: asset?.fileType || asset?.currentFileType || "",
    fileExtension:
      asset?.fileExtension || asset?.currentFileExtension || "",

    destinationId: asset?.destinationId || "",
    destinationName: asset?.destinationName || "",

    validFrom: asset?.validFrom || "",
    validTo: asset?.validTo || "",

    approvedForUse: asset?.approvedForUse !== false,
    channelUsage: getChannelUsage(asset),
    audience: asset?.audience || "travel_agent",

    sharedAs: isImageAsset(asset) ? "image_link" : "file_link",
    selectedAt: new Date().toISOString()
  };
}

function mergeSelectedAssetsWithLoadedAssets(loadedAssets, selectedAssets) {
  const map = new Map();

  loadedAssets.forEach(asset => {
    const id = getAssetId(asset);
    if (id) map.set(id, asset);
  });

  selectedAssets.forEach(asset => {
    const id = getAssetId(asset);
    if (id && !map.has(id)) map.set(id, asset);
  });

  return Array.from(map.values());
}

/* =========================
   COMPONENT
========================= */

export default function AssetPickerModal({
  open,
  onClose,
  selectedAssets = [],
  onConfirm,
  title = "Select Assets",

  /**
   * Optional filters from parent:
   * channel="email" | "whatsapp" | "engagement" | "quotation"
   * destinationId="..."
   * usageType="promotional_package"
   */
  channel = "",
  destinationId = "",
  usageType = "",

  approvedOnly = true,
  validOnly = true
}) {
  const [assets, setAssets] = useState([]);
  const [destinations, setDestinations] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [assetType, setAssetType] = useState("all");
  const [usageTypeFilter, setUsageTypeFilter] = useState(usageType || "all");
  const [destinationFilter, setDestinationFilter] = useState(
    destinationId || "all"
  );
  const [channelFilter, setChannelFilter] = useState(channel || "all");
  const [approvalFilter, setApprovalFilter] = useState(
    approvedOnly ? "approved" : "all"
  );
  const [validityFilter, setValidityFilter] = useState(
    validOnly ? "valid" : "all"
  );

  const [selectedIds, setSelectedIds] = useState([]);
  const [previewAsset, setPreviewAsset] = useState(null);
  const [copiedAssetId, setCopiedAssetId] = useState("");

  useEffect(() => {
    if (!open) return;

    setSelectedIds(
      selectedAssets
        .map(asset => getAssetId(asset))
        .filter(Boolean)
    );
  }, [open, selectedAssets]);

  useEffect(() => {
    if (!open) return;

    setUsageTypeFilter(usageType || "all");
    setDestinationFilter(destinationId || "all");
    setChannelFilter(channel || "all");
    setApprovalFilter(approvedOnly ? "approved" : "all");
    setValidityFilter(validOnly ? "valid" : "all");
  }, [open, usageType, destinationId, channel, approvedOnly, validOnly]);

  useEffect(() => {
    if (!open) return;

    let mounted = true;

    async function loadAssets() {
      setLoading(true);
      setError("");

      try {
        const [assetSnap, destinationSnap] = await Promise.all([
          getDocs(collection(db, "documents")),
          getDocs(collection(db, "destinations"))
        ]);

        if (!mounted) return;

        const assetRows = assetSnap.docs
          .map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
          }))
          .filter(asset => {
            const status = getEffectiveStatus(asset);

            if (asset.deleted === true || asset.isDeleted === true) {
              return false;
            }

            if (asset.archived === true) {
              return false;
            }

            if (status !== "active") {
              return false;
            }

            if (asset.active === false) {
              return false;
            }

            if (!getAssetUrl(asset)) {
              return false;
            }

            return true;
          })
          .sort((a, b) => {
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

        const destinationRows = destinationSnap.docs
          .map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
          }))
          .filter(item => item.deleted !== true && item.isDeleted !== true)
          .sort((a, b) =>
            String(a.name || "").localeCompare(String(b.name || ""))
          );

        setAssets(assetRows);
        setDestinations(destinationRows);
      } catch (err) {
        console.error("Failed to load document assets:", err);

        if (mounted) {
          setError("Unable to load assets from document library.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadAssets();

    return () => {
      mounted = false;
    };
  }, [open]);

  const mergedAssets = useMemo(() => {
    return mergeSelectedAssetsWithLoadedAssets(assets, selectedAssets);
  }, [assets, selectedAssets]);

  const categories = useMemo(() => {
    const map = new Map();

    mergedAssets.forEach(asset => {
      if (!asset.categoryId) return;

      map.set(asset.categoryId, {
        id: asset.categoryId,
        name: asset.categoryName || "Uncategorized"
      });
    });

    return Array.from(map.values()).sort((a, b) =>
      String(a.name).localeCompare(String(b.name))
    );
  }, [mergedAssets]);

  const filteredAssets = useMemo(() => {
    const q = normalize(search);

    return mergedAssets.filter(asset => {
      const status = getEffectiveStatus(asset);
      const channelUsage = getChannelUsage(asset);

      if (asset.deleted === true || asset.isDeleted === true) return false;
      if (asset.archived === true) return false;
      if (status !== "active") return false;
      if (!getAssetUrl(asset)) return false;

      const matchesCategory =
        categoryId === "all" || asset.categoryId === categoryId;

      const matchesType =
        assetType === "all" || getAssetType(asset) === assetType;

      const matchesUsage =
        usageTypeFilter === "all" || asset.usageType === usageTypeFilter;

      const matchesDestination =
        destinationFilter === "all" ||
        asset.destinationId === destinationFilter ||
        !asset.destinationId;

      const matchesChannel =
        channelFilter === "all" ||
        channelUsage.includes(channelFilter) ||
        channelUsage.length === 0;

      const matchesApproval =
        approvalFilter === "all" ||
        (approvalFilter === "approved" && asset.approvedForUse !== false) ||
        (approvalFilter === "notApproved" && asset.approvedForUse === false);

      const matchesValidity =
        validityFilter === "all" ||
        (validityFilter === "valid" && isCurrentlyValid(asset)) ||
        (validityFilter === "expired" && isExpired(asset));

      const searchableText = [
        asset.name,
        asset.title,
        asset.description,
        asset.categoryName,
        asset.assetType,
        asset.usageType,
        getUsageTypeLabel(asset.usageType),
        asset.destinationName,
        asset.currentFileName,
        asset.currentUrl,
        Array.isArray(asset.tags) ? asset.tags.join(" ") : ""
      ]
        .map(normalize)
        .join(" ");

      const matchesSearch = !q || searchableText.includes(q);

      return (
        matchesCategory &&
        matchesType &&
        matchesUsage &&
        matchesDestination &&
        matchesChannel &&
        matchesApproval &&
        matchesValidity &&
        matchesSearch
      );
    });
  }, [
    mergedAssets,
    search,
    categoryId,
    assetType,
    usageTypeFilter,
    destinationFilter,
    channelFilter,
    approvalFilter,
    validityFilter
  ]);

  const selectedAssetObjects = useMemo(() => {
    return selectedIds
      .map(id => {
        const found = mergedAssets.find(asset => getAssetId(asset) === id);
        return found ? normalizeAssetForSelection(found) : null;
      })
      .filter(Boolean);
  }, [mergedAssets, selectedIds]);

  const toggleAsset = asset => {
    const id = getAssetId(asset);
    if (!id) return;

    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(item => item !== id);
      }

      return [...prev, id];
    });
  };

  const clearSelected = () => {
    setSelectedIds([]);
  };

  const handleConfirm = () => {
    onConfirm?.(selectedAssetObjects);
    onClose?.();
  };

  const copyAssetLink = async asset => {
    const url = getAssetUrl(asset);
    const id = getAssetId(asset);

    if (!url) return;

    try {
      await navigator.clipboard.writeText(url);
      setCopiedAssetId(id);

      window.setTimeout(() => {
        setCopiedAssetId("");
      }, 1600);
    } catch (err) {
      console.error("Failed to copy link:", err);
      alert("Unable to copy link.");
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[80] bg-black/50 p-3 sm:p-4 flex items-center justify-center">
        <div className="w-full max-w-7xl max-h-[92vh] overflow-hidden rounded-2xl bg-white shadow-xl flex flex-col">
          {/* HEADER */}
          <div className="border-b border-gray-100 px-5 py-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                {title}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Select approved and active assets from the document library.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              aria-label="Close asset picker"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* FILTERS */}
          <div className="border-b border-gray-100 px-5 py-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="relative md:col-span-4">
                <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />

                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search asset, tag, destination, package..."
                  className="mui-input pl-9"
                />
              </div>

              <select
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
                className="mui-input md:col-span-2"
              >
                <option value="all">All Categories</option>

                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>

              <select
                value={assetType}
                onChange={e => setAssetType(e.target.value)}
                className="mui-input md:col-span-2"
              >
                {ASSET_TYPES.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>

              <select
                value={usageTypeFilter}
                onChange={e => setUsageTypeFilter(e.target.value)}
                className="mui-input md:col-span-2"
              >
                {USAGE_TYPES.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>

              <select
                value={destinationFilter}
                onChange={e => setDestinationFilter(e.target.value)}
                className="mui-input md:col-span-2"
              >
                <option value="all">All Destinations</option>

                {destinations.map(destination => (
                  <option key={destination.id} value={destination.id}>
                    {destination.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <select
                value={channelFilter}
                onChange={e => setChannelFilter(e.target.value)}
                className="mui-input md:col-span-3"
              >
                {CHANNEL_USAGE_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <select
                value={approvalFilter}
                onChange={e => setApprovalFilter(e.target.value)}
                className="mui-input md:col-span-3"
              >
                {APPROVAL_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <select
                value={validityFilter}
                onChange={e => setValidityFilter(e.target.value)}
                className="mui-input md:col-span-3"
              >
                {VALIDITY_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setCategoryId("all");
                  setAssetType("all");
                  setUsageTypeFilter(usageType || "all");
                  setDestinationFilter(destinationId || "all");
                  setChannelFilter(channel || "all");
                  setApprovalFilter(approvedOnly ? "approved" : "all");
                  setValidityFilter(validOnly ? "valid" : "all");
                }}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 md:col-span-3"
              >
                Reset Filters
              </button>
            </div>

            {selectedAssetObjects.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2">
                <span className="text-xs font-semibold text-blue-800">
                  {selectedAssetObjects.length} selected
                </span>

                {selectedAssetObjects.slice(0, 4).map(asset => (
                  <span
                    key={asset.assetId || asset.url}
                    className="rounded-full bg-white px-2 py-0.5 text-[11px] text-blue-700 border border-blue-100"
                  >
                    {asset.title}
                  </span>
                ))}

                {selectedAssetObjects.length > 4 && (
                  <span className="text-[11px] text-blue-700">
                    +{selectedAssetObjects.length - 4} more
                  </span>
                )}

                <button
                  type="button"
                  onClick={clearSelected}
                  className="ml-auto text-xs font-semibold text-blue-700 hover:underline"
                >
                  Clear selected
                </button>
              </div>
            )}
          </div>

          {/* BODY */}
          <div className="flex-1 overflow-y-auto p-5 bg-gray-50">
            {error && (
              <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-16 text-sm text-gray-500">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Loading assets...
              </div>
            ) : filteredAssets.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center">
                <Folder className="h-9 w-9 text-gray-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-gray-800">
                  No assets found
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Upload approved active assets or adjust filters.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredAssets.map(asset => {
                  const id = getAssetId(asset);
                  const selected = selectedIds.includes(id);
                  const image = isImageAsset(asset);
                  const assetTitle = getAssetTitle(asset);
                  const assetUrl = getAssetUrl(asset);
                  const expired = isExpired(asset);
                  const notYetValid = isNotYetValid(asset);
                  const channelUsage = getChannelUsage(asset);
                  const copied = copiedAssetId === id;

                  return (
                    <div
                      key={id}
                      className={`
                        rounded-2xl border bg-white overflow-hidden transition
                        ${
                          selected
                            ? "border-blue-500 ring-2 ring-blue-100"
                            : "border-gray-200 hover:border-blue-200 hover:shadow-sm"
                        }
                      `}
                    >
                      <button
                        type="button"
                        onClick={() => toggleAsset(asset)}
                        className="block w-full text-left"
                      >
                        {image ? (
                          <div className="aspect-video bg-gray-100 overflow-hidden">
                            <img
                              src={assetUrl}
                              alt={assetTitle}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="aspect-video bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
                            {getAssetType(asset) === "image" ? (
                              <ImageIcon className="h-10 w-10 text-blue-500" />
                            ) : getAssetType(asset) === "document" ? (
                              <FileText className="h-10 w-10 text-blue-500" />
                            ) : (
                              <Package className="h-10 w-10 text-blue-500" />
                            )}
                          </div>
                        )}

                        <div className="p-4 space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">
                                {assetTitle}
                              </p>

                              <p className="text-xs text-gray-500 mt-1 truncate">
                                {asset.categoryName || "Uncategorized"} ·{" "}
                                {getAssetTypeLabel(getAssetType(asset))}
                              </p>
                            </div>

                            <span
                              className={`
                                h-6 w-6 rounded-full border flex items-center justify-center shrink-0
                                ${
                                  selected
                                    ? "bg-blue-600 border-blue-600 text-white"
                                    : "bg-white border-gray-300 text-transparent"
                                }
                              `}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            {asset.destinationName ? (
                              <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-[11px] text-cyan-700">
                                {asset.destinationName}
                              </span>
                            ) : (
                              <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-[11px] text-cyan-700">
                                All Destinations
                              </span>
                            )}

                            {asset.usageType && (
                              <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[11px] text-purple-700">
                                {getUsageTypeLabel(asset.usageType)}
                              </span>
                            )}

                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">
                              v{asset.currentVersion || 1}
                            </span>

                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">
                              {formatBytes(asset.currentFileSize)}
                            </span>

                            {asset.approvedForUse !== false ? (
                              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
                                Approved
                              </span>
                            ) : (
                              <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] text-orange-700">
                                Not Approved
                              </span>
                            )}

                            {expired && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] text-red-700">
                                <AlertTriangle className="h-3 w-3" />
                                Expired
                              </span>
                            )}

                            {notYetValid && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
                                <AlertTriangle className="h-3 w-3" />
                                Future
                              </span>
                            )}
                          </div>

                          {(asset.validFrom || asset.validTo) && (
                            <p className="text-[11px] text-gray-500">
                              Valid: {formatDateOnly(asset.validFrom) || "—"} to{" "}
                              {formatDateOnly(asset.validTo) || "—"}
                            </p>
                          )}

                          {channelUsage.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {channelUsage.map(item => (
                                <span
                                  key={item}
                                  className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700"
                                >
                                  {item}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </button>

                      <div className="border-t border-gray-100 px-4 py-3 flex items-center gap-3">
                        {assetUrl && (
                          <button
                            type="button"
                            onClick={() => setPreviewAsset(asset)}
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Preview
                          </button>
                        )}

                        {assetUrl && (
                          <a
                            href={assetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-green-600 hover:underline"
                          >
                            <Download className="h-3.5 w-3.5" />
                            Open
                          </a>
                        )}

                        {assetUrl && (
                          <button
                            type="button"
                            onClick={() => copyAssetLink(asset)}
                            className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900"
                          >
                            {copied ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-green-600" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5" />
                                Copy
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* FOOTER */}
          <div className="border-t border-gray-100 px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-xs text-gray-500">
              {selectedAssetObjects.length} asset
              {selectedAssetObjects.length === 1 ? "" : "s"} selected
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirm}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Use Selected Assets
              </button>
            </div>
          </div>
        </div>
      </div>

      {previewAsset && (
        <div className="fixed inset-0 z-[90] bg-black/70 p-4 flex items-center justify-center">
          <div className="w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-xl flex flex-col">
            <div className="border-b border-gray-100 px-5 py-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-gray-900">
                  {getAssetTitle(previewAsset)}
                </h3>
                <p className="truncate text-xs text-gray-500">
                  {previewAsset.categoryName || "Asset"} ·{" "}
                  {getUsageTypeLabel(previewAsset.usageType)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setPreviewAsset(null)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                aria-label="Close preview"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto bg-gray-950 p-4">
              {isImageAsset(previewAsset) ? (
                <img
                  src={getAssetUrl(previewAsset)}
                  alt={getAssetTitle(previewAsset)}
                  className="mx-auto max-h-[72vh] max-w-full rounded-lg object-contain"
                />
              ) : (
                <div className="mx-auto max-w-xl rounded-2xl bg-white p-8 text-center">
                  <Package className="mx-auto h-12 w-12 text-blue-500" />
                  <h4 className="mt-3 text-sm font-semibold text-gray-900">
                    {getAssetTitle(previewAsset)}
                  </h4>
                  <p className="mt-1 text-xs text-gray-500">
                    Preview is available for image assets. Open this file in a new tab to view it.
                  </p>

                  <a
                    href={getAssetUrl(previewAsset)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Open Asset
                  </a>
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 px-5 py-4 flex items-center justify-between gap-3">
              <p className="text-xs text-gray-500">
                {previewAsset.currentFileName || previewAsset.fileName || "Asset"}
              </p>

              <button
                type="button"
                onClick={() => {
                  toggleAsset(previewAsset);
                  setPreviewAsset(null);
                }}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
              >
                {selectedIds.includes(getAssetId(previewAsset))
                  ? "Remove from Selection"
                  : "Select Asset"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}