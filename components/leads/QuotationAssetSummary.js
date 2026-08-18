"use client";

import { useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Package
} from "lucide-react";

/* =========================
   HELPERS
========================= */

function cleanString(value = "") {
  return String(value || "").trim();
}

function getFirstValue(...values) {
  return (
    values.find(
      value => typeof value === "string" && value.trim().length > 0
    )?.trim() || ""
  );
}

function getAssetTitle(asset = {}) {
  return getFirstValue(
    asset?.title,
    asset?.name,
    asset?.fileName,
    asset?.currentFileName,
    "Asset"
  );
}

function getAssetUrl(asset = {}) {
  return getFirstValue(
    asset?.url,
    asset?.currentUrl,
    asset?.externalUrl,
    asset?.downloadUrl,
    asset?.fileUrl
  );
}

function getAssetKey(asset = {}) {
  return getFirstValue(
    asset?.assetId,
    asset?.id,
    asset?.documentId,
    getAssetUrl(asset)
  );
}

function normalizeQuotationAsset(asset = {}) {
  return {
    assetId: getFirstValue(asset?.assetId, asset?.id, asset?.documentId),
    title: getAssetTitle(asset),
    url: getAssetUrl(asset),

    categoryName: getFirstValue(asset?.categoryName),
    categorySlug: getFirstValue(asset?.categorySlug),
    assetType: getFirstValue(asset?.assetType, asset?.documentType, "Asset"),

    currentVersion: asset?.currentVersion || asset?.version || 1,

    destinationName: getFirstValue(asset?.destinationName),
    fileName: getFirstValue(asset?.fileName, asset?.currentFileName),
    fileType: getFirstValue(asset?.fileType, asset?.currentFileType)
  };
}

function parseAssetsFromLinksText(text = "") {
  const clean = cleanString(text);
  if (!clean) return [];

  const lines = clean
    .split("\n")
    .map(line => cleanString(line))
    .filter(Boolean);

  const assets = [];
  let pendingTitle = "";

  lines.forEach(line => {
    const isUrl = /^https?:\/\//i.test(line);

    if (isUrl) {
      assets.push({
        assetId: "",
        title: pendingTitle || `Shared Asset ${assets.length + 1}`,
        url: line,
        categoryName: "",
        assetType: "Asset",
        currentVersion: 1
      });

      pendingTitle = "";
      return;
    }

    if (!line.toLowerCase().includes("shared assets")) {
      pendingTitle = line.replace(/^\d+\.\s*/, "");
    }
  });

  return assets;
}

function parseAssetsFromLinksHtml(html = "") {
  const clean = String(html || "");
  if (!clean) return [];

  const urls = [];
  const regex = /href=["']([^"']+)["']/gi;
  let match;

  while ((match = regex.exec(clean)) !== null) {
    const url = cleanString(match[1]);

    if (url && /^https?:\/\//i.test(url)) {
      urls.push(url);
    }
  }

  return Array.from(new Set(urls)).map((url, index) => ({
    assetId: "",
    title: `Shared Asset ${index + 1}`,
    url,
    categoryName: "",
    assetType: "Asset",
    currentVersion: 1
  }));
}

function getQuotationAssets(quotation = {}) {
  const metadata = quotation.metadata || {};

  const directAssets =
    quotation.sharedAssets ||
    quotation.quotationAssets ||
    quotation.latestQuotationSharedAssets ||
    quotation.finalQuotationSharedAssets ||
    metadata.sharedAssets ||
    metadata.quotationAssets ||
    metadata.latestQuotationSharedAssets ||
    metadata.finalQuotationSharedAssets ||
    [];

  const textAssets = parseAssetsFromLinksText(
    quotation.assetLinksText ||
      quotation.latestQuotationAssetLinksText ||
      quotation.finalQuotationAssetLinksText ||
      metadata.assetLinksText ||
      metadata.latestQuotationAssetLinksText ||
      metadata.finalQuotationAssetLinksText ||
      ""
  );

  const htmlAssets = parseAssetsFromLinksHtml(
    quotation.assetLinksHtml ||
      quotation.latestQuotationAssetLinksHtml ||
      quotation.finalQuotationAssetLinksHtml ||
      metadata.assetLinksHtml ||
      metadata.latestQuotationAssetLinksHtml ||
      metadata.finalQuotationAssetLinksHtml ||
      ""
  );

  const sourceAssets =
    Array.isArray(directAssets) && directAssets.length
      ? directAssets
      : textAssets.length
        ? textAssets
        : htmlAssets;

  if (!Array.isArray(sourceAssets)) return [];

  const map = new Map();

  sourceAssets.forEach(asset => {
    const normalized = normalizeQuotationAsset(asset);
    const key = getAssetKey(normalized);

    if (!key && !normalized.url) return;

    map.set(key || normalized.url, normalized);
  });

  return Array.from(map.values());
}

