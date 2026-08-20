"use client";

import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getFunctions, httpsCallable } from "firebase/functions";

import { app, storage } from "@/lib/firebase";
import { PAYMENT_STORAGE_PATHS } from "@/lib/paymentConstants";

const MAX_PAYMENT_FILE_BYTES = 10 * 1024 * 1024;

export const PAYMENT_FILE_KINDS = {
  CUSTOMER_RECEIPT: "customer_receipt",
  VENDOR_PROOF: "vendor_proof"
};

function cleanString(value = "") {
  return String(value || "").trim();
}

function safeFileName(name = "") {
  return cleanString(name)
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
}

function isAllowedPaymentFile(file) {
  const type = cleanString(file?.type).toLowerCase();
  return type === "application/pdf" || type.startsWith("image/");
}

function validatePaymentFile({ leadId, file }) {
  if (!cleanString(leadId)) {
    throw new Error("Lead ID is required for receipt upload.");
  }

  if (!file) return;

  if (!isAllowedPaymentFile(file)) {
    throw new Error("Upload an image or PDF receipt only.");
  }

  if (Number(file.size || 0) > MAX_PAYMENT_FILE_BYTES) {
    throw new Error("Receipt file is too large. Maximum allowed size is 10 MB.");
  }
}

function getStorageFolder(kind) {
  if (kind === PAYMENT_FILE_KINDS.VENDOR_PROOF) {
    return PAYMENT_STORAGE_PATHS.VENDOR_PROOFS;
  }

  if (kind === PAYMENT_FILE_KINDS.CUSTOMER_RECEIPT) {
    return PAYMENT_STORAGE_PATHS.CUSTOMER_RECEIPTS;
  }

  throw new Error("Unsupported payment receipt type.");
}

async function uploadDirect({ leadId, file, kind }) {
  if (!storage) {
    const error = new Error("Firebase Storage is not initialized.");
    error.code = "storage/not-initialized";
    throw error;
  }

  const fileName = `${Date.now()}-${safeFileName(file.name) || "receipt"}`;
  const storagePath = `${getStorageFolder(kind)}/${cleanString(leadId)}/${fileName}`;
  const fileRef = ref(storage, storagePath);

  await uploadBytes(fileRef, file, {
    contentType: cleanString(file.type) || "application/octet-stream",
    customMetadata: {
      leadId: cleanString(leadId),
      paymentFileKind: kind,
      originalFileName: cleanString(file.name)
    }
  });

  const url = await getDownloadURL(fileRef);

  return {
    url,
    fileName: file.name,
    storagePath,
    uploadMethod: "firebase_storage"
  };
}

async function fileToBase64(file) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}

async function uploadThroughFunction({ leadId, file, kind }) {
  if (!app) {
    throw new Error("Firebase app is not initialized.");
  }

  const functions = getFunctions(app, "us-central1");
  const uploadFn = httpsCallable(functions, "uploadLeadPaymentReceipt");
  const base64 = await fileToBase64(file);

  const response = await uploadFn({
    leadId: cleanString(leadId),
    kind,
    fileName: cleanString(file.name),
    contentType: cleanString(file.type) || "application/octet-stream",
    size: Number(file.size || 0),
    base64
  });

  const data = response?.data || {};

  if (!cleanString(data.url)) {
    throw new Error("Secure receipt upload did not return a download URL.");
  }

  return {
    url: cleanString(data.url),
    fileName: cleanString(data.fileName) || file.name,
    storagePath: cleanString(data.storagePath),
    uploadMethod: "firebase_function"
  };
}

function getErrorCode(error) {
  return cleanString(error?.code).toLowerCase();
}

function getFriendlyUploadError(primaryError, fallbackError) {
  const primaryCode = getErrorCode(primaryError);
  const fallbackCode = getErrorCode(fallbackError);

  if (
    fallbackCode.includes("functions/not-found") ||
    fallbackCode.includes("not-found")
  ) {
    return "Receipt upload service is not deployed yet. Deploy the uploadLeadPaymentReceipt Firebase Function and try again.";
  }

  if (
    primaryCode.includes("storage/unauthorized") ||
    primaryCode.includes("storage/permission-denied") ||
    fallbackCode.includes("permission-denied") ||
    fallbackCode.includes("unauthenticated")
  ) {
    return "Receipt upload permission was denied. Please sign in again or ask Admin to verify Firebase Storage/payment upload permissions.";
  }

  return (
    cleanString(fallbackError?.message) ||
    cleanString(primaryError?.message) ||
    "Receipt upload failed. Please try again."
  );
}

/**
 * Uploads a payment receipt/proof.
 *
 * Fast path: Firebase Storage client upload.
 * Fallback: authenticated callable function using Firebase Admin Storage.
 * This keeps payment uploads working even when browser Storage rules do not
 * yet include the lead-payments paths.
 */
export async function uploadPaymentFile({ leadId, file, kind }) {
  if (!file) {
    return {
      url: "",
      fileName: "",
      storagePath: "",
      uploadMethod: "none"
    };
  }

  validatePaymentFile({ leadId, file });

  let primaryError = null;

  try {
    return await uploadDirect({ leadId, file, kind });
  } catch (error) {
    primaryError = error;
    console.warn("Direct payment receipt upload failed; using secure fallback.", {
      code: error?.code,
      message: error?.message
    });
  }

  try {
    return await uploadThroughFunction({ leadId, file, kind });
  } catch (fallbackError) {
    console.error("Secure payment receipt upload failed.", {
      directCode: primaryError?.code,
      directMessage: primaryError?.message,
      fallbackCode: fallbackError?.code,
      fallbackMessage: fallbackError?.message
    });

    throw new Error(getFriendlyUploadError(primaryError, fallbackError));
  }
}

export default uploadPaymentFile;
