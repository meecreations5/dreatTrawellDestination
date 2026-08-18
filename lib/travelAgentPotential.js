export const TRAVEL_AGENT_POTENTIAL = {
  UNASSESSED: "unassessed",
  HIGH: "a_high",
  GOOD: "b_good",
  DEVELOPING: "c_developing",
  LOW: "d_low"
};

export const TRAVEL_AGENT_POTENTIAL_OPTIONS = [
  { value: TRAVEL_AGENT_POTENTIAL.UNASSESSED, label: "New / Unassessed", shortLabel: "New", tone: "slate" },
  { value: TRAVEL_AGENT_POTENTIAL.HIGH, label: "A - High Potential", shortLabel: "A", tone: "emerald" },
  { value: TRAVEL_AGENT_POTENTIAL.GOOD, label: "B - Good Potential", shortLabel: "B", tone: "blue" },
  { value: TRAVEL_AGENT_POTENTIAL.DEVELOPING, label: "C - Developing", shortLabel: "C", tone: "amber" },
  { value: TRAVEL_AGENT_POTENTIAL.LOW, label: "D - Low / Dormant", shortLabel: "D", tone: "rose" }
];

const normalize = value => String(value || "").trim().toLowerCase();

export function normalizeTravelAgentPotential(agentOrValue) {
  if (typeof agentOrValue === "string") {
    const raw = normalize(agentOrValue);
    if (TRAVEL_AGENT_POTENTIAL_OPTIONS.some(option => option.value === raw)) return raw;
    if (["a+", "a", "very high", "very_high", "high"].includes(raw)) return TRAVEL_AGENT_POTENTIAL.HIGH;
    if (["b", "medium", "good"].includes(raw)) return TRAVEL_AGENT_POTENTIAL.GOOD;
    if (["c", "developing"].includes(raw)) return TRAVEL_AGENT_POTENTIAL.DEVELOPING;
    if (["d", "low", "dormant"].includes(raw)) return TRAVEL_AGENT_POTENTIAL.LOW;
    return TRAVEL_AGENT_POTENTIAL.UNASSESSED;
  }

  const agent = agentOrValue || {};
  return normalizeTravelAgentPotential(
    agent.potentialLevel ||
      agent.travelAgentPotential ||
      agent.potential ||
      agent.businessPotential ||
      agent.agentCategory ||
      ""
  );
}

export function getTravelAgentPotentialMeta(agentOrValue) {
  const value = normalizeTravelAgentPotential(agentOrValue);
  return TRAVEL_AGENT_POTENTIAL_OPTIONS.find(option => option.value === value) || TRAVEL_AGENT_POTENTIAL_OPTIONS[0];
}
