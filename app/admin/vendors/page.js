"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query
} from "firebase/firestore";

import {
  AlertCircle,
  Building2,
  Download,
  Edit3,
  Eye,
  FileDown,
  Grid3X3,
  List,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UploadCloud,
  Users,
  X
} from "lucide-react";

import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";

import VendorStatusChip from "@/components/vendors/VendorStatusChip";
import { saveVendor } from "@/lib/saveVendor";

import {
  VENDOR_STATUS,
  VENDOR_STATUS_OPTIONS,
  VENDOR_TYPE_OPTIONS,
  VENDOR_TYPES,
  getVendorTypeLabel
} from "@/lib/vendorConstants";

/* =========================
   CSV CONFIG
========================= */

const CSV_HEADERS = [
  "Vendor Name",
  "Vendor Type",
  "Location Type",
  "Status",
  "Contact Person",
  "Designation",
  "Email",
  "Mobile",
  "WhatsApp",
  "Website",
  "Country",
  "State",
  "City",
  "Pincode",
  "Destinations",
  "Services",
  "GST Number",
  "PAN Number",
  "Payment Terms",
  "Credit Days",
  "Bank Name",
  "Account Name",
  "Account Number",
  "Branch Name",
  "IFSC Code",
  "UPI ID",
  "Notes"
];

/* =========================
   HELPERS
========================= */

function safeText(value = "") {
  return String(value || "").trim();
}

function isSuperAdminUser(user) {
  const role = String(
    user?.role ||
      user?.userRole ||
      user?.customClaims?.role ||
      ""
  ).toLowerCase();

  return (
    role === "super_admin" ||
    role === "superadmin" ||
    role === "super admin" ||
    user?.isSuperAdmin === true
  );
}

