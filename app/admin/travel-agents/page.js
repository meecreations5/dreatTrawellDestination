"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import AdminGuard from "@/components/AdminGuard";

import TravelAgentFilterBar from "@/components/travel-agents/TravelAgentFilters";
import TravelAgentStatusToggle from "@/components/travel-agents/TravelAgentStatusToggle";
import TravelAgentExportCSV from "@/components/travel-agents/TravelAgentExportCSV";
import TravelAgentImportCSV from "@/components/travel-agents/TravelAgentImportCSV";
import AgentSideDrawer from "@/components/travel-agents/AgentSideDrawer";

import EmptyState from "@/components/ui/EmptyState";
import Link from "next/link";

/* =========================
   MAU CHIP
========================= */
const MAUChip = ({ label }) => (
  <span className="px-2 py-[2px] rounded-md text-[11px] bg-slate-100 text-slate-700">
    {label}
  </span>
);

export default function AdminTravelAgentsPage() {
  const [agents, setAgents] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);

  const [view, setView] = useState("table");
  const [selectedAgent, setSelectedAgent] = useState(null);

  const [filters, setFilters] = useState({
    search: "",
    status: "",
    agencyType: "",
    destinationId: "",
    relationshipStage: ""
  });

  /* =========================
     LOAD DATA
  ========================= */
  useEffect(() => {
    const load = async () => {
      const [agentSnap, destSnap] = await Promise.all([
        getDocs(collection(db, "travelAgents")),
        getDocs(collection(db, "destinations"))
      ]);

      setAgents(
        agentSnap.docs.map(d => ({
          id: d.id,
          ...d.data()
        }))
      );

      setDestinations(
        destSnap.docs.map(d => ({
          id: d.id,
          name: d.data().name
        }))
      );

      setLoading(false);
    };

    load();
  }, []);

  /* =========================
     DESTINATION MAP
  ========================= */
  const destinationMap = useMemo(() => {
    const map = {};
    destinations.forEach(d => {
      map[d.id] = d.name;
    });
    return map;
  }, [destinations]);

  /* =========================
     SAFE DESTINATION RESOLVER
  ========================= */
  const getAgentDestinations = agent => {
    if (Array.isArray(agent.destinationIds)) {
      return agent.destinationIds.map((id, i) => ({
        id: id || `dest-${i}`,
        name: destinationMap[id] || id || "Unknown"
      }));
    }

    if (
      Array.isArray(agent.destinations) &&
      typeof agent.destinations[0] === "string"
    ) {
      return agent.destinations.map((id, i) => ({
        id: id || `dest-${i}`,
        name: destinationMap[id] || id || "Unknown"
      }));
    }

    if (
      Array.isArray(agent.destinations) &&
      typeof agent.destinations[0] === "object"
    ) {
      return agent.destinations.map((d, i) => ({
        id: d.id || d.name || `dest-${i}`,
        name:
          d.name ||
          destinationMap[d.id] ||
          d.id ||
          "Unknown"
      }));
    }

    return [];
  };

  /* =========================
     FILTERED AGENTS (MEMOIZED)
  ========================= */
  const filteredAgents = useMemo(() => {
    return agents.filter(agent => {
      const spoc =
        agent.spocs?.find(x => x.isPrimary) ||
        agent.spocs?.[0];

      const s = filters.search.toLowerCase();

      if (
        s &&
        !agent.agencyName?.toLowerCase().includes(s) &&
        !agent.agentCode?.toLowerCase().includes(s) &&
        !spoc?.name?.toLowerCase().includes(s)
      ) {
        return false;
      }

      if (filters.status && agent.status !== filters.status)
        return false;

      if (
        filters.agencyType &&
        agent.agencyType !== filters.agencyType
      )
        return false;

      if (
        filters.relationshipStage &&
        agent.relationshipStage !==
          filters.relationshipStage
      )
        return false;

      if (
        filters.destinationId &&
        !getAgentDestinations(agent).some(
          d => d.id === filters.destinationId
        )
      )
        return false;

      return true;
    });
  }, [agents, filters, destinationMap]);

  /* =========================
     UI
  ========================= */
  return (
    <AdminGuard>
      <main className="p-6 w-full mx-auto space-y-4">

        <h1 className="text-xl font-semibold text-gray-800">
          Travel Agents
        </h1>

        {/* FILTER BAR — LEADS STYLE */}
        <TravelAgentFilterBar
          view={view}
          setView={setView}
          filters={filters}
          setFilters={setFilters}
          destinations={destinations}
          onExport={() => {
            if (!filteredAgents.length) {
              alert("No agents to export");
              return;
            }
          }}
        />

        {/* ACTION BAR */}
        <div className="flex justify-end gap-2">
          <TravelAgentImportCSV />
          <TravelAgentExportCSV agents={filteredAgents} />
        </div>

        {/* LOADING */}
        {loading && (
          <div className="text-sm text-gray-500">
            Loading travel agents…
          </div>
        )}

        {/* EMPTY */}
        {!loading && filteredAgents.length === 0 && (
          <EmptyState
            title="No travel agents found"
            description="Try adjusting filters"
          />
        )}

        {/* =========================
            TABLE VIEW
        ========================= */}
        {!loading && view === "table" && (
          <div className="border border-gray-100 rounded-xl bg-white overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50/60 text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Agency</th>
                  <th className="px-4 py-3 text-left">SPOC</th>
                  <th className="px-4 py-3 text-left">Destinations</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>

              <tbody>
                {filteredAgents.map(agent => {
                  const spoc =
                    agent.spocs?.find(x => x.isPrimary) ||
                    agent.spocs?.[0];

                  const agentDestinations =
                    getAgentDestinations(agent);

                  return (
                    <tr
                      key={agent.id}
                      className="border-b border-gray-100 hover:bg-gray-50/60"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">
                          {agent.agencyName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {agent.agentCode}
                        </p>
                      </td>

                      <td className="px-4 py-3">
                        {spoc && (
                          <>
                            <p>{spoc.name}</p>
                            <p className="text-xs text-gray-500">
                              {spoc.email || spoc.mobile}
                            </p>
                          </>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1 max-w-[260px]">
                          {agentDestinations
                            .slice(0, 3)
                            .map((d, i) => (
                              <MAUChip
                                key={`${d.id}-${i}`}
                                label={d.name}
                              />
                            ))}
                          {agentDestinations.length > 3 && (
                            <span className="text-[11px] text-gray-500">
                              +{agentDestinations.length - 3} more
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <TravelAgentStatusToggle
                          agentId={agent.id}
                          currentStatus={
                            agent.status || "inactive"
                          }
                        />
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-3 text-xs">
                          <button
                            onClick={() =>
                              setSelectedAgent(agent)
                            }
                            className="text-gray-600 hover:text-gray-900"
                          >
                            Quick view
                          </button>

                          <Link
                            href={`/admin/travel-agents/${agent.id}`}
                            className="text-blue-600 hover:underline"
                          >
                            View
                          </Link>

                          <Link
                            href={`/admin/travel-agents/${agent.id}/edit`}
                            className="text-gray-600 hover:underline"
                          >
                            Edit
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* =========================
            CARD VIEW
        ========================= */}
        {!loading && view === "card" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {filteredAgents.map(agent => {
              const agentDestinations =
                getAgentDestinations(agent);

              return (
                <div
                  key={agent.id}
                  className="border border-gray-100 rounded-xl bg-white p-4 hover:bg-gray-50/50"
                >
                  <div className="flex justify-between">
                    <div>
                      <p className="font-semibold text-gray-800">
                        {agent.agencyName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {agent.agentCode}
                      </p>
                    </div>

                    <TravelAgentStatusToggle
                      agentId={agent.id}
                      currentStatus={
                        agent.status || "inactive"
                      }
                    />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1">
                    {agentDestinations
                      .slice(0, 4)
                      .map((d, i) => (
                        <MAUChip
                          key={`${d.id}-${i}`}
                          label={d.name}
                        />
                      ))}
                  </div>

                  <div className="mt-4 flex gap-4 text-xs">
                    <button
                      onClick={() =>
                        setSelectedAgent(agent)
                      }
                      className="text-gray-600 hover:text-gray-900"
                    >
                      Quick view
                    </button>

                    <Link
                      href={`/admin/travel-agents/${agent.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      View
                    </Link>

                    <Link
                      href={`/admin/travel-agents/${agent.id}/edit`}
                      className="text-gray-600 hover:underline"
                    >
                      Edit
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* =========================
            SIDE DRAWER
        ========================= */}
        {selectedAgent && (
          <AgentSideDrawer
            agent={selectedAgent}
            destinations={getAgentDestinations(
              selectedAgent
            )}
            onClose={() => setSelectedAgent(null)}
          />
        )}
      </main>
    </AdminGuard>
  );
}
