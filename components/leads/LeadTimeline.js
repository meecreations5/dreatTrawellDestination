// components/leads/LeadTimeline.jsx

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot
} from "firebase/firestore";

import { db } from "@/lib/firebase";

import {
  AlertTriangle,
  ArrowDownCircle,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleDot,
  Copy,
  ExternalLink,
  FileText,
  Filter as FilterIcon,
  LockKeyhole,
  Mail,
  MessageCircle,
  MessageSquare,
  Package,
  PhoneCall,
  RefreshCcw,
  RotateCcw,
  Send,
  Sparkles,
  UserRound,
  Wallet
} from "lucide-react";

/* =========================
   BASE UI MAP
========================= */

const UI = {
  follow_up: {
    Icon: PhoneCall,
    soft: "bg-blue-50 text-blue-700 border-blue-100",
    dot: "bg-blue-600",
    iconColor: "text-blue-700",
    label: "Follow-up"
  },
  quotation: {
    Icon: Wallet,
    soft: "bg-purple-50 text-purple-700 border-purple-100",
    dot: "bg-purple-600",
    iconColor: "text-purple-700",
    label: "Quotation"
  },
  stage: {
    Icon: RefreshCcw,
    soft: "bg-orange-50 text-orange-700 border-orange-100",
    dot: "bg-orange-500",
    iconColor: "text-orange-700",
    label: "Stage"
  },
  assigned: {
    Icon: UserRound,
    soft: "bg-green-50 text-green-700 border-green-100",
    dot: "bg-green-600",
    iconColor: "text-green-700",
    label: "Assigned"
  },
  remark: {
    Icon: MessageSquare,
    soft: "bg-gray-50 text-gray-700 border-gray-200",
    dot: "bg-gray-400",
    iconColor: "text-gray-600",
    label: "Remark"
  },
  created: {
    Icon: Sparkles,
    soft: "bg-indigo-50 text-indigo-700 border-indigo-100",
    dot: "bg-indigo-600",
    iconColor: "text-indigo-700",
    label: "Created"
  }
};

/* =========================
   QUOTATION ACTION UI
========================= */

const QUOTATION_UI = {
  draft_saved: {
    Icon: FileText,
    soft: "bg-slate-50 text-slate-700 border-slate-200",
    dot: "bg-slate-500",
    iconColor: "text-slate-700",
    label: "Draft Saved"
  },
  draft_updated: {
    Icon: FileText,
    soft: "bg-gray-50 text-gray-700 border-gray-200",
    dot: "bg-gray-500",
    iconColor: "text-gray-700",
    label: "Draft Updated"
  },
  quotation_created: {
    Icon: Wallet,
    soft: "bg-purple-50 text-purple-700 border-purple-100",
    dot: "bg-purple-600",
    iconColor: "text-purple-700",
    label: "Quotation Created"
  },
  quotation_sent_email: {
    Icon: Mail,
    soft: "bg-blue-50 text-blue-700 border-blue-100",
    dot: "bg-blue-600",
    iconColor: "text-blue-700",
    label: "Sent via Email"
  },
  quotation_sent_whatsapp: {
    Icon: MessageCircle,
    soft: "bg-green-50 text-green-700 border-green-100",
    dot: "bg-green-600",
    iconColor: "text-green-700",
    label: "Sent via WhatsApp"
  },
  quotation_sent_email_whatsapp: {
    Icon: Send,
    soft: "bg-cyan-50 text-cyan-700 border-cyan-100",
    dot: "bg-cyan-600",
    iconColor: "text-cyan-700",
    label: "Sent via Email & WhatsApp"
  },
  final_quotation_marked: {
    Icon: CheckCircle2,
    soft: "bg-emerald-50 text-emerald-700 border-emerald-100",
    dot: "bg-emerald-600",
    iconColor: "text-emerald-700",
    label: "Final Quotation"
  },
  quotation_revised: {
    Icon: RotateCcw,
    soft: "bg-violet-50 text-violet-700 border-violet-100",
    dot: "bg-violet-600",
    iconColor: "text-violet-700",
    label: "Revised"
  },
  quotation_cost_updated: {
    Icon: LockKeyhole,
    soft: "bg-orange-50 text-orange-700 border-orange-100",
    dot: "bg-orange-500",
    iconColor: "text-orange-700",
    label: "Internal Cost Updated"
  },
  quotation_send_failed: {
    Icon: AlertTriangle,
    soft: "bg-red-50 text-red-700 border-red-100",
    dot: "bg-red-600",
    iconColor: "text-red-700",
    label: "Send Failed"
  }
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "quotation", label: "Quotation" },
  { key: "follow_up", label: "Follow-up" },
  { key: "stage", label: "Stage" },
  { key: "assigned", label: "Assigned" },
  { key: "remark", label: "Remark" }
];

/* =========================
   BASIC HELPERS
========================= */

function cleanString(value = "") {
  return String(value || "").trim();
}

function getTimelineMetadata(item = {}) {
  return item?.metadata || item?.data || item || {};
}

function getAssetTitle(asset = {}) {
  return cleanString(
    asset.title ||
    asset.name ||
    asset.fileName ||
    asset.currentFileName ||
    "Asset"
  );
}

function getAssetUrl(asset = {}) {
  return cleanString(
    asset.url ||
    asset.currentUrl ||
    asset.externalUrl ||
    asset.downloadUrl ||
    asset.fileUrl
  );
}

