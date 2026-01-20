// lib/generateLeadCode.js

function sanitize(text = "") {
  return text
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "_")
    .substring(0, 20);
}

export function generateLeadCode({
  destination,
  agentName
}) {
  const date = new Date().toISOString().split("T")[0];
  const rand = Math.floor(1000 + Math.random() * 9000);

  const safeDestination = sanitize(destination || "NA");
  const safeAgent = sanitize(agentName || "AGENT");

  return `DT-LD-${date}-${safeDestination}-${rand}-${safeAgent}`;
}
