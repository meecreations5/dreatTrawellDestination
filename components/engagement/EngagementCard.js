"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Mail,
  Phone,
  MessageCircle,
  Handshake,
  Clock,
  Star,
  Send,
  PlusCircle,
  Eye,
  MapPin,
  User,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Package,
  Copy,
  Check
} from "lucide-react";

import InitialAvatar from "@/components/ui/InitialAvatar";
import CreateLeadModal from "@/components/engagement/CreateLeadModal";
import SendCommunicationModal from "@/components/engagement/SendCommunicationModal";

/* =========================
   CHANNEL CONFIG
========================= */
const CHANNEL_CONFIG = {
  email: {
    label: "Email",
    icon: Mail,
    color: "text-blue-600"
  },
  call: {
    label: "Call",
    icon: Phone,
    color: "text-green-600"
  },
  whatsapp: {
    label: "WhatsApp",
    icon: MessageCircle,
    color: "text-emerald-600"
  },
  meeting: {
    label: "Meeting",
    icon: Handshake,
    color: "text-purple-600"
  }
};

/* =========================
   HTML TO CLEAN TEXT
========================= */
function normalizeHtmlText(input = "") {
  if (!input) return "";

  return String(input)
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/* =========================
   FIELD HELPERS
========================= */
const getAgentId = (engagement, agent) =>
  agent?.id ||
  engagement?.travelAgentId ||
  engagement?.agentId ||
  engagement?.travelAgentRefId ||
  engagement?.travelAgentDocId ||
  engagement?.agent?.id ||
  engagement?.agent?.travelAgentId ||
  engagement?.travelAgent?.id ||
  "";

const getAgentPhone = (engagement, agent) =>
  agent?.phone ||
  engagement?.agentPhone ||
  engagement?.travelAgentPhone ||
  engagement?.phone ||
  engagement?.mobile ||
  engagement?.spoc?.phone ||
  engagement?.spoc?.mobile ||
  engagement?.agent?.phone ||
  engagement?.agent?.mobile ||
  engagement?.travelAgent?.phone ||
  "";

const getAgentEmail = (engagement, agent) =>
  agent?.email ||
  engagement?.agentEmail ||
  engagement?.travelAgentEmail ||
  engagement?.email ||
  engagement?.spoc?.email ||
  engagement?.agent?.email ||
  engagement?.travelAgent?.email ||
  "";

const getAgentCity = (engagement, agent) =>
  agent?.city ||
  engagement?.agentCity ||
  engagement?.travelAgentCity ||
  engagement?.city ||
  engagement?.agent?.city ||
  engagement?.agent?.address?.city ||
  engagement?.travelAgent?.city ||
  engagement?.travelAgent?.address?.city ||
  "";

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
    "Asset"
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

function normalizeAsset(asset) {
  return {
    assetId: asset?.assetId || asset?.id || asset?.documentId || "",
    title: getAssetTitle(asset),
    url: getAssetUrl(asset),

    categoryId: asset?.categoryId || "",
    categoryName: asset?.categoryName || "",
    categorySlug: asset?.categorySlug || "",

    assetType: asset?.assetType || asset?.documentType || "document",
    usageType: asset?.usageType || "",

    currentVersion: asset?.currentVersion || asset?.version || 1,

    fileName: asset?.fileName || asset?.currentFileName || "",
    fileSize: asset?.fileSize || asset?.currentFileSize || null,
    fileType: asset?.fileType || asset?.currentFileType || "",
    fileExtension:
      asset?.fileExtension || asset?.currentFileExtension || "",

    sharedAs: asset?.sharedAs || "file_link"
  };
}

function getSharedAssets(engagement) {
  const assets = Array.isArray(engagement?.sharedAssets)
    ? engagement.sharedAssets
    : [];

  const normalized = assets
    .map(normalizeAsset)
    .filter(asset => asset.assetId || asset.url);

  const unique = new Map();

  normalized.forEach(asset => {
    const key = asset.assetId || asset.url;
    unique.set(key, asset);
  });

  return Array.from(unique.values());
}

const getProfileStatus = (engagement, agent) => {
  const directlyComplete =
    agent?.profileComplete === true ||
    engagement?.profileComplete === true ||
    engagement?.travelAgentProfileComplete === true ||
    engagement?.agent?.profileComplete === true ||
    engagement?.travelAgent?.profileComplete === true;

  if (directlyComplete) {
    return {
      complete: true,
      percentage: 100,
      missing: []
    };
  }

  if (typeof agent?.profileCompletionPercentage === "number") {
    return {
      complete: agent.profileCompletionPercentage >= 100,
      percentage: agent.profileCompletionPercentage,
      missing: agent?.missingProfileFields || []
    };
  }

  const checks = [
    {
      label: "Agency name",
      ok: Boolean(
        agent?.agencyName ||
          agent?.name ||
          engagement?.travelAgentName ||
          engagement?.agentName ||
          engagement?.agencyName
      )
    },
    {
      label: "SPOC",
      ok: Boolean(
        engagement?.spoc?.name ||
          engagement?.spocName ||
          engagement?.contactPerson ||
          agent?.spocName
      )
    },
    {
      label: "Phone",
      ok: Boolean(getAgentPhone(engagement, agent))
    },
    {
      label: "Email",
      ok: Boolean(getAgentEmail(engagement, agent))
    },
    {
      label: "City",
      ok: Boolean(getAgentCity(engagement, agent))
    }
  ];

  const completed = checks.filter(item => item.ok).length;

  return {
    complete: completed === checks.length,
    percentage: Math.round((completed / checks.length) * 100),
    missing: checks.filter(item => !item.ok).map(item => item.label)
  };
};

export default function EngagementCard({
  engagement,
  agent,
  highlight = false,

  /* page-specific controls */
  agentProfileHref = "",
  viewEngagementHref = "",
  leadCreateHref = "",
  showSendCommunication = true,
  showProfileBadge = true
}) {
  const router = useRouter();

  const [expanded, setExpanded] = useState(false);
  const [assetsExpanded, setAssetsExpanded] = useState(false);
  const [pinned, setPinned] = useState(!!engagement?.pinned);
  const [leadOpen, setLeadOpen] = useState(false);
  const [commOpen, setCommOpen] = useState(false);
  const [copiedAssetKey, setCopiedAssetKey] = useState("");

  const PREVIEW_CHARS = 140;
  const ASSET_PREVIEW_LIMIT = 3;

  const message = normalizeHtmlText(
    engagement?.message ||
      engagement?.messageText ||
      engagement?.messageHtml ||
      ""
  );

  const sharedAssets = getSharedAssets(engagement);
  const visibleAssets = assetsExpanded
    ? sharedAssets
    : sharedAssets.slice(0, ASSET_PREVIEW_LIMIT);

  const hiddenAssetCount = Math.max(
    sharedAssets.length - ASSET_PREVIEW_LIMIT,
    0
  );

  const channelKey = String(engagement?.channel || "meeting").toLowerCase();
  const channel = CHANNEL_CONFIG[channelKey] || CHANNEL_CONFIG.meeting;
  const ChannelIcon = channel.icon;

  const agentId = getAgentId(engagement, agent);

  const resolvedAgentProfileHref =
    agentProfileHref || (agentId ? `/travel-agents/${agentId}` : "");

  const resolvedViewEngagementHref =
    viewEngagementHref ||
    (engagement?.id ? `/engagements/${engagement.id}` : "");

  const travelAgentName =
    engagement?.travelAgentName ||
    engagement?.agentName ||
    engagement?.agent?.name ||
    agent?.agencyName ||
    agent?.name ||
    "—";

  const spocName =
    agent?.spocName ||
    engagement?.spoc?.name ||
    engagement?.spoc?.email ||
    engagement?.spoc?.mobile ||
    "";

  const profile = getProfileStatus(engagement, agent);

  const touchStartX = useRef(0);

  const onTouchStart = e => {
    touchStartX.current = e.touches[0].clientX;
  };

  const onTouchEnd = e => {
    const diff = e.changedTouches[0].clientX - touchStartX.current;

    if (Math.abs(diff) < 80) return;

    if (diff > 80 && showSendCommunication) {
      setCommOpen(true);
    }

    if (diff < -80 && !engagement?.leadId) {
      if (leadCreateHref) {
        router.push(leadCreateHref);
      } else {
        setLeadOpen(true);
      }
    }
  };

  const openEngagementDetail = () => {
    if (!resolvedViewEngagementHref) return;
    router.push(resolvedViewEngagementHref);
  };

  const openLeadCreate = () => {
    if (leadCreateHref) {
      router.push(leadCreateHref);
      return;
    }

    setLeadOpen(true);
  };

  const copyAssetLink = async asset => {
    const url = getAssetUrl(asset);
    if (!url) return;

    const key = asset.assetId || url;

    try {
      await navigator.clipboard.writeText(url);
      setCopiedAssetKey(key);

      window.setTimeout(() => {
        setCopiedAssetKey("");
      }, 1600);
    } catch (error) {
      console.error("Failed to copy asset link:", error);
      alert("Unable to copy link. Please open the asset and copy manually.");
    }
  };

  return (
    <>
      <article
        className={`
          w-full bg-white px-4 py-3 border-b border-gray-200 space-y-2
          transition
          ${highlight ? "bg-blue-50 border-blue-200" : ""}
        `}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={openEngagementDetail}
            className="flex items-center gap-2 text-sm min-w-0 text-left"
          >
            <ChannelIcon className={`w-4 h-4 shrink-0 ${channel.color}`} />

            <span className="font-medium truncate">
              {channel.label}
            </span>

            <Clock className="w-4 h-4 text-orange-500 ml-2 shrink-0" />

            <span className="text-xs text-gray-600 capitalize truncate">
              {engagement?.status || "logged"}
            </span>

            {sharedAssets.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-100">
                <Package className="w-3 h-3" />
                {sharedAssets.length} asset
                {sharedAssets.length > 1 ? "s" : ""}
              </span>
            )}
          </button>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={openEngagementDetail}
              title="View engagement details"
              className="text-gray-400 hover:text-blue-600"
            >
              <ExternalLink className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setPinned(v => !v)}
              title={pinned ? "Unpin" : "Pin"}
              className="text-gray-400 hover:text-yellow-500"
            >
              <Star
                className={`w-4 h-4 ${
                  pinned ? "text-yellow-500" : "text-gray-300"
                }`}
                fill={pinned ? "currentColor" : "none"}
              />
            </button>
          </div>
        </div>

        {/* DESTINATION */}
        {engagement?.destinationName && (
          <button
            type="button"
            onClick={openEngagementDetail}
            className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 max-w-full"
          >
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              {engagement.destinationName}
            </span>
          </button>
        )}

        {/* MESSAGE */}
        {message && (
          <div
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            className="text-sm text-gray-800 bg-gray-50 rounded-md px-2 py-1"
          >
            <button
              type="button"
              onClick={openEngagementDetail}
              className="block w-full text-left"
            >
              <p
                className={`
                  whitespace-pre-wrap break-words
                  ${expanded ? "" : "line-clamp-2"}
                `}
              >
                {expanded ? message : message.slice(0, PREVIEW_CHARS)}
                {!expanded && message.length > PREVIEW_CHARS && "…"}
              </p>
            </button>

            {message.length > PREVIEW_CHARS && (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  setExpanded(v => !v);
                }}
                className="mt-1 text-xs text-blue-600 hover:underline"
              >
                {expanded ? "View less" : "View more"}
              </button>
            )}
          </div>
        )}

        {/* SHARED ASSETS */}
        {sharedAssets.length > 0 && (
          <div className="rounded-xl border border-blue-100 bg-blue-50/40 px-3 py-2 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-800">
                <Package className="w-3.5 h-3.5" />
                Shared Assets
              </div>

              <span className="text-[11px] text-blue-600">
                {sharedAssets.length} selected
              </span>
            </div>

            <div className="space-y-1.5">
              {visibleAssets.map(asset => {
                const url = getAssetUrl(asset);
                const key = asset.assetId || url;
                const copied = copiedAssetKey === key;

                return (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-2 rounded-lg border border-blue-100 bg-white px-2.5 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-gray-800">
                        {getAssetTitle(asset)}
                      </p>

                      <p className="truncate text-[11px] text-gray-500">
                        {asset.categoryName || asset.assetType || "Asset"} · v
                        {asset.currentVersion || 1}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {url && (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 hover:underline"
                        >
                          <Eye className="w-3 h-3" />
                          View
                        </a>
                      )}

                      {url && (
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            copyAssetLink(asset);
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-600 hover:text-gray-900"
                        >
                          {copied ? (
                            <>
                              <Check className="w-3 h-3 text-green-600" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
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

            {hiddenAssetCount > 0 && !assetsExpanded && (
              <button
                type="button"
                onClick={() => setAssetsExpanded(true)}
                className="text-xs text-blue-700 hover:underline"
              >
                Show {hiddenAssetCount} more asset
                {hiddenAssetCount > 1 ? "s" : ""}
              </button>
            )}

            {assetsExpanded && sharedAssets.length > ASSET_PREVIEW_LIMIT && (
              <button
                type="button"
                onClick={() => setAssetsExpanded(false)}
                className="text-xs text-blue-700 hover:underline"
              >
                Show less assets
              </button>
            )}
          </div>
        )}

        {/* META */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
          <div className="flex items-center gap-1.5 min-w-0">
            <User className="w-3.5 h-3.5 shrink-0" />

            {resolvedAgentProfileHref ? (
              <Link
                href={resolvedAgentProfileHref}
                className="inline-flex items-center gap-1 text-gray-700 hover:text-blue-700 min-w-0"
              >
                <span className="truncate">{travelAgentName}</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </Link>
            ) : (
              <span className="truncate">{travelAgentName}</span>
            )}
          </div>

          {showProfileBadge && (
            <>
              {profile.complete ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                  <CheckCircle2 className="w-3 h-3" />
                  Profile Complete
                </span>
              ) : (
                <span
                  title={
                    profile.missing?.length
                      ? `Missing: ${profile.missing.join(", ")}`
                      : "Profile details incomplete"
                  }
                  className="inline-flex items-center gap-1 rounded-full border border-amber-100 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700"
                >
                  <AlertTriangle className="w-3 h-3" />
                  Profile {profile.percentage}%
                </span>
              )}
            </>
          )}

          {spocName && (
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-gray-400">•</span>
              <span className="truncate">{spocName}</span>
            </div>
          )}

          {engagement?.createdByName && (
            <div className="flex items-center gap-1.5 min-w-0">
              <InitialAvatar name={engagement.createdByName} size="xs" />
              <span className="truncate">{engagement.createdByName}</span>
            </div>
          )}
        </div>

        {/* ACTIONS */}
        <div
          className={`grid gap-2 pt-1 ${
            showSendCommunication ? "grid-cols-3" : "grid-cols-2"
          }`}
        >
          <button
            type="button"
            onClick={openEngagementDetail}
            className="py-1.5 rounded-md text-xs font-medium border border-gray-300 text-gray-700 flex items-center justify-center gap-1 hover:bg-gray-50"
          >
            <Eye className="w-3.5 h-3.5" />
            Details
          </button>

          {showSendCommunication && (
            <button
              type="button"
              onClick={() => setCommOpen(true)}
              className="py-1.5 rounded-md text-xs font-medium bg-blue-600 text-white flex items-center justify-center gap-1 hover:bg-blue-700"
            >
              <Send className="w-3.5 h-3.5" />
              Send
            </button>
          )}

          {!engagement?.leadId ? (
            <button
              type="button"
              onClick={openLeadCreate}
              className="py-1.5 rounded-md text-xs font-medium border border-green-600 text-green-600 flex items-center justify-center gap-1 hover:bg-green-50"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Lead
            </button>
          ) : (
            <button
              type="button"
              onClick={() => router.push(`/leads/${engagement.leadId}`)}
              className="py-1.5 rounded-md text-xs font-medium border border-indigo-600 text-indigo-600 flex items-center justify-center gap-1 hover:bg-indigo-50"
            >
              <Eye className="w-3.5 h-3.5" />
              Lead
            </button>
          )}
        </div>
      </article>

      {/* MODALS */}
      {showSendCommunication && commOpen && (
        <SendCommunicationModal
          engagement={engagement}
          agent={agent}
          onClose={() => setCommOpen(false)}
        />
      )}

      {leadOpen && (
        <CreateLeadModal
          engagement={engagement}
          onClose={() => setLeadOpen(false)}
        />
      )}
    </>
  );
}