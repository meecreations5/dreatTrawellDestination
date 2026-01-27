"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  query,
  where,
  onSnapshot
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";

/* SAME UI COMPONENTS */
import DashboardKpiCard from "@/components/admin/dashboard/DashboardKpiCard";
import LeadsTrendChart from "@/components/admin/dashboard/LeadsTrendChart";
import LeadsByStageChart from "@/components/admin/dashboard/LeadsByStageChart";

/* ENGAGEMENT */
import EngagementKpiCard from "@/components/admin/dashboard/engagements/EngagementKpiCard";
import EngagementByChannelChart from "@/components/admin/dashboard/engagements/EngagementByChannelChart";

export default function TeamDashboardGraph() {
  const { user, loading } = useAuth("team");

  const [leads, setLeads] = useState([]);
  const [engagements, setEngagements] = useState([]);

  /* =========================
     DATA LOAD (TEAM ONLY)
  ========================== */
  useEffect(() => {
    if (!user?.uid) return;

    const leadsQ = query(
      collection(db, "leads"),
      where("assignedToUid", "==", user.uid)
    );

    const engQ = query(
      collection(db, "engagements"),
      where("agentId", "==", user.uid)
    );

    const unsubLeads = onSnapshot(leadsQ, snap =>
      setLeads(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );

    const unsubEng = onSnapshot(engQ, snap =>
      setEngagements(
        snap.docs.map(d => ({ id: d.id, ...d.data() }))
      )
    );

    return () => {
      unsubLeads();
      unsubEng();
    };
  }, [user]);

  /* =========================
     METRICS
  ========================== */
  const metrics = useMemo(() => {
    let revenue = 0;
    let wonCount = 0;

    leads.forEach(l => {
      const amt =
        l.lastQuotedAmount ||
        l.totalQuotedAmount ||
        0;

      if (l.stage === "closed_won") {
        revenue += amt;
        wonCount++;
      }
    });

    const overdue = leads.filter(l => {
      const d = l.nextActionAt?.toDate?.();
      return d && d < new Date();
    }).length;

    return {
      total: leads.length,
      won: wonCount,
      revenue,
      overdue
    };
  }, [leads]);

  const lastEngagement = useMemo(() => {
    let last = null;
    engagements.forEach(e => {
      const d = e.createdAt?.toDate?.();
      if (d && (!last || d > last)) last = d;
    });
    return last ? last.toLocaleDateString() : "—";
  }, [engagements]);

  /* =========================
     RENDER GUARD
  ========================== */
  if (loading) {
    return <p className="p-6">Loading…</p>;
  }

  /* =========================
     UI (ADMIN-LIKE, MOBILE SAFE)
  ========================== */
  return (
    <main className="p-4 md:p-6 space-y-10 w-full">

      {/* =========================
        HEADER
      ========================== */}
      <section className="space-y-2">
        <h1 className="text-xl font-semibold">
          Team Dashboard
        </h1>
        <p className="text-sm text-gray-500">
          Your performance & follow-ups
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <DashboardKpiCard
            label="My Leads"
            value={metrics.total}
          />
          <DashboardKpiCard
            label="Deals Won"
            value={metrics.won}
            color="green"
          />
          <DashboardKpiCard
            label="Revenue"
            value={`₹${metrics.revenue.toLocaleString()}`}
            color="green"
          />
          <DashboardKpiCard
            label="Overdue"
            value={metrics.overdue}
            color={metrics.overdue ? "red" : "gray"}
          />
        </div>
      </section>

      {/* =========================
        FLOW
      ========================== */}
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <LeadsTrendChart leads={leads} />
        <LeadsByStageChart leads={leads} />
      </section>

      {/* =========================
        ENGAGEMENT
      ========================== */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">
          My Engagements
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <EngagementKpiCard
            label="Total"
            value={engagements.length}
          />
          <EngagementKpiCard
            label="Last Engagement"
            value={lastEngagement}
          />
        </div>

        <EngagementByChannelChart engagements={engagements} />
      </section>

    </main>
  );
}
