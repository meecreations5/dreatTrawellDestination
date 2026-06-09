"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { doc, getDoc } from "firebase/firestore";

import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";

import {
  ArrowLeft,
  BadgeCheck,
  Briefcase,
  Building2,
  ExternalLink,
  Globe2,
  Landmark,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Route,
  ShieldCheck,
  UserRound,
  Users
} from "lucide-react";

import TravelChip from "@/components/ui/TravelChip";
import CardSkeleton from "@/components/ui/CardSkeleton";

/* =========================
   HELPERS
========================= */
function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function formatLabel(value) {
  if (!value) return "Not added";

  return String(value)
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, char => char.toUpperCase());
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === "") {
    return "Not added";
  }

  const amount = Number(value);

  if (Number.isNaN(amount)) {
    return "Not added";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(amount);
}

function getWebsiteHref(website) {
  if (!website) return "";

  const value = String(website).trim();

  if (!value) return "";

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  return `https://${value}`;
}

function getPrimarySpoc(agent) {
  if (!Array.isArray(agent?.spocs) || agent.spocs.length === 0) {
    return null;
  }

  return (
    agent.spocs.find(spoc => spoc?.isPrimary) ||
    agent.spocs.find(spoc => normalize(spoc?.status) === "active") ||
    agent.spocs[0]
  );
}

function getAgentPhone(agent, primarySpoc) {
  return (
    agent?.genericContact?.phone ||
    primarySpoc?.mobile ||
    primarySpoc?.phone ||
    agent?.phone ||
    agent?.mobile ||
    agent?.contactNumber ||
    agent?.spocMobile ||
    agent?.whatsappNumber ||
    ""
  );
}

function getAgentEmail(agent, primarySpoc) {
  return (
    agent?.genericContact?.email ||
    primarySpoc?.email ||
    agent?.email ||
    agent?.contactEmail ||
    agent?.spocEmail ||
    agent?.primaryEmail ||
    ""
  );
}

function getAgentCity(agent) {
  return (
    agent?.address?.city ||
    agent?.city ||
    agent?.location?.city ||
    ""
  );
}

function getLocationLabel(agent) {
  const address = agent?.address || {};

  return [
    address.city || agent?.city,
    address.state || agent?.state,
    address.country || agent?.country
  ]
    .filter(Boolean)
    .join(", ");
}

function formatAddress(address) {
  if (!address) return "";

  return [
    address.line1,
    address.line2,
    [address.city, address.state].filter(Boolean).join(", "),
    [address.country, address.pincode].filter(Boolean).join(" ")
  ]
    .filter(Boolean)
    .join("\n");
}

function getMapQuery(address) {
  if (!address) return "";

  return [
    address.line1,
    address.line2,
    address.city,
    address.state,
    address.country,
    address.pincode
  ]
    .filter(Boolean)
    .join(", ");
}

function getDestinations(agent) {
  if (Array.isArray(agent?.destinations)) {
    return agent.destinations.filter(d => d?.id || d?.name);
  }

  if (Array.isArray(agent?.destinationNames)) {
    return agent.destinationNames
      .filter(Boolean)
      .map((name, index) => ({
        id: `${name}-${index}`,
        name
      }));
  }

  return [];
}

function getPreferredChannels(agent) {
  return Object.entries(agent?.preferredCommunication || {}).filter(
    ([, value]) => value
  );
}

function getStatusColor(status) {
  const value = normalize(status);

  if (value === "active" || value === "approved") return "success";
  if (value === "inactive" || value === "rejected") return "warning";

  return "neutral";
}

function getKycColor(status) {
  const value = normalize(status);

  if (value === "approved" || value === "verified") return "success";
  if (value === "rejected") return "warning";
  if (value === "pending") return "warning";

  return "neutral";
}

