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
  User
} from "lucide-react";

import InitialAvatar from "@/components/ui/InitialAvatar";
import CreateLeadModal from "@/components/engagement/CreateLeadModal";
import SendCommunicationModal from "@/components/engagement/SendCommunicationModal";

/* =========================
   CHANNEL CONFIG
========================= */
const CHANNEL_CONFIG = {
  email: { label: "Email", icon: Mail, color: "text-blue-600" },
  call: { label: "Call", icon: Phone, color: "text-green-600" },
  whatsapp: { label: "WhatsApp", icon: MessageCircle, color: "text-emerald-600" },
  meeting: { label: "Meeting", icon: Handshake, color: "text-purple-600" }
};

/* =========================
   HTML → CLEAN TEXT
========================= */
function normalizeHtmlText(input = "") {
  if (!input) return "";
  const div = document.createElement("div");
  div.innerHTML = input;
  return (div.innerText || div.textContent || "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default function EngagementCard({ engagement, agent }) {
  const router = useRouter();

  const [expanded, setExpanded] = useState(false);
  const [pinned, setPinned] = useState(!!engagement.pinned);
  const [leadOpen, setLeadOpen] = useState(false);
  const [commOpen, setCommOpen] = useState(false);
  const PREVIEW_CHARS = 140;

  /* =========================
     RESOLVE DATA SAFELY
  ========================== */
  const message = normalizeHtmlText(
    engagement.message ||
    engagement.messageText ||
    engagement.messageHtml ||
    ""
  );

  const channelKey = (engagement.channel || "meeting").toLowerCase();
  const channel = CHANNEL_CONFIG[channelKey] || CHANNEL_CONFIG.meeting;
  const ChannelIcon = channel.icon;

  const travelAgentName =
    engagement.travelAgentName ||
    engagement.agentName ||
    engagement.agent?.name ||
    agent?.name ||
    "—";

  /* =========================
     SWIPE (MESSAGE ONLY)
  ========================== */
  const touchStartX = useRef(0);

  const onTouchStart = e => {
    touchStartX.current = e.touches[0].clientX;
  };

  const onTouchEnd = e => {
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(diff) < 80) return;

    if (diff > 80) setCommOpen(true);
    if (diff < -80 && !engagement.leadId) setLeadOpen(true);
  };

  return (
    <>
      <article className="w-full bg-white px-4 py-3 border-b border-gray-200 space-y-2">
        {/* HEADER */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <ChannelIcon className={`w-4 h-4 ${channel.color}`} />
            <span className="font-medium">{channel.label}</span>

            <Clock className="w-4 h-4 text-orange-500 ml-2" />
            <span className="text-xs text-gray-600 capitalize">
              {engagement.status}
            </span>
          </div>

          <button type="button" onClick={() => setPinned(v => !v)}>
            <Star
              className={`w-4 h-4 ${pinned ? "text-yellow-500" : "text-gray-300"
                }`}
              fill={pinned ? "currentColor" : "none"}
            />
          </button>
        </div>

        {/* DESTINATION */}
        {engagement.destinationName && (
          <div className="flex items-center gap-1 text-xs text-gray-600">
            <MapPin className="w-3.5 h-3.5" />
            <span className="truncate">{engagement.destinationName}</span>
          </div>
        )}

        {/* MESSAGE (SWIPE ZONE) */}
        {/* ================= MESSAGE ================= */}
        {message && (
          <div className="text-sm text-gray-800 bg-gray-50 rounded-md px-2 py-1">
            <p
              className={`
        whitespace-pre-wrap break-words
        ${expanded ? "" : "line-clamp-2"}
      `}
            >
              {expanded
                ? message
                : message.slice(0, PREVIEW_CHARS)}
              {!expanded &&
                message.length > PREVIEW_CHARS && "…"}
            </p>

            {message.length > PREVIEW_CHARS && (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  setExpanded(v => !v);
                }}
                className="
          mt-1 text-xs
          text-blue-600
          hover:underline
        "
              >
                {expanded ? "View less" : "View more"}
              </button>
            )}
          </div>
        )}


        {/* META */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" />
            <span>{travelAgentName}</span>
          </div>

          {engagement.spoc?.name && (
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400">•</span>
              <span>{engagement.spoc.name}</span>
            </div>
          )}

          {engagement.createdByName && (
            <div className="flex items-center gap-1.5">
              <InitialAvatar name={engagement.createdByName} size="xs" />
              <span>{engagement.createdByName}</span>
            </div>
          )}
        </div>

        {/* ACTIONS */}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => setCommOpen(true)}
            className="flex-1 py-1.5 rounded-md text-xs font-medium bg-blue-600 text-white flex items-center justify-center gap-1"
          >
            <Send className="w-3.5 h-3.5" />
            Send
          </button>

          {!engagement.leadId ? (
            <button
              type="button"
              onClick={() => setLeadOpen(true)}
              className="flex-1 py-1.5 rounded-md text-xs font-medium border border-green-600 text-green-600 flex items-center justify-center gap-1"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Lead
            </button>
          ) : (
            <button
              type="button"
              onClick={() => router.push(`/leads/${engagement.leadId}`)}
              className="flex-1 py-1.5 rounded-md text-xs font-medium border border-indigo-600 text-indigo-600 flex items-center justify-center gap-1"
            >
              <Eye className="w-3.5 h-3.5" />
              View
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
