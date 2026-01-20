export function exportLeadsCsv(leads = []) {
  if (!leads.length) return;

  const headers = [
    "Lead Code",
    "Stage",
    "Assigned To",
    "Destination",
    "Next Action",
    "Created At"
  ];

  const rows = leads.map(l => [
    l.leadCode,
    l.stage,
    l.assignedTo || "",
    l.destinationName || "",
    l.nextActionAt?.toDate?.().toLocaleString() || "",
    l.createdAt?.toDate?.().toLocaleString() || ""
  ]);

  const csv =
    [headers, ...rows]
      .map(r =>
        r.map(v => `"${v || ""}"`).join(",")
      )
      .join("\n");

  const blob = new Blob([csv], {
    type: "text/csv"
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "admin-leads.csv";
  a.click();
}
