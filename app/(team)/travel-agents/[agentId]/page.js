"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";

import {
  Phone,
  Mail,
  MapPin,
  Briefcase,
  Users,
  CheckCircle,
  AlertTriangle,
  MessageCircle
} from "lucide-react";

import TravelChip from "@/components/ui/TravelChip";
import CardSkeleton from "@/components/ui/CardSkeleton";

export default function TravelAgentDetailPage() {
  const { agentId } = useParams();
  const router = useRouter();
  const { user, loading } = useAuth();

  const [agent, setAgent] = useState(null);
  const [loadingAgent, setLoadingAgent] = useState(true);

  /* ================= LOAD ================= */
  useEffect(() => {
    if (loading || !user || !agentId) return;

    getDoc(doc(db, "travelAgents", agentId)).then(snap => {
      if (!snap.exists()) {
        router.replace("/travel-agents");
        return;
      }
      setAgent(snap.data());
      setLoadingAgent(false);
    });
  }, [agentId, user, loading, router]);

  /* ================= LOADING ================= */
  if (loading || loadingAgent) {
    return (
      <main className="max-w-6xl mx-auto p-6 space-y-4">
        <CardSkeleton />
        <CardSkeleton />
      </main>
    );
  }

  if (!agent) return null;

  /* ================= DERIVED ================= */
  const destinations =
    agent.destinations?.filter(d => d?.id && d?.name) || [];

  const primarySpoc =
    agent.spocs?.find(s => s.isPrimary) ||
    agent.spocs?.[0];

  const preferredChannels = Object.entries(
    agent.preferredCommunication || {}
  ).filter(([, v]) => v);

  /* ================= UI ================= */
  return (
    <main className="bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">

        {/* ================= HEADER ================= */}
        <section className="bg-white rounded-xl p-4 space-y-2">
          <h1 className="text-xl font-semibold text-gray-900">
            {agent.agencyName}
          </h1>

          <p className="text-sm text-gray-500">
            {agent.agentCode}
          </p>

          <div className="flex flex-wrap gap-2 pt-2">
            {agent.status && (
              <TravelChip
                label={agent.status}
                icon="date"
                color={agent.status === "active" ? "success" : "neutral"}
              />
            )}

            {agent.relationshipStage && (
              <TravelChip
                label={agent.relationshipStage}
                icon="date"
                color="primary"
              />
            )}

            {agent.kycStatus && (
              <TravelChip
                label={`KYC: ${agent.kycStatus}`}
                icon={agent.kycStatus === "Approved" ? "engaged" : "warning"}
                color={agent.kycStatus === "Approved" ? "success" : "warning"}
              />
            )}
          </div>
        </section>

        {/* ================= QUICK ACTIONS ================= */}
        <section className="flex flex-wrap gap-3">
          <Link
            href={`/engagements/travel-agent/${agentId}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium"
          >
            <MessageCircle size={16} />
            View Engagements
          </Link>

          <Link
            href={`/leads?agentId=${agentId}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-gray-100 text-gray-800 text-sm font-medium"
          >
            <Users size={16} />
            View Leads
          </Link>
        </section>

        {/* ================= MAIN GRID ================= */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* ========== LEFT (2/3) ========== */}
          <div className="md:col-span-2 space-y-6">

            {/* BUSINESS OVERVIEW */}
            <div className="bg-white rounded-xl p-4 space-y-3">
              <h2 className="flex items-center gap-2 font-semibold text-sm">
                <Briefcase size={16} />
                Business Overview
              </h2>

              <div className="text-sm text-gray-700 space-y-1">
                {agent.agencyType && <p><b>Agency Type:</b> {agent.agencyType}</p>}
                {agent.usp && <p><b>USP:</b> {agent.usp}</p>}
                {agent.team && <p><b>Team:</b> {agent.team}</p>}
                {agent.avgTicketSize && (
                  <p><b>Avg Ticket Size:</b> ₹{agent.avgTicketSize}</p>
                )}
              </div>
            </div>

            {/* DESTINATIONS */}
            <div className="bg-white rounded-xl p-4 space-y-3">
              <h2 className="flex items-center gap-2 font-semibold text-sm">
                <MapPin size={16} />
                Destinations
              </h2>

              {destinations.length ? (
                <div className="flex flex-wrap gap-2">
                  {destinations.map((d, idx) => (
                    <TravelChip
                      key={d.id ?? idx}
                      label={d.name}
                      icon="destination"
                      color="primary"
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  No destinations added
                </p>
              )}
            </div>

            {/* ADDRESS */}
            <div className="bg-white rounded-xl p-4 space-y-3">
              <h2 className="flex items-center gap-2 font-semibold text-sm">
                <MapPin size={16} />
                Address
              </h2>

              <p className="text-sm text-gray-700 leading-relaxed">
                {agent.address?.line1}<br />
                {agent.address?.line2 && <>{agent.address.line2}<br /></>}
                {agent.address?.city}, {agent.address?.state}<br />
                {agent.address?.country} {agent.address?.pincode}
              </p>

              {agent.address && (
                <a
                  href={`https://www.google.com/maps?q=${encodeURIComponent(
                    [
                      agent.address.line1,
                      agent.address.city,
                      agent.address.state,
                      agent.address.country
                    ].filter(Boolean).join(", ")
                  )}`}
                  target="_blank"
                  className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                >
                  <MapPin size={14} />
                  View on Google Maps
                </a>
              )}
            </div>
          </div>

          {/* ========== RIGHT (1/3) ========== */}
          <div className="space-y-6">

            {/* PRIMARY SPOC */}
            <div className="bg-white rounded-xl p-4 space-y-3">
              <h2 className="flex items-center gap-2 font-semibold text-sm">
                <Users size={16} />
                Primary Contact
              </h2>

              {primarySpoc ? (
                <div className="text-sm space-y-1">
                  <p className="font-medium">{primarySpoc.name}</p>
                  <p className="text-gray-500">{primarySpoc.designation}</p>

                  {primarySpoc.mobile && (
                    <a
                      href={`tel:${primarySpoc.mobile}`}
                      className="flex items-center gap-1 text-blue-600"
                    >
                      <Phone size={14} />
                      {primarySpoc.mobile}
                    </a>
                  )}

                  {primarySpoc.email && (
                    <a
                      href={`mailto:${primarySpoc.email}`}
                      className="flex items-center gap-1 text-blue-600"
                    >
                      <Mail size={14} />
                      {primarySpoc.email}
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  No SPOC available
                </p>
              )}
            </div>

            {/* PREFERRED COMMUNICATION */}
            {preferredChannels.length > 0 && (
              <div className="bg-white rounded-xl p-4 space-y-3">
                <h2 className="flex items-center gap-2 font-semibold text-sm">
                  <MessageCircle size={16} />
                  Preferred Communication
                </h2>

                <div className="flex flex-wrap gap-2">
                  {preferredChannels.map(([key]) => (
                    <TravelChip
                      key={key}
                      label={key}
                      icon={key}
                    />
                  ))}
                </div>
              </div>
            )}

          </div>
        </section>
      </div>
    </main>
  );
}