/* =========================
   SMALL UI COMPONENTS
========================= */
function SummaryCard({
  icon: Icon,
  label,
  value,
  helper,
  tone = "blue"
}) {
  const toneMap = {
    blue: "border-blue-100 bg-blue-50 text-blue-700",
    emerald: "border-emerald-100 bg-emerald-50 text-emerald-700",
    amber: "border-amber-100 bg-amber-50 text-amber-700",
    violet: "border-violet-100 bg-violet-50 text-violet-700",
    rose: "border-rose-100 bg-rose-50 text-rose-700"
  };

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-start gap-3">
        <div
          className={`rounded-xl border p-2 ${
            toneMap[tone] || toneMap.blue
          }`}
        >
          <Icon size={18} />
        </div>

        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500">
            {label}
          </p>

          <p className="mt-1 truncate text-sm font-semibold text-gray-950">
            {value || "Not added"}
          </p>

          {helper && (
            <p className="mt-1 text-xs text-gray-400">
              {helper}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  icon: Icon,
  children,
  tone = "blue"
}) {
  const toneMap = {
    blue: "bg-blue-50 text-blue-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    violet: "bg-violet-50 text-violet-700",
    rose: "bg-rose-50 text-rose-700",
    slate: "bg-slate-50 text-slate-700"
  };

  const lineMap = {
    blue: "from-blue-500 to-indigo-500",
    emerald: "from-emerald-500 to-teal-500",
    amber: "from-amber-500 to-orange-500",
    violet: "from-violet-500 to-purple-500",
    rose: "from-rose-500 to-pink-500",
    slate: "from-slate-500 to-gray-500"
  };

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="mb-4 flex items-center gap-3">
        <div
          className={`rounded-xl p-2 ${
            toneMap[tone] || toneMap.blue
          }`}
        >
          <Icon size={17} />
        </div>

        <div>
          <h2 className="text-sm font-semibold text-gray-950">
            {title}
          </h2>

          <div
            className={`mt-1 h-1 w-10 rounded-full bg-gradient-to-r ${
              lineMap[tone] || lineMap.blue
            }`}
          />
        </div>
      </div>

      {children}
    </section>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-b border-gray-100 py-3 last:border-b-0 sm:grid-cols-3 sm:gap-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
        {label}
      </p>

      <p className="text-sm text-gray-800 sm:col-span-2">
        {value || "Not added"}
      </p>
    </div>
  );
}

function EmptyCardText({ children }) {
  return (
    <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
      {children}
    </p>
  );
}

function SpocCard({ spoc }) {
  return (
    <div className="rounded-xl border border-blue-100 bg-gradient-to-br from-white to-blue-50/50 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-gray-950">
              {spoc.name || "Unnamed SPOC"}
            </p>

            {spoc.isPrimary && (
              <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[11px] font-medium text-white">
                Primary
              </span>
            )}
          </div>

          <p className="mt-1 text-xs text-gray-500">
            {spoc.designation || "Designation not added"}
          </p>
        </div>

        {spoc.status && (
          <span className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[11px] font-medium text-gray-600">
            {formatLabel(spoc.status)}
          </span>
        )}
      </div>

      <div className="mt-3 space-y-2">
        {spoc.mobile || spoc.phone ? (
          <a
            href={`tel:${spoc.mobile || spoc.phone}`}
            className="flex items-center gap-2 text-xs font-medium text-blue-700 hover:underline"
          >
            <Phone size={13} />
            {spoc.mobile || spoc.phone}
          </a>
        ) : (
          <p className="text-xs text-gray-400">
            No phone added
          </p>
        )}

        {spoc.email ? (
          <a
            href={`mailto:${spoc.email}`}
            className="flex items-center gap-2 truncate text-xs font-medium text-blue-700 hover:underline"
          >
            <Mail size={13} />
            <span className="truncate">{spoc.email}</span>
          </a>
        ) : (
          <p className="text-xs text-gray-400">
            No email added
          </p>
        )}
      </div>
    </div>
  );
}