function formatDate(value) {
  if (!value) return "—";

  const date = value?.toDate ? value.toDate() : new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function getDestinationText(vendor) {
  const destinations =
    vendor.destinations ||
    vendor.destinationNames ||
    [];

  if (!Array.isArray(destinations) || destinations.length === 0) {
    return "No destination mapped";
  }

  return destinations.join(", ");
}

function getServiceText(vendor) {
  const services = vendor.services || [];

  if (!Array.isArray(services) || services.length === 0) {
    return "No services added";
  }

  return services.join(", ");
}

function getLocationText(vendor) {
  const parts = [
    vendor.postOfficeName,
    vendor.city || vendor.district,
    vendor.state,
    vendor.country
  ].filter(Boolean);

  if (parts.length === 0) return "No location added";

  return parts.join(", ");
}

function getSearchBlob(vendor) {
  return [
    vendor.vendorName,
    vendor.vendorCode,
    vendor.vendorType,
    vendor.status,
    vendor.contactPerson,
    vendor.designation,
    vendor.email,
    vendor.mobile,
    vendor.whatsapp,
    vendor.website,
    vendor.city,
    vendor.district,
    vendor.state,
    vendor.country,
    vendor.pincode,
    vendor.postOfficeName,
    vendor.gstNumber,
    vendor.panNumber,
    ...(vendor.destinations || []),
    ...(vendor.destinationNames || []),
    ...(vendor.services || [])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function splitMultiValue(value = "") {
  const clean = safeText(value);

  if (!clean) return [];

  const separator = clean.includes("|")
    ? "|"
    : clean.includes(";")
      ? ";"
      : ",";

  return clean
    .split(separator)
    .map(item => safeText(item))
    .filter(Boolean);
}

function normalizeCsvKey(value = "") {
  return safeText(value)
    .replace(/^\uFEFF/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getCsvValue(row, keys = []) {
  for (const key of keys) {
    const normalizedKey = normalizeCsvKey(key);

    if (row[normalizedKey] !== undefined) {
      return safeText(row[normalizedKey]);
    }
  }

  return "";
}

function escapeCsvValue(value = "") {
  const clean = String(value ?? "");

  if (
    clean.includes(",") ||
    clean.includes('"') ||
    clean.includes("\n") ||
    clean.includes("\r")
  ) {
    return `"${clean.replaceAll('"', '""')}"`;
  }

  return clean;
}

function parseCsv(text = "") {
  const rows = [];
  let currentRow = [];
  let currentValue = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      currentValue += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      currentRow.push(currentValue);
      currentValue = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }

      currentRow.push(currentValue);

      if (currentRow.some(cell => safeText(cell))) {
        rows.push(currentRow);
      }

      currentRow = [];
      currentValue = "";
      continue;
    }

    currentValue += char;
  }

  currentRow.push(currentValue);

  if (currentRow.some(cell => safeText(cell))) {
    rows.push(currentRow);
  }

  if (rows.length <= 1) return [];

  const headers = rows[0].map(normalizeCsvKey);

  return rows.slice(1).map(row => {
    const record = {};

    headers.forEach((header, index) => {
      record[header] = safeText(row[index] || "");
    });

    return record;
  });
}

function downloadTextFile(filename, text, type = "text/plain;charset=utf-8;") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

function downloadCsv(filename, rows) {
  const csv = [
    CSV_HEADERS.map(escapeCsvValue).join(","),
    ...rows.map(row =>
      CSV_HEADERS.map(header => escapeCsvValue(row[header] || "")).join(",")
    )
  ].join("\n");

  downloadTextFile(filename, csv, "text/csv;charset=utf-8;");
}

function normalizeVendorType(value = "") {
  const clean = safeText(value).toLowerCase();

  if (!clean) return VENDOR_TYPES.DMC;

  if (Object.values(VENDOR_TYPES).includes(clean)) return clean;

  if (clean.includes("dmc") || clean.includes("destination")) {
    return VENDOR_TYPES.DMC;
  }

  if (clean.includes("hotel") || clean.includes("resort")) {
    return VENDOR_TYPES.HOTEL;
  }

  if (clean.includes("transport") || clean.includes("transfer")) {
    return VENDOR_TYPES.TRANSPORT;
  }

  if (clean.includes("activity") || clean.includes("sightseeing")) {
    return VENDOR_TYPES.ACTIVITY;
  }

  if (clean.includes("visa")) return VENDOR_TYPES.VISA;
  if (clean.includes("insurance")) return VENDOR_TYPES.INSURANCE;
  if (clean.includes("flight")) return VENDOR_TYPES.FLIGHT;

  return VENDOR_TYPES.OTHER;
}

function normalizeVendorStatus(value = "") {
  const clean = safeText(value).toLowerCase();

  if (Object.values(VENDOR_STATUS).includes(clean)) return clean;

  if (clean.includes("black")) return VENDOR_STATUS.BLACKLISTED;
  if (clean.includes("inactive")) return VENDOR_STATUS.INACTIVE;

  return VENDOR_STATUS.ACTIVE;
}

function normalizeLocationType(value = "", country = "") {
  const clean = safeText(value).toLowerCase();
  const cleanCountry = safeText(country).toLowerCase();

  if (
    clean.includes("international") ||
    clean.includes("foreign") ||
    clean.includes("global")
  ) {
    return "international";
  }

  if (cleanCountry && cleanCountry !== "india") {
    return "international";
  }

  return "india";
}

function mapCsvRowToVendorForm(row) {
  const country = getCsvValue(row, ["Country"]);
  const locationType = normalizeLocationType(
    getCsvValue(row, ["Location Type", "Vendor Location Type"]),
    country
  );

  const city = getCsvValue(row, ["City", "District"]);

  const destinations = splitMultiValue(
    getCsvValue(row, ["Destinations", "Destination Names"])
  );

  const services = splitMultiValue(getCsvValue(row, ["Services"]));

  return {
    vendorName: getCsvValue(row, ["Vendor Name", "Name"]),
    vendorType: normalizeVendorType(getCsvValue(row, ["Vendor Type", "Type"])),
    vendorLocationType: locationType,
    status: normalizeVendorStatus(getCsvValue(row, ["Status"])),

    contactPerson: getCsvValue(row, ["Contact Person", "SPOC", "Contact"]),
    designation: getCsvValue(row, ["Designation"]),
    email: getCsvValue(row, ["Email"]),
    mobile: getCsvValue(row, ["Mobile", "Phone"]),
    whatsapp: getCsvValue(row, ["WhatsApp", "Whatsapp"]),
    website: getCsvValue(row, ["Website"]),

    country: country || (locationType === "india" ? "India" : ""),
    state: getCsvValue(row, ["State", "Province"]),
    city,
    district: city,
    pincode: getCsvValue(row, ["Pincode", "PIN Code", "Postal Code", "ZIP"]),
    addressLine1: getCsvValue(row, ["Address Line 1", "Address"]),
    addressLine2: getCsvValue(row, ["Address Line 2"]),

    destinationIds: splitMultiValue(getCsvValue(row, ["Destination IDs"])),
    destinations,
    destinationNames: destinations,
    services,

    gstNumber: getCsvValue(row, ["GST Number", "GST"]),
    panNumber: getCsvValue(row, ["PAN Number", "PAN"]),

    paymentTerms: getCsvValue(row, ["Payment Terms"]),
    creditDays: getCsvValue(row, ["Credit Days"]),
    cancellationPolicy: getCsvValue(row, ["Cancellation Policy"]),

    bankName: getCsvValue(row, ["Bank Name"]),
    accountName: getCsvValue(row, ["Account Name", "Account Holder Name"]),
    accountNumber: getCsvValue(row, ["Account Number"]),
    branchName: getCsvValue(row, ["Branch Name"]),
    ifscCode: getCsvValue(row, ["IFSC Code", "IFSC"]),
    upiId: getCsvValue(row, ["UPI ID", "UPI"]),

    notes: getCsvValue(row, ["Notes", "Remarks"])
  };
}

function mapVendorToCsvRow(vendor) {
  return {
    "Vendor Name": vendor.vendorName || "",
    "Vendor Type": getVendorTypeLabel(vendor.vendorType),
    "Location Type": vendor.vendorLocationType || "india",
    Status: vendor.status || "",
    "Contact Person": vendor.contactPerson || "",
    Designation: vendor.designation || "",
    Email: vendor.email || "",
    Mobile: vendor.mobile || "",
    WhatsApp: vendor.whatsapp || "",
    Website: vendor.website || "",
    Country: vendor.country || "",
    State: vendor.state || "",
    City: vendor.city || vendor.district || "",
    Pincode: vendor.pincode || "",
    Destinations: Array.isArray(vendor.destinations)
      ? vendor.destinations.join(" | ")
      : "",
    Services: Array.isArray(vendor.services)
      ? vendor.services.join(" | ")
      : "",
    "GST Number": vendor.gstNumber || "",
    "PAN Number": vendor.panNumber || "",
    "Payment Terms": vendor.paymentTerms || "",
    "Credit Days":
      vendor.creditDays === 0 || vendor.creditDays
        ? String(vendor.creditDays)
        : "",
    "Bank Name": vendor.bankName || vendor.bankDetails?.bankName || "",
    "Account Name":
      vendor.accountName || vendor.bankDetails?.accountName || "",
    "Account Number":
      vendor.accountNumber || vendor.bankDetails?.accountNumber || "",
    "Branch Name": vendor.branchName || vendor.bankDetails?.branchName || "",
    "IFSC Code":
      vendor.ifscCode ||
      vendor.ifsc ||
      vendor.bankDetails?.ifscCode ||
      vendor.bankDetails?.ifsc ||
      "",
    "UPI ID": vendor.upiId || vendor.bankDetails?.upiId || "",
    Notes: vendor.notes || ""
  };
}

/* =========================
   SMALL UI
========================= */

function StatCard({ icon: Icon, label, value, tone = "blue" }) {
  const toneMap = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-green-50 text-green-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    gray: "bg-gray-50 text-gray-700"
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100  p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-gray-500">
            {label}
          </p>

          <h3 className="text-2xl font-semibold text-gray-900 mt-1">
            {value}
          </h3>
        </div>

        <div
          className={`
            h-11 w-11 rounded-xl flex items-center justify-center
            ${toneMap[tone] || toneMap.blue}
          `}
        >
          <Icon size={21} />
        </div>
      </div>
    </div>
  );
}

function FilterChip({ label, onRemove }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="
        inline-flex items-center gap-1.5
        rounded-full border border-blue-100 bg-blue-50
        px-3 py-1 text-xs font-medium text-blue-700
        hover:bg-blue-100
      "
    >
      {label}
      <X size={12} />
    </button>
  );
}

