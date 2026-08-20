// lib/generateVendorCode.js

import {
  collection,
  getDocs,
  limit,
  orderBy,
  query
} from "firebase/firestore";

import { db } from "./firebase";

/* =========================
   CONFIG
========================= */

const VENDOR_CODE_PREFIX = "DT-VEN";
const VENDOR_CODE_PAD_LENGTH = 4;

/* =========================
   HELPERS
========================= */

function extractVendorNumber(vendorCode = "") {
  const code = String(vendorCode || "").trim();

  if (!code) return 0;

  const match = code.match(/(\d+)$/);

  if (!match) return 0;

  const number = Number(match[1]);

  return Number.isFinite(number) ? number : 0;
}

function formatVendorCode(number) {
  return `${VENDOR_CODE_PREFIX}-${String(number).padStart(
    VENDOR_CODE_PAD_LENGTH,
    "0"
  )}`;
}

/* =========================
   GENERATE VENDOR CODE
========================= */

export async function generateVendorCode() {
  const vendorsRef = collection(db, "vendors");

  const q = query(
    vendorsRef,
    orderBy("createdAt", "desc"),
    limit(25)
  );

  const snap = await getDocs(q);

  let maxNumber = 0;

  snap.forEach(docSnap => {
    const vendor = docSnap.data();

    const number = extractVendorNumber(vendor.vendorCode);

    if (number > maxNumber) {
      maxNumber = number;
    }
  });

  return formatVendorCode(maxNumber + 1);
}

export {
  VENDOR_CODE_PREFIX,
  VENDOR_CODE_PAD_LENGTH,
  extractVendorNumber,
  formatVendorCode
};