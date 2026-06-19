// components/vendors/VendorStatusChip.jsx

"use client";

import {
  getVendorStatusMeta,
  getVendorRequestStatusMeta,
  getVendorQuoteStatusMeta,
  getPaymentStatusMeta
} from "@/lib/vendorConstants";

const toneClassMap = {
  gray: "bg-gray-50 text-gray-700 border-gray-200",
  blue: "bg-blue-50 text-blue-700 border-blue-100",
  green: "bg-green-50 text-green-700 border-green-100",
  amber: "bg-amber-50 text-amber-700 border-amber-100",
  orange: "bg-orange-50 text-orange-700 border-orange-100",
  purple: "bg-purple-50 text-purple-700 border-purple-100",
  red: "bg-red-50 text-red-700 border-red-100"
};

function resolveMeta(type, value) {
  if (type === "vendor") {
    return getVendorStatusMeta(value);
  }

  if (type === "request") {
    return getVendorRequestStatusMeta(value);
  }

  if (type === "quote") {
    return getVendorQuoteStatusMeta(value);
  }

  if (type === "payment") {
    return getPaymentStatusMeta(value);
  }

  return {
    label: String(value || "Unknown").replaceAll("_", " "),
    tone: "gray"
  };
}

export default function VendorStatusChip({
  value,
  type = "vendor",
  size = "sm"
}) {
  const meta = resolveMeta(type, value);

  const sizeClass =
    size === "xs"
      ? "px-2 py-0.5 text-[11px]"
      : "px-2.5 py-1 text-xs";

  return (
    <span
      className={`
        inline-flex items-center rounded-full border
        font-medium capitalize whitespace-nowrap
        ${sizeClass}
        ${toneClassMap[meta.tone] || toneClassMap.gray}
      `}
    >
      {meta.label}
    </span>
  );
}