async function copyText(value = "") {
  const text = cleanString(value);
  if (!text) return false;

  try {
    if (
      typeof navigator !== "undefined" &&
      navigator.clipboard?.writeText
    ) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";

    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);

    return true;
  } catch (error) {
    console.warn("Copy failed:", error);
    return false;
  }
}

function buildAllAssetLinksText(assets = []) {
  if (!assets.length) return "";

  return assets
    .map((asset, index) => {
      const title = getAssetTitle(asset);
      const url = getAssetUrl(asset);

      return `${index + 1}. ${title}\n${url}`;
    })
    .join("\n\n");
}

/* =========================
   COMPONENT
========================= */

export default function QuotationAssetSummary({
  quotation = {},
  compact = false
}) {
  const [expanded, setExpanded] = useState(false);
  const [copiedKey, setCopiedKey] = useState("");

  const assets = useMemo(() => {
    return getQuotationAssets(quotation);
  }, [quotation]);

  if (!assets.length) return null;

  const visibleAssets = expanded || !compact ? assets : assets.slice(0, 2);
  const hiddenCount = Math.max(assets.length - visibleAssets.length, 0);

  const handleCopyOne = async asset => {
    const url = getAssetUrl(asset);
    if (!url) return;

    const copied = await copyText(url);
    if (!copied) return;

    const key = getAssetKey(asset) || url;
    setCopiedKey(key);

    window.setTimeout(() => {
      setCopiedKey("");
    }, 1200);
  };

  const handleCopyAll = async () => {
    const copied = await copyText(buildAllAssetLinksText(assets));
    if (!copied) return;

    setCopiedKey("all");

    window.setTimeout(() => {
      setCopiedKey("");
    }, 1200);
  };

  return (
    <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-white text-blue-700">
            <Package className="h-3.5 w-3.5" />
          </span>

          <div>
            <p className="text-xs font-bold text-blue-900">
              Quotation Assets
            </p>

            <p className="text-[11px] text-blue-700">
              {assets.length} shared {assets.length === 1 ? "asset" : "assets"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCopyAll}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-blue-100 bg-white px-2.5 py-1.5 text-[11px] font-bold text-blue-700 hover:bg-blue-50"
        >
          {copiedKey === "all" ? (
            <Check className="h-3.5 w-3.5 text-green-600" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copiedKey === "all" ? "Copied" : "Copy All"}
        </button>
      </div>

      <div className="mt-2 space-y-1.5">
        {visibleAssets.map(asset => {
          const url = getAssetUrl(asset);
          const key = getAssetKey(asset) || url;
          const isCopied = copiedKey === key;

          return (
            <div
              key={key}
              className="flex items-center justify-between gap-2 rounded-lg border border-blue-100 bg-white px-2.5 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-gray-900">
                  {getAssetTitle(asset)}
                </p>

                <p className="truncate text-[11px] text-gray-500">
                  {asset.categoryName || asset.assetType || "Asset"} · v
                  {asset.currentVersion || 1}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                {url && (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border border-blue-100 bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700 hover:bg-blue-100"
                  >
                    <ExternalLink className="h-3 w-3" />
                    View
                  </a>
                )}

                {url && (
                  <button
                    type="button"
                    onClick={() => handleCopyOne(asset)}
                    className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-[10px] font-bold text-gray-600 hover:bg-gray-50"
                  >
                    {isCopied ? (
                      <Check className="h-3 w-3 text-green-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}

                    {isCopied ? "Copied" : "Copy"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {compact && assets.length > 2 && (
        <button
          type="button"
          onClick={() => setExpanded(value => !value)}
          className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:underline"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              Show {hiddenCount} more
            </>
          )}
        </button>
      )}
    </div>
  );
}