export const LEAD_CLOSING_POTENTIAL = {
  HOT: "hot",
  WARM: "warm",
  COLD: "cold",
  AT_RISK: "at_risk"
};

export const LEAD_CLOSING_POTENTIAL_OPTIONS = [
  { value: LEAD_CLOSING_POTENTIAL.HOT, label: "Hot / High", tone: "rose" },
  { value: LEAD_CLOSING_POTENTIAL.WARM, label: "Warm / Medium", tone: "amber" },
  { value: LEAD_CLOSING_POTENTIAL.COLD, label: "Cold / Low", tone: "slate" },
  { value: LEAD_CLOSING_POTENTIAL.AT_RISK, label: "At Risk", tone: "red" }
];

const normalize = value => String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");

export function normalizeLeadClosingPotential(leadOrValue) {
  if (typeof leadOrValue === "string") {
    const raw = normalize(leadOrValue);
    if (["hot", "high", "hot_lead"].includes(raw)) return LEAD_CLOSING_POTENTIAL.HOT;
    if (["warm", "medium"].includes(raw)) return LEAD_CLOSING_POTENTIAL.WARM;
    if (["cold", "low"].includes(raw)) return LEAD_CLOSING_POTENTIAL.COLD;
    if (["at_risk", "risk", "stalled"].includes(raw)) return LEAD_CLOSING_POTENTIAL.AT_RISK;
    return LEAD_CLOSING_POTENTIAL.WARM;
  }

  const lead = leadOrValue || {};
  return normalizeLeadClosingPotential(
    lead.closingPotential ||
      lead.leadPotential ||
      lead.potential ||
      (String(lead.stage || "").toLowerCase() === "hot_lead" ? "hot" : "warm")
  );
}

export function getLeadClosingPotentialMeta(leadOrValue) {
  const value = normalizeLeadClosingPotential(leadOrValue);
  return LEAD_CLOSING_POTENTIAL_OPTIONS.find(option => option.value === value) || LEAD_CLOSING_POTENTIAL_OPTIONS[1];
}
