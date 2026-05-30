"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import AdminGuard from "@/components/AdminGuard";
import { generateTravelAgentCode } from "@/lib/generateTravelAgentCode";

const TEMPLATE_HEADERS = [
  "Agency Name",
  "Agency Type",
  "Website",
  "Status",
  "Phone",
  "Email",
  "Address Line 1",
  "Address Line 2",
  "City",
  "State",
  "Country",
  "Pincode",
  "SPOC Name",
  "SPOC Email",
  "SPOC Mobile",
  "SPOC Designation",
  "SPOC Department",
  "Relationship Stage",
  "KYC Status",
  "Destination IDs",
  "Destinations",
  "Product Types",
  "Strengths",
  "Weaknesses",
  "Preferred Language",
  "Preferred Call",
  "Preferred Email",
  "Preferred Whatsapp",
  "GST Number",
  "PAN Number",
  "Google Map Link",
  "Team",
  "USP",
  "Internal Notes",
  "Avg Ticket Size"
];

const TEMPLATE_CSV = `${TEMPLATE_HEADERS.join(",")}
Geo Holidays,,https://geoholidays.in,active,9893887773,akash@geoholidays.in,Bhopal,,Bhopal,,India,,Akash,akash@geoholidays.in,9893887773,,,New,Pending,,,Tours|Packages,,,English,false,true,true,,,,,,,`;

const clean = value => String(value || "").trim();

const normalize = value => clean(value).toLowerCase();

const normalizePhone = value => clean(value).replace(/\D/g, "");

const toBool = value => {
  const v = normalize(value);
  return ["true", "yes", "1", "y"].includes(v);
};

const toNumberOrNull = value => {
  const v = clean(value);
  if (!v) return null;

  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const toArray = value => {
  if (!value) return [];

  return String(value)
    .split("|")
    .map(item => item.trim())
    .filter(Boolean);
};

const pick = (row, keys, fallback = "") => {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== "") {
      return row[key];
    }
  }

  return fallback;
};

const splitCsvLine = line => {
  const result = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"' && nextChar === '"') {
      current += '"';
      i++;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === "," && !insideQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result;
};

const parseCsv = text => {
  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const headers = splitCsvLine(lines[0]).map(header => header.trim());

  return lines.slice(1).map((line, index) => {
    const values = splitCsvLine(line);

    const row = {
      _rowId: crypto.randomUUID(),
      _rowNumber: index + 2
    };

    headers.forEach((header, i) => {
      row[header] = values[i]?.replace(/^"|"$/g, "") || "";
    });

    return row;
  });
};

const getPrimarySpoc = agent =>
  agent.spocs?.find(spoc => spoc.isPrimary) || agent.spocs?.[0] || null;

const buildExistingIndexes = agents => {
  const emailMap = new Map();
  const phoneMap = new Map();

  agents.forEach(agent => {
    const spoc = getPrimarySpoc(agent);

    const emails = [
      agent.genericContact?.email,
      spoc?.email,
      ...(agent.spocs || []).map(item => item.email)
    ]
      .map(normalize)
      .filter(Boolean);

    const phones = [
      agent.genericContact?.phone,
      spoc?.mobile,
      ...(agent.spocs || []).map(item => item.mobile)
    ]
      .map(normalizePhone)
      .filter(Boolean);

    emails.forEach(email => {
      if (!emailMap.has(email)) {
        emailMap.set(email, agent);
      }
    });

    phones.forEach(phone => {
      if (!phoneMap.has(phone)) {
        phoneMap.set(phone, agent);
      }
    });
  });

  return {
    emailMap,
    phoneMap
  };
};

const getRowBasics = row => {
  const agencyName = clean(pick(row, ["Agency Name", "agencyName"]));

  const email = clean(
    pick(row, ["Email", "genericEmail"]) ||
      pick(row, ["SPOC Email", "spocEmail"])
  );

  const phone = clean(
    pick(row, ["Phone", "genericPhone"]) ||
      pick(row, ["SPOC Mobile", "spocMobile"])
  );

  return {
    agencyName,
    email,
    phone
  };
};