function EmptyVendors({ hasFilters, onClearFilters }) {
  return (
    <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
      <div className="h-14 w-14 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center mx-auto">
        <Building2 size={25} />
      </div>

      <h3 className="text-base font-semibold text-gray-900 mt-4">
        {hasFilters ? "No vendors match your filters" : "No vendors found"}
      </h3>

      <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
        {hasFilters
          ? "Try clearing search, vendor type or status filters."
          : "Add your DMC, hotel, transport, visa, activity and other travel partners here."}
      </p>

      <div className="mt-5 flex items-center justify-center gap-2">
        {hasFilters ? (
          <button
            type="button"
            onClick={onClearFilters}
            className="
              inline-flex items-center gap-2
              px-4 py-2 rounded-xl border border-gray-200
              text-sm font-medium text-gray-700 hover:bg-gray-50
            "
          >
            <X size={16} />
            Clear Filters
          </button>
        ) : (
          <Link
            href="/admin/vendors/new"
            className="
              inline-flex items-center gap-2
              px-4 py-2 rounded-xl bg-blue-600 text-white
              text-sm font-medium hover:bg-blue-700
            "
          >
            <Plus size={16} />
            Add Vendor
          </Link>
        )}
      </div>
    </div>
  );
}

function ViewToggle({ view, onChange }) {
  return (
    <div className="inline-flex items-center rounded-xl border border-gray-200 bg-white p-1">
      <button
        type="button"
        onClick={() => onChange("grid")}
        className={`
          h-8 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5
          ${
            view === "grid"
              ? "bg-blue-600 text-white"
              : "text-gray-600 hover:bg-gray-50"
          }
        `}
      >
        <Grid3X3 size={14} />
        Grid
      </button>

      <button
        type="button"
        onClick={() => onChange("list")}
        className={`
          h-8 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5
          ${
            view === "list"
              ? "bg-blue-600 text-white"
              : "text-gray-600 hover:bg-gray-50"
          }
        `}
      >
        <List size={14} />
        List
      </button>
    </div>
  );
}

