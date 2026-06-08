"use client";

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
  ExternalLink
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
   Safe for Next.js render
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

export default function EngagementCard({
  engagement,
  agent,
  highlight = false
}) {
  const router = useRouter();

  const [expanded, setExpanded] = useState(false);
  const [pinned, setPinned] = useState(!!engagement.pinned);
  const [leadOpen, setLeadOpen] = useState(false);
  const [commOpen, setCommOpen] = useState(false);

  const PREVIEW_CHARS = 140;

  const message = normalizeHtmlText(
    engagement.message ||
      engagement.messageText ||
      engagement.messageHtml ||
      ""
  );

  const channelKey = String(engagement.channel || "meeting").toLowerCase();
  const channel = CHANNEL_CONFIG[channelKey] || CHANNEL_CONFIG.meeting;
  const ChannelIcon = channel.icon;

  const travelAgentName =
    engagement.travelAgentName ||
    engagement.agentName ||
    engagement.agent?.name ||
    agent?.agencyName ||
    agent?.name ||
    "—";

  const spocName =
    engagement.spoc?.name ||
    engagement.spoc?.email ||
    engagement.spoc?.mobile ||
    "";

  const touchStartX = useRef(0);

  const onTouchStart = e => {
    touchStartX.current = e.touches[0].clientX;
  };

  const onTouchEnd = e => {
    const diff = e.changedTouches[0].clientX - touchStartX.current;

    if (Math.abs(diff) < 80) return;

    if (diff > 80) {
      setCommOpen(true);
    }

    if (diff < -80 && !engagement.leadId) {
      setLeadOpen(true);
    }
  };

  const openEngagementDetail = () => {
    if (!engagement?.id) return;
    router.push(`/engagements/${engagement.id}`);
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
              {engagement.status || "logged"}
            </span>
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
        {engagement.destinationName && (
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

        {/* META */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
          <div className="flex items-center gap-1.5 min-w-0">
            <User className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{travelAgentName}</span>
          </div>

          {spocName && (
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-gray-400">•</span>
              <span className="truncate">{spocName}</span>
            </div>
          )}

          {engagement.createdByName && (
            <div className="flex items-center gap-1.5 min-w-0">
              <InitialAvatar name={engagement.createdByName} size="xs" />
              <span className="truncate">{engagement.createdByName}</span>
            </div>
          )}
        </div>

        {/* ACTIONS */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <button
            type="button"
            onClick={openEngagementDetail}
            className="py-1.5 rounded-md text-xs font-medium border border-gray-300 text-gray-700 flex items-center justify-center gap-1 hover:bg-gray-50"
          >
            <Eye className="w-3.5 h-3.5" />
            Details
          </button>

          <button
            type="button"
            onClick={() => setCommOpen(true)}
            className="py-1.5 rounded-md text-xs font-medium bg-blue-600 text-white flex items-center justify-center gap-1 hover:bg-blue-700"
          >
            <Send className="w-3.5 h-3.5" />
            Send
          </button>

          {!engagement.leadId ? (
            <button
              type="button"
              onClick={() => setLeadOpen(true)}
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
      {commOpen && (
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