// components/engagement/EngagementCard.js

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import EngagementChip from "@/components/engagement/EngagementChip";
import InitialAvatar from "@/components/ui/InitialAvatar";
import CreateLeadModal from "./CreateLeadModal";
import SendCommunicationModal from "./SendCommunicationModal";

export default function EngagementCard({
  engagement,
  agent,
  highlight
}) {
  const router = useRouter();

  const [leadOpen, setLeadOpen] = useState(false);
  const [commOpen, setCommOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [pinned, setPinned] = useState(
    Boolean(engagement.pinned)
  );


  function normalizeHtmlText(input = "") {
    if (!input) return "";

    // 1. Decode HTML entities
    const textarea = document.createElement("textarea");
    textarea.innerHTML = input;
    let decoded = textarea.value;

    // 2. Replace non-breaking spaces with normal spaces
    decoded = decoded.replace(/\u00A0/g, " ");

    // 3. Normalize excessive whitespace
    return decoded.replace(/\s+/g, " ").trim();
  }


  /* =========================
     MESSAGE (SAFE + STABLE)
     ✅ same logic that worked earlier
  ========================== */
  const rawMessage =
    engagement.message ||
    engagement.messageText ||
    engagement.messageHtml?.replace(/<[^>]+>/g, "") ||
    "";

  const message = normalizeHtmlText(rawMessage);

  const isLong = message.length > 160;

  /* =========================
     BACKGROUND RULES
  ========================== */
  const bg =
    engagement.leadId
      ? "bg-indigo-50 border border-indigo-200"
      : "bg-white";

  return (
    <div
      className={`
        rounded-xl shadow-card p-4 space-y-3
        transition
        ${bg}
        ${highlight ? "ring-2 ring-blue-400" : ""}
      `}
    >
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2 items-center">
          <EngagementChip
            label={engagement.channel?.toUpperCase()}
            icon={
              engagement.channel === "call" ? "📞" :
                engagement.channel === "email" ? "✉️" :
                  engagement.channel === "whatsapp" ? "💬" :
                    "🤝"
            }
            active
          />

          <EngagementChip
            label={engagement.status}
            icon={engagement.status === "completed" ? "✅" : "⏰"}
            active={engagement.status === "completed"}
          />
        </div>

        {/* PIN / STAR */}
        <button
          onClick={() => {
            setPinned(v => !v);
            // 🔥 Firestore update hook (optional later)
            // updateDoc(doc(db,"engagements", engagement.id), { pinned: !pinned })
          }}
          title="Pin engagement"
          className={`
            text-lg transition
            ${pinned ? "text-yellow-500" : "text-gray-300 hover:text-gray-500"}
          `}
        >
          ★
        </button>
      </div>

      {/* SPOC */}
      <p className="text-sm text-gray-600">
        SPOC: {engagement.spoc?.name || "—"}
      </p>

      {/* DESTINATION */}
      {engagement.destinationName && (
        <div className="flex gap-2 flex-wrap">
          <EngagementChip
            label={engagement.destinationName}
            icon="✈️"
            active
          />
        </div>
      )}

      {/* MESSAGE */}
      {message && (
        <div className="text-sm text-gray-700 space-y-1 max-w-full">
          <div className="whitespace-pre-wrap break-words">
            {expanded || !isLong
              ? message
              : message.slice(0, 160) + "…"}
          </div>

          {isLong && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="text-xs text-blue-600 hover:underline"
            >
              {expanded ? "View less" : "View more"}
            </button>
          )}
        </div>
      )}


      {/* META */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <InitialAvatar name={engagement.createdByName} />
          <span>{engagement.createdByName}</span>
        </div>

        {engagement.assignedToName && (
          <div className="flex items-center gap-2">
            <InitialAvatar name={engagement.assignedToName} />
            <span>{engagement.assignedToName}</span>
          </div>
        )}
      </div>

      {/* ACTIONS */}
      <div className="flex gap-4 pt-2 flex-wrap">
        <button
          onClick={() => setCommOpen(true)}
          className="text-sm text-blue-600 hover:underline"
        >
          Send Communication
        </button>

        {!engagement.leadId && (
          <button
            onClick={() => setLeadOpen(true)}
            className="text-sm text-green-600 hover:underline"
          >
            Create Lead
          </button>
        )}

        {engagement.leadId && (
          <button
            onClick={() => router.push(`/leads/${engagement.leadId}`)}
            className="text-sm text-blue-600 hover:underline"
          >
            View Lead
          </button>
        )}
      </div>

      {/* MODALS */}
      {commOpen && (
        <SendCommunicationModal
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
    </div>
  );
}