function DeleteButton({
  vendor,
  isSuperAdmin,
  deletingId,
  onDelete,
  compact = false
}) {
  if (!isSuperAdmin) return null;

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => onDelete(vendor)}
        disabled={deletingId === vendor.id}
        className="
          h-9 w-9 rounded-xl border border-red-100
          flex items-center justify-center text-red-500
          hover:bg-red-50 disabled:opacity-60
        "
        title="Delete vendor"
      >
        <Trash2 size={15} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onDelete(vendor)}
      disabled={deletingId === vendor.id}
      className="
        inline-flex items-center justify-center gap-2
        px-3 py-2 rounded-xl border border-red-100
        text-xs font-semibold text-red-600 hover:bg-red-50
        disabled:opacity-60
      "
    >
      <Trash2 size={14} />
      {deletingId === vendor.id ? "Deleting..." : "Delete"}
    </button>
  );
}

function VendorCard({
  vendor,
  isSuperAdmin,
  deletingId,
  onDelete
}) {
  const vendorHref = `/admin/vendors/${vendor.id}`;

  return (
    <div className="bg-white rounded-2xl border border-gray-100  p-5 hover:shadow-md transition group">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={vendorHref}
              className="text-base font-semibold text-gray-900 truncate hover:text-blue-700"
            >
              {vendor.vendorName || "Unnamed Vendor"}
            </Link>

            <VendorStatusChip type="vendor" value={vendor.status} />
          </div>

          <p className="text-xs text-gray-500 mt-1">
            {vendor.vendorCode || "No code"} ·{" "}
            {getVendorTypeLabel(vendor.vendorType)}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={vendorHref}
            className="
              h-9 w-9 rounded-xl border border-gray-200
              flex items-center justify-center text-gray-500
              hover:bg-blue-50 hover:text-blue-700 hover:border-blue-100
            "
            title="View vendor profile"
          >
            <Eye size={15} />
          </Link>

          <Link
            href={vendorHref}
            className="
              h-9 w-9 rounded-xl border border-gray-200
              flex items-center justify-center text-gray-500
              hover:bg-gray-50 hover:text-gray-900
            "
            title="Edit vendor"
          >
            <Edit3 size={15} />
          </Link>

          <DeleteButton
            vendor={vendor}
            isSuperAdmin={isSuperAdmin}
            deletingId={deletingId}
            onDelete={onDelete}
            compact
          />
        </div>
      </div>

      <div className="mt-4 space-y-2 text-sm">
        <div className="flex items-center gap-2 text-gray-700">
          <Users size={15} className="text-gray-400 shrink-0" />
          <span className="truncate">
            {vendor.contactPerson || "No contact person"}
          </span>
        </div>

        <div className="flex items-center gap-2 text-gray-700">
          <Phone size={15} className="text-gray-400 shrink-0" />
          <span className="truncate">
            {vendor.mobile || vendor.whatsapp || "No phone added"}
          </span>
        </div>

        <div className="flex items-center gap-2 text-gray-700">
          <Mail size={15} className="text-gray-400 shrink-0" />
          <span className="truncate">
            {vendor.email || "No email added"}
          </span>
        </div>

        <div className="flex items-center gap-2 text-gray-700">
          <MapPin size={15} className="text-gray-400 shrink-0" />
          <span className="truncate">
            {getLocationText(vendor)}
          </span>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">
            Destinations
          </p>

          <p className="text-sm text-gray-700 line-clamp-2">
            {getDestinationText(vendor)}
          </p>
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">
            Services
          </p>

          <p className="text-sm text-gray-700 line-clamp-2">
            {getServiceText(vendor)}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="text-xs text-gray-400">
          <p>Created {formatDate(vendor.createdAt)}</p>
          <p>{vendor.createdByName || "—"}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={vendorHref}
            className="
              inline-flex items-center justify-center gap-2
              px-3 py-2 rounded-xl bg-blue-600 text-white
              text-xs font-semibold hover:bg-blue-700
            "
          >
            <Eye size={14} />
            View
          </Link>

          <Link
            href={vendorHref}
            className="
              inline-flex items-center justify-center gap-2
              px-3 py-2 rounded-xl border border-gray-200
              text-xs font-semibold text-gray-700 hover:bg-gray-50
            "
          >
            <Edit3 size={14} />
            Edit
          </Link>

          <DeleteButton
            vendor={vendor}
            isSuperAdmin={isSuperAdmin}
            deletingId={deletingId}
            onDelete={onDelete}
          />
        </div>
      </div>
    </div>
  );
}