const compareWithExisting = (row, existingAgent) => {
  if (!existingAgent) return [];

  const spoc = getPrimarySpoc(existingAgent);
  const changes = [];

  const compare = (label, csvValue, existingValue) => {
    const csv = clean(csvValue);
    const existing = clean(existingValue);

    if (csv && normalize(csv) !== normalize(existing)) {
      changes.push(`${label}: ${existing || "-"} -> ${csv}`);
    }
  };

  compare(
    "Agency Name",
    pick(row, ["Agency Name", "agencyName"]),
    existingAgent.agencyName
  );

  compare(
    "Agency Type",
    pick(row, ["Agency Type", "agencyType"]),
    existingAgent.agencyType
  );

  compare(
    "Status",
    pick(row, ["Status", "status"]),
    existingAgent.status
  );

  compare(
    "Email",
    pick(row, ["Email", "genericEmail"]),
    existingAgent.genericContact?.email
  );

  compare(
    "Phone",
    pick(row, ["Phone", "genericPhone"]),
    existingAgent.genericContact?.phone
  );

  compare(
    "City",
    pick(row, ["City", "city"]),
    existingAgent.address?.city
  );

  compare(
    "State",
    pick(row, ["State", "state"]),
    existingAgent.address?.state
  );

  compare(
    "SPOC Name",
    pick(row, ["SPOC Name", "spocName"]),
    spoc?.name
  );

  compare(
    "SPOC Email",
    pick(row, ["SPOC Email", "spocEmail"]),
    spoc?.email
  );

  compare(
    "SPOC Mobile",
    pick(row, ["SPOC Mobile", "spocMobile"]),
    spoc?.mobile
  );

  return changes;
};

const analyzeRows = (rows, existingAgents) => {
  const indexes = buildExistingIndexes(existingAgents);

  const csvEmailCount = new Map();
  const csvPhoneCount = new Map();

  rows.forEach(row => {
    const { email, phone } = getRowBasics(row);

    const emailKey = normalize(email);
    const phoneKey = normalizePhone(phone);

    if (emailKey) {
      csvEmailCount.set(
        emailKey,
        (csvEmailCount.get(emailKey) || 0) + 1
      );
    }

    if (phoneKey) {
      csvPhoneCount.set(
        phoneKey,
        (csvPhoneCount.get(phoneKey) || 0) + 1
      );
    }
  });

  return rows.map(row => {
    const errors = [];
    const warnings = [];
    const matchTypes = [];

    const { agencyName, email, phone } = getRowBasics(row);

    const emailKey = normalize(email);
    const phoneKey = normalizePhone(phone);

    if (!agencyName) {
      errors.push("Agency Name is required");
    }

    if (!email && !phone) {
      warnings.push("No email or mobile number found");
    }

    const status = normalize(pick(row, ["Status", "status"]));

    if (status && !["active", "inactive"].includes(status)) {
      warnings.push(
        "Status should be active or inactive. It will be saved as active."
      );
    }

    if (emailKey && csvEmailCount.get(emailKey) > 1) {
      errors.push("Duplicate Email inside CSV");
      matchTypes.push("Email");
    }

    if (phoneKey && csvPhoneCount.get(phoneKey) > 1) {
      errors.push("Duplicate Mobile Number inside CSV");
      matchTypes.push("Mobile");
    }

    const existingByEmail = emailKey
      ? indexes.emailMap.get(emailKey)
      : null;

    const existingByPhone = phoneKey
      ? indexes.phoneMap.get(phoneKey)
      : null;

    if (existingByEmail) {
      errors.push("Email already exists");
      matchTypes.push("Email");
    }

    if (existingByPhone) {
      errors.push("Mobile Number already exists");
      matchTypes.push("Mobile");
    }

    const existingAgent =
      existingByEmail || existingByPhone || null;

    const compareChanges = compareWithExisting(row, existingAgent);

    let validationStatus = "ready";

    if (errors.length > 0) {
      validationStatus = "blocked";
    } else if (warnings.length > 0) {
      validationStatus = "review";
    }

    return {
      ...row,
      _analysis: {
        validationStatus,
        uploadStatus: "pending",
        uploadMessage: "",
        generatedAgentCode: "",
        errors,
        warnings,
        matchTypes: [...new Set(matchTypes)],
        existingAgent,
        compareChanges
      }
    };
  });
};

