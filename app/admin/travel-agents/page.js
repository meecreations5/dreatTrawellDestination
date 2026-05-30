"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

const MAUChip = ({ label }) => (
  <span className="px-2 py-[2px] rounded-md text-[11px] bg-slate-100 text-slate-700">
    {label}
  </span>
);

const SortButton = ({ label, sortKey, sort, setSort }) => {
  const active = sort.key === sortKey;

  const nextDirection =
    active && sort.direction === "asc" ? "desc" : "asc";

  return (
    <button
      type="button"
      onClick={() =>
        setSort({
          key: sortKey,
          direction: nextDirection
        })
      }
      className="inline-flex items-center gap-1 hover:text-gray-800"
    >
      {label}
      <span className="text-[10px] text-gray-400">
        {active ? (sort.direction === "asc" ? "↑" : "↓") : "↕"}
      </span>
    </button>
  );
};

export default function AdminTravelAgentsPage() {
  const [agents, setAgents] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);

  const [view, setView] = useState("table");
  const [selectedAgent, setSelectedAgent] = useState(null);

  const [sort, setSort] = useState({
    key: "agencyName",
    direction: "asc"
  });

  const [filters, setFilters] = useState({
    search: "",
    status: "",
    agencyType: "",
    destinationId: "",
    relationshipStage: ""
  });

  const loadData = useCallback(async () => {
    setLoading(true);

    try {
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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const destinationMap = useMemo(() => {
    const map = {};

    destinations.forEach(d => {
      map[d.id] = d.name;
    });

    return map;
  }, [destinations]);

  const getAgentDestinations = useCallback(
    agent => {
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
    },
    [destinationMap]
  );

  const getPrimarySpoc = agent =>
    agent.spocs?.find(x => x.isPrimary) || agent.spocs?.[0] || null;

  const filteredAgents = useMemo(() => {
    return agents.filter(agent => {
      const spoc = getPrimarySpoc(agent);
      const s = filters.search.trim().toLowerCase();

      if (
        s &&
        !agent.agencyName?.toLowerCase().includes(s) &&
        !agent.agentCode?.toLowerCase().includes(s) &&
        !spoc?.name?.toLowerCase().includes(s) &&
        !spoc?.email?.toLowerCase().includes(s) &&
        !spoc?.mobile?.toLowerCase().includes(s)
      ) {
        return false;
      }

      if (filters.status && agent.status !== filters.status) {
        return false;
      }

      if (filters.agencyType && agent.agencyType !== filters.agencyType) {
        return false;
      }

      if (
        filters.relationshipStage &&
        agent.relationshipStage !== filters.relationshipStage
      ) {
        return false;
      }

      if (
        filters.destinationId &&
        !getAgentDestinations(agent).some(d => d.id === filters.destinationId)
      ) {
        return false;
      }

      return true;
    });
  }, [agents, filters, getAgentDestinations]);

  const sortedAgents = useMemo(() => {
    const normalize = value =>
      String(value || "").trim().toLowerCase();

    const getValue = agent => {
      const spoc = getPrimarySpoc(agent);

      switch (sort.key) {
        case "agencyName":
          return normalize(agent.agencyName);

        case "agentCode":
          return normalize(agent.agentCode);

        case "spoc":
          return normalize(spoc?.name);

        case "destinations":
          return getAgentDestinations(agent).length;

        case "status":
          return normalize(agent.status);

        case "agencyType":
          return normalize(agent.agencyType);

        case "relationshipStage":
          return normalize(agent.relationshipStage);

        default:
          return normalize(agent.agencyName);
      }
    };

    const direction = sort.direction === "asc" ? 1 : -1;

    return [...filteredAgents].sort((a, b) => {
      const av = getValue(a);
      const bv = getValue(b);

      if (typeof av === "number" && typeof bv === "number") {
        return (av - bv) * direction;
      }

      const result = String(av).localeCompare(String(bv));
      return result * direction;
    });
  }, [filteredAgents, sort, getAgentDestinations]);

  return (
    <AdminGuard>
      <main className="p-6 w-full mx-auto space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-gray-800">
            Travel Agents
          </h1>

          <p className="text-xs text-gray-500">
            {sortedAgents.length} of {agents.length} agents
          </p>
        </div>

        {/* <TravelAgentFilterBar
          view={view}
          setView={setView}
          filters={filters}
          setFilters={setFilters}
          destinations={destinations}
          onExport={() => {
            if (!sortedAgents.length) {
              alert("No agents to export");
            }
          }}
        /> */}

        <TravelAgentFilterBar
          view={view}
          setView={setView}
          filters={filters}
          setFilters={setFilters}
          destinations={destinations}
          exportAgents={filteredAgents}
        />

        <div className="flex flex-wrap justify-between gap-2">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">
              Sort
            </label>

            <select
              value={`${sort.key}:${sort.direction}`}
              onChange={e => {
                const [key, direction] = e.target.value.split(":");
                setSort({ key, direction });
              }}
              className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm"
            >
              <option value="agencyName:asc">Agency A-Z</option>
              <option value="agencyName:desc">Agency Z-A</option>
              <option value="agentCode:asc">Agent Code A-Z</option>
              <option value="status:asc">Status A-Z</option>
              <option value="agencyType:asc">Agency Type A-Z</option>
              <option value="relationshipStage:asc">Stage A-Z</option>
              <option value="destinations:desc">Most Destinations</option>
              <option value="destinations:asc">Least Destinations</option>
            </select>
          </div>

          <div className="flex justify-end gap-2">
            <TravelAgentImportCSV onImported={loadData} />
            <TravelAgentExportCSV agents={sortedAgents} />
          </div>
        </div>

        {loading && (
          <div className="text-sm text-gray-500">
            Loading travel agents…
          </div>
        )}

        {!loading && sortedAgents.length === 0 && (
          <EmptyState
            title="No travel agents found"
            description="Try adjusting filters"
          />
        )}

        {!loading && view === "table" && sortedAgents.length > 0 && (
          <div className="border border-gray-100 rounded-xl bg-white overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50/60 text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <SortButton
                      label="Agency"
                      sortKey="agencyName"
                      sort={sort}
                      setSort={setSort}
                    />
                  </th>

                  <th className="px-4 py-3 text-left">
                    <SortButton
                      label="SPOC"
                      sortKey="spoc"
                      sort={sort}
                      setSort={setSort}
                    />
                  </th>

                  <th className="px-4 py-3 text-left">
                    <SortButton
                      label="Destinations"
                      sortKey="destinations"
                      sort={sort}
                      setSort={setSort}
                    />
                  </th>

                  <th className="px-4 py-3 text-left">
                    <SortButton
                      label="Status"
                      sortKey="status"
                      sort={sort}
                      setSort={setSort}
                    />
                  </th>

                  <th className="px-4 py-3" />
                </tr>
              </thead>

              <tbody>
                {sortedAgents.map(agent => {
                  const spoc = getPrimarySpoc(agent);
                  const agentDestinations = getAgentDestinations(agent);

                  return (
                    <tr
                      key={agent.id}
                      className="border-b border-gray-100 hover:bg-gray-50/60"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">
                          {agent.agencyName || "Unnamed agency"}
                        </p>
                        <p className="text-xs text-gray-500">
                          {agent.agentCode || "No code"}
                        </p>
                      </td>

                      <td className="px-4 py-3">
                        {spoc ? (
                          <>
                            <p>{spoc.name || "Unnamed SPOC"}</p>
                            <p className="text-xs text-gray-500">
                              {spoc.email || spoc.mobile || "No contact"}
                            </p>
                          </>
                        ) : (
                          <span className="text-xs text-gray-400">
                            No SPOC
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1 max-w-[260px]">
                          {agentDestinations.slice(0, 3).map((d, i) => (
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

                          {agentDestinations.length === 0 && (
                            <span className="text-xs text-gray-400">
                              No destinations
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <TravelAgentStatusToggle
                          agentId={agent.id}
                          currentStatus={agent.status || "inactive"}
                        />
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-3 text-xs">
                          <button
                            type="button"
                            onClick={() => setSelectedAgent(agent)}
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

        {!loading && view === "card" && sortedAgents.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {sortedAgents.map(agent => {
              const agentDestinations = getAgentDestinations(agent);

              return (
                <div
                  key={agent.id}
                  className="border border-gray-100 rounded-xl bg-white p-4 hover:bg-gray-50/50"
                >
                  <div className="flex justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-800">
                        {agent.agencyName || "Unnamed agency"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {agent.agentCode || "No code"}
                      </p>
                    </div>

                    <TravelAgentStatusToggle
                      agentId={agent.id}
                      currentStatus={agent.status || "inactive"}
                    />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1">
                    {agentDestinations.slice(0, 4).map((d, i) => (
                      <MAUChip
                        key={`${d.id}-${i}`}
                        label={d.name}
                      />
                    ))}

                    {agentDestinations.length === 0 && (
                      <span className="text-xs text-gray-400">
                        No destinations
                      </span>
                    )}
                  </div>

                  <div className="mt-4 flex gap-4 text-xs">
                    <button
                      type="button"
                      onClick={() => setSelectedAgent(agent)}
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

        {selectedAgent && (
          <AgentSideDrawer
            agent={selectedAgent}
            destinations={getAgentDestinations(selectedAgent)}
            onClose={() => setSelectedAgent(null)}
          />
        )}
      </main>
    </AdminGuard>
  );
}