function VendorTable({
  vendors,
  isSuperAdmin,
  deletingId,
  onDelete
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100  overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr className="text-left text-xs text-gray-500">
              <th className="px-4 py-3 font-semibold">Vendor</th>
              <th className="px-4 py-3 font-semibold">Type</th>
              <th className="px-4 py-3 font-semibold">Contact</th>
              <th className="px-4 py-3 font-semibold">Location</th>
              <th className="px-4 py-3 font-semibold">Destinations</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Created</th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {vendors.map(vendor => {
              const vendorHref = `/admin/vendors/${vendor.id}`;

              return (
                <tr key={vendor.id} className="hover:bg-gray-50/70">
                  <td className="px-4 py-4 min-w-[230px]">
                    <Link
                      href={vendorHref}
                      className="font-semibold text-gray-900 hover:text-blue-700"
                    >
                      {vendor.vendorName || "Unnamed Vendor"}
                    </Link>

                    <p className="text-xs text-gray-500 mt-0.5">
                      {vendor.vendorCode || "No code"}
                    </p>
                  </td>

                  <td className="px-4 py-4 min-w-[160px] text-gray-700">
                    {getVendorTypeLabel(vendor.vendorType)}
                  </td>

                  <td className="px-4 py-4 min-w-[220px]">
                    <p className="font-medium text-gray-900">
                      {vendor.contactPerson || "—"}
                    </p>

                    <p className="text-xs text-gray-500 mt-0.5">
                      {vendor.mobile ||
                        vendor.whatsapp ||
                        vendor.email ||
                        "No contact"}
                    </p>
                  </td>

                  <td className="px-4 py-4 min-w-[180px] text-gray-700">
                    {getLocationText(vendor)}
                  </td>

                  <td className="px-4 py-4 min-w-[220px] text-gray-700">
                    <span className="line-clamp-2">
                      {getDestinationText(vendor)}
                    </span>
                  </td>

                  <td className="px-4 py-4">
                    <VendorStatusChip type="vendor" value={vendor.status} />
                  </td>

                  <td className="px-4 py-4 whitespace-nowrap text-gray-500">
                    {formatDate(vendor.createdAt)}
                  </td>

                  <td className="px-4 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={vendorHref}
                        className="
                          h-9 w-9 rounded-xl border border-gray-200
                          flex items-center justify-center text-gray-500
                          hover:bg-blue-50 hover:text-blue-700
                        "
                        title="View vendor"
                      >
                        <Eye size={15} />
                      </Link>

                      <Link
                        href={vendorHref}
                        className="
                          h-9 w-9 rounded-xl border border-gray-200
                          flex items-center justify-center text-gray-500
                          hover:bg-gray-50 hover:text-gray-900
                        "
                        title="Edit vendor"
                      >
                        <Edit3 size={15} />
                      </Link>

                      <DeleteButton
                        vendor={vendor}
                        isSuperAdmin={isSuperAdmin}
                        deletingId={deletingId}
                        onDelete={onDelete}
                        compact
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* =========================
   PAGE
========================= */

export default function AdminVendorsPage() {
  const { user, loading: authLoading } = useAuth(true);
  const fileInputRef = useRef(null);

  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [view, setView] = useState("grid");

  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const [deletingId, setDeletingId] = useState("");

  const [filters, setFilters] = useState({
    search: "",
    type: "all",
    status: "all"
  });

  const isSuperAdmin = isSuperAdminUser(user);

  useEffect(() => {
    const savedView = window.localStorage.getItem("vendorListingView");

    if (savedView === "grid" || savedView === "list") {
      setView(savedView);
    }
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;

    setLoading(true);

    const q = query(
      collection(db, "vendors"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      snapshot => {
        const rows = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          vendorId: docSnap.id,
          ...docSnap.data()
        }));

        setVendors(rows);
        setLoading(false);
      },
      err => {
        console.error("Vendor load failed:", err);
        setError(err?.message || "Failed to load vendors.");
        setLoading(false);
      }
    );

    return () => unsub();
  }, [authLoading, user]);

  const stats = useMemo(() => {
    const total = vendors.length;
    const active = vendors.filter(v => v.status === "active").length;
    const inactive = vendors.filter(v => v.status === "inactive").length;
    const blacklisted = vendors.filter(v => v.status === "blacklisted").length;
    const international = vendors.filter(
      v => v.vendorLocationType === "international"
    ).length;

    return {
      total,
      active,
      inactive,
      blacklisted,
      international
    };
  }, [vendors]);

  const filteredVendors = useMemo(() => {
    const search = filters.search.trim().toLowerCase();

    return vendors.filter(vendor => {
      const matchesSearch =
        !search || getSearchBlob(vendor).includes(search);

      const matchesType =
        filters.type === "all" || vendor.vendorType === filters.type;

      const matchesStatus =
        filters.status === "all" || vendor.status === filters.status;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [vendors, filters]);

  const hasFilters =
    Boolean(filters.search.trim()) ||
    filters.type !== "all" ||
    filters.status !== "all";

  const selectedTypeLabel =
    VENDOR_TYPE_OPTIONS.find(item => item.value === filters.type)?.label || "";

  const selectedStatusLabel =
    VENDOR_STATUS_OPTIONS.find(item => item.value === filters.status)?.label ||
    "";

  const updateView = nextView => {
    setView(nextView);
    window.localStorage.setItem("vendorListingView", nextView);
  };

  const clearFilters = () => {
    setFilters({
      search: "",
      type: "all",
      status: "all"
    });
  };

  const handleDeleteVendor = async vendor => {
    if (!isSuperAdmin) {
      setError("Only Super Admin can delete vendors.");
      return;
    }

    if (!vendor?.id) return;

    const confirmed = window.confirm(
      `Delete vendor "${vendor.vendorName || "Unnamed Vendor"}"?\n\nThis action cannot be undone. Related quotations, documents or payment records may still reference this vendor.`
    );

    if (!confirmed) return;

    setDeletingId(vendor.id);
    setError("");

    try {
      await deleteDoc(doc(db, "vendors", vendor.id));
    } catch (err) {
      console.error("Vendor delete failed:", err);
      setError(err?.message || "Failed to delete vendor.");
    } finally {
      setDeletingId("");
    }
  };

  const handleExportCsv = () => {
    const rows = filteredVendors.map(mapVendorToCsvRow);
    downloadCsv("vendors-export.csv", rows);
  };

  const handleDownloadTemplate = () => {
    downloadCsv("vendors-import-template.csv", [
      {
        "Vendor Name": "ABC Holidays DMC",
        "Vendor Type": "dmc",
        "Location Type": "international",
        Status: "active",
        "Contact Person": "John Doe",
        Designation: "Sales Manager",
        Email: "vendor@example.com",
        Mobile: "+971500000000",
        WhatsApp: "+971500000000",
        Website: "https://example.com",
        Country: "UAE",
        State: "Dubai",
        City: "Dubai",
        Pincode: "",
        Destinations: "Dubai | Abu Dhabi",
        Services: "Hotel | Transfers | Sightseeing",
        "GST Number": "",
        "PAN Number": "",
        "Payment Terms": "Advance",
        "Credit Days": "0",
        "Bank Name": "",
        "Account Name": "",
        "Account Number": "",
        "Branch Name": "",
        "IFSC Code": "",
        "UPI ID": "",
        Notes: "Preferred vendor"
      }
    ]);
  };

  const handleCsvFileChange = async event => {
    const file = event.target.files?.[0];

    if (!file || !user) return;

    setImporting(true);
    setImportResult(null);
    setError("");

    try {
      const text = await file.text();
      const rows = parseCsv(text);

      if (rows.length === 0) {
        throw new Error("CSV file is empty or invalid.");
      }

      const result = {
        total: rows.length,
        success: 0,
        failed: 0,
        errors: []
      };

      for (let index = 0; index < rows.length; index += 1) {
        try {
          const formPayload = mapCsvRowToVendorForm(rows[index]);

          if (!safeText(formPayload.vendorName)) {
            throw new Error("Vendor Name is required.");
          }

          await saveVendor({
            vendorId: "",
            form: formPayload,
            user
          });

          result.success += 1;
        } catch (rowError) {
          result.failed += 1;
          result.errors.push(
            `Row ${index + 2}: ${rowError?.message || "Import failed."}`
          );
        }
      }

      setImportResult(result);
    } catch (err) {
      console.error("Vendor CSV import failed:", err);
      setError(err?.message || "Failed to import vendors.");
    } finally {
      setImporting(false);

      if (event.target) {
        event.target.value = "";
      }
    }
  };

  if (authLoading || loading) {
    return (
      <main className="min-h-screen p-6">
        <div className="max-w-9xl mx-auto animate-pulse space-y-4">
          <div className="h-10 bg-gray-200 rounded-xl w-72" />

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map(item => (
              <div
                key={item}
                className="h-28 bg-gray-200 rounded-2xl"
              />
            ))}
          </div>

          <div className="h-20 bg-gray-200 rounded-2xl" />
          <div className="h-96 bg-gray-200 rounded-2xl" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="max-w-9xl mx-auto space-y-6">
        {/* HEADER */}
        <section className="bg-white rounded-3xl border border-gray-100  overflow-hidden">
          <div className="p-5 md:p-6 bg-gradient-to-br from-blue-50 via-white to-indigo-50">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-sm text-blue-700 font-medium">
                  <ShieldCheck size={16} />
                  Vendor Management
                </div>

                <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 mt-1">
                  Vendors
                </h1>

                <p className="text-sm text-gray-500 mt-1 max-w-2xl">
                  Manage DMCs, hotels, transport partners, activity vendors and
                  other suppliers used for lead quotations.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="
                    inline-flex items-center justify-center gap-2
                    px-4 py-2.5 rounded-xl border border-gray-200 bg-white
                    text-gray-700 text-sm font-medium hover:bg-gray-50
                  "
                >
                  <FileDown size={17} />
                  Template
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                  className="
                    inline-flex items-center justify-center gap-2
                    px-4 py-2.5 rounded-xl border border-gray-200 bg-white
                    text-gray-700 text-sm font-medium hover:bg-gray-50
                    disabled:opacity-60
                  "
                >
                  <UploadCloud size={17} />
                  {importing ? "Importing..." : "Import CSV"}
                </button>

                <button
                  type="button"
                  onClick={handleExportCsv}
                  disabled={filteredVendors.length === 0}
                  className="
                    inline-flex items-center justify-center gap-2
                    px-4 py-2.5 rounded-xl border border-gray-200 bg-white
                    text-gray-700 text-sm font-medium hover:bg-gray-50
                    disabled:opacity-60
                  "
                >
                  <Download size={17} />
                  Export CSV
                </button>

                <Link
                  href="/admin/vendors/new"
                  className="
                    inline-flex items-center justify-center gap-2
                    px-4 py-2.5 rounded-xl bg-blue-600 text-white
                    text-sm font-medium hover:bg-blue-700 
                  "
                >
                  <Plus size={17} />
                  Add Vendor
                </Link>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleCsvFileChange}
                className="hidden"
              />
            </div>
          </div>
        </section>

        {/* STATS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <StatCard
            icon={Building2}
            label="Total Vendors"
            value={stats.total}
            tone="blue"
          />

          <StatCard
            icon={ShieldCheck}
            label="Active"
            value={stats.active}
            tone="green"
          />

          <StatCard
            icon={Users}
            label="Inactive"
            value={stats.inactive}
            tone="gray"
          />

          <StatCard
            icon={X}
            label="Blacklisted"
            value={stats.blacklisted}
            tone="red"
          />

          <StatCard
            icon={MapPin}
            label="International"
            value={stats.international}
            tone="amber"
          />
        </div>

        {/* ERROR */}
        {error && (
          <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 flex items-start gap-2 text-sm text-red-700">
            <AlertCircle size={17} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* IMPORT RESULT */}
        {importResult && (
          <div
            className={`
              rounded-2xl border px-4 py-3 text-sm
              ${
                importResult.failed > 0
                  ? "border-amber-100 bg-amber-50 text-amber-800"
                  : "border-green-100 bg-green-50 text-green-800"
              }
            `}
          >
            <p className="font-semibold">
              Import completed: {importResult.success} success,{" "}
              {importResult.failed} failed out of {importResult.total}.
            </p>

            {importResult.errors.length > 0 && (
              <div className="mt-2 max-h-32 overflow-y-auto space-y-1 text-xs">
                {importResult.errors.slice(0, 20).map(item => (
                  <p key={item}>{item}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* STICKY FILTER BAR */}
        <div className="sticky top-20 z-20">
          <div className="bg-white/95 backdrop-blur rounded-2xl border border-gray-100 shadow-md p-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                  <SlidersHorizontal size={17} />
                </div>

                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    Search & Filters
                  </p>
                  <p className="text-xs text-gray-500">
                    Showing {filteredVendors.length} of {vendors.length} vendors
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <ViewToggle view={view} onChange={updateView} />

                <button
                  type="button"
                  onClick={handleExportCsv}
                  disabled={filteredVendors.length === 0}
                  className="
                    inline-flex items-center justify-center gap-2
                    px-3 py-2 rounded-xl border border-gray-200
                    text-xs font-semibold text-gray-700 hover:bg-gray-50
                    disabled:opacity-50
                  "
                >
                  <Download size={15} />
                  Export
                </button>

                <Link
                  href="/admin/vendors/new"
                  className="
                    inline-flex items-center justify-center gap-2
                    px-3 py-2 rounded-xl bg-blue-600 text-white
                    text-xs font-semibold hover:bg-blue-700
                  "
                >
                  <Plus size={15} />
                  Add Vendor
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="md:col-span-2 relative">
                <Search
                  size={17}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  value={filters.search}
                  onChange={e =>
                    setFilters(prev => ({
                      ...prev,
                      search: e.target.value
                    }))
                  }
                  placeholder="Search vendor, code, destination, contact, pincode..."
                  className="
                    w-full rounded-xl border border-gray-200
                    pl-10 pr-3 py-2.5 text-sm
                    focus:outline-none focus:ring-2 focus:ring-blue-100
                  "
                />
              </div>

              <select
                value={filters.type}
                onChange={e =>
                  setFilters(prev => ({
                    ...prev,
                    type: e.target.value
                  }))
                }
                className="
                  rounded-xl border border-gray-200
                  px-3 py-2.5 text-sm bg-white
                  focus:outline-none focus:ring-2 focus:ring-blue-100
                "
              >
                <option value="all">All Vendor Types</option>
                {VENDOR_TYPE_OPTIONS.map(item => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>

              <select
                value={filters.status}
                onChange={e =>
                  setFilters(prev => ({
                    ...prev,
                    status: e.target.value
                  }))
                }
                className="
                  rounded-xl border border-gray-200
                  px-3 py-2.5 text-sm bg-white
                  focus:outline-none focus:ring-2 focus:ring-blue-100
                "
              >
                <option value="all">All Status</option>
                {VENDOR_STATUS_OPTIONS.map(item => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={clearFilters}
                disabled={!hasFilters}
                className="
                  rounded-xl border border-gray-200
                  px-3 py-2.5 text-sm font-medium text-gray-700
                  hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed
                "
              >
                Clear Filters
              </button>
            </div>

            {hasFilters && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {filters.search.trim() && (
                  <FilterChip
                    label={`Search: ${filters.search.trim()}`}
                    onRemove={() =>
                      setFilters(prev => ({
                        ...prev,
                        search: ""
                      }))
                    }
                  />
                )}

                {filters.type !== "all" && (
                  <FilterChip
                    label={`Type: ${selectedTypeLabel}`}
                    onRemove={() =>
                      setFilters(prev => ({
                        ...prev,
                        type: "all"
                      }))
                    }
                  />
                )}

                {filters.status !== "all" && (
                  <FilterChip
                    label={`Status: ${selectedStatusLabel}`}
                    onRemove={() =>
                      setFilters(prev => ({
                        ...prev,
                        status: "all"
                      }))
                    }
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {/* LIST / GRID */}
        {filteredVendors.length === 0 ? (
          <EmptyVendors
            hasFilters={hasFilters}
            onClearFilters={clearFilters}
          />
        ) : view === "list" ? (
          <VendorTable
            vendors={filteredVendors}
            isSuperAdmin={isSuperAdmin}
            deletingId={deletingId}
            onDelete={handleDeleteVendor}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredVendors.map(vendor => (
              <VendorCard
                key={vendor.id}
                vendor={vendor}
                isSuperAdmin={isSuperAdmin}
                deletingId={deletingId}
                onDelete={handleDeleteVendor}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}