const buildAgentPayload = async row => {
  const agencyName = clean(pick(row, ["Agency Name", "agencyName"]));

  const spocName = clean(pick(row, ["SPOC Name", "spocName"]));
  const spocEmail = clean(pick(row, ["SPOC Email", "spocEmail"]));
  const spocMobile = clean(pick(row, ["SPOC Mobile", "spocMobile"]));

  const genericEmail = clean(pick(row, ["Email", "genericEmail"]));
  const genericPhone = clean(pick(row, ["Phone", "genericPhone"]));

  const generatedAgentCode = await generateTravelAgentCode();

  return {
    accountManagerUid: clean(
      pick(row, ["Account Manager UID", "accountManagerUid"])
    ),

    address: {
      city: clean(pick(row, ["City", "city"])),
      country: clean(pick(row, ["Country", "country"], "India")) || "India",
      line1: clean(pick(row, ["Address Line 1", "line1"])),
      line2: clean(pick(row, ["Address Line 2", "line2"])),
      pincode: clean(pick(row, ["Pincode", "pincode"])),
      state: clean(pick(row, ["State", "state"]))
    },

    agencyName,
    agencyType: clean(pick(row, ["Agency Type", "agencyType"])),
    agentCode: generatedAgentCode,
    assignedTo: clean(pick(row, ["Assigned To", "assignedTo"])),

    avgTicketSize: toNumberOrNull(
      pick(row, ["Avg Ticket Size", "avgTicketSize"])
    ),

    createdAt: serverTimestamp(),
    createdByUid: clean(pick(row, ["Created By UID", "createdByUid"])),

    destinationIds: toArray(
      pick(row, ["Destination IDs", "destinationIds"])
    ),

    destinations: toArray(
      pick(row, ["Destinations", "destinations"])
    ),

    genericContact: {
      email: genericEmail || spocEmail,
      phone: genericPhone || spocMobile
    },

    googleMapLink: clean(
      pick(row, ["Google Map Link", "googleMapLink"])
    ),

    gstNumber: clean(pick(row, ["GST Number", "gstNumber"])),
    internalNotes: clean(
      pick(row, ["Internal Notes", "internalNotes"])
    ),

    kycStatus:
      clean(pick(row, ["KYC Status", "kycStatus"])) || "Pending",

    logoUrl: clean(pick(row, ["Logo URL", "logoUrl"])),
    panNumber: clean(pick(row, ["PAN Number", "panNumber"])),

    preferredCommunication: {
      call: toBool(pick(row, ["Preferred Call", "preferredCall"])),
      email:
        clean(pick(row, ["Preferred Email", "preferredEmail"])) === ""
          ? true
          : toBool(pick(row, ["Preferred Email", "preferredEmail"])),
      whatsapp:
        clean(pick(row, ["Preferred Whatsapp", "preferredWhatsapp"])) === ""
          ? true
          : toBool(
              pick(row, ["Preferred Whatsapp", "preferredWhatsapp"])
            )
    },

    preferredLanguage:
      clean(
        pick(row, ["Preferred Language", "preferredLanguage"])
      ) || "English",

    productTypes: toArray(
      pick(row, ["Product Types", "productTypes"])
    ),

    relationshipStage:
      clean(
        pick(row, ["Relationship Stage", "relationshipStage"])
      ) || "New",

    spocs:
      spocName || spocEmail || spocMobile
        ? [
            {
              department: clean(
                pick(row, ["SPOC Department", "spocDepartment"])
              ),
              designation: clean(
                pick(row, ["SPOC Designation", "spocDesignation"])
              ),
              email: spocEmail,
              isPrimary: true,
              mobile: spocMobile,
              name: spocName
            }
          ]
        : [],

    status:
      clean(pick(row, ["Status", "status"])).toLowerCase() === "inactive"
        ? "inactive"
        : "active",

    strengths: toArray(pick(row, ["Strengths", "strengths"])),
    team: clean(pick(row, ["Team", "team"])),

    updatedAt: serverTimestamp(),
    importedAt: serverTimestamp(),
    importSource: "csv",

    usp: clean(pick(row, ["USP", "usp"])),
    weaknesses: toArray(pick(row, ["Weaknesses", "weaknesses"])),
    website: clean(pick(row, ["Website", "website"]))
  };
};

