"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";

/* ENGAGEMENT COMPONENTS */
import EngagementKpiCard from "@/components/admin/dashboard/engagements/EngagementKpiCard";
import EngagementByChannelChart from "@/components/admin/dashboard/engagements/EngagementByChannelChart";
import EngagementByDestinationChart from "@/components/admin/dashboard/engagements/EngagementByDestinationChart";
import AgentEngagementOverviewTable from "@/components/admin/dashboard/engagements/AgentEngagementOverviewTable";

export default function AdminEngagementDashboard() {
  const router = useRouter();
  const { user, loading, error } = useAuth("admin");

  const [engagements, setEngagements] = useState([]);
  const [leads, setLeads] = useState([]);

  /* ================= AUTH ================= */
  useEffect(() => {
    if (!loading && error === "ROLE_MISMATCH") {
      router.replace("/dashboard");
    }

    if (!loading && error === "USER_NOT_REGISTERED") {
      router.replace("/admin/login");
    }
  }, [loading, error, router]);

  /* ================= DATA LOAD ================= */
  useEffect(() => {
    if (!user) return;

    const unsubEng = onSnapshot(
      collection(db, "engagements"),
      snap =>
        setEngagements(
          snap.docs.map(d => ({ id: d.id, ...d.data() }))
        )
    );

    const unsubLeads = onSnapshot(
      collection(db, "leads"),
      snap =>
        setLeads(
          snap.docs.map(d => ({ id: d.id, ...d.data() }))
        )
    );

    return () => {
      unsubEng();
      unsubLeads();
    };
  }, [user]);

  if (loading || user === undefined) {
    return <p className="p-6">Loading...</p>;
  }

  if (!user) {
    return <p className="p-6 text-red-600">Access denied</p>;
  }

  /* ================= METRICS ================= */
  const agentSet = new Set();
  const destinationSet = new Set();
  let last = null;

  engagements.forEach(e => {
    if (e.agentId) agentSet.add(e.agentId);
    e.destinationIds?.forEach(d => destinationSet.add(d));

    const d = e.createdAt?.toDate?.();
    if (d && (!last || d > last)) last = d;
  });

  return (
    <main className="p-6 space-y-6 w-full">

      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">
            Engagement Dashboard
          </h1>
          <p className="text-sm text-gray-500">
            Outreach & communication activity
          </p>
        </div>

        <Link
          href="/admin/dashboard"
          className="text-sm text-blue-600 hover:underline"
        >
          ← Back to admin dashboard
        </Link>
      </div>

      {/* KPI STRIP */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <EngagementKpiCard label="Total Engagements" value={engagements.length} />
        <EngagementKpiCard label="Agents Engaged" value={agentSet.size} />
        <EngagementKpiCard label="Destinations Engaged" value={destinationSet.size} />
        <EngagementKpiCard
          label="Last Engagement"
          value={last ? last.toLocaleDateString() : "—"}
        />
      </div>

      {/* CHARTS */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <EngagementByChannelChart engagements={engagements} />
        <EngagementByDestinationChart engagements={engagements} />
      </div>

      {/* AGENT VISIBILITY */}
      <AgentEngagementOverviewTable
        engagements={engagements}
        leads={leads}
      />
    </main>
  );
}
