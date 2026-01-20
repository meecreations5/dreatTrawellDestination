"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";

import AgentFilterBar from "@/components/travel-agents/AgentFilterBar";
import TravelChip from "@/components/ui/TravelChip";
import EmptyState from "@/components/ui/EmptyState";
import CardSkeleton from "@/components/ui/CardSkeleton";
import {AgentFilters} from "@/components/travel-agents/AgentFilter";

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
   AGENT CARD
========================= */
function AgentCard({
  agent,
  lastEngagement,
  leadCount,
  city
}) {
  const channelIcon =
    CHANNEL_ICON_MAP[lastEngagement?.channel];

  return (
    <div className="bg-white rounded-xl p-4 space-y-3">
      {/* HEADER */}
      <div className="flex justify-between">
        <div>
          <p className="font-semibold text-sm">
            {agent.agencyName}
          </p>
          <p className="text-xs text-gray-500">
            {agent.agentCode}
          </p>
        </div>
      </div>

      {/* CHIPS */}
      <div className="flex flex-wrap gap-2">
        {/* LEADS */}
        <TravelChip
          label={`${leadCount} Leads`}
          icon="leads"
          color="primary"
        />

        {/* LOCATION */}
        {city && (
          <TravelChip
            label={city}
            icon="location"
            color="neutral"
          />
        )}

        {/* CHANNEL */}
        {lastEngagement && channelIcon && (
          <TravelChip
            label={lastEngagement.channel}
            icon={channelIcon}
            color="neutral"
          />
        )}

        {/* STATUS */}
        {lastEngagement ? (
          <TravelChip
            label="Engaged"
            icon="engaged"
            color="success"
          />
        ) : (
          <TravelChip
            label="Needs follow-up"
            icon="warning"
            color="warning"
          />
        )}
      </div>

      {/* ACTIONS */}
      <div className="pt-2 flex gap-4 text-xs">
        <Link
          href={`/travel-agents/${agent.id}`}
          className="text-blue-600 hover:underline"
        >
          View agent
        </Link>

        <Link
          href={`/engagements/new?agentId=${agent.id}`}
          className="text-gray-600 hover:underline"
        >
          Add engagement
        </Link>
      </div>
    </div>
  );
}

export default function UserTravelAgentsPage() {
  const { user, loading } = useAuth();

  const [agents, setAgents] = useState([]);
  const [engagements, setEngagements] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loadingList, setLoadingList] = useState(true);

  const [filters, setFilters] = useState({
    search: "",
    engagement: "all",
    channel: "all"
  });

  /* LOAD AGENTS */
  useEffect(() => {
    if (!user) return;

    const unsub = onSnapshot(
      collection(db, "travelAgents"),
      snap => {
        setAgents(
          snap.docs.map(d => ({
            id: d.id,
            ...d.data()
          }))
        );
        setLoadingList(false);
      }
    );

    return () => unsub();
  }, [user]);

  /* LOAD ENGAGEMENTS */
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "engagements"),
      where("createdByUid", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, snap => {
      setEngagements(
        snap.docs.map(d => ({
          id: d.id,
          ...d.data()
        }))
      );
    });

    return () => unsub();
  }, [user]);

  /* LOAD LEADS */
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "leads"),
      where("assignedToUid", "==", user.uid)
    );

    const unsub = onSnapshot(q, snap => {
      setLeads(
        snap.docs.map(d => ({
          id: d.id,
          ...d.data()
        }))
      );
    });

    return () => unsub();
  }, [user]);

  /* MAP LAST ENGAGEMENT */
  const lastEngagementMap = useMemo(() => {
    const map = {};
    engagements.forEach(e => {
      if (!map[e.agentId]) map[e.agentId] = e;
    });
    return map;
  }, [engagements]);

  /* MAP LEADS META */
  const leadMetaMap = useMemo(() => {
    const map = {};
    leads.forEach(l => {
      if (!l.agentId) return;

      if (!map[l.agentId]) {
        map[l.agentId] = {
          count: 0,
          city: l.city || l.location?.city || ""
        };
      }

      map[l.agentId].count += 1;
    });
    return map;
  }, [leads]);

  /* APPLY FILTERS */
  const filteredAgents = useMemo(() => {
    return agents.filter(agent => {
      const last = lastEngagementMap[agent.id];

      if (filters.search) {
        const s = filters.search.toLowerCase();
        if (
          !agent.agencyName?.toLowerCase().includes(s) &&
          !agent.agentCode?.toLowerCase().includes(s)
        ) {
          return false;
        }
      }

      if (filters.engagement === "engaged" && !last)
        return false;

      if (
        filters.engagement === "not_engaged" &&
        last
      )
        return false;

      if (
        filters.channel !== "all" &&
        last?.channel !== filters.channel
      )
        return false;

      return true;
    });
  }, [agents, filters, lastEngagementMap]);

  if (loading || loadingList) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-6 space-y-4 bg-gray-50 min-h-screen">
        <CardSkeleton />
        <CardSkeleton />
      </main>
    );
  }

  return (
    <main className="bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* HEADER */}
        <div>
          <h1 className="text-lg font-semibold text-gray-900">
            Travel Agents
          </h1>
          <p className="text-sm text-gray-500">
            {filteredAgents.length} results
          </p>
        </div>

        {/* FILTER BAR */}
        <AgentFilterBar
          filters={filters}
          setFilters={setFilters}
        />

        {/* LIST */}
        {filteredAgents.length === 0 ? (
          <EmptyState
            icon="🧳"
            title="No agents found"
            description="Try adjusting your filters"
          />
        ) : (
          <div className="space-y-4">
            {filteredAgents.map(agent => {
              const meta =
                leadMetaMap[agent.id] || {};

              return (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  lastEngagement={
                    lastEngagementMap[agent.id]
                  }
                  leadCount={meta.count || 0}
                  city={meta.city}
                />
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
