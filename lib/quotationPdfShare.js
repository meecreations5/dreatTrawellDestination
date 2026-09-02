"use client";

import { getFunctions, httpsCallable } from "firebase/functions";
import { app, auth } from "@/lib/firebase";
import { generateQuotationPdfBlob } from "@/lib/quotationPdf";

const MAX_QUOTATION_PDF_BYTES = 9 * 1024 * 1024;

function clean(value = "") {
  return String(value || "").trim();
}

async function blobToBase64(blob) {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || "");
      resolve(value.includes(",") ? value.split(",", 2)[1] : value);
    };
    reader.onerror = () => reject(reader.error || new Error("Could not prepare quotation PDF for upload."));
    reader.readAsDataURL(blob);
  });
}

function getCallableMessage(error) {
  return clean(
    error?.details?.message ||
    error?.details?.error ||
    error?.message ||
    error ||
    "Quotation PDF upload failed"
  )
    .replace(/^Firebase:\s*/i, "")
    .replace(/\s*\(functions\/[a-z-]+\)\.?$/i, "")
    .trim();
}

export async function createShareableQuotationPdf({
  leadId,
  quotationId,
  revision = "",
  quotation = {},
  lead = {},
  branding = null
} = {}) {
  if (!clean(leadId) || !clean(quotationId)) {
    throw new Error("Lead and quotation IDs are required to create the PDF link.");
  }
  if (!auth?.currentUser || !app) {
    throw new Error("Your login session has expired. Please sign in again.");
  }

  const generated = await generateQuotationPdfBlob({ quotation, lead, branding });
  if (!generated?.ok || !generated?.blob) {
    const reason = generated?.reason || "pdf_generation_failed";
    if (reason === "pdf_library_missing") {
      throw new Error("PDF library is not installed. Run npm install and redeploy the CRM.");
    }
    throw new Error(generated?.error || "Could not generate the quotation PDF.");
  }

  if (generated.blob.size > MAX_QUOTATION_PDF_BYTES) {
    throw new Error("Quotation PDF is too large to share. Please reduce large images/assets and try again.");
  }

  // Firebase callable automatically attaches the current Auth token and
  // refreshes it when required. Avoiding a forced refresh removes an extra
  // network round-trip from every quotation send.
  const functions = getFunctions(app, "us-central1");
  const uploadPdf = httpsCallable(functions, "uploadQuotationPdf", { timeout: 90_000 });
  const base64 = await blobToBase64(generated.blob);

  try {
    const response = await uploadPdf({
      leadId: clean(leadId),
      quotationId: clean(quotationId),
      revision: clean(revision),
      fileName: generated.fileName || "DreamTrawell-Quotation.pdf",
      contentType: "application/pdf",
      size: Number(generated.blob.size || 0),
      storageBucket: clean(app?.options?.storageBucket || ""),
      base64
    });

    const data = response?.data || {};
    if (!clean(data.url)) {
      throw new Error("PDF upload completed without a download URL.");
    }

    return {
      url: clean(data.url),
      storagePath: clean(data.storagePath),
      fileName: clean(data.fileName) || generated.fileName,
      size: Number(data.size || generated.blob.size || 0)
    };
  } catch (error) {
    throw new Error(getCallableMessage(error));
  }
}
