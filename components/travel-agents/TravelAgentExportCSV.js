"use client";

const FIELD_ORDER = [
  "id",

  "agentCode",
  "agencyName",
  "agencyType",
  "status",
  "relationshipStage",
  "kycStatus",

  "accountManagerUid",
  "assignedTo",
  "createdByUid",

  "genericContact.email",
  "genericContact.phone",

  "address.line1",
  "address.line2",
  "address.city",
  "address.state",
  "address.country",
  "address.pincode",

  "website",
  "googleMapLink",
  "logoUrl",

  "gstNumber",
  "panNumber",

  "preferredLanguage",
  "preferredCommunication.call",
  "preferredCommunication.email",
  "preferredCommunication.whatsapp",

  "primarySpoc.name",
  "primarySpoc.email",
  "primarySpoc.mobile",
  "primarySpoc.designation",
  "primarySpoc.department",

  "allSpocNames",
  "allSpocEmails",
  "allSpocMobiles",
  "spocs",

  "destinationIds",
  "destinations",
  "productTypes",
  "strengths",
  "weaknesses",

  "team",
  "usp",
  "internalNotes",
  "avgTicketSize",

  "createdAt",
  "updatedAt",
  "importedAt",
  "importSource"
];

const isPlainObject = value =>
  value &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  !(value instanceof Date);

const isTimestampLike = value => {
  if (!value || typeof value !== "object") return false;

  return (
    typeof value.toDate === "function" ||
    typeof value.seconds === "number" ||
    typeof value._seconds === "number"
  );
};

const formatTimestamp = value => {
  try {
    if (typeof value.toDate === "function") {
      return value.toDate().toISOString();
    }

    if (typeof value.seconds === "number") {
      return new Date(value.seconds * 1000).toISOString();
    }

    if (typeof value._seconds === "number") {
      return new Date(value._seconds * 1000).toISOString();
    }
  } catch {
    return "";
  }

  return "";
};

const sanitizeForJson = value => {
  if (value === null || value === undefined) return "";

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (isTimestampLike(value)) {
    return formatTimestamp(value);
  }

  if (Array.isArray(value)) {
    return value.map(item => sanitizeForJson(item));
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        sanitizeForJson(item)
      ])
    );
  }

  return value;
};

const formatValue = value => {
  if (value === null || value === undefined) return "";

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (isTimestampLike(value)) {
    return formatTimestamp(value);
  }

  if (Array.isArray(value)) {
    const hasObject = value.some(item => isPlainObject(item));

    if (hasObject) {
      return JSON.stringify(sanitizeForJson(value));
    }

    return value
      .map(item => formatValue(item))
      .filter(Boolean)
      .join("|");
  }

  if (isPlainObject(value)) {
    return JSON.stringify(sanitizeForJson(value));
  }

  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }

  return String(value);
};

const flattenObject = (obj, prefix = "", output = {}) => {
  Object.entries(obj || {}).forEach(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;

    if (
      isPlainObject(value) &&
      !isTimestampLike(value)
    ) {
      flattenObject(value, path, output);
    } else {
      output[path] = formatValue(value);
    }
  });

  return output;
};

const getPrimarySpoc = agent =>
  agent.spocs?.find(spoc => spoc.isPrimary) ||
  agent.spocs?.[0] ||
  null;

const buildExportRow = agent => {
  const flat = flattenObject(agent);
  const primarySpoc = getPrimarySpoc(agent);

  flat["primarySpoc.name"] = formatValue(primarySpoc?.name);
  flat["primarySpoc.email"] = formatValue(primarySpoc?.email);
  flat["primarySpoc.mobile"] = formatValue(primarySpoc?.mobile);
  flat["primarySpoc.designation"] = formatValue(primarySpoc?.designation);
  flat["primarySpoc.department"] = formatValue(primarySpoc?.department);

  flat.allSpocNames = formatValue(
    (agent.spocs || []).map(spoc => spoc.name).filter(Boolean)
  );

  flat.allSpocEmails = formatValue(
    (agent.spocs || []).map(spoc => spoc.email).filter(Boolean)
  );

  flat.allSpocMobiles = formatValue(
    (agent.spocs || []).map(spoc => spoc.mobile).filter(Boolean)
  );

  flat.spocs = formatValue(agent.spocs);
  flat.destinationIds = formatValue(agent.destinationIds);
  flat.destinations = formatValue(agent.destinations);
  flat.productTypes = formatValue(agent.productTypes);
  flat.strengths = formatValue(agent.strengths);
  flat.weaknesses = formatValue(agent.weaknesses);

  return flat;
};

const escapeCsvValue = value => {
  const stringValue = value === null || value === undefined ? "" : String(value);

  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n") ||
    stringValue.includes("\r")
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
};

const downloadCsv = (filename, rows) => {
  const blob = new Blob([rows], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
};

export default function TravelAgentExportCSV({ agents = [] }) {
  const exportData = () => {
    if (!agents.length) {
      alert("No travel agents to export");
      return;
    }

    const exportRows = agents.map(agent => buildExportRow(agent));

    const dynamicHeaders = Array.from(
      new Set(exportRows.flatMap(row => Object.keys(row)))
    );

    const headers = [
      ...FIELD_ORDER,
      ...dynamicHeaders.filter(header => !FIELD_ORDER.includes(header))
    ];

    const csvRows = [
      headers.map(escapeCsvValue).join(","),
      ...exportRows.map(row =>
        headers
          .map(header => escapeCsvValue(row[header] || ""))
          .join(",")
      )
    ];

    const today = new Date().toISOString().slice(0, 10);

    downloadCsv(
      `travel-agents-export-${today}.csv`,
      csvRows.join("\n")
    );
  };

  return (
    <button
      type="button"
      onClick={exportData}
      className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 hover:bg-gray-50"
    >
      Export CSV
    </button>
  );
}