"use client";

export default function TravelAgentExportCSV({ agents }) {
  const exportCsv = () => {
    if (!agents || agents.length === 0) {
      alert("No data to export");
      return;
    }

    const headers = [
      "Agency Name",
      "Agent Code",
      "Status",
      "Agency Type",
      "Assigned To",
      "Relationship Stage",
      "Destinations",
      "Primary SPOC Name",
      "Primary SPOC Email",
      "Primary SPOC Mobile",
      "City",
      "State",
      "Country",
      "Website",
      "GST Number",
      "PAN Number"
    ];

    const rows = agents.map(agent => {
      const primarySpoc =
        agent.spocs?.find(s => s.isPrimary) ||
        agent.spocs?.[0];

      return [
        agent.agencyName || "",
        agent.agentCode || "",
        agent.status || "",
        agent.agencyType || "",
        agent.assignedTo || "",
        agent.relationshipStage || "",
        (agent.destinations || [])
          .map(d => d.name)
          .join(" | "),
        primarySpoc?.name || "",
        primarySpoc?.email || "",
        primarySpoc?.mobile || "",
        agent.address?.city || "",
        agent.address?.state || "",
        agent.address?.country || "",
        agent.website || "",
        agent.gstNumber || "",
        agent.panNumber || ""
      ];
    });

    const csvContent =
      [headers, ...rows]
        .map(r =>
          r
            .map(v =>
              `"${String(v).replace(/"/g, '""')}"`
            )
            .join(",")
        )
        .join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "travel_agents.csv";
    link.click();

    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={exportCsv}
      className="bg-green-600 text-white px-4 py-2 rounded text-sm"
    >
      Export CSV
    </button>
  );
}
