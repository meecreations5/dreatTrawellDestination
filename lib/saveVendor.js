// lib/saveVendor.js

import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc
} from "firebase/firestore";

import { db } from "./firebase";
import { generateVendorCode } from "./generateVendorCode";

import {
  VENDOR_STATUS,
  VENDOR_TYPES
} from "./vendorConstants";

/* =========================
   HELPERS
========================= */

function cleanString(value = "") {
  return String(value || "").trim();
}

function cleanArray(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map(item => cleanString(item))
    .filter(Boolean);
}

function getUserName(user) {
  return (
    cleanString(user?.name) ||
    cleanString(user?.displayName) ||
    cleanString(user?.fullName) ||
    cleanString(user?.employeeName) ||
    cleanString(user?.email) ||
    "System"
  );
}

function getUserEmail(user) {
  return (
    cleanString(user?.email) ||
    cleanString(user?.workEmail) ||
    cleanString(user?.officialEmail)
  );
}

function getUserUid(user) {
  return (
    cleanString(user?.uid) ||
    cleanString(user?.id) ||
    cleanString(user?.email)
  );
}

function normalizeVendorType(type = "") {
  const cleanType = cleanString(type);

  return Object.values(VENDOR_TYPES).includes(cleanType)
    ? cleanType
    : VENDOR_TYPES.DMC;
}

function normalizeVendorStatus(status = "") {
  const cleanStatus = cleanString(status);

  return Object.values(VENDOR_STATUS).includes(cleanStatus)
    ? cleanStatus
    : VENDOR_STATUS.ACTIVE;
}

function buildVendorPayload(form = {}) {
  const vendorName = cleanString(form.vendorName);
  const vendorType = normalizeVendorType(form.vendorType);
  const status = normalizeVendorStatus(form.status);

  const contactPerson = cleanString(form.contactPerson);
  const email = cleanString(form.email).toLowerCase();
  const mobile = cleanString(form.mobile);
  const whatsapp = cleanString(form.whatsapp);

  const city = cleanString(form.city);
  const state = cleanString(form.state);
  const country = cleanString(form.country || "India");

  const destinations = cleanArray(form.destinations);

  return {
    vendorName,
    vendorNameLower: vendorName.toLowerCase(),

    vendorType,
    status,

    destinations,
    destinationNames: destinations,

    contactPerson,
    contactPersonLower: contactPerson.toLowerCase(),

    email,
    mobile,
    whatsapp,

    city,
    state,
    country,

    address: {
      line1: cleanString(form?.address?.line1 || form.addressLine1),
      line2: cleanString(form?.address?.line2 || form.addressLine2),
      city,
      state,
      country,
      pincode: cleanString(form?.address?.pincode || form.pincode)
    },

    gstNumber: cleanString(form.gstNumber).toUpperCase(),
    panNumber: cleanString(form.panNumber).toUpperCase(),

    paymentTerms: cleanString(form.paymentTerms),
    cancellationPolicy: cleanString(form.cancellationPolicy),
    notes: cleanString(form.notes),

    bankDetails: {
      accountName: cleanString(
        form?.bankDetails?.accountName || form.accountName
      ),
      accountNumber: cleanString(
        form?.bankDetails?.accountNumber || form.accountNumber
      ),
      bankName: cleanString(
        form?.bankDetails?.bankName || form.bankName
      ),
      branchName: cleanString(
        form?.bankDetails?.branchName || form.branchName
      ),
      ifsc: cleanString(
        form?.bankDetails?.ifsc || form.ifsc
      ).toUpperCase(),
      upiId: cleanString(
        form?.bankDetails?.upiId || form.upiId
      )
    }
  };
}

function validateVendorPayload(payload) {
  if (!payload.vendorName) {
    throw new Error("Vendor name is required.");
  }

  if (!payload.vendorType) {
    throw new Error("Vendor type is required.");
  }

  if (!payload.contactPerson) {
    throw new Error("Contact person is required.");
  }

  if (!payload.mobile && !payload.email && !payload.whatsapp) {
    throw new Error(
      "Add at least one contact detail: mobile, WhatsApp, or email."
    );
  }
}

/* =========================
   CREATE VENDOR
========================= */

export async function createVendor({
  form,
  user
}) {
  if (!user) {
    throw new Error("User session is required.");
  }

  const payload = buildVendorPayload(form);
  validateVendorPayload(payload);

  const userUid = getUserUid(user);
  const userName = getUserName(user);
  const userEmail = getUserEmail(user);

  const vendorCode = await generateVendorCode();

  const vendorRef = await addDoc(collection(db, "vendors"), {
    ...payload,

    vendorCode,

    createdByUid: userUid,
    createdByName: userName,
    createdByEmail: userEmail,

    updatedByUid: userUid,
    updatedByName: userName,
    updatedByEmail: userEmail,

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  return {
    vendorId: vendorRef.id,
    vendorCode,
    ...payload
  };
}

/* =========================
   UPDATE VENDOR
========================= */

export async function updateVendor({
  vendorId,
  form,
  user
}) {
  if (!vendorId) {
    throw new Error("Vendor ID is required.");
  }

  if (!user) {
    throw new Error("User session is required.");
  }

  const vendorRef = doc(db, "vendors", vendorId);
  const vendorSnap = await getDoc(vendorRef);

  if (!vendorSnap.exists()) {
    throw new Error("Vendor not found.");
  }

  const payload = buildVendorPayload(form);
  validateVendorPayload(payload);

  const userUid = getUserUid(user);
  const userName = getUserName(user);
  const userEmail = getUserEmail(user);

  await updateDoc(vendorRef, {
    ...payload,

    updatedByUid: userUid,
    updatedByName: userName,
    updatedByEmail: userEmail,

    updatedAt: serverTimestamp()
  });

  return {
    vendorId,
    vendorCode: vendorSnap.data()?.vendorCode || "",
    ...payload
  };
}

/* =========================
   SAVE VENDOR
========================= */

export async function saveVendor({
  vendorId = "",
  form,
  user
}) {
  if (vendorId) {
    return updateVendor({
      vendorId,
      form,
      user
    });
  }

  return createVendor({
    form,
    user
  });
}