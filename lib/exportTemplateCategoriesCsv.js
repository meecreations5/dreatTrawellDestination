export function exportTemplateCategoriesCsv(categories = []) {
  if (!categories.length) {
    alert("No categories to export");
    return;
  }

  const headers = [
    "Name",
    "Code",
    "Active",
    "Require Attachment",
    "Created At"
  ];

  const rows = categories.map(c => [
    c.name || "",
    c.code || "",
    c.active ? "Yes" : "No",
    c.rules?.requireAttachment ? "Yes" : "No",
    c.createdAt?.toDate
      ? c.createdAt.toDate().toISOString()
      : ""
  ]);

  const csv = [
    headers.join(","),
    ...rows.map(r =>
      r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")
    )
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `template-categories-${Date.now()}.csv`;
  link.click();

  URL.revokeObjectURL(url);
}
