"use client";

import TravelAgentStatusToggle from "./TravelAgentStatusToggle";

export default function AgentSideDrawer({
  agent,
  destinations,
  onClose
}) {
  if (!agent) return null;

  const spoc =
    agent.spocs?.find(x => x.isPrimary) ||
    agent.spocs?.[0];

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* BACKDROP */}
      <div
        className="flex-1 bg-black/20"
        onClick={onClose}
      />

      {/* DRAWER */}
      <aside className="
        w-full max-w-md
        bg-white h-full
        border-l border-gray-200
        p-5 overflow-y-auto
      ">
        {/* HEADER */}
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-lg font-semibold">
              {agent.agencyName}
            </h2>
            <p className="text-xs text-gray-500">
              {agent.agentCode}
            </p>
          </div>

          <TravelAgentStatusToggle
            agentId={agent.id}
            currentStatus={agent.status}
          />
        </div>

        {/* SPOC */}
        {spoc && (
          <div className="mt-4">
            <p className="text-xs text-gray-400">
              Primary SPOC
            </p>
            <p className="text-sm">{spoc.name}</p>
            <p className="text-xs text-gray-500">
              {spoc.email || spoc.mobile}
            </p>
          </div>
        )}

        {/* DESTINATIONS */}
        <div className="mt-4">
          <p className="text-xs text-gray-400 mb-1">
            Destinations
          </p>
          <div className="flex flex-wrap gap-1">
            {destinations.map((d, i) => (
              <span
                key={`${d.id}-${i}`}
                className="px-2 py-[2px] text-[11px] bg-slate-100 rounded"
              >
                {d.name}
              </span>
            ))}
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-4 border-t border-gray-100 mt-4 pt-4">
          <KPI label="Leads" value={agent.totalLeads || 0} />
          <KPI label="Revenue" value={`₹${agent.totalRevenue || 0}`} />
          <KPI label="Conversion" value={`${agent.conversionRate || 0}%`} />
        </div>

        {/* META */}
        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
          {agent.agencyType && (
            <Meta label="Agency Type" value={agent.agencyType} />
          )}
          {agent.relationshipStage && (
            <Meta label="Relationship" value={agent.relationshipStage} />
          )}
        </div>
      </aside>
    </div>
  );
}

const KPI = ({ label, value }) => (
  <div>
    <p className="text-[11px] text-gray-400">{label}</p>
    <p className="text-sm font-semibold text-gray-800">{value}</p>
  </div>
);

const Meta = ({ label, value }) => (
  <div>
    <p className="text-gray-400">{label}</p>
    <p className="text-gray-700">{value}</p>
  </div>
);