function getAssetKey(asset = {}) {
  return cleanString(
    asset.assetId ||
    asset.id ||
    asset.documentId ||
    getAssetUrl(asset)
  );
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

function normalizeSharedAsset(asset = {}) {
  return {
    assetId: cleanString(asset.assetId || asset.id || asset.documentId),
    title: getAssetTitle(asset),
    url: getAssetUrl(asset),
    categoryName: cleanString(asset.categoryName),
    assetType: cleanString(asset.assetType || asset.documentType || "Asset"),
    currentVersion: asset.currentVersion || asset.version || 1
  };
}

function getSharedAssetsFromTimelineItem(item = {}) {
  const metadata = getTimelineMetadata(item);

  const directAssets =
    metadata.sharedAssets ||
    metadata.quotationSharedAssets ||
    metadata.latestQuotationSharedAssets ||
    item.sharedAssets ||
    item.quotationSharedAssets ||
    [];

  const textAssets = parseAssetsFromLinksText(
    metadata.assetLinksText ||
    item.assetLinksText ||
    metadata.latestQuotationAssetLinksText ||
    ""
  );

  const htmlAssets = parseAssetsFromLinksHtml(
    metadata.assetLinksHtml ||
    item.assetLinksHtml ||
    metadata.latestQuotationAssetLinksHtml ||
    ""
  );

  const assets =
    Array.isArray(directAssets) && directAssets.length
      ? directAssets
      : textAssets.length
        ? textAssets
        : htmlAssets;

  if (!Array.isArray(assets)) return [];

  const map = new Map();

  assets.forEach(asset => {
    const normalized = normalizeSharedAsset(asset);
    const key = getAssetKey(normalized);

    if (!key && !normalized.url) return;

    map.set(key || normalized.url, normalized);
  });

  return Array.from(map.values());
}

function toJsDate(value) {
  if (!value) return new Date();

  if (value?.toDate) {
    const date = value.toDate();
    return Number.isNaN(date.getTime()) ? new Date() : date;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? new Date() : value;
  }

  if (typeof value === "object" && typeof value.seconds === "number") {
    const date = new Date(value.seconds * 1000);
    return Number.isNaN(date.getTime()) ? new Date() : date;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

const isSameDay = (a, b) =>
  a.getDate() === b.getDate() &&
  a.getMonth() === b.getMonth() &&
  a.getFullYear() === b.getFullYear();

function formatDateLabel(dateValue) {
  const d = toJsDate(dateValue);
  const today = new Date();
  const yesterday = new Date(today);

  yesterday.setDate(today.getDate() - 1);

  if (isSameDay(d, today)) return "Today";
  if (isSameDay(d, yesterday)) return "Yesterday";

  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function formatTime(dateValue) {
  if (!dateValue) return "";

  return toJsDate(dateValue).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function resolveTimelineDate(...values) {
  for (const value of values) {
    if (!value) continue;

    if (value?.toDate) {
      const date = value.toDate();
      if (!Number.isNaN(date.getTime())) return date;
    }

    if (value instanceof Date) {
      if (!Number.isNaN(value.getTime())) return value;
    }

    if (typeof value === "number") {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return date;
    }

    if (typeof value === "string") {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return date;
    }

    if (
      typeof value === "object" &&
      typeof value.seconds === "number"
    ) {
      const date = new Date(value.seconds * 1000);
      if (!Number.isNaN(date.getTime())) return date;
    }
  }

  return null;
}

/* =========================
   SHARED ASSET UI
========================= */

function TimelineSharedAssets({ item }) {
  const [copiedAssetKey, setCopiedAssetKey] = useState("");

  const assets = getSharedAssetsFromTimelineItem(item);

  if (!assets.length) return null;

  const copyLink = async asset => {
    const url = getAssetUrl(asset);
    if (!url) return;

    try {
      if (
        typeof navigator !== "undefined" &&
        navigator.clipboard?.writeText
      ) {
        await navigator.clipboard.writeText(url);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = url;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";

        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      setCopiedAssetKey(getAssetKey(asset) || url);

      window.setTimeout(() => {
        setCopiedAssetKey("");
      }, 1200);
    } catch (error) {
      console.warn("Asset link copy failed:", error);
    }
  };

  return (
    <div
      onClick={event => event.stopPropagation()}
      className="mt-3 rounded-xl border border-blue-100 bg-blue-50/50 p-2.5"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Package className="h-3.5 w-3.5 text-blue-600" />

          <p className="text-[11px] font-bold text-blue-800">
            Shared Assets
          </p>
        </div>

        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-100">
          {assets.length}
        </span>
      </div>

      <div className="space-y-1.5">
        {assets.map(asset => {
          const assetKey = getAssetKey(asset) || getAssetUrl(asset);
          const isCopied = copiedAssetKey === assetKey;
          const url = getAssetUrl(asset);

          return (
            <div
              key={assetKey}
              className="flex items-center justify-between gap-2 rounded-lg border border-blue-100 bg-white px-2.5 py-1.5"
            >
              <div className="min-w-0">
                <p className="truncate text-[11px] font-bold text-gray-900">
                  {getAssetTitle(asset)}
                </p>

                <p className="truncate text-[10px] text-gray-500">
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
                    onClick={() => copyLink(asset)}
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
    </div>
  );
}

/* =========================
   VALUE HELPERS
========================= */

function hasValue(value) {
  return value !== undefined && value !== null && value !== "";
}

function hasArrayValue(value) {
  return Array.isArray(value) && value.length > 0;
}

function mergeIfMissing(currentValue, fallbackValue) {
  return hasValue(currentValue) ? currentValue : fallbackValue;
}

function mergeArrayIfMissing(currentValue, fallbackValue) {
  if (Array.isArray(currentValue) && currentValue.length) {
    return currentValue;
  }

  if (!Array.isArray(currentValue) && hasValue(currentValue)) {
    return currentValue;
  }

  return fallbackValue;
}

function formatMoney(value) {
  if (!hasValue(value)) return "—";

  const amount = Number(value);

  if (!Number.isFinite(amount)) return "—";

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(amount);
}

function formatPercent(value) {
  if (!hasValue(value)) return "—";

  const number = Number(value);

  if (!Number.isFinite(number)) return "—";

  return `${number.toFixed(1)}%`;
}

function getQuotationAction(event) {
  if (event.type !== "quotation") return "";

  const metadata = event.metadata || {};
  const action = metadata.action;

  if (action) return action;

  const title = String(event.title || "").toLowerCase();
  const channel = String(
    metadata.channel || metadata.sentVia || ""
  ).toLowerCase();
  const status = String(metadata.status || "").toLowerCase();

  if (title.includes("draft updated")) return "draft_updated";
  if (title.includes("draft saved")) return "draft_saved";
  if (title.includes("final")) return "final_quotation_marked";

  if (title.includes("whatsapp") && title.includes("email")) {
    return "quotation_sent_email_whatsapp";
  }

  if (title.includes("whatsapp")) return "quotation_sent_whatsapp";
  if (title.includes("email")) return "quotation_sent_email";

  if (channel.includes("whatsapp") && channel.includes("email")) {
    return "quotation_sent_email_whatsapp";
  }

  if (channel.includes("whatsapp")) return "quotation_sent_whatsapp";
  if (channel.includes("email")) return "quotation_sent_email";

  if (status === "draft") return "draft_saved";
  if (status === "final") return "final_quotation_marked";

  return "quotation_created";
}

function getEventUi(event) {
  if (event.type === "quotation") {
    const action = getQuotationAction(event);
    return QUOTATION_UI[action] || UI.quotation;
  }

  return UI[event.type] || UI.remark;
}

function getActionStatus(event) {
  const metadata = event.metadata || {};
  const action = getQuotationAction(event);

  if (metadata.status) return metadata.status;

  if (action === "draft_saved" || action === "draft_updated") {
    return "draft";
  }

  if (action === "final_quotation_marked") {
    return "final";
  }

  if (
    action === "quotation_sent_email" ||
    action === "quotation_sent_whatsapp" ||
    action === "quotation_sent_email_whatsapp"
  ) {
    return "sent";
  }

  return "";
}

function getSentViaValue(event) {
  const metadata = event.metadata || {};

  if (Array.isArray(metadata.sentVia)) {
    return metadata.sentVia.join(", ");
  }

  if (metadata.sentVia) return metadata.sentVia;
  if (metadata.channel) return metadata.channel;

  const action = getQuotationAction(event);

  if (action === "quotation_sent_email") return "email";
  if (action === "quotation_sent_whatsapp") return "whatsapp";
  if (action === "quotation_sent_email_whatsapp") {
    return "email, whatsapp";
  }

  return "";
}

function getTotalAmountValue(event) {
  const metadata = event.metadata || {};

  return (
    metadata.totalAmount ??
    metadata.customerQuotedAmount ??
    metadata.totalPrice ??
    metadata.amount ??
    ""
  );
}

function getQuotationKeys(event) {
  if (!event || event.type !== "quotation") return [];

  const metadata = event.metadata || {};

  const quotationId =
    metadata.quotationId ||
    event.quotationId ||
    "";

  const revision =
    metadata.revision ??
    metadata.rev ??
    metadata.version ??
    "";

  return [
    quotationId ? `qid:${quotationId}` : "",
    revision ? `rev:${revision}` : ""
  ].filter(Boolean);
}

function getCommercialSnapshot(event) {
  const metadata = event?.metadata || {};

  const totalAmount =
    metadata.totalAmount ??
    metadata.customerQuotedAmount ??
    metadata.totalPrice ??
    metadata.amount;

  const customerQuotedAmount =
    metadata.customerQuotedAmount ??
    metadata.totalAmount ??
    metadata.totalPrice ??
    metadata.amount;

  const sharedAssets =
    metadata.sharedAssets ||
    metadata.quotationSharedAssets ||
    metadata.latestQuotationSharedAssets ||
    [];

  return {
    totalAmount,
    customerQuotedAmount,
    vendorCost: metadata.vendorCost,
    grossProfit: metadata.grossProfit,
    marginPercent: metadata.marginPercent,
    itineraryHtml: metadata.itineraryHtml,
    quotationId: metadata.quotationId,
    revision:
      metadata.revision ??
      metadata.rev ??
      metadata.version,
    pricingVisibleToCustomer: metadata.pricingVisibleToCustomer,

    sharedAssets,
    sharedAssetIds: metadata.sharedAssetIds,
    sharedAssetTitles: metadata.sharedAssetTitles,
    assetShareCount:
      metadata.assetShareCount ??
      (Array.isArray(sharedAssets) ? sharedAssets.length : 0),
    hasSharedAssets:
      metadata.hasSharedAssets ??
      (Array.isArray(sharedAssets) && sharedAssets.length > 0),
    assetLinksText: metadata.assetLinksText,
    assetLinksHtml: metadata.assetLinksHtml
  };
}

function getDateMsFromAny(...values) {
  const date = resolveTimelineDate(...values);
  return date ? date.getTime() : 0;
}

function findFallbackQuotationSnapshot(event, quotationSnapshots = []) {
  if (!event || event.type !== "quotation") return {};

  const snapshotsWithAssets = quotationSnapshots.filter(snapshot => {
    return (
      Array.isArray(snapshot.sharedAssets) &&
      snapshot.sharedAssets.length > 0
    );
  });

  if (!snapshotsWithAssets.length) return {};

  // If only one quotation has assets, use it as fallback.
  if (snapshotsWithAssets.length === 1) {
    return snapshotsWithAssets[0];
  }

  const eventMs = getDateMsFromAny(
    event.createdAt,
    event.updatedAt,
    event.sentAt,
    event.metadata?.createdAt,
    event.metadata?.updatedAt,
    event.metadata?.sentAt
  );

  if (!eventMs) return {};

  const nearest = snapshotsWithAssets
    .filter(snapshot => snapshot.timestampMs)
    .map(snapshot => ({
      snapshot,
      diff: Math.abs(snapshot.timestampMs - eventMs)
    }))
    .sort((a, b) => a.diff - b.diff)[0];

  // Within 48 hours, assume quotation doc belongs to this timeline quotation event.
  if (nearest && nearest.diff <= 1000 * 60 * 60 * 48) {
    return nearest.snapshot;
  }

  return {};
}

function getQuotationSnapshotFromQuotationDoc(quotation = {}) {
  const metadata = quotation.metadata || {};

  const directSharedAssets =
    quotation.sharedAssets ||
    quotation.quotationAssets ||
    quotation.latestQuotationSharedAssets ||
    quotation.finalQuotationSharedAssets ||
    metadata.sharedAssets ||
    metadata.quotationAssets ||
    metadata.latestQuotationSharedAssets ||
    metadata.finalQuotationSharedAssets ||
    [];

  const assetLinksText =
    quotation.assetLinksText ||
    quotation.latestQuotationAssetLinksText ||
    quotation.finalQuotationAssetLinksText ||
    metadata.assetLinksText ||
    metadata.latestQuotationAssetLinksText ||
    metadata.finalQuotationAssetLinksText ||
    "";

  const assetLinksHtml =
    quotation.assetLinksHtml ||
    quotation.latestQuotationAssetLinksHtml ||
    quotation.finalQuotationAssetLinksHtml ||
    metadata.assetLinksHtml ||
    metadata.latestQuotationAssetLinksHtml ||
    metadata.finalQuotationAssetLinksHtml ||
    "";

  const textAssets = parseAssetsFromLinksText(assetLinksText);
  const htmlAssets = parseAssetsFromLinksHtml(assetLinksHtml);

  const sharedAssets =
    Array.isArray(directSharedAssets) && directSharedAssets.length
      ? directSharedAssets
      : textAssets.length
        ? textAssets
        : htmlAssets;

  return {
    quotationId:
      quotation.id ||
      quotation.quotationId ||
      metadata.quotationId ||
      "",

    revision:
      quotation.revision ??
      metadata.revision ??
      metadata.rev ??
      metadata.version ??
      "",

    timestampMs: getDateMsFromAny(
      quotation.sentAt,
      quotation.updatedAt,
      quotation.createdAt,
      metadata.sentAt,
      metadata.updatedAt,
      metadata.createdAt
    ),

    totalAmount:
      quotation.totalAmount ??
      quotation.customerQuotedAmount ??
      quotation.totalPrice ??
      metadata.totalAmount ??
      metadata.customerQuotedAmount ??
      metadata.totalPrice,

    customerQuotedAmount:
      quotation.customerQuotedAmount ??
      quotation.customerQuoteAmount ??
      quotation.totalAmount ??
      quotation.totalPrice ??
      metadata.customerQuotedAmount ??
      metadata.customerQuoteAmount ??
      metadata.totalAmount ??
      metadata.totalPrice,

    vendorCost:
      quotation.vendorCost ??
      quotation.selectedVendorCost ??
      metadata.vendorCost ??
      metadata.selectedVendorCost,

    grossProfit:
      quotation.grossProfit ??
      metadata.grossProfit,

    marginPercent:
      quotation.marginPercent ??
      metadata.marginPercent,

    itineraryHtml:
      quotation.itineraryHtml ??
      metadata.itineraryHtml,

    pricingVisibleToCustomer:
      quotation.pricingVisibleToCustomer ??
      metadata.pricingVisibleToCustomer,

    sharedAssets,

    sharedAssetIds:
      quotation.sharedAssetIds ||
      metadata.sharedAssetIds ||
      sharedAssets.map(asset => asset.assetId).filter(Boolean),

    sharedAssetTitles:
      quotation.sharedAssetTitles ||
      metadata.sharedAssetTitles ||
      sharedAssets.map(asset => asset.title).filter(Boolean),

    assetShareCount:
      quotation.assetShareCount ??
      metadata.assetShareCount ??
      sharedAssets.length,

    hasSharedAssets:
      quotation.hasSharedAssets ??
      metadata.hasSharedAssets ??
      sharedAssets.length > 0,

    assetLinksText,
    assetLinksHtml
  };
}

function enrichEventsWithCommercials(
  visibleEvents = [],
  allEvents = [],
  quotationRows = []
) {
  const commercialMap = new Map();

  const quotationSnapshots = quotationRows
    .map(quotation => getQuotationSnapshotFromQuotationDoc(quotation))
    .filter(snapshot => {
      return (
        hasValue(snapshot.quotationId) ||
        hasValue(snapshot.revision) ||
        hasArrayValue(snapshot.sharedAssets) ||
        snapshot.hasSharedAssets === true
      );
    });

  quotationSnapshots.forEach(snapshot => {
    const keys = [
      snapshot.quotationId ? `qid:${snapshot.quotationId}` : "",
      snapshot.revision ? `rev:${snapshot.revision}` : ""
    ].filter(Boolean);

    if (!keys.length) return;

    const hasCommercial =
      hasValue(snapshot.totalAmount) ||
      hasValue(snapshot.customerQuotedAmount) ||
      hasValue(snapshot.vendorCost) ||
      hasValue(snapshot.grossProfit) ||
      hasValue(snapshot.marginPercent) ||
      hasValue(snapshot.itineraryHtml) ||
      hasArrayValue(snapshot.sharedAssets) ||
      snapshot.hasSharedAssets === true;

    if (!hasCommercial) return;

    const cleanedSnapshot = Object.fromEntries(
      Object.entries(snapshot).filter(([, value]) => {
        if (Array.isArray(value)) return value.length > 0;
        return hasValue(value);
      })
    );

    keys.forEach(key => {
      const existing = commercialMap.get(key) || {};

      commercialMap.set(key, {
        ...existing,
        ...cleanedSnapshot
      });
    });
  });

  [...allEvents, ...visibleEvents].forEach(event => {
    if (event?.type !== "quotation") return;

    const keys = getQuotationKeys(event);
    if (!keys.length) return;

    const snapshot = getCommercialSnapshot(event);

    const hasCommercial =
      hasValue(snapshot.totalAmount) ||
      hasValue(snapshot.customerQuotedAmount) ||
      hasValue(snapshot.vendorCost) ||
      hasValue(snapshot.grossProfit) ||
      hasValue(snapshot.marginPercent) ||
      hasValue(snapshot.itineraryHtml) ||
      hasArrayValue(snapshot.sharedAssets) ||
      snapshot.hasSharedAssets === true;

    if (!hasCommercial) return;

    const cleanedSnapshot = Object.fromEntries(
      Object.entries(snapshot).filter(([, value]) => {
        if (Array.isArray(value)) return value.length > 0;
        return hasValue(value);
      })
    );

    keys.forEach(key => {
      const existing = commercialMap.get(key) || {};

      commercialMap.set(key, {
        ...existing,
        ...cleanedSnapshot
      });
    });
  });

  return visibleEvents.map(event => {
    if (event?.type !== "quotation") return event;

    const keys = getQuotationKeys(event);

    const keyedFallback =
      keys.map(key => commercialMap.get(key)).find(Boolean) || {};

    const looseFallback = Object.keys(keyedFallback).length
      ? {}
      : findFallbackQuotationSnapshot(event, quotationSnapshots);

    const fallback = Object.keys(keyedFallback).length
      ? keyedFallback
      : looseFallback;

    if (!Object.keys(fallback).length) return event;

    const metadata = event.metadata || {};

    return {
      ...event,
      metadata: {
        ...metadata,

        quotationId: mergeIfMissing(
          metadata.quotationId,
          fallback.quotationId
        ),
        revision: mergeIfMissing(metadata.revision, fallback.revision),

        totalAmount: mergeIfMissing(
          metadata.totalAmount,
          fallback.totalAmount
        ),
        customerQuotedAmount: mergeIfMissing(
          metadata.customerQuotedAmount,
          fallback.customerQuotedAmount
        ),
        vendorCost: mergeIfMissing(metadata.vendorCost, fallback.vendorCost),
        grossProfit: mergeIfMissing(
          metadata.grossProfit,
          fallback.grossProfit
        ),
        marginPercent: mergeIfMissing(
          metadata.marginPercent,
          fallback.marginPercent
        ),
        itineraryHtml: mergeIfMissing(
          metadata.itineraryHtml,
          fallback.itineraryHtml
        ),

        pricingVisibleToCustomer:
          metadata.pricingVisibleToCustomer === undefined
            ? fallback.pricingVisibleToCustomer
            : metadata.pricingVisibleToCustomer,

        sharedAssets: mergeArrayIfMissing(
          metadata.sharedAssets,
          fallback.sharedAssets
        ),
        sharedAssetIds: mergeArrayIfMissing(
          metadata.sharedAssetIds,
          fallback.sharedAssetIds
        ),
        sharedAssetTitles: mergeArrayIfMissing(
          metadata.sharedAssetTitles,
          fallback.sharedAssetTitles
        ),
        assetShareCount: mergeIfMissing(
          metadata.assetShareCount,
          fallback.assetShareCount
        ),
        hasSharedAssets:
          metadata.hasSharedAssets === undefined
            ? fallback.hasSharedAssets
            : metadata.hasSharedAssets,
        assetLinksText: mergeIfMissing(
          metadata.assetLinksText,
          fallback.assetLinksText
        ),
        assetLinksHtml: mergeIfMissing(
          metadata.assetLinksHtml,
          fallback.assetLinksHtml
        )
      }
    };
  });
}

function normalizeFollowUpEventForModal(event) {
  const metadata = event.metadata || {};

  const nextActionDate = resolveTimelineDate(
    metadata.nextActionDueAt,
    metadata.nextFollowUpAt,
    metadata.nextActionAt,
    metadata.followUpAt,

    metadata.nextActionDueAtIso,
    metadata.nextFollowUpAtIso,

    metadata.nextActionDueAtMs,
    metadata.nextFollowUpAtMs,

    event.nextActionDueAt,
    event.nextFollowUpAt,
    event.nextActionDueAtIso,
    event.nextFollowUpAtIso,
    event.nextActionDueAtMs,
    event.nextFollowUpAtMs
  );

  const nextActionIso = nextActionDate
    ? nextActionDate.toISOString()
    : "";

  const nextActionMs = nextActionDate
    ? nextActionDate.getTime()
    : null;

  return {
    ...event,

    nextFollowUpAt: nextActionDate,
    nextActionDueAt: nextActionDate,
    nextFollowUpAtIso: nextActionIso,
    nextActionDueAtIso: nextActionIso,
    nextFollowUpAtMs: nextActionMs,
    nextActionDueAtMs: nextActionMs,

    metadata: {
      ...metadata,

      action: metadata.action || "follow_up_logged",

      channel:
        metadata.channel ||
        metadata.followUpChannel ||
        event.channel ||
        "",

      followUpChannel:
        metadata.followUpChannel ||
        metadata.channel ||
        event.channel ||
        "",

      outcome:
        metadata.outcome ||
        metadata.outcomeCode ||
        event.outcome ||
        "",

      summary:
        metadata.summary ||
        metadata.followUpSummary ||
        event.summary ||
        event.description ||
        "",

      followUpSummary:
        metadata.followUpSummary ||
        metadata.summary ||
        event.summary ||
        event.description ||
        "",

      nextActionType:
        metadata.nextActionType ||
        event.nextActionType ||
        "follow_up",

      nextFollowUpAt: nextActionDate,
      nextActionDueAt: nextActionDate,

      nextFollowUpAtIso: nextActionIso,
      nextActionDueAtIso: nextActionIso,
      nextFollowUpAtMs: nextActionMs,
      nextActionDueAtMs: nextActionMs
    }
  };
}

function normalizeEventForModal(event) {
  if (!event) return event;

  if (
    event.type === "follow_up" ||
    event.type === "followup" ||
    event.metadata?.action === "follow_up_logged"
  ) {
    return normalizeFollowUpEventForModal(event);
  }

  if (event.type !== "quotation") return event;

  const metadata = event.metadata || {};
  const action = getQuotationAction(event);
  const ui = QUOTATION_UI[action] || UI.quotation;

  const revision =
    metadata.revision ??
    metadata.rev ??
    metadata.version ??
    "";

  const totalAmount = getTotalAmountValue(event);
  const sentVia = getSentViaValue(event);
  const status = getActionStatus(event);

  const leadId =
    event.leadId ||
    metadata.leadId ||
    "";

  const customerQuotedAmount =
    metadata.customerQuotedAmount ??
    metadata.totalAmount ??
    metadata.totalPrice ??
    metadata.amount;

  return {
    ...event,
    leadId,
    actionLabel: ui.label,
    metadata: {
      ...metadata,

      leadId,
      action,
      status,

      sentVia,
      revision,

      ...(hasValue(totalAmount)
        ? { totalAmount }
        : {}),

      ...(hasValue(customerQuotedAmount)
        ? { customerQuotedAmount }
        : {}),

      channel: metadata.channel || sentVia,

      displayRevision: revision ? `v${revision}` : "",

      pricingVisibleToCustomer:
        metadata.pricingVisibleToCustomer === undefined
          ? false
          : metadata.pricingVisibleToCustomer
    }
  };
}

function hasCommercialMetadata(event) {
  const metadata = event.metadata || {};

  return (
    hasValue(metadata.customerQuotedAmount) ||
    hasValue(metadata.totalAmount) ||
    hasValue(metadata.vendorCost) ||
    hasValue(metadata.grossProfit) ||
    hasValue(metadata.marginPercent)
  );
}

/* =========================
   SMALL UI COMPONENTS
========================= */

function TimelineChip({ children, tone = "gray" }) {
  const tones = {
    gray: "bg-gray-100 text-gray-700 border-gray-200",
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    green: "bg-green-50 text-green-700 border-green-100",
    orange: "bg-orange-50 text-orange-700 border-orange-100",
    purple: "bg-purple-50 text-purple-700 border-purple-100",
    red: "bg-red-50 text-red-700 border-red-100",
    cyan: "bg-cyan-50 text-cyan-700 border-cyan-100",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100"
  };

  return (
    <span
      className={`
        inline-flex items-center rounded-full border px-2 py-0.5
        text-[10px] font-bold
        ${tones[tone] || tones.gray}
      `}
    >
      {children}
    </span>
  );
}

function FilterButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        rounded-full border px-2.5 py-1 text-[11px] font-bold transition
        ${active
          ? "bg-blue-600 text-white border-blue-600 "
          : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
        }
      `}
    >
      {children}
    </button>
  );
}

function QuotationChips({ event }) {
  if (event.type !== "quotation") return null;

  const normalizedEvent = normalizeEventForModal(event);
  const metadata = normalizedEvent.metadata || {};
  const action = getQuotationAction(normalizedEvent);

  const assetCount =
    metadata.assetShareCount ||
    metadata.sharedAssets?.length ||
    0;

  return (
    <div className="flex flex-wrap gap-1.5 mt-2.5">
      {metadata.revision && (
        <TimelineChip tone="purple">
          Rev {metadata.revision}
        </TimelineChip>
      )}

      {metadata.channel && (
        <TimelineChip
          tone={
            String(metadata.channel).includes("whatsapp")
              ? "green"
              : "blue"
          }
        >
          {metadata.channel}
        </TimelineChip>
      )}

      {metadata.status && (
        <TimelineChip
          tone={
            metadata.status === "draft"
              ? "gray"
              : metadata.status === "final"
                ? "emerald"
                : "green"
          }
        >
          {metadata.status}
        </TimelineChip>
      )}

      {metadata.isDraft && (
        <TimelineChip tone="gray">
          Draft
        </TimelineChip>
      )}

      {metadata.isFinalQuotation && (
        <TimelineChip tone="emerald">
          Final
        </TimelineChip>
      )}

      {metadata.pricingVisibleToCustomer === false && (
        <TimelineChip tone="orange">
          Internal pricing hidden
        </TimelineChip>
      )}

      {(metadata.hasSharedAssets || assetCount > 0) && (
        <TimelineChip tone="blue">
          {assetCount} Assets
        </TimelineChip>
      )}

      {metadata.marginPercent !== undefined &&
        metadata.marginPercent !== null && (
          <TimelineChip tone="gray">
            Margin {formatPercent(metadata.marginPercent)}
          </TimelineChip>
        )}

      {action === "quotation_send_failed" && (
        <TimelineChip tone="red">
          Failed
        </TimelineChip>
      )}
    </div>
  );
}

function InternalCommercials({ event }) {
  if (event.type !== "quotation") return null;

  const normalizedEvent = normalizeEventForModal(event);

  if (!hasCommercialMetadata(normalizedEvent)) return null;

  const metadata = normalizedEvent.metadata || {};

  return (
    <div className="mt-3 rounded-xl border border-orange-100 bg-orange-50 p-2.5">
      <div className="mb-2 flex items-center gap-1.5">
        <LockKeyhole className="h-3.5 w-3.5 text-orange-700" />

        <p className="text-[11px] font-bold text-orange-800">
          Internal Commercials
        </p>
      </div>

      <div className="grid grid-cols-2 gap-1.5 text-[11px]">
        <div className="rounded-lg bg-white border border-orange-100 px-2 py-1.5">
          <p className="text-[10px] text-gray-500">Quote</p>
          <p className="font-bold text-gray-900">
            {formatMoney(metadata.customerQuotedAmount ?? metadata.totalAmount)}
          </p>
        </div>

        <div className="rounded-lg bg-white border border-orange-100 px-2 py-1.5">
          <p className="text-[10px] text-gray-500">Vendor</p>
          <p className="font-bold text-gray-900">
            {formatMoney(metadata.vendorCost)}
          </p>
        </div>

        <div className="rounded-lg bg-white border border-orange-100 px-2 py-1.5">
          <p className="text-[10px] text-gray-500">Profit</p>
          <p className="font-bold text-gray-900">
            {formatMoney(metadata.grossProfit)}
          </p>
        </div>

        <div className="rounded-lg bg-white border border-orange-100 px-2 py-1.5">
          <p className="text-[10px] text-gray-500">Margin</p>
          <p className="font-bold text-gray-900">
            {formatPercent(metadata.marginPercent)}
          </p>
        </div>
      </div>
    </div>
  );
}

function SignatureUsed({ event }) {
  const signatureUser = event.metadata?.signatureUser;

  if (!signatureUser?.name) return null;

  return (
    <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-gray-50 border border-gray-100 px-2.5 py-1.5">
      <UserRound className="h-3.5 w-3.5 text-gray-500" />

      <p className="text-[11px] text-gray-500">
        Signature:{" "}
        <span className="font-bold text-gray-700">
          {signatureUser.name}
        </span>

        {signatureUser.role ? (
          <span> · {signatureUser.role}</span>
        ) : null}
      </p>
    </div>
  );
}

function NextFollowUp({ event }) {
  const metadata = event.metadata || {};

  const nextFollowUpAt = resolveTimelineDate(
    metadata.nextActionDueAt,
    metadata.nextFollowUpAt,
    metadata.nextActionAt,
    metadata.followUpAt,

    metadata.nextActionDueAtIso,
    metadata.nextFollowUpAtIso,

    metadata.nextActionDueAtMs,
    metadata.nextFollowUpAtMs,

    event.nextActionDueAt,
    event.nextFollowUpAt,
    event.nextActionDueAtIso,
    event.nextFollowUpAtIso,
    event.nextActionDueAtMs,
    event.nextFollowUpAtMs
  );

  if (!nextFollowUpAt) return null;

  return (
    <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1.5">
      <CalendarDays className="h-3.5 w-3.5 text-blue-600" />

      <p className="text-[11px] font-medium text-blue-700">
        Next:{" "}
        {nextFollowUpAt.toLocaleString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        })}
      </p>
    </div>
  );
}

/* =========================
   MAIN COMPONENT
========================= */

export default function LeadTimeline({
  leadId,
  onLoad,
  onSelect,
  eventsOverride,
  showFilters = false
}) {
  const [events, setEvents] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [activeFilter, setActiveFilter] = useState("all");
  const todayRef = useRef(null);

  useEffect(() => {
    if (!leadId) return;

    const q = query(
      collection(db, "leads", leadId, "timeline"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, snap => {
      const rows = snap.docs.map(d => {
        const data = d.data();

        return {
          id: d.id,
          leadId,
          ...data,
          metadata: {
            ...(data.metadata || {}),
            leadId
          }
        };
      });

      setEvents(rows);
      onLoad?.(rows);
    });

    return () => unsub();
  }, [leadId, onLoad]);

  useEffect(() => {
    if (!leadId) return;

    const unsub = onSnapshot(
      collection(db, "leads", leadId, "quotations"),
      snap => {
        const rows = snap.docs.map(d => ({
          id: d.id,
          ...d.data()
        }));

        setQuotations(rows);
      },
      error => {
        console.warn("Quotation asset timeline sync skipped:", error);
        setQuotations([]);
      }
    );

    return () => unsub();
  }, [leadId]);

  const rawSource = eventsOverride ?? events;

  const source = useMemo(() => {
    return enrichEventsWithCommercials(rawSource, events, quotations);
  }, [rawSource, events, quotations]);

  console.log("Timeline asset debug", {
    events: events.map(event => ({
      id: event.id,
      type: event.type,
      title: event.title,
      metadata: event.metadata,
      sharedAssets: event.metadata?.sharedAssets,
      assetLinksText: event.metadata?.assetLinksText
    })),

    quotations: quotations.map(quotation => ({
      id: quotation.id,
      revision: quotation.revision,
      sharedAssets: quotation.sharedAssets,
      assetLinksText: quotation.assetLinksText,
      assetLinksHtml: quotation.assetLinksHtml
    })),

    source: source.map(event => ({
      id: event.id,
      type: event.type,
      title: event.title,
      sharedAssets: event.metadata?.sharedAssets,
      assetLinksText: event.metadata?.assetLinksText
    }))
  });

  const filteredEvents = useMemo(() => {
    if (!showFilters) return source;
    if (activeFilter === "all") return source;

    return source.filter(event => {
      if (activeFilter === "remark") {
        return event.type === "remark" || !event.type;
      }

      return event.type === activeFilter;
    });
  }, [source, activeFilter, showFilters]);

  const grouped = useMemo(() => {
    return filteredEvents.reduce((acc, event) => {
      const date =
        resolveTimelineDate(event.createdAt) ||
        event.createdAt?.toDate?.() ||
        new Date();

      const label = formatDateLabel(date);

      if (!acc[label]) acc[label] = [];
      acc[label].push(event);

      return acc;
    }, {});
  }, [filteredEvents]);

  const quotationCount = source.filter(
    event => event.type === "quotation"
  ).length;

  const followUpCount = source.filter(
    event => event.type === "follow_up"
  ).length;

  if (!source.length) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-gray-200 ">
          <CircleDot className="h-4 w-4 text-gray-400" />
        </div>

        <p className="mt-2 text-sm font-bold text-gray-900">
          No activity yet
        </p>

        <p className="mt-1 text-xs text-gray-500">
          Lead actions, follow-ups and quotations will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* TOP BAR */}
      <div className="rounded-xl border border-gray-200 bg-white p-3 ">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700 border border-blue-100">
              <CalendarDays className="h-3.5 w-3.5" />
            </span>

            <div>
              <p className="text-sm font-bold text-gray-900">
                Lead Activity
              </p>

              <p className="text-[11px] text-gray-500">
                {source.length} activities · {quotationCount} quotations · {followUpCount} follow-ups
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            {showFilters && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-500">
                  <FilterIcon className="h-3.5 w-3.5" />
                  Filter
                </span>

                {FILTERS.map(filter => (
                  <FilterButton
                    key={filter.key}
                    active={activeFilter === filter.key}
                    onClick={() => setActiveFilter(filter.key)}
                  >
                    {filter.label}
                  </FilterButton>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() =>
                todayRef.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "start"
                })
              }
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1.5 text-[11px] font-bold text-blue-700 hover:bg-blue-100"
            >
              <ArrowDownCircle className="h-3.5 w-3.5" />
              Today
            </button>
          </div>
        </div>
      </div>

      {!filteredEvents.length ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center">
          <p className="text-sm font-bold text-gray-900">
            No activity found
          </p>

          <p className="mt-1 text-xs text-gray-500">
            Try changing the selected filter.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([dateLabel, items]) => (
            <div
              key={dateLabel}
              ref={dateLabel === "Today" ? todayRef : null}
            >
              {/* DATE HEADER */}
              <div className="mb-3 flex items-center gap-3">
                <div className="h-px flex-1 bg-gray-200" />

                <span className="rounded-full border border-gray-200 bg-white px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-500 ">
                  {dateLabel}
                </span>

                <div className="h-px flex-1 bg-gray-200" />
              </div>

              {/* TIMELINE */}
              <div className="relative">
                <div className="absolute left-[15px] top-0 bottom-0 w-px bg-gray-200" />

                <div className="space-y-4">
                  {items.map(event => {
                    const normalizedEvent = normalizeEventForModal(event);
                    const ui = getEventUi(normalizedEvent);
                    const Icon = ui.Icon || CircleDot;

                    const actionLabel =
                      normalizedEvent.type === "quotation"
                        ? QUOTATION_UI[
                          getQuotationAction(normalizedEvent)
                        ]?.label
                        : ui.label;

                    return (
                      <div
                        key={normalizedEvent.id}
                        className="relative flex gap-3"
                      >
                        <div className="relative z-10 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white ">
                          <span
                            className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${ui.dot}`}
                          />

                          <Icon className={`h-3.5 w-3.5 ${ui.iconColor}`} />
                        </div>

                        <div
                          onClick={() => onSelect?.(normalizedEvent)}
                          className="
                            group flex-1 cursor-pointer rounded-xl border border-gray-200
                            bg-white p-3  transition
                            hover:border-blue-100 hover:shadow-md
                          "
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span
                                  className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${ui.soft}`}
                                >
                                  {actionLabel || ui.label}
                                </span>

                                {normalizedEvent.metadata?.displayRevision && (
                                  <span className="rounded-full border border-purple-100 bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700">
                                    {normalizedEvent.metadata.displayRevision}
                                  </span>
                                )}
                              </div>

                              <p className="mt-1.5 text-sm font-bold text-gray-900">
                                {normalizedEvent.title || actionLabel}
                              </p>

                              {normalizedEvent.description && (
                                <p className="mt-1 text-xs leading-relaxed text-gray-600">
                                  {normalizedEvent.description}
                                </p>
                              )}
                            </div>

                            <div className="shrink-0 text-right">
                              <p className="rounded-full bg-gray-50 px-2 py-0.5 text-[11px] font-bold text-gray-500 border border-gray-100">
                                {formatTime(normalizedEvent.createdAt)}
                              </p>
                            </div>
                          </div>

                          <TimelineSharedAssets item={normalizedEvent} />

                          <QuotationChips event={normalizedEvent} />

                          <InternalCommercials event={normalizedEvent} />

                          <SignatureUsed event={normalizedEvent} />

                          <NextFollowUp event={normalizedEvent} />

                          <div className="mt-3 flex items-center justify-between gap-3 border-t border-gray-100 pt-2.5">
                            <p className="text-[11px] text-gray-400">
                              By{" "}
                              <span className="font-bold text-gray-500">
                                {normalizedEvent.createdByName ||
                                  normalizedEvent.createdByEmail ||
                                  "System"}
                              </span>
                            </p>

                            <span className="text-[10px] font-bold text-blue-600 opacity-0 transition group-hover:opacity-100">
                              View details
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}