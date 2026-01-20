"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";

/* DASHBOARD COMPONENTS */
import DashboardFilters from "@/components/admin/dashboard/DashboardFilters";
import DashboardKpiCard from "@/components/admin/dashboard/DashboardKpiCard";
import LeadsTrendChart from "@/components/admin/dashboard/LeadsTrendChart";
import LeadsByStageChart from "@/components/admin/dashboard/LeadsByStageChart";
import TeamPerformanceTable from "@/components/admin/dashboard/TeamPerformanceTable";
import LeadsByDestinationChart from "@/components/admin/dashboard/LeadsByDestinationChart";
import RevenueByDestinationChart from "@/components/admin/dashboard/RevenueByDestinationChart";

/* ENGAGEMENT COMPONENTS */
import EngagementKpiCard from "@/components/admin/dashboard/engagements/EngagementKpiCard";
import EngagementByChannelChart from "@/components/admin/dashboard/engagements/EngagementByChannelChart";
import EngagementByDestinationChart from "@/components/admin/dashboard/engagements/EngagementByDestinationChart";
import AgentEngagementOverviewTable from "@/components/admin/dashboard/engagements/AgentEngagementOverviewTable";

export default function AdminDashboardGraph() {
  const router = useRouter();
  const { user, loading, error } = useAuth("admin");
  const mountTimeRef = useRef(performance.now());
  const authLoggedRef = useRef(false);
  const dataLoggedRef = useRef(false);

  /* =========================
     STATE (ALWAYS FIRST)
  ========================== */
  const [leads, setLeads] = useState([]);
  const [engagements, setEngagements] = useState([]);

  const [filters, setFilters] = useState({
    stage: "all",
    assignedTo: "all",
    from: "",
    to: "",
    overdue: false
  });

  /* =========================
     AUTH REDIRECTION
  ========================== */
  useEffect(() => {
    if (!loading && !authLoggedRef.current) {
      authLoggedRef.current = true;
      console.log(
        "[TimeLog] Auth resolved in",
        Math.round(performance.now() - mountTimeRef.current),
        "ms"
      );
    }

    if (!loading && error === "ROLE_MISMATCH") {
      router.replace("/dashboard");
    }

    if (!loading && error === "USER_NOT_REGISTERED") {
      router.replace("/admin/login");
    }
  }, [loading, error, router]);


  useEffect(() => {
    console.log(
      "[TimeLog] Dashboard mounted in",
      Math.round(performance.now() - mountTimeRef.current),
      "ms"
    );
  }, []);

  /* =========================
     DATA LOAD (ADMIN ONLY)
  ========================== */
  useEffect(() => {
    if (!user) return;

    const unsubLeads = onSnapshot(
      collection(db, "leads"),
      snap => {
        setLeads(
          snap.docs.map(d => ({ id: d.id, ...d.data() }))
        );

        if (!dataLoggedRef.current) {
          dataLoggedRef.current = true;
          console.log(
            "[TimeLog] Firestore data loaded in",
            Math.round(performance.now() - mountTimeRef.current),
            "ms"
          );
        }
      }
    );

    const unsubEngagements = onSnapshot(
      collection(db, "engagements"),
      snap =>
        setEngagements(
          snap.docs.map(d => ({ id: d.id, ...d.data() }))
        )
    );

    return () => {
      unsubLeads();
      unsubEngagements();
    };
  }, [user]);

  /* =========================
     FILTERED LEADS (HOOK SAFE)
  ========================== */
  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      if (filters.stage !== "all" && l.stage !== filters.stage)
        return false;

      if (
        filters.assignedTo !== "all" &&
        l.assignedToUid !== filters.assignedTo
      )
        return false;

      if (filters.overdue) {
        const d = l.nextActionAt?.toDate?.();
        if (!d || d >= new Date()) return false;
      }

      if (filters.from) {
        const c = l.createdAt?.toDate?.();
        if (!c || c < new Date(filters.from)) return false;
      }

      if (filters.to) {
        const c = l.createdAt?.toDate?.();
        if (!c || c > new Date(filters.to)) return false;
      }

      return true;
    });
  }, [leads, filters]);

  /* =========================
     LEAD METRICS
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
        totalWon += amount;
        wonCount += 1;
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

  /* =========================
     ENGAGEMENT METRICS
  ========================== */
  const engagementMetrics = useMemo(() => {
    const agentSet = new Set();
    const destinationSet = new Set();
    let last = null;

    engagements.forEach(e => {
      if (e.agentId) agentSet.add(e.agentId);

      if (Array.isArray(e.destinationIds)) {
        e.destinationIds.forEach(d =>
          destinationSet.add(d)
        );
      }

      const d = e.createdAt?.toDate?.();
      if (d && (!last || d > last)) last = d;
    });

    return {
      total: engagements.length,
      agents: agentSet.size,
      destinations: destinationSet.size,
      lastDate: last ? last.toLocaleDateString() : "—"
    };
  }, [engagements]);

  useEffect(() => {
  if (user && leads.length && engagements.length) {
    console.log(
      "[TimeLog] Dashboard ready in",
      Math.round(performance.now() - mountTimeRef.current),
      "ms"
    );
  }
}, [user, leads, engagements]);

  /* =========================
     RENDER GUARDS (AFTER HOOKS)
  ========================== */
  if (loading || user === undefined) {
    return <p className="p-6">Loading...</p>;
  }

  if (!user) {
    return <p className="p-6 text-red-600">Access denied</p>;
  }

  

  /* =========================
     DASHBOARD UI
  ========================== */
  return (
    <main className="p-6 space-y-10 w-full">

      {/* =====================================================
        TODAY’S PULSE (TOP STRIP)
    ===================================================== */}
      <section className="space-y-2">
        <h1 className="text-xl font-semibold">
          Admin Dashboard
        </h1>
        <p className="text-sm text-gray-500">
          Live business pulse & operational signals
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <DashboardKpiCard
            label="Leads Today"
            value={filteredLeads.length}
          />
          <DashboardKpiCard
            label="Revenue Won"
            value={`₹${metrics.totalWon.toLocaleString()}`}
            color="green"
          />
          <DashboardKpiCard
            label="Engagements Sent"
            value={engagementMetrics.total}
            color="blue"
          />
          <DashboardKpiCard
            label="Agents Active"
            value={engagementMetrics.agents}
            color="amber"
          />
        </div>
      </section>

      {/* =====================================================
        OUTCOME vs EFFORT (SPLIT VIEW)
    ===================================================== */}
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* -------- BUSINESS OUTCOME -------- */}
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">
              Business Outcome
            </h2>
            <p className="text-sm text-gray-500">
              What the business is delivering
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <DashboardKpiCard
              label="Total Leads"
              value={metrics.totalLeads}
            />
            <DashboardKpiCard
              label="Avg Deal"
              value={`₹${metrics.avgDeal.toLocaleString()}`}
              color="purple"
            />
            <DashboardKpiCard
              label="Win Rate"
              value={`${metrics.winRate}%`}
              color="green"
            />
          </div>

          <LeadsTrendChart leads={filteredLeads} />
        </div>

        {/* -------- OUTREACH EFFORT -------- */}
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">
              Outreach Effort
            </h2>
            <p className="text-sm text-gray-500">
              Communication & engagement activity
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <EngagementKpiCard
              label="Total Engagements"
              value={engagementMetrics.total}
            />
            <EngagementKpiCard
              label="Destinations Engaged"
              value={engagementMetrics.destinations}
            />
            <EngagementKpiCard
              label="Last Engagement"
              value={engagementMetrics.lastDate}
            />
          </div>

          <EngagementByChannelChart engagements={engagements} />
        </div>
      </section>

      {/* =====================================================
        WHAT NEEDS ATTENTION (ACTION PANEL)
    ===================================================== */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">
          What Needs Attention
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm font-medium text-amber-800">
              Agents with leads but no engagement
            </p>
            <p className="text-xs text-amber-700 mt-1">
              Follow-up required to unlock potential
            </p>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-sm font-medium text-red-700">
              Destinations heavily engaged but low leads
            </p>
            <p className="text-xs text-red-600 mt-1">
              Review pricing or messaging
            </p>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-sm font-medium text-green-700">
              Organic lead demand detected
            </p>
            <p className="text-xs text-green-600 mt-1">
              Scale outreach for momentum
            </p>
          </div>

        </div>
      </section>

      {/* =====================================================
        DEEP DIVE (PROGRESSIVE DISCLOSURE)
    ===================================================== */}
      <details className="bg-white border border-gray-200 rounded-xl p-4">
        <summary className="cursor-pointer font-medium text-sm text-gray-700">
          Explore detailed analytics ↓
        </summary>

        <div className="space-y-8 mt-6">

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <LeadsByStageChart leads={filteredLeads} />
            <LeadsByDestinationChart leads={filteredLeads} />
          </div>

          <RevenueByDestinationChart leads={filteredLeads} />

          <TeamPerformanceTable leads={filteredLeads} />

          <div className="pt-4 border-t">
            <AgentEngagementOverviewTable
              engagements={engagements}
              leads={leads}
            />
          </div>

        </div>
      </details>

      {/* =====================================================
        FOOTER CTA
    ===================================================== */}
      <div className="flex justify-end">
        <a
          href="/admin/engagements"
          className="text-sm text-blue-600 hover:underline"
        >
          View full engagement dashboard →
        </a>
      </div>

    </main>
  );

}
