"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  collection,
  onSnapshot,
  orderBy,
  query
} from "firebase/firestore";
import {
  Activity,
  ArrowUpRight,
  BadgeCheck,
  Building2,
  Clock3,
  Grid3X3,
  List,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  SearchX,
  TrendingUp,
  Users,
  Zap
} from "lucide-react";

import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";

import AgentFilterBar from "@/components/travel-agents/AgentFilterBar";
import TravelChip from "@/components/ui/TravelChip";
import EmptyState from "@/components/ui/EmptyState";
import CardSkeleton from "@/components/ui/CardSkeleton";

/* =========================
   CHANNEL → ICON MAP
========================= */
const CHANNEL_ICON_MAP = {
  email: "email",
  call: "call",
  whatsapp: "whatsapp",
  meeting: "meeting"
};

/* =========================
   HELPERS
========================= */
function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function isDeletedLead(lead) {
  return (
    lead?.isDelete === true ||
    lead?.deleted === true ||
    lead?.isDeleted === true
  );
}

function toMillis(value) {
  if (!value) return 0;

  if (typeof value?.toMillis === "function") {
    return value.toMillis();
  }

  if (typeof value?.toDate === "function") {
    return value.toDate().getTime();
  }

  if (value?.seconds) {
    return value.seconds * 1000;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function formatDate(value) {
  const millis = toMillis(value);
  if (!millis) return "";

  return new Date(millis).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function timeAgo(value) {
  const millis = toMillis(value);
  if (!millis) return "";

  const diff = Date.now() - millis;
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 24) return `${hours} hr ago`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;

  return `${Math.floor(days / 30)} months ago`;
}

function formatChannel(value) {
  if (!value) return "";

  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, char => char.toUpperCase());
}

function getLeadCity(lead) {
  return (
    lead.city ||
    lead.location?.city ||
    lead.destinationCity ||
    lead.destination?.city ||
    ""
  );
}

function getAgentCity(agent, meta) {
  return (
    agent.address?.city ||
    meta?.city ||
    agent.city ||
    agent.location?.city ||
    ""
  );
}

function getPrimarySpoc(agent) {
  if (!Array.isArray(agent.spocs) || agent.spocs.length === 0) {
    return null;
  }

  return (
    agent.spocs.find(spoc => spoc?.isPrimary) ||
    agent.spocs.find(spoc => normalize(spoc?.status) === "active") ||
    agent.spocs[0]
  );
}

function getAgentPhone(agent) {
  const primarySpoc = getPrimarySpoc(agent);

  return (
    agent.genericContact?.phone ||
    primarySpoc?.mobile ||
    primarySpoc?.phone ||
    agent.phone ||
    agent.mobile ||
    agent.contactNumber ||
    agent.spocMobile ||
    agent.whatsappNumber ||
    ""
  );
}

function getAgentEmail(agent) {
  const primarySpoc = getPrimarySpoc(agent);

  return (
    agent.genericContact?.email ||
    primarySpoc?.email ||
    agent.email ||
    agent.contactEmail ||
    agent.spocEmail ||
    agent.primaryEmail ||
    ""
  );
}

function getContactName(agent) {
  const primarySpoc = getPrimarySpoc(agent);

  return (
    primarySpoc?.name ||
    agent.spocName ||
    agent.contactPerson ||
    agent.contactName ||
    agent.primaryContactName ||
    ""
  );
}

function isStaleEngagement(lastEngagement) {
  const millis = toMillis(lastEngagement?.createdAt);
  if (!millis) return false;

  const diffDays = Math.floor(
    (Date.now() - millis) / (1000 * 60 * 60 * 24)
  );

  return diffDays > 15;
}

function getAgentHealth({ lastEngagement, leadCount }) {
  if (!lastEngagement && leadCount > 0) return "At Risk";
  if (!lastEngagement) return "No Activity";
  if (isStaleEngagement(lastEngagement)) return "Stale";
  if (leadCount >= 5) return "High Potential";
  return "Healthy";
}

function getPriority({ lastEngagement, leadCount }) {
  if (!lastEngagement && leadCount > 0) {
    return {
      label: "High Priority",
      className: "bg-amber-50 text-amber-700 border-amber-100"
    };
  }

  if (!lastEngagement) {
    return {
      label: "Follow-up Needed",
      className: "bg-orange-50 text-orange-700 border-orange-100"
    };
  }

  if (isStaleEngagement(lastEngagement)) {
    return {
      label: "Follow-up Due",
      className: "bg-orange-50 text-orange-700 border-orange-100"
    };
  }

  if (leadCount >= 5) {
    return {
      label: "Active Agent",
      className: "bg-emerald-50 text-emerald-700 border-emerald-100"
    };
  }

  return {
    label: "Normal",
    className: "bg-gray-50 text-gray-600 border-gray-200"
  };
}

function getLatestEngagementText(lastEngagement) {
  return (
    lastEngagement?.subject ||
    lastEngagement?.notes ||
    lastEngagement?.message ||
    lastEngagement?.messageText ||
    ""
  );
}

/* =========================
   STAT CARD
========================= */
function StatCard({ label, value, helper, icon: Icon, tone = "blue" }) {
  const toneClass = {
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    orange: "bg-orange-50 text-orange-700 border-orange-100",
    purple: "bg-purple-50 text-purple-700 border-purple-100",
    slate: "bg-slate-50 text-slate-700 border-slate-200"
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4  transition hover:border-blue-100 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500">
            {label}
          </p>

          <p className="mt-1 text-2xl font-semibold text-gray-950">
            {value}
          </p>

          {helper && (
            <p className="mt-1 text-[11px] text-gray-400">
              {helper}
            </p>
          )}
        </div>

        {Icon && (
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${
              toneClass[tone] || toneClass.blue
            }`}
          >
            <Icon size={18} />
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================
   FILTER TABS
========================= */
function AgentTabs({ filters, setFilters, stats }) {
  const tabs = [
    {
      label: "All",
      value: "all",
      count: stats.totalAgents,
      icon: Users
    },
    {
      label: "Engaged",
      value: "engaged",
      count: stats.engaged,
      icon: MessageCircle
    },
    {
      label: "Needs Follow-up",
      value: "not_engaged",
      count: stats.needsFollowUp,
      icon: Clock3
    },
    {
      label: "High Leads",
      value: "high_leads",
      count: stats.highLeadAgents,
      icon: TrendingUp
    }
  ];

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {tabs.map(tab => {
        const active = filters.engagement === tab.value;
        const Icon = tab.icon;

        return (
          <button
            key={tab.value}
            type="button"
            onClick={() =>
              setFilters(prev => ({
                ...prev,
                engagement: tab.value
              }))
            }
            className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition ${
              active
                ? "border-blue-600 bg-blue-600 text-white "
                : "border-gray-200 bg-white text-gray-600 hover:border-blue-100 hover:bg-blue-50 hover:text-blue-700"
            }`}
          >
            <Icon size={14} />

            {tab.label}

            <span
              className={`rounded-full px-2 py-0.5 text-[11px] ${
                active
                  ? "bg-white/15 text-white"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* =========================
   AGENT CARD
========================= */
function AgentCard({ agent, lastEngagement, leadCount, city }) {
  const channel = normalize(lastEngagement?.channel);
  const channelIcon = CHANNEL_ICON_MAP[channel];

  const latestDate = formatDate(lastEngagement?.createdAt);
  const latestAgo = timeAgo(lastEngagement?.createdAt);

  const priority = getPriority({
    lastEngagement,
    leadCount
  });

  const health = getAgentHealth({
    lastEngagement,
    leadCount
  });

  const contactName = getContactName(agent);
  const phone = getAgentPhone(agent);
  const email = getAgentEmail(agent);
  const latestText = getLatestEngagementText(lastEngagement);

  const healthColor =
    health === "At Risk" || health === "Stale"
      ? "warning"
      : health === "High Potential" || health === "Healthy"
      ? "success"
      : "neutral";

  return (
    <div className="group flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-4  transition hover:border-blue-100 hover:shadow-md">
      {/* HEADER */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
            <Building2 size={18} />
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-950">
              {agent.agencyName || "Unnamed Agency"}
            </p>

            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
              {agent.agentCode && <span>{agent.agentCode}</span>}
              {contactName && <span>• {contactName}</span>}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${priority.className}`}
          >
            {priority.label}
          </span>

          <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-medium text-gray-600">
            <BadgeCheck size={12} />
            {agent.kycStatus || agent.status || "Active"}
          </span>
        </div>
      </div>

      {/* CHIPS */}
      <div className="mt-4 flex flex-wrap gap-2">
        <TravelChip
          label={`${leadCount || 0} Lead${leadCount === 1 ? "" : "s"}`}
          icon="leads"
          color="primary"
        />

        {city && (
          <TravelChip
            label={city}
            icon="location"
            color="neutral"
          />
        )}

        {lastEngagement && channelIcon && (
          <TravelChip
            label={formatChannel(lastEngagement.channel)}
            icon={channelIcon}
            color="neutral"
          />
        )}

        <TravelChip
          label={health}
          icon={health === "Healthy" ? "engaged" : "warning"}
          color={healthColor}
        />
      </div>

      {/* CONTACT DETAILS */}
      <div className="mt-4 rounded-xl border border-gray-200 bg-slate-50 px-3 py-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            Contact Details
          </p>

          <Activity size={13} className="text-gray-400" />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-gray-500">
              <Users size={13} />
              SPOC
            </span>

            <span className="min-w-0 truncate text-right text-xs text-gray-800">
              {contactName || "Not added"}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-gray-500">
              <Phone size={13} />
              Phone
            </span>

            <span className="min-w-0 truncate text-right text-xs text-gray-800">
              {phone || "Not added"}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-gray-500">
              <Mail size={13} />
              Email
            </span>

            <span className="min-w-0 truncate text-right text-xs text-gray-800">
              {email || "Not added"}
            </span>
          </div>
        </div>
      </div>

      {/* LATEST ENGAGEMENT */}
      <div className="mt-4 flex-1">
        {lastEngagement ? (
          <div
            className={`rounded-xl border px-3 py-3 ${
              isStaleEngagement(lastEngagement)
                ? "border-orange-100 bg-orange-50"
                : "border-blue-100 bg-blue-50"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                <MessageCircle size={13} />
                Latest Engagement
              </p>

              {latestAgo && (
                <p className="text-[11px] font-medium text-blue-700">
                  {latestAgo}
                </p>
              )}
            </div>

            <p className="mt-1 text-xs font-medium text-gray-800">
              {formatChannel(lastEngagement.channel) || "Engagement logged"}
              {latestDate ? ` • ${latestDate}` : ""}
            </p>

            {latestText && (
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-500">
                {latestText}
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-3">
            <p className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700">
              <Clock3 size={13} />
              No engagement recorded yet
            </p>

            <p className="mt-1 text-xs leading-5 text-amber-600">
              This agent has no activity history available.
            </p>
          </div>
        )}
      </div>

      {/* ACTIONS */}
      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-gray-200 pt-3">
        <Link
          href={`/travel-agents/${agent.id}`}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          View Details
          <ArrowUpRight size={14} />
        </Link>

        <Link
          href={`/engagements/travel-agent/${agent.id}`}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          Engagements
          <ArrowUpRight size={14} />
        </Link>
      </div>
    </div>
  );
}

/* =========================
   TABLE VIEW
========================= */
function AgentTable({
  agents,
  leadMetaMap,
  lastEngagementMap,
  latestEngagedAgent,
  agentRefs
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white ">
      <div className="overflow-x-auto">
        <table className="min-w-[1050px] w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">
                Agency
              </th>

              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">
                SPOC
              </th>

              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">
                City
              </th>

              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">
                Leads
              </th>

              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">
                Contact
              </th>

              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">
                Latest Engagement
              </th>

              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">
                Status
              </th>

              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {agents.map(agent => {
              const meta = leadMetaMap[agent.id] || {};
              const leadCount = meta.count || 0;
              const city = getAgentCity(agent, meta);
              const lastEngagement = lastEngagementMap[agent.id];

              const phone = getAgentPhone(agent);
              const email = getAgentEmail(agent);
              const contactName = getContactName(agent);

              const health = getAgentHealth({
                lastEngagement,
                leadCount
              });

              const priority = getPriority({
                lastEngagement,
                leadCount
              });

              const latestText = getLatestEngagementText(lastEngagement);

              const isLatestEngagement =
                latestEngagedAgent?.id === agent.id;

              return (
                <tr
                  key={agent.id}
                  ref={el => {
                    agentRefs.current[agent.id] = el;
                  }}
                  className={
                    isLatestEngagement
                      ? "bg-blue-50/70"
                      : "hover:bg-gray-50"
                  }
                >
                  <td className="px-4 py-3 align-top">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                        <Building2 size={16} />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-medium text-gray-900">
                            {agent.agencyName || "Unnamed Agency"}
                          </p>

                          {isLatestEngagement && (
                            <span className="shrink-0 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-medium text-white">
                              Latest
                            </span>
                          )}
                        </div>

                        {agent.agentCode && (
                          <p className="mt-1 text-xs text-gray-500">
                            {agent.agentCode}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3 align-top">
                    <p className="text-sm text-gray-700">
                      {contactName || "—"}
                    </p>
                  </td>

                  <td className="px-4 py-3 align-top">
                    <p className="inline-flex items-center gap-1.5 text-sm text-gray-700">
                      {city ? <MapPin size={13} /> : null}
                      {city || "—"}
                    </p>
                  </td>

                  <td className="px-4 py-3 align-top">
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                      {leadCount} Lead{leadCount === 1 ? "" : "s"}
                    </span>
                  </td>

                  <td className="px-4 py-3 align-top">
                    <div className="space-y-1">
                      <p className="inline-flex items-center gap-1.5 text-xs text-gray-700">
                        <Phone size={12} />
                        {phone || "No phone"}
                      </p>

                      <p className="flex max-w-[190px] items-center gap-1.5 truncate text-xs text-gray-500">
                        <Mail size={12} className="shrink-0" />
                        <span className="truncate">
                          {email || "No email"}
                        </span>
                      </p>
                    </div>
                  </td>

                  <td className="px-4 py-3 align-top">
                    {lastEngagement ? (
                      <div>
                        <p className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-800">
                          <MessageCircle size={12} />
                          {formatChannel(lastEngagement.channel) ||
                            "Engagement"}
                        </p>

                        <p className="mt-1 text-xs text-gray-500">
                          {timeAgo(lastEngagement.createdAt)}
                          {formatDate(lastEngagement.createdAt)
                            ? ` • ${formatDate(lastEngagement.createdAt)}`
                            : ""}
                        </p>

                        {latestText && (
                          <p className="mt-1 max-w-[240px] truncate text-xs text-gray-400">
                            {latestText}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                        <Clock3 size={12} />
                        No activity
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-3 align-top">
                    <div className="space-y-1">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${priority.className}`}
                      >
                        {priority.label}
                      </span>

                      <p className="text-xs text-gray-500">
                        {health}
                      </p>

                      <p className="inline-flex items-center gap-1 text-xs text-gray-400">
                        <BadgeCheck size={12} />
                        {agent.kycStatus || agent.status || "Active"}
                      </p>
                    </div>
                  </td>

                  <td className="px-4 py-3 align-top text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/travel-agents/${agent.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        View Details
                        <ArrowUpRight size={13} />
                      </Link>

                      <Link
                        href={`/engagements/travel-agent/${agent.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
                      >
                        Engagements
                        <ArrowUpRight size={13} />
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* =========================
   PAGE
========================= */
export default function UserTravelAgentsPage() {
  const { user, loading } = useAuth();

  const [agents, setAgents] = useState([]);
  const [engagements, setEngagements] = useState([]);
  const [leads, setLeads] = useState([]);

  const [loadingAgents, setLoadingAgents] = useState(true);
  const [loadingEngagements, setLoadingEngagements] = useState(true);
  const [loadingLeads, setLoadingLeads] = useState(true);

  const [error, setError] = useState("");

  const [filters, setFilters] = useState({
    search: "",
    engagement: "all",
    channel: "all",
    city: "all",
    sortBy: "agency_az"
  });

  const [view, setView] = useState("grid");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  const agentRefs = useRef({});

  useEffect(() => {
    if (loading) return;

    if (!user) {
      setLoadingAgents(false);
      return;
    }

    setLoadingAgents(true);

    const unsub = onSnapshot(
      collection(db, "travelAgents"),
      snap => {
        setAgents(
          snap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
        );

        setLoadingAgents(false);
      },
      err => {
        console.error("Travel agents load error:", err);
        setError("Unable to load travel agents.");
        setLoadingAgents(false);
      }
    );

    return () => unsub();
  }, [user, loading]);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      setLoadingEngagements(false);
      return;
    }

    setLoadingEngagements(true);

    const q = query(
      collection(db, "engagements"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      snap => {
        setEngagements(
          snap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
        );

        setLoadingEngagements(false);
      },
      err => {
        console.error("Engagements load error:", err);
        setError("Unable to load engagements.");
        setLoadingEngagements(false);
      }
    );

    return () => unsub();
  }, [user, loading]);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      setLoadingLeads(false);
      return;
    }

    setLoadingLeads(true);

    const unsub = onSnapshot(
      collection(db, "leads"),
      snap => {
        setLeads(
          snap.docs
            .map(doc => ({
              id: doc.id,
              ...doc.data()
            }))
            .filter(lead => !isDeletedLead(lead))
        );

        setLoadingLeads(false);
      },
      err => {
        console.error("Leads load error:", err);
        setError("Unable to load leads.");
        setLoadingLeads(false);
      }
    );

    return () => unsub();
  }, [user, loading]);

  const scopedAgents = useMemo(() => {
    return agents;
  }, [agents]);

  const lastEngagementMap = useMemo(() => {
    const map = {};

    engagements.forEach(engagement => {
      if (!engagement.agentId) return;

      const existing = map[engagement.agentId];

      if (
        !existing ||
        toMillis(engagement.createdAt) > toMillis(existing.createdAt)
      ) {
        map[engagement.agentId] = engagement;
      }
    });

    return map;
  }, [engagements]);

  const leadMetaMap = useMemo(() => {
    const map = {};

    leads.forEach(lead => {
      if (!lead.agentId) return;

      const city = getLeadCity(lead);

      if (!map[lead.agentId]) {
        map[lead.agentId] = {
          count: 0,
          city: ""
        };
      }

      map[lead.agentId].count += 1;

      if (!map[lead.agentId].city && city) {
        map[lead.agentId].city = city;
      }
    });

    return map;
  }, [leads]);

  const cityOptions = useMemo(() => {
    const cities = new Set();

    scopedAgents.forEach(agent => {
      const meta = leadMetaMap[agent.id] || {};
      const city = getAgentCity(agent, meta);

      if (city) {
        cities.add(city.trim());
      }
    });

    return Array.from(cities).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    );
  }, [scopedAgents, leadMetaMap]);

  const stats = useMemo(() => {
    const engaged = scopedAgents.filter(agent => {
      return Boolean(lastEngagementMap[agent.id]);
    }).length;

    const staleFollowUps = scopedAgents.filter(agent => {
      const last = lastEngagementMap[agent.id];
      return last && isStaleEngagement(last);
    }).length;

    const noActivity = scopedAgents.filter(agent => {
      return !lastEngagementMap[agent.id];
    }).length;

    const totalLeads = scopedAgents.reduce((sum, agent) => {
      return sum + (leadMetaMap[agent.id]?.count || 0);
    }, 0);

    const highLeadAgents = scopedAgents.filter(agent => {
      return (leadMetaMap[agent.id]?.count || 0) >= 5;
    }).length;

    return {
      totalAgents: scopedAgents.length,
      engaged,
      noActivity,
      staleFollowUps,
      totalLeads,
      highLeadAgents,
      needsFollowUp: noActivity + staleFollowUps
    };
  }, [scopedAgents, lastEngagementMap, leadMetaMap]);

  const filteredAgents = useMemo(() => {
    return scopedAgents.filter(agent => {
      const last = lastEngagementMap[agent.id];
      const meta = leadMetaMap[agent.id] || {};
      const leadCount = meta.count || 0;
      const city = getAgentCity(agent, meta);
      const primarySpoc = getPrimarySpoc(agent);

      const search = normalize(filters.search);

      if (search) {
        const searchableText = [
          agent.agencyName,
          agent.agentCode,
          getContactName(agent),
          getAgentPhone(agent),
          getAgentEmail(agent),
          agent.genericContact?.phone,
          agent.genericContact?.email,
          primarySpoc?.name,
          primarySpoc?.mobile,
          primarySpoc?.email,
          agent.website,
          city
        ]
          .map(normalize)
          .join(" ");

        if (!searchableText.includes(search)) {
          return false;
        }
      }

      if (
        filters.city !== "all" &&
        normalize(city) !== normalize(filters.city)
      ) {
        return false;
      }

      if (filters.engagement === "engaged" && !last) {
        return false;
      }

      if (
        filters.engagement === "not_engaged" &&
        last &&
        !isStaleEngagement(last)
      ) {
        return false;
      }

      if (filters.engagement === "high_leads" && leadCount < 5) {
        return false;
      }

      if (
        filters.channel !== "all" &&
        normalize(last?.channel) !== normalize(filters.channel)
      ) {
        return false;
      }

      return true;
    });
  }, [scopedAgents, filters, lastEngagementMap, leadMetaMap]);

  const sortedAgents = useMemo(() => {
    const list = [...filteredAgents];

    if (filters.sortBy === "agency_az") {
      list.sort((a, b) =>
        String(a.agencyName || "").localeCompare(
          String(b.agencyName || ""),
          undefined,
          { sensitivity: "base" }
        )
      );
    }

    if (filters.sortBy === "agency_za") {
      list.sort((a, b) =>
        String(b.agencyName || "").localeCompare(
          String(a.agencyName || ""),
          undefined,
          { sensitivity: "base" }
        )
      );
    }

    if (filters.sortBy === "recently_engaged") {
      list.sort((a, b) => {
        return (
          toMillis(lastEngagementMap[b.id]?.createdAt) -
          toMillis(lastEngagementMap[a.id]?.createdAt)
        );
      });
    }

    if (filters.sortBy === "oldest_engaged") {
      list.sort((a, b) => {
        const aTime = toMillis(lastEngagementMap[a.id]?.createdAt);
        const bTime = toMillis(lastEngagementMap[b.id]?.createdAt);

        if (!aTime && !bTime) return 0;
        if (!aTime) return 1;
        if (!bTime) return -1;

        return aTime - bTime;
      });
    }

    if (filters.sortBy === "needs_followup") {
      list.sort((a, b) => {
        const aLast = lastEngagementMap[a.id];
        const bLast = lastEngagementMap[b.id];

        const aNeedsFollowUp = !aLast || isStaleEngagement(aLast);
        const bNeedsFollowUp = !bLast || isStaleEngagement(bLast);

        return Number(bNeedsFollowUp) - Number(aNeedsFollowUp);
      });
    }

    if (filters.sortBy === "most_leads") {
      list.sort((a, b) => {
        const aCount = leadMetaMap[a.id]?.count || 0;
        const bCount = leadMetaMap[b.id]?.count || 0;

        return bCount - aCount;
      });
    }

    return list;
  }, [filteredAgents, filters.sortBy, lastEngagementMap, leadMetaMap]);

  const latestEngagedAgent = useMemo(() => {
    let latestAgent = null;
    let latestTime = 0;

    sortedAgents.forEach(agent => {
      const last = lastEngagementMap[agent.id];
      const time = toMillis(last?.createdAt);

      if (time > latestTime) {
        latestTime = time;
        latestAgent = agent;
      }
    });

    return latestAgent;
  }, [sortedAgents, lastEngagementMap]);

  const totalPages = Math.max(
    1,
    Math.ceil(sortedAgents.length / pageSize)
  );

  const paginatedAgents = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;

    return sortedAgents.slice(start, end);
  }, [sortedAgents, page, pageSize]);

  const paginationStart =
    sortedAgents.length === 0 ? 0 : (page - 1) * pageSize + 1;

  const paginationEnd = Math.min(
    page * pageSize,
    sortedAgents.length
  );

  useEffect(() => {
    setPage(1);
  }, [
    filters.search,
    filters.engagement,
    filters.channel,
    filters.city,
    filters.sortBy,
    pageSize
  ]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const jumpToLatestEngagement = () => {
    if (!latestEngagedAgent) return;

    const index = sortedAgents.findIndex(
      agent => agent.id === latestEngagedAgent.id
    );

    if (index === -1) return;

    const targetPage = Math.floor(index / pageSize) + 1;

    setPage(targetPage);

    setTimeout(() => {
      agentRefs.current[latestEngagedAgent.id]?.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    }, 150);
  };

  const clearFilters = () => {
    setFilters({
      search: "",
      engagement: "all",
      channel: "all",
      city: "all",
      sortBy: "agency_az"
    });
  };

  const isPageLoading =
    loading ||
    loadingAgents ||
    loadingEngagements ||
    loadingLeads;

  if (isPageLoading) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-9xl space-y-4 px-4 py-6">
          {Array.from({ length: 5 }).map((_, index) => (
            <CardSkeleton key={index} />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-9xl space-y-5 px-4 py-6">
        {/* HEADER */}
        <div className="rounded-3xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
                <Building2 size={14} />
                Travel Agent Analytics
              </div>

              <h1 className="text-2xl font-semibold tracking-tight text-white">
                Travel Agents
              </h1>

              <p className="mt-1 max-w-3xl text-sm leading-6 text-blue-100">
                Detailed agent engagement overview with leads, contact, activity
                health, and latest follow-up status.
              </p>

              <p className="mt-2 text-xs text-blue-100/80">
                Showing {paginationStart}-{paginationEnd} of{" "}
                {sortedAgents.length} travel agents
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {latestEngagedAgent && (
                <button
                  type="button"
                  onClick={jumpToLatestEngagement}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs font-medium text-white hover:bg-white/20"
                >
                  <MessageCircle size={13} />
                  Jump to Latest Engagement
                </button>
              )}

              <select
                value={String(pageSize)}
                onChange={e => setPageSize(Number(e.target.value))}
                className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs font-medium text-white outline-none"
              >
                <option className="text-gray-900" value="6">
                  6 / page
                </option>
                <option className="text-gray-900" value="12">
                  12 / page
                </option>
                <option className="text-gray-900" value="24">
                  24 / page
                </option>
                <option className="text-gray-900" value="48">
                  48 / page
                </option>
              </select>

              <div className="flex rounded-lg border border-white/20 bg-white/10 p-1">
                <button
                  type="button"
                  onClick={() => setView("grid")}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${
                    view === "grid"
                      ? "bg-white text-blue-700"
                      : "text-white hover:bg-white/10"
                  }`}
                >
                  <Grid3X3 size={13} />
                  Grid
                </button>

                <button
                  type="button"
                  onClick={() => setView("list")}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${
                    view === "list"
                      ? "bg-white text-blue-700"
                      : "text-white hover:bg-white/10"
                  }`}
                >
                  <List size={13} />
                  List
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <StatCard
            icon={Building2}
            label="Total Agents"
            value={stats.totalAgents}
            helper="All agents"
            tone="blue"
          />

          <StatCard
            icon={Zap}
            label="Total Leads"
            value={stats.totalLeads}
            helper="Linked leads"
            tone="purple"
          />

          <StatCard
            icon={MessageCircle}
            label="Engaged"
            value={stats.engaged}
            helper="Has activity"
            tone="emerald"
          />

          <StatCard
            icon={SearchX}
            label="No Activity"
            value={stats.noActivity}
            helper="No engagement"
            tone="amber"
          />

          <StatCard
            icon={Clock3}
            label="Stale"
            value={stats.staleFollowUps}
            helper="15+ days old"
            tone="orange"
          />

          <StatCard
            icon={TrendingUp}
            label="High Leads"
            value={stats.highLeadAgents}
            helper="5+ leads"
            tone="slate"
          />
        </div>

        {/* FILTER AREA */}
        <div className="sticky top-0 z-20 space-y-3 bg-gray-50/95 py-3 backdrop-blur">
          <AgentTabs
            filters={filters}
            setFilters={setFilters}
            stats={stats}
          />

          <AgentFilterBar
            filters={filters}
            setFilters={setFilters}
            cities={cityOptions}
            onClear={clearFilters}
          />
        </div>

        {/* ERROR */}
        {error && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* CONTENT */}
        {sortedAgents.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 ">
            <EmptyState
              icon="🧳"
              title="No travel agents found"
              description="No agents match your current filters. Clear filters to view all travel agents."
            />

            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Clear Filters
              </button>
            </div>
          </div>
        ) : (
          <>
            {view === "grid" ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {paginatedAgents.map(agent => {
                  const meta = leadMetaMap[agent.id] || {};
                  const city = getAgentCity(agent, meta);

                  const isLatestEngagement =
                    latestEngagedAgent?.id === agent.id;

                  return (
                    <div
                      key={agent.id}
                      ref={el => {
                        agentRefs.current[agent.id] = el;
                      }}
                      className={
                        isLatestEngagement
                          ? "rounded-2xl ring-2 ring-blue-500 ring-offset-2 ring-offset-gray-50"
                          : ""
                      }
                    >
                      {isLatestEngagement && (
                        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-1 text-[11px] font-medium text-white">
                          <MessageCircle size={12} />
                          Latest Engagement
                        </div>
                      )}

                      <AgentCard
                        agent={agent}
                        lastEngagement={lastEngagementMap[agent.id]}
                        leadCount={meta.count || 0}
                        city={city}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <AgentTable
                agents={paginatedAgents}
                leadMetaMap={leadMetaMap}
                lastEngagementMap={lastEngagementMap}
                latestEngagedAgent={latestEngagedAgent}
                agentRefs={agentRefs}
              />
            )}

            {/* PAGINATION */}
            <div className="flex flex-col gap-3 border-t border-gray-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-gray-500">
                Showing {paginationStart}-{paginationEnd} of{" "}
                {sortedAgents.length}
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setPage(prev => Math.max(1, prev - 1))
                  }
                  disabled={page === 1}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>

                <span className="text-xs text-gray-500">
                  Page {page} of {totalPages}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    setPage(prev => Math.min(totalPages, prev + 1))
                  }
                  disabled={page === totalPages}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}