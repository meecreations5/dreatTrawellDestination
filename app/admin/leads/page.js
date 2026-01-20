"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";

import AdminLeadCard from "@/components/admin/AdminLeadCard";
import AdminLeadTable from "@/components/admin/AdminLeadTable";
import AdminLeadFilters from "@/components/admin/AdminLeadFilters";
import AdminLeadCardSkeleton from "@/components/admin/AdminLeadCardSkeleton";
import EmptyState from "@/components/ui/EmptyState";

import { exportLeadsCsv } from "@/lib/exportLeadsCsv";

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  const [view, setView] = useState("card");

  const [filters, setFilters] = useState({
    stage: "all",
    assignedTo: "all",
    nextAction: "all",
    search: ""
  });

  /* =========================
     REALTIME LOAD
  ========================== */
  useEffect(() => {
    const q = query(
      collection(db, "leads"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, snap => {
      setLeads(
        snap.docs.map(d => ({
          id: d.id,
          ...d.data()
        }))
      );
      setLoading(false);
    });

    return () => unsub();
  }, []);

  /* =========================
     FILTERED LEADS (🔥 FIX)
  ========================== */
  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      // SEARCH (Lead Code)
      if (
        filters.search &&
        !lead.leadCode
          ?.toLowerCase()
          .includes(filters.search.toLowerCase())
      ) {
        return false;
      }

      // STAGE
      if (
        filters.stage !== "all" &&
        lead.stage !== filters.stage
      ) {
        return false;
      }

      // ASSIGNED USER
      if (
        filters.assignedTo !== "all" &&
        lead.assignedToUid !== filters.assignedTo
      ) {
        return false;
      }

      // NEXT ACTION
      if (filters.nextAction === "overdue") {
        const next =
          lead.nextActionAt?.toDate?.();
        if (!next || next >= new Date()) {
          return false;
        }
      }

      if (filters.nextAction === "none") {
        if (lead.nextActionAt) return false;
      }

      return true;
    });
  }, [leads, filters]);

  /* =========================
     UI
  ========================== */
  return (
    <main className="p-6 w-full mx-auto space-y-4">
      <h1 className="text-xl font-semibold">
        Admin — Leads
      </h1>

      {/* FILTER BAR */}
      <AdminLeadFilters
        view={view}
        setView={setView}
        filters={filters}
        setFilters={setFilters}
        onExport={() => {
          if (!filteredLeads.length) {
            alert("No leads to export");
            return;
          }
          exportLeadsCsv(filteredLeads);
        }}
      />

      {/* LOADING */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <AdminLeadCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* EMPTY */}
      {!loading && filteredLeads.length === 0 && (
        <EmptyState
          title="No leads found"
          description="Try adjusting filters"
        />
      )}

      {/* CARD VIEW */}
      {!loading && view === "card" && (
        <div className="space-y-3">
          {filteredLeads.map(lead => (
            <AdminLeadCard
              key={lead.id}
              lead={lead}
            />
          ))}
        </div>
      )}

      {/* TABLE VIEW */}
      {!loading && view === "table" && (
        <AdminLeadTable
          leads={filteredLeads}
          selected={[]}
          onToggle={() => {}}
          onRowClick={id =>
            window.location.assign(
              `/admin/leads/${id}`
            )
          }
        />
      )}
    </main>
  );
}
