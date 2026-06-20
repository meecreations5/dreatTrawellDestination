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
  if (Array.isArray(value)) {
    return value
      .map(item => cleanString(item))
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map(item => cleanString(item))
      .filter(Boolean);
  }

  return [];
}

function cleanNumber(value) {
  if (value === "" || value === null || value === undefined) return null;

  const numberValue = Number(value);

  return Number.isNaN(numberValue) ? null : numberValue;
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

function normalizeVendorLocationType(value = "") {
  return cleanString(value) === "international"
    ? "international"
    : "india";
}

function getBankIfsc(form = {}) {
  return cleanString(
    form?.bankDetails?.ifscCode ||
      form?.bankDetails?.ifsc ||
      form.ifscCode ||
      form.ifsc
  ).toUpperCase();
}

/* =========================
   BUILD PAYLOAD
========================= */

function buildVendorPayload(form = {}) {
  const vendorName = cleanString(form.vendorName);
  const vendorType = normalizeVendorType(form.vendorType);
  const status = normalizeVendorStatus(form.status);
  const vendorLocationType = normalizeVendorLocationType(
    form.vendorLocationType || form?.address?.vendorLocationType
  );

  const contactPerson = cleanString(form.contactPerson);
  const designation = cleanString(form.designation);

  const email = cleanString(form.email).toLowerCase();
  const mobile = cleanString(form.mobile);
  const whatsapp = cleanString(form.whatsapp);
  const website = cleanString(form.website);

  const city = cleanString(form.city || form?.address?.city);
  const district = cleanString(form.district || form?.address?.district);
  const state = cleanString(form.state || form?.address?.state);

  const country = cleanString(
    form.country ||
      form?.address?.country ||
      (vendorLocationType === "india" ? "India" : "")
  );

  const pincode = cleanString(form.pincode || form?.address?.pincode);

  const postOfficeName = cleanString(
    form.postOfficeName || form?.address?.postOfficeName
  );

  const destinationIds = cleanArray(form.destinationIds);
  const destinations = cleanArray(form.destinations);
  const services = cleanArray(form.services);

  const addressLine1 = cleanString(
    form?.address?.line1 || form.addressLine1
  );

  const addressLine2 = cleanString(
    form?.address?.line2 || form.addressLine2
  );

  const gstNumber = cleanString(form.gstNumber).toUpperCase();
  const panNumber = cleanString(form.panNumber).toUpperCase();

  const paymentTerms = cleanString(form.paymentTerms);
  const cancellationPolicy = cleanString(form.cancellationPolicy);
  const creditDays = cleanNumber(form.creditDays);

  const bankName = cleanString(
    form?.bankDetails?.bankName || form.bankName
  );

  const accountName = cleanString(
    form?.bankDetails?.accountName || form.accountName
  );

  const accountNumber = cleanString(
    form?.bankDetails?.accountNumber || form.accountNumber
  );

  const branchName = cleanString(
    form?.bankDetails?.branchName || form.branchName
  );

  const ifscCode = getBankIfsc(form);

  const upiId = cleanString(
    form?.bankDetails?.upiId || form.upiId
  );

  const blacklistedReason =
    status === VENDOR_STATUS.BLACKLISTED
      ? cleanString(form.blacklistedReason)
      : "";

  return {
    vendorName,
    vendorNameLower: vendorName.toLowerCase(),

    vendorLocationType,

    vendorType,
    vendorTypeLabel: cleanString(form.vendorTypeLabel),
    status,

    destinationIds,
    destinations,
    destinationNames: destinations,
    services,

    contactPerson,
    contactPersonLower: contactPerson.toLowerCase(),
    designation,

    email,
    mobile,
    whatsapp,
    website,

    city,
    district,
    state,
    country,
    pincode,
    postOfficeName,

    addressLine1,
    addressLine2,

    address: {
      vendorLocationType,
      line1: addressLine1,
      line2: addressLine2,
      city,
      district,
      state,
      country,
      pincode,
      postOfficeName
    },

    gstNumber,
    panNumber,

    paymentTerms,
    cancellationPolicy,
    creditDays,

    bankName,
    accountName,
    accountNumber,
    branchName,
    ifscCode,
    ifsc: ifscCode,
    upiId,

    bankDetails: {
      accountName,
      accountNumber,
      bankName,
      branchName,
      ifscCode,
      ifsc: ifscCode,
      upiId
    },

    blacklistedReason,
    notes: cleanString(form.notes)
  };
}

/* =========================
   VALIDATION
========================= */

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

  if (
    payload.status === VENDOR_STATUS.BLACKLISTED &&
    !payload.blacklistedReason
  ) {
    throw new Error("Blacklist reason is required.");
  }
}

/* =========================
   CREATE VENDOR
========================= */

export async function createVendor({ form, user }) {
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
    vendorCodeLower: vendorCode.toLowerCase(),

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

export async function updateVendor({ vendorId, form, user }) {
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

  const existingVendor = vendorSnap.data();
  const payload = buildVendorPayload(form);

  validateVendorPayload(payload);

  const userUid = getUserUid(user);
  const userName = getUserName(user);
  const userEmail = getUserEmail(user);

  const vendorCode = existingVendor?.vendorCode || "";

  await updateDoc(vendorRef, {
    ...payload,

    vendorCode,
    vendorCodeLower: cleanString(vendorCode).toLowerCase(),

    updatedByUid: userUid,
    updatedByName: userName,
    updatedByEmail: userEmail,

    updatedAt: serverTimestamp()
  });

  return {
    vendorId,
    vendorCode,
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