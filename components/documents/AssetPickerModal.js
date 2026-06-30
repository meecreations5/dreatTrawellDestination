"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs
} from "firebase/firestore";
import {
  CheckCircle2,
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

const ASSET_TYPE_LABELS = {
  document: "Document",
  presentation: "Presentation",
  spreadsheet: "Spreadsheet",
  image: "Image",
  video: "Video",
  link: "Link",
  other: "Other"
};

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function getAssetTitle(asset) {
  return asset.title || asset.name || asset.currentFileName || "Untitled Asset";
}

function getAssetUrl(asset) {
  return asset.currentUrl || asset.url || asset.externalUrl || "";
}

function getAssetType(asset) {
  return asset.assetType || "document";
}

function isImageAsset(asset) {
  const type = normalize(asset.assetType);
  const fileType = normalize(asset.currentFileType);
  const extension = normalize(asset.currentFileExtension);

  return (
    type === "image" ||
    fileType.startsWith("image/") ||
    ["jpg", "jpeg", "png", "webp"].includes(extension)
  );
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

function mapAssetForSelection(asset) {
  return {
    assetId: asset.id,
    title: getAssetTitle(asset),
    url: getAssetUrl(asset),

    categoryId: asset.categoryId || "",
    categoryName: asset.categoryName || "",
    categorySlug: asset.categorySlug || "",

    assetType: asset.assetType || "document",
    usageType: asset.usageType || "",
    visibility: asset.visibility || "team",

    currentVersion: asset.currentVersion || 1,
    fileName: asset.currentFileName || "",
    fileSize: asset.currentFileSize || null,
    fileType: asset.currentFileType || "",
    fileExtension: asset.currentFileExtension || "",

    destinationId: asset.destinationId || "",
    destinationName: asset.destinationName || "",

    sharedAs: isImageAsset(asset) ? "image_link" : "file_link",
    selectedAt: new Date().toISOString()
  };
}

export default function AssetPickerModal({
  open,
  onClose,
  selectedAssets = [],
  onConfirm,
  title = "Select Assets"
}) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [assetType, setAssetType] = useState("all");

  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => {
    if (!open) return;

    setSelectedIds(
      selectedAssets
        .map(asset => asset.assetId || asset.id)
        .filter(Boolean)
    );
  }, [open, selectedAssets]);

  useEffect(() => {
    if (!open) return;

    let mounted = true;

    async function loadAssets() {
      setLoading(true);
      setError("");

      try {
        const snap = await getDocs(collection(db, "documents"));

        if (!mounted) return;

        const rows = snap.docs
          .map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
          }))
          .filter(asset => {
            const status = asset.status || "active";

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

        setAssets(rows);
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

  const categories = useMemo(() => {
    const map = new Map();

    assets.forEach(asset => {
      if (!asset.categoryId) return;

      map.set(asset.categoryId, {
        id: asset.categoryId,
        name: asset.categoryName || "Uncategorized"
      });
    });

    return Array.from(map.values()).sort((a, b) =>
      String(a.name).localeCompare(String(b.name))
    );
  }, [assets]);

  const filteredAssets = useMemo(() => {
    const q = normalize(search);

    return assets.filter(asset => {
      const matchesCategory =
        categoryId === "all" || asset.categoryId === categoryId;

      const matchesType =
        assetType === "all" || getAssetType(asset) === assetType;

      const searchableText = [
        asset.name,
        asset.title,
        asset.description,
        asset.categoryName,
        asset.assetType,
        asset.usageType,
        asset.destinationName,
        asset.currentFileName,
        Array.isArray(asset.tags) ? asset.tags.join(" ") : ""
      ]
        .map(normalize)
        .join(" ");

      const matchesSearch = !q || searchableText.includes(q);

      return matchesCategory && matchesType && matchesSearch;
    });
  }, [assets, search, categoryId, assetType]);

  const selectedAssetObjects = useMemo(() => {
    return assets
      .filter(asset => selectedIds.includes(asset.id))
      .map(mapAssetForSelection);
  }, [assets, selectedIds]);

  const toggleAsset = assetId => {
    setSelectedIds(prev => {
      if (prev.includes(assetId)) {
        return prev.filter(id => id !== assetId);
      }

      return [...prev, assetId];
    });
  };

  const handleConfirm = () => {
    onConfirm?.(selectedAssetObjects);
    onClose?.();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 p-4 flex items-center justify-center">
      <div className="w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-xl flex flex-col">
        {/* HEADER */}
        <div className="border-b border-gray-100 px-5 py-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              {title}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Select approved assets from the document library.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* FILTERS */}
        <div className="border-b border-gray-100 px-5 py-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="relative md:col-span-2">
              <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />

              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search asset, tag, destination, category..."
                className="mui-input pl-9"
              />
            </div>

            <select
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
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
              value={assetType}
              onChange={e => setAssetType(e.target.value)}
              className="mui-input"
            >
              <option value="all">All Asset Types</option>
              <option value="document">Document</option>
              <option value="presentation">Presentation</option>
              <option value="spreadsheet">Spreadsheet</option>
              <option value="image">Image</option>
              <option value="video">Video</option>
              <option value="link">Link</option>
              <option value="other">Other</option>
            </select>
          </div>
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
                Upload active assets in Document Library or adjust filters.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredAssets.map(asset => {
                const selected = selectedIds.includes(asset.id);
                const image = isImageAsset(asset);
                const assetTitle = getAssetTitle(asset);
                const assetUrl = getAssetUrl(asset);

                return (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => toggleAsset(asset.id)}
                    className={`
                      text-left rounded-2xl border bg-white overflow-hidden transition
                      ${
                        selected
                          ? "border-blue-500 ring-2 ring-blue-100"
                          : "border-gray-200 hover:border-blue-200 hover:shadow-sm"
                      }
                    `}
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
                        {getAssetType(asset) === "document" ? (
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
                            {ASSET_TYPE_LABELS[getAssetType(asset)] ||
                              "Asset"}
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
                        {asset.destinationName && (
                          <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-[11px] text-cyan-700">
                            {asset.destinationName}
                          </span>
                        )}

                        {asset.usageType && (
                          <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[11px] text-purple-700">
                            {asset.usageType}
                          </span>
                        )}

                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">
                          v{asset.currentVersion || 1}
                        </span>

                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">
                          {formatBytes(asset.currentFileSize)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <a
                          href={assetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </a>

                        <a
                          href={assetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-xs text-green-600 hover:underline"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Open
                        </a>
                      </div>
                    </div>
                  </button>
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
  );
}