const StatusBadge = ({ type, children }) => {
  const className =
    type === "ready"
      ? "bg-green-50 text-green-700 border-green-100"
      : type === "review"
        ? "bg-amber-50 text-amber-700 border-amber-100"
        : type === "blocked" || type === "failed"
          ? "bg-red-50 text-red-700 border-red-100"
          : type === "uploaded"
            ? "bg-blue-50 text-blue-700 border-blue-100"
            : type === "uploading"
              ? "bg-purple-50 text-purple-700 border-purple-100"
              : "bg-gray-50 text-gray-600 border-gray-100";

  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] ${className}`}
    >
      {children}
    </span>
  );
};

export default function TravelAgentBulkUploadPage() {
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  const stats = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        const validationStatus = row._analysis?.validationStatus;
        const uploadStatus = row._analysis?.uploadStatus;

        acc.total += 1;

        if (validationStatus === "ready") acc.ready += 1;
        if (validationStatus === "review") acc.review += 1;
        if (validationStatus === "blocked") acc.blocked += 1;

        if (uploadStatus === "uploaded") acc.uploaded += 1;
        if (uploadStatus === "failed") acc.failed += 1;

        return acc;
      },
      {
        total: 0,
        ready: 0,
        review: 0,
        blocked: 0,
        uploaded: 0,
        failed: 0
      }
    );
  }, [rows]);

  const importableCount = stats.ready + stats.review;

  const updateRowAnalysis = (rowId, patch) => {
    setRows(prev =>
      prev.map(row =>
        row._rowId === rowId
          ? {
              ...row,
              _analysis: {
                ...row._analysis,
                ...patch
              }
            }
          : row
      )
    );
  };

  const handleFileChange = async event => {
    const file = event.target.files?.[0];

    if (!file) return;

    setLoading(true);
    setFileName(file.name);
    setRows([]);

    try {
      const text = await file.text();
      const parsedRows = parseCsv(text);

      if (!parsedRows.length) {
        alert("CSV file is empty");
        return;
      }

      const existingSnap = await getDocs(collection(db, "travelAgents"));

      const existingAgents = existingSnap.docs.map(item => ({
        id: item.id,
        ...item.data()
      }));

      const analyzed = analyzeRows(parsedRows, existingAgents);

      setRows(analyzed);
    } catch (error) {
      console.error("CSV analysis failed:", error);
      alert("Could not analyze CSV");
    } finally {
      setLoading(false);
    }
  };

  const importValidRows = async () => {
    const validRows = rows.filter(row =>
      ["ready", "review"].includes(row._analysis?.validationStatus)
    );

    if (!validRows.length) {
      alert("No valid rows to import");
      return;
    }

    setImporting(true);

    try {
      for (const row of validRows) {
        updateRowAnalysis(row._rowId, {
          uploadStatus: "uploading",
          uploadMessage: "Generating code and uploading..."
        });

        try {
          const payload = await buildAgentPayload(row);
          const ref = doc(collection(db, "travelAgents"));

          await setDoc(ref, payload);

          updateRowAnalysis(row._rowId, {
            uploadStatus: "uploaded",
            uploadMessage: `Uploaded as ${payload.agentCode}`,
            generatedAgentCode: payload.agentCode
          });
        } catch (error) {
          console.error("Row upload failed:", error);

          updateRowAnalysis(row._rowId, {
            uploadStatus: "failed",
            uploadMessage: error?.message || "Upload failed"
          });
        }
      }

      alert("Bulk upload completed");
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setFileName("");
    setRows([]);
  };

  return (
    <AdminGuard>
      <main className="p-6 w-full mx-auto space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-800">
              Bulk Upload Travel Agents
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Upload, validate duplicate email/mobile, then import valid
              records. Agent codes are auto-generated during upload.
            </p>
          </div>

          <Link
            href="/admin/travel-agents"
            className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 hover:bg-gray-50 inline-flex items-center"
          >
            Back to Travel Agents
          </Link>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-800">
                Upload CSV file
              </p>
              <p className="text-xs text-gray-500">
                Duplicate check is based only on Email ID and Mobile Number.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <a
                href={`data:text/csv;charset=utf-8,${encodeURIComponent(
                  TEMPLATE_CSV
                )}`}
                download="travel-agent-bulk-upload-template.csv"
                className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 hover:bg-gray-50 inline-flex items-center"
              >
                Download Template
              </a>

              <label className="h-9 rounded-lg bg-gray-900 px-3 text-sm text-white hover:bg-gray-800 inline-flex items-center cursor-pointer">
                Choose CSV
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={loading || importing}
                />
              </label>

              {rows.length > 0 && (
                <button
                  type="button"
                  onClick={reset}
                  disabled={importing}
                  className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {fileName && (
            <div className="text-xs text-gray-500">
              Selected file:{" "}
              <span className="font-medium text-gray-700">
                {fileName}
              </span>
            </div>
          )}
        </div>

        {loading && (
          <div className="rounded-xl border border-gray-100 bg-white p-4 text-sm text-gray-500">
            Validating CSV and checking duplicate email/mobile...
          </div>
        )}

        {rows.length > 0 && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <div className="rounded-xl border border-gray-100 bg-white p-3">
                <p className="text-xs text-gray-500">Total</p>
                <p className="text-lg font-semibold text-gray-800">
                  {stats.total}
                </p>
              </div>

              <div className="rounded-xl border border-green-100 bg-white p-3">
                <p className="text-xs text-gray-500">Ready</p>
                <p className="text-lg font-semibold text-green-700">
                  {stats.ready}
                </p>
              </div>

              <div className="rounded-xl border border-amber-100 bg-white p-3">
                <p className="text-xs text-gray-500">Review</p>
                <p className="text-lg font-semibold text-amber-700">
                  {stats.review}
                </p>
              </div>

              <div className="rounded-xl border border-red-100 bg-white p-3">
                <p className="text-xs text-gray-500">Blocked</p>
                <p className="text-lg font-semibold text-red-700">
                  {stats.blocked}
                </p>
              </div>

              <div className="rounded-xl border border-blue-100 bg-white p-3">
                <p className="text-xs text-gray-500">Uploaded</p>
                <p className="text-lg font-semibold text-blue-700">
                  {stats.uploaded}
                </p>
              </div>

              <div className="rounded-xl border border-red-100 bg-white p-3">
                <p className="text-xs text-gray-500">Failed</p>
                <p className="text-lg font-semibold text-red-700">
                  {stats.failed}
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={importValidRows}
                disabled={importing || importableCount === 0}
                className="h-10 rounded-lg bg-blue-600 px-4 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {importing
                  ? "Uploading..."
                  : `Upload Valid Rows (${importableCount})`}
              </button>
            </div>

            <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
              <div className="max-h-[620px] overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50 text-xs text-gray-500 z-10">
                    <tr>
                      <th className="px-3 py-3 text-left">Row</th>
                      <th className="px-3 py-3 text-left">Agency</th>
                      <th className="px-3 py-3 text-left">Agent Code</th>
                      <th className="px-3 py-3 text-left">Contact</th>
                      <th className="px-3 py-3 text-left">
                        Email/Mobile Match
                      </th>
                      <th className="px-3 py-3 text-left">Compare</th>
                      <th className="px-3 py-3 text-left">Validation</th>
                      <th className="px-3 py-3 text-left">Upload Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {rows.map(row => {
                      const analysis = row._analysis;
                      const basics = getRowBasics(row);

                      return (
                        <tr
                          key={row._rowId}
                          className="border-t border-gray-100 align-top"
                        >
                          <td className="px-3 py-3 text-xs text-gray-500">
                            {row._rowNumber}
                          </td>

                          <td className="px-3 py-3">
                            <p className="font-medium text-gray-800">
                              {basics.agencyName || "-"}
                            </p>
                            <p className="text-xs text-gray-500">
                              {clean(pick(row, ["City", "city"])) || "No city"}
                            </p>
                          </td>

                          <td className="px-3 py-3">
                            {analysis.generatedAgentCode ? (
                              <span className="text-sm text-gray-800">
                                {analysis.generatedAgentCode}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">
                                Auto generated on upload
                              </span>
                            )}
                          </td>

                          <td className="px-3 py-3">
                            <p className="text-xs text-gray-700">
                              {basics.email || "No email"}
                            </p>
                            <p className="text-xs text-gray-500">
                              {basics.phone || "No mobile"}
                            </p>
                          </td>

                          <td className="px-3 py-3">
                            {analysis.matchTypes.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {analysis.matchTypes.map(type => (
                                  <StatusBadge key={type} type="blocked">
                                    {type}
                                  </StatusBadge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">
                                No match
                              </span>
                            )}
                          </td>

                          <td className="px-3 py-3 min-w-[240px]">
                            {analysis.compareChanges.length > 0 ? (
                              <div className="space-y-1">
                                {analysis.compareChanges
                                  .slice(0, 3)
                                  .map(change => (
                                    <p
                                      key={change}
                                      className="text-xs text-gray-600"
                                    >
                                      {change}
                                    </p>
                                  ))}

                                {analysis.compareChanges.length > 3 && (
                                  <p className="text-xs text-gray-400">
                                    +{analysis.compareChanges.length - 3} more
                                    changes
                                  </p>
                                )}
                              </div>
                            ) : analysis.existingAgent ? (
                              <span className="text-xs text-gray-400">
                                Existing record looks same
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">
                                New record
                              </span>
                            )}
                          </td>

                          <td className="px-3 py-3 min-w-[220px]">
                            <div className="space-y-2">
                              <StatusBadge type={analysis.validationStatus}>
                                {analysis.validationStatus === "ready"
                                  ? "Ready"
                                  : analysis.validationStatus === "review"
                                    ? "Review"
                                    : "Blocked"}
                              </StatusBadge>

                              {analysis.errors.length > 0 && (
                                <div className="space-y-1">
                                  {analysis.errors.map(error => (
                                    <p
                                      key={error}
                                      className="text-xs text-red-600"
                                    >
                                      {error}
                                    </p>
                                  ))}
                                </div>
                              )}

                              {analysis.warnings.length > 0 && (
                                <div className="space-y-1">
                                  {analysis.warnings.map(warning => (
                                    <p
                                      key={warning}
                                      className="text-xs text-amber-600"
                                    >
                                      {warning}
                                    </p>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>

                          <td className="px-3 py-3 min-w-[170px]">
                            <div className="space-y-1">
                              <StatusBadge type={analysis.uploadStatus}>
                                {analysis.uploadStatus}
                              </StatusBadge>

                              {analysis.uploadMessage && (
                                <p className="text-xs text-gray-500">
                                  {analysis.uploadMessage}
                                </p>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </AdminGuard>
  );
}