/* =========================
   PAGE
========================= */
export default function TravelAgentDetailPage() {
  const { agentId } = useParams();
  const router = useRouter();
  const { user, loading } = useAuth();

  const [agent, setAgent] = useState(null);
  const [loadingAgent, setLoadingAgent] = useState(true);

  /* ================= LOAD ================= */
  useEffect(() => {
    if (loading) return;

    if (!user || !agentId) {
      setLoadingAgent(false);
      return;
    }

    let active = true;

    async function loadAgent() {
      try {
        setLoadingAgent(true);

        const snap = await getDoc(doc(db, "travelAgents", agentId));

        if (!active) return;

        if (!snap.exists()) {
          router.replace("/travel-agents");
          return;
        }

        setAgent({
          id: snap.id,
          ...snap.data()
        });
      } catch (error) {
        console.error("Travel agent load error:", error);
        router.replace("/travel-agents");
      } finally {
        if (active) {
          setLoadingAgent(false);
        }
      }
    }

    loadAgent();

    return () => {
      active = false;
    };
  }, [agentId, user, loading, router]);

  /* ================= LOADING ================= */
  if (loading || loadingAgent) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl space-y-4 px-4 py-6">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </main>
    );
  }

  if (!agent) return null;

  /* ================= DERIVED ================= */
  const destinations = getDestinations(agent);
  const primarySpoc = getPrimarySpoc(agent);
  const preferredChannels = getPreferredChannels(agent);

  const primaryPhone = getAgentPhone(agent, primarySpoc);
  const primaryEmail = getAgentEmail(agent, primarySpoc);
  const locationLabel = getLocationLabel(agent);
  const city = getAgentCity(agent);
  const fullAddress = formatAddress(agent.address);
  const mapQuery = getMapQuery(agent.address);
  const websiteHref = getWebsiteHref(agent.website);

  const allSpocs = Array.isArray(agent.spocs) ? agent.spocs : [];

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 via-gray-50 to-gray-50">
      <div className="mx-auto max-w-7xl space-y-5 px-4 py-6">
        {/* BACK */}
        <Link
          href="/travel-agents"
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-blue-700"
        >
          <ArrowLeft size={16} />
          Back to Travel Agents
        </Link>

        {/* HEADER */}
        <section className="overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-sm">
          <div className="relative border-b border-blue-100 bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 p-5 text-white sm:p-6">
            <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute bottom-0 left-20 h-28 w-28 rounded-full bg-cyan-300/20 blur-2xl" />

            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {agent.agentCode && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white backdrop-blur">
                      <Building2 size={13} />
                      {agent.agentCode}
                    </span>
                  )}

                  {agent.status && (
                    <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white backdrop-blur">
                      {formatLabel(agent.status)}
                    </span>
                  )}

                  {agent.relationshipStage && (
                    <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white backdrop-blur">
                      {formatLabel(agent.relationshipStage)}
                    </span>
                  )}

                  {agent.kycStatus && (
                    <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white backdrop-blur">
                      KYC: {formatLabel(agent.kycStatus)}
                    </span>
                  )}
                </div>

                <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">
                  {agent.agencyName || "Unnamed Travel Agent"}
                </h1>

                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-blue-50">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin size={15} />
                    {locationLabel || "Location not added"}
                  </span>

                  <span className="inline-flex items-center gap-1.5">
                    <UserRound size={15} />
                    {primarySpoc?.name || "Primary SPOC not added"}
                  </span>

                  {websiteHref && (
                    <a
                      href={websiteHref}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-white hover:underline"
                    >
                      <Globe2 size={15} />
                      Website
                    </a>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row lg:shrink-0">
                <Link
                  href={`/engagements/travel-agent/${agentId}`}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 shadow-sm hover:bg-blue-50"
                >
                  <MessageCircle size={16} />
                  View Engagements
                </Link>

                <Link
                  href={`/leads?agentId=${agentId}`}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-medium text-white backdrop-blur hover:bg-white/20"
                >
                  <Users size={16} />
                  View Leads
                </Link>
              </div>
            </div>
          </div>

          {/* SUMMARY CARDS */}
          <div className="grid grid-cols-1 gap-3 bg-gradient-to-b from-blue-50/60 to-white p-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              icon={Landmark}
              label="Agency Type"
              value={formatLabel(agent.agencyType)}
              tone="blue"
            />

            <SummaryCard
              icon={UserRound}
              label="Primary SPOC"
              value={primarySpoc?.name || "Not added"}
              helper={primarySpoc?.designation}
              tone="emerald"
            />

            <SummaryCard
              icon={Route}
              label="Destinations"
              value={destinations.length}
              helper={
                destinations.length
                  ? "Mapped destinations"
                  : "No destinations"
              }
              tone="violet"
            />

            <SummaryCard
              icon={ShieldCheck}
              label="KYC Status"
              value={formatLabel(agent.kycStatus || "Pending")}
              tone="amber"
            />
          </div>
        </section>

        {/* MAIN GRID */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* LEFT COLUMN */}
          <div className="space-y-6 lg:col-span-2">
            {/* BUSINESS OVERVIEW */}
            <SectionCard
              title="Business Overview"
              icon={Briefcase}
              tone="blue"
            >
              <div className="divide-y divide-gray-100">
                <InfoRow
                  label="Agency Type"
                  value={formatLabel(agent.agencyType)}
                />

                <InfoRow
                  label="Relationship Stage"
                  value={formatLabel(agent.relationshipStage)}
                />

                <InfoRow
                  label="Team"
                  value={agent.team}
                />

                <InfoRow
                  label="Average Ticket Size"
                  value={formatCurrency(agent.avgTicketSize)}
                />

                <InfoRow
                  label="USP"
                  value={agent.usp}
                />
              </div>
            </SectionCard>

            {/* DESTINATIONS */}
            <SectionCard
              title="Destinations"
              icon={MapPin}
              tone="violet"
            >
              {destinations.length ? (
                <div className="flex flex-wrap gap-2">
                  {destinations.map((destination, index) => (
                    <TravelChip
                      key={destination.id || destination.name || index}
                      label={
                        destination.name ||
                        destination.destinationName ||
                        "Unnamed Destination"
                      }
                      icon="destination"
                      color="primary"
                    />
                  ))}
                </div>
              ) : (
                <EmptyCardText>
                  No destinations have been mapped to this travel agent yet.
                </EmptyCardText>
              )}
            </SectionCard>

            {/* ADDRESS */}
            <SectionCard
              title="Address"
              icon={MapPin}
              tone="emerald"
            >
              {fullAddress ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-emerald-100 bg-gradient-to-br from-white to-emerald-50/60 p-4">
                    <p className="whitespace-pre-line text-sm leading-6 text-gray-700">
                      {fullAddress}
                    </p>
                  </div>

                  {mapQuery && (
                    <a
                      href={`https://www.google.com/maps?q=${encodeURIComponent(
                        mapQuery
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:underline"
                    >
                      <ExternalLink size={14} />
                      View on Google Maps
                    </a>
                  )}
                </div>
              ) : (
                <EmptyCardText>
                  Address details are not available for this travel agent.
                </EmptyCardText>
              )}
            </SectionCard>

            {/* ALL SPOCS */}
            <SectionCard
              title="All SPOCs"
              icon={Users}
              tone="amber"
            >
              {allSpocs.length ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {allSpocs.map((spoc, index) => (
                    <SpocCard
                      key={
                        spoc.email ||
                        spoc.mobile ||
                        spoc.phone ||
                        spoc.name ||
                        index
                      }
                      spoc={spoc}
                    />
                  ))}
                </div>
              ) : (
                <EmptyCardText>
                  No SPOC details have been added yet.
                </EmptyCardText>
              )}
            </SectionCard>
          </div>

          {/* RIGHT COLUMN */}
          <aside className="space-y-6 lg:sticky lg:top-6 lg:h-fit">
            {/* PRIMARY CONTACT */}
            <SectionCard
              title="Primary Contact"
              icon={UserRound}
              tone="emerald"
            >
              {primarySpoc ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-base font-semibold text-gray-950">
                      {primarySpoc.name || "Unnamed SPOC"}
                    </p>

                    <p className="mt-1 text-sm text-gray-500">
                      {primarySpoc.designation || "Designation not added"}
                    </p>
                  </div>

                  <div className="space-y-2 rounded-xl border border-emerald-100 bg-gradient-to-br from-white to-emerald-50/60 p-4">
                    {primaryPhone ? (
                      <a
                        href={`tel:${primaryPhone}`}
                        className="flex items-center gap-2 text-sm font-medium text-blue-700 hover:underline"
                      >
                        <Phone size={15} />
                        {primaryPhone}
                      </a>
                    ) : (
                      <p className="text-sm text-gray-400">
                        Phone not added
                      </p>
                    )}

                    {primaryEmail ? (
                      <a
                        href={`mailto:${primaryEmail}`}
                        className="flex items-center gap-2 truncate text-sm font-medium text-blue-700 hover:underline"
                      >
                        <Mail size={15} />
                        <span className="truncate">
                          {primaryEmail}
                        </span>
                      </a>
                    ) : (
                      <p className="text-sm text-gray-400">
                        Email not added
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <EmptyCardText>
                  Primary contact is not available.
                </EmptyCardText>
              )}
            </SectionCard>

            {/* PREFERRED COMMUNICATION */}
            <SectionCard
              title="Preferred Communication"
              icon={MessageCircle}
              tone="violet"
            >
              {preferredChannels.length ? (
                <div className="flex flex-wrap gap-2">
                  {preferredChannels.map(([key]) => (
                    <TravelChip
                      key={key}
                      label={formatLabel(key)}
                      icon={key}
                      color="neutral"
                    />
                  ))}
                </div>
              ) : (
                <EmptyCardText>
                  Preferred communication channels are not configured.
                </EmptyCardText>
              )}
            </SectionCard>

            {/* PROFILE STATUS */}
            <SectionCard
              title="Profile Status"
              icon={BadgeCheck}
              tone="blue"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/60 px-3 py-2">
                  <span className="text-xs font-medium text-gray-600">
                    Status
                  </span>

                  <TravelChip
                    label={formatLabel(agent.status || "Active")}
                    icon="date"
                    color={getStatusColor(agent.status || "active")}
                  />
                </div>

                <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2">
                  <span className="text-xs font-medium text-gray-600">
                    KYC
                  </span>

                  <TravelChip
                    label={formatLabel(agent.kycStatus || "Pending")}
                    icon={
                      normalize(agent.kycStatus) === "approved"
                        ? "engaged"
                        : "warning"
                    }
                    color={getKycColor(agent.kycStatus || "pending")}
                  />
                </div>

                <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2">
                  <span className="text-xs font-medium text-gray-600">
                    City
                  </span>

                  <span className="text-xs font-semibold text-gray-800">
                    {city || "Not added"}
                  </span>
                </div>
              </div>
            </SectionCard>
          </aside>
        </section>
      </div>
    </main>
  );
}