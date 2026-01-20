"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

/* DASHBOARD COMPONENTS */
import DashboardFilters from "@/components/admin/dashboard/DashboardFilters";
import DashboardKpiCard from "@/components/admin/dashboard/DashboardKpiCard";
import LeadsTrendChart from "@/components/admin/dashboard/LeadsTrendChart";
import LeadsByStageChart from "@/components/admin/dashboard/LeadsByStageChart";
import TeamPerformanceTable from "@/components/admin/dashboard/TeamPerformanceTable";
import LeadsByDestinationChart from "@/components/admin/dashboard/LeadsByDestinationChart";
import RevenueByDestinationChart from "@/components/admin/dashboard/RevenueByDestinationChart";

export default function AdminDashboardPage() {
  const [leads, setLeads] = useState([]);
  const [filters, setFilters] = useState({
    stage: "all",
    assignedTo: "all",
    from: "",
    to: "",
    overdue: false
  });

  /* =========================
     REALTIME LOAD
  ========================== */
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "leads"),
      snap => {
        setLeads(
          snap.docs.map(d => ({
            id: d.id,
            ...d.data()
          }))
        );
      }
    );

    return () => unsub();
  }, []);

  /* =========================
     FILTERED LEADS
  ========================== */
  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      if (
        filters.stage !== "all" &&
        l.stage !== filters.stage
      ) {
        return false;
      }

      if (
        filters.assignedTo !== "all" &&
        l.assignedToUid !== filters.assignedTo
      ) {
        return false;
      }

      if (filters.overdue) {
        const d = l.nextActionAt?.toDate?.();
        if (!d || d >= new Date()) return false;
      }

      if (filters.from) {
        const created = l.createdAt?.toDate?.();
        if (!created || created < new Date(filters.from))
          return false;
      }

      if (filters.to) {
        const created = l.createdAt?.toDate?.();
        if (!created || created > new Date(filters.to))
          return false;
      }

      return true;
    });
  }, [leads, filters]);

  /* =========================
     KPI & AMOUNT METRICS
  ========================== */
  const metrics = useMemo(() => {
    let totalQuoted = 0;
    let totalWon = 0;
    let quotedCount = 0;
    let wonCount = 0;

    filteredLeads.forEach(l => {
      const amount =
        l.lastQuotedAmount ||
        l.totalQuotedAmount ||
        0;

      if (amount) {
        totalQuoted += amount;
        quotedCount += 1;
      }

      if (l.stage === "closed_won") {
        wonCount += 1;
        totalWon += amount;
      }
    });

    return {
      totalLeads: filteredLeads.length,
      totalQuoted,
      totalWon,
      avgDeal:
        wonCount > 0
          ? Math.round(totalWon / wonCount)
          : 0,
      winRate:
        quotedCount > 0
          ? Math.round((wonCount / quotedCount) * 100)
          : 0
    };
  }, [filteredLeads]);

  return (
    <main className="p-6 space-y-6 w-full">

      {/* HEADER */}
      <h1 className="text-xl font-semibold">
        Admin Dashboard
      </h1>

      {/* FILTERS */}
      <DashboardFilters
        filters={filters}
        setFilters={setFilters}
      />

      {/* KPI ROW */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <DashboardKpiCard
          label="Total Leads"
          value={metrics.totalLeads}
        />
        <DashboardKpiCard
          label="Total Quoted"
          value={`₹${metrics.totalQuoted.toLocaleString()}`}
          color="blue"
        />
        <DashboardKpiCard
          label="Total Won"
          value={`₹${metrics.totalWon.toLocaleString()}`}
          color="green"
        />
        <DashboardKpiCard
          label="Avg Deal Size"
          value={`₹${metrics.avgDeal.toLocaleString()}`}
          color="purple"
        />
        <DashboardKpiCard
          label="Win Rate"
          value={`${metrics.winRate}%`}
          color="amber"
        />
      </div>

      {/* TREND + STAGE */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <LeadsTrendChart leads={filteredLeads} />
        <LeadsByStageChart leads={filteredLeads} />
      </div>

      {/* TEAM PERFORMANCE */}
      <TeamPerformanceTable leads={filteredLeads} />

      {/* DESTINATION ANALYTICS */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <LeadsByDestinationChart leads={filteredLeads} />
        <RevenueByDestinationChart leads={filteredLeads} />
      </div>

    </main>
  );
}
