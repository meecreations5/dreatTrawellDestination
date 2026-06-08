"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import {
  ArrowLeft,
  CalendarDays,
  Mail,
  MessageSquare,
  User,
  MapPin,
  Phone,
  AtSign,
  Building2,
  CheckCircle2
} from "lucide-react";

import { db } from "@/lib/firebase";

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

function safeText(value) {
  return value || "—";
}

function getChannelLabel(channel) {
  if (!channel) return "—";

  const value = String(channel).toLowerCase();

  if (value === "whatsapp") return "WhatsApp";
  if (value === "email") return "Email";
  if (value === "call") return "Call";
  if (value === "meeting") return "Meeting";

  return channel;
}

export default function EngagementDetailPage() {
  const { engagementId } = useParams();
  const router = useRouter();

  const [engagement, setEngagement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!engagementId) {
      setLoading(false);
      setNotFound(true);
      return;
    }

    let active = true;

    async function fetchEngagement() {
      try {
        setLoading(true);
        setError("");
        setNotFound(false);

        const snap = await getDoc(doc(db, "engagements", engagementId));

        if (!active) return;

        if (!snap.exists()) {
          setEngagement(null);
          setNotFound(true);
          return;
        }

        setEngagement({
          id: snap.id,
          ...snap.data()
        });
      } catch (err) {
        console.error("Failed to fetch engagement:", err);

        if (active) {
          setError("Unable to load engagement details.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    fetchEngagement();

    return () => {
      active = false;
    };
  }, [engagementId]);

  if (loading) {
    return (
      <main className="p-6 max-w-5xl mx-auto">
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="animate-pulse space-y-4">
            <div className="h-5 bg-gray-200 rounded w-52" />
            <div className="h-4 bg-gray-100 rounded w-80" />
            <div className="h-40 bg-gray-100 rounded-xl" />
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="p-6 max-w-5xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
          <h1 className="text-base font-semibold text-red-700">
            Something went wrong
          </h1>

          <p className="text-sm text-red-600 mt-1">{error}</p>

          <button
            type="button"
            onClick={() => router.back()}
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-red-700 hover:text-red-800"
          >
            <ArrowLeft size={16} />
            Go Back
          </button>
        </div>
      </main>
    );
  }

  if (notFound || !engagement) {
    return (
      <main className="p-6 max-w-5xl mx-auto">
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <h1 className="text-base font-semibold text-gray-900">
            Engagement not found
          </h1>

          <p className="text-sm text-gray-500 mt-1">
            This engagement record does not exist or may have been deleted.
          </p>

          <button
            type="button"
            onClick={() => router.back()}
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            <ArrowLeft size={16} />
            Go Back
          </button>
        </div>
      </main>
    );
  }

  const channel = String(engagement.channel || "").toLowerCase();

  const agentName =
    engagement.agentName ||
    engagement.travelAgentName ||
    engagement.agent?.name ||
    "—";

  const spocName =
    engagement.spoc?.name ||
    engagement.toName ||
    engagement.recipientName ||
    "";

  const spocEmail =
    engagement.spoc?.email ||
    engagement.toEmail ||
    engagement.recipientEmail ||
    "";

  const spocMobile =
    engagement.spoc?.mobile ||
    engagement.spoc?.phone ||
    engagement.toPhone ||
    engagement.recipientPhone ||
    "";

  const spocDisplayName = spocName || spocEmail || spocMobile || "—";

  const plainMessage =
    engagement.messageText ||
    engagement.message ||
    "No message content available.";

  const htmlMessage =
    engagement.messageHtml ||
    engagement.html ||
    "";

  const hasHtmlMessage = channel === "email" && htmlMessage;

  return (
    <main className="p-6 max-w-5xl mx-auto space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-3"
          >
            <ArrowLeft size={16} />
            Back
          </button>

          <h1 className="text-2xl font-bold text-gray-900">
            Engagement Detail
          </h1>

          <p className="text-sm text-gray-500 mt-1">
            View communication details and message content.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center justify-center rounded-full bg-gray-100 px-4 py-1.5 text-xs font-semibold text-gray-700">
            {getChannelLabel(engagement.channel)}
          </span>

          <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-4 py-1.5 text-xs font-semibold text-green-700 capitalize">
            <CheckCircle2 size={13} />
            {safeText(engagement.status)}
          </span>
        </div>
      </div>

      {/* DETAIL CARD */}
      <section className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 bg-gray-50/60">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center">
              {channel === "email" ? (
                <Mail size={18} className="text-blue-600" />
              ) : (
                <MessageSquare size={18} className="text-emerald-600" />
              )}
            </div>

            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-900 break-words">
                {engagement.subject ||
                  `${getChannelLabel(engagement.channel)} Engagement`}
              </h2>

              <p className="text-sm text-gray-500 mt-1">
                Engagement ID: {engagement.id}
              </p>
            </div>
          </div>
        </div>

        {/* INFO GRID */}
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <InfoCard
            icon={<Building2 size={16} />}
            label="Travel Agent"
            value={agentName}
          />

          <InfoCard
            icon={<MapPin size={16} />}
            label="Destination"
            value={safeText(engagement.destinationName)}
            subValue={
              Array.isArray(engagement.destinationNames)
                ? engagement.destinationNames.join(", ")
                : ""
            }
          />

          <InfoCard
            icon={<User size={16} />}
            label="SPOC"
            value={spocDisplayName}
            subValue={spocEmail && spocMobile ? `${spocEmail} • ${spocMobile}` : ""}
          />

          <InfoCard
            icon={<CalendarDays size={16} />}
            label="Created At"
            value={formatDate(engagement.createdAt)}
            subValue={`By ${safeText(engagement.createdByName)}`}
          />

          {spocEmail && (
            <InfoCard
              icon={<AtSign size={16} />}
              label="SPOC Email"
              value={spocEmail}
            />
          )}

          {spocMobile && (
            <InfoCard
              icon={<Phone size={16} />}
              label="SPOC Mobile"
              value={spocMobile}
            />
          )}
        </div>

        {/* MESSAGE */}
        <div className="p-5 border-t border-gray-100">
          <div className="flex items-center justify-between gap-3 mb-3">
            <p className="font-semibold text-gray-900">Message</p>

            <span className="text-xs text-gray-500">
              {getChannelLabel(engagement.channel)}
            </span>
          </div>

          {hasHtmlMessage ? (
            <div
              className="border border-gray-200 rounded-xl p-4 bg-gray-50 text-sm text-gray-800 leading-6 overflow-x-auto"
              dangerouslySetInnerHTML={{
                __html: htmlMessage
              }}
            />
          ) : (
            <pre className="whitespace-pre-wrap bg-gray-50 p-4 border border-gray-200 rounded-xl text-sm text-gray-800 leading-6 font-sans">
              {plainMessage}
            </pre>
          )}
        </div>
      </section>
    </main>
  );
}

function InfoCard({ icon, label, value, subValue }) {
  return (
    <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-gray-500 mb-1">
        {icon && <span className="text-gray-400">{icon}</span>}
        <span>{label}</span>
      </div>

      <p className="text-sm font-semibold text-gray-900 break-words">
        {value || "—"}
      </p>

      {subValue && (
        <p className="text-xs text-gray-500 mt-1 break-words">
          {subValue}
        </p>
      )}
    </div>
  );
}