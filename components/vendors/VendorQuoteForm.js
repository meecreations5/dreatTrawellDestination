"use client";

import { useMemo, useState } from "react";
import {
  getDownloadURL,
  ref,
  uploadBytes
} from "firebase/storage";

import { storage } from "@/lib/firebase";

function cleanString(value = "") {
  return String(value || "").trim();
}

function formatCurrencyPreview(value, currency = "INR") {
  const amount = Number(value || 0);

  if (!amount) return "—";

  try {
    return amount.toLocaleString("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0
    });
  } catch {
    return `${currency} ${amount.toLocaleString("en-IN")}`;
  }
}

function safeFileName(name = "reference") {
  return String(name || "reference")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .toLowerCase();
}

export default function VendorQuoteForm({
  vendorRequest,
  initialData = null,
  saving = false,
  error = "",
  onSubmit,
  onCancel
}) {
  const [form, setForm] = useState({
    currency: initialData?.currency || "INR",
    vendorCost:
      initialData?.vendorCost ||
      initialData?.price ||
      "",

    referenceText:
      initialData?.referenceText ||
      initialData?.mailContent ||
      "",

    referenceFileUrl:
      initialData?.referenceFileUrl ||
      initialData?.attachmentUrl ||
      "",

    referenceFileName:
      initialData?.referenceFileName ||
      initialData?.attachmentName ||
      "",

    internalRemark:
      initialData?.internalRemark ||
      initialData?.remark ||
      "",

    markAsFinal:
      Boolean(
        initialData?.markAsFinal ||
        initialData?.isFinal ||
        initialData?.selected
      )
  });

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const vendorName =
    vendorRequest?.vendorName ||
    vendorRequest?.vendor?.vendorName ||
    "Vendor";

  const nextRevision = useMemo(() => {
    if (initialData?.revision) return initialData.revision;

    return Number(vendorRequest?.latestRevision || 0) + 1;
  }, [initialData, vendorRequest]);

  const pricePreview = useMemo(
    () => formatCurrencyPreview(form.vendorCost, form.currency),
    [form.vendorCost, form.currency]
  );

  const updateField = (key, value) => {
    setForm(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleFileUpload = async file => {
    if (!file) return;

    setUploadError("");

    try {
      setUploading(true);

      const leadId = vendorRequest?.leadId || "lead";
      const requestId =
        vendorRequest?.id ||
        vendorRequest?.vendorRequestId ||
        "vendor-request";

      const path = `vendor-quotes/${leadId}/${requestId}/${Date.now()}-${safeFileName(file.name)}`;

      const storageRef = ref(storage, path);

      await uploadBytes(storageRef, file);

      const downloadUrl = await getDownloadURL(storageRef);

      setForm(prev => ({
        ...prev,
        referenceFileUrl: downloadUrl,
        referenceFileName: file.name
      }));
    } catch (uploadErrorObject) {
      console.error("Vendor quote reference upload failed:", uploadErrorObject);
      setUploadError(
        uploadErrorObject?.message ||
          "Failed to upload reference file."
      );
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = e => {
    e.preventDefault();

    const vendorCost = Number(form.vendorCost || 0);

    if (!vendorCost || vendorCost <= 0) {
      alert("Please enter vendor pricing.");
      return;
    }

    onSubmit?.({
      currency: form.currency,
      vendorCost,

      referenceText: cleanString(form.referenceText),
      referenceFileUrl: cleanString(form.referenceFileUrl),
      referenceFileName: cleanString(form.referenceFileName),

      internalRemark: cleanString(form.internalRemark),

      markAsFinal: Boolean(form.markAsFinal),
      isFinal: Boolean(form.markAsFinal)
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-blue-50">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Add Vendor Pricing
              </h2>

              <p className="text-xs text-gray-500 mt-1">
                {vendorName} · Revision {nextRevision}
              </p>
            </div>

            <button
              type="button"
              onClick={onCancel}
              className="text-sm text-gray-500 hover:text-gray-800"
            >
              ✕
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {(error || uploadError) && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error || uploadError}
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Currency
              </label>

              <select
                value={form.currency}
                onChange={e => updateField("currency", e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="INR">INR</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="AED">AED</option>
                <option value="SGD">SGD</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Vendor Price *
              </label>

              <input
                type="number"
                min="0"
                value={form.vendorCost}
                onChange={e => updateField("vendorCost", e.target.value)}
                placeholder="Enter vendor cost"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="rounded-2xl bg-green-50 border border-green-100 p-4">
            <p className="text-xs font-medium text-green-700">
              Pricing Preview
            </p>

            <p className="text-2xl font-bold text-green-800 mt-1">
              {pricePreview}
            </p>

            <p className="text-xs text-green-700 mt-1">
              Date will be auto captured on save.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Vendor Mail Content / Pricing Note
            </label>

            <textarea
              rows={4}
              value={form.referenceText}
              onChange={e => updateField("referenceText", e.target.value)}
              placeholder="Paste vendor mail content, WhatsApp message, or pricing note here..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Upload Reference Image / File
            </label>

            <input
              type="file"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
              disabled={uploading}
              onChange={e => handleFileUpload(e.target.files?.[0])}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white"
            />

            {uploading && (
              <p className="text-xs text-blue-600 mt-2">
                Uploading reference file...
              </p>
            )}

            {form.referenceFileUrl && (
              <div className="mt-3 rounded-xl bg-gray-50 border border-gray-100 px-3 py-2">
                <p className="text-xs text-gray-500">
                  Reference attached
                </p>

                <a
                  href={form.referenceFileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-blue-600 hover:underline break-all"
                >
                  {form.referenceFileName || form.referenceFileUrl}
                </a>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Internal Remark
            </label>

            <textarea
              rows={2}
              value={form.internalRemark}
              onChange={e => updateField("internalRemark", e.target.value)}
              placeholder="Optional internal note for team..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <label className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 cursor-pointer">
            <input
              type="checkbox"
              checked={form.markAsFinal}
              onChange={e => updateField("markAsFinal", e.target.checked)}
              className="mt-1"
            />

            <span>
              <span className="block text-sm font-semibold text-amber-800">
                Mark as final vendor pricing
              </span>

              <span className="block text-xs text-amber-700 mt-0.5">
                This will mark this vendor price as the selected final costing for this lead.
              </span>
            </span>
          </label>

          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving || uploading}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving || uploading}
              className="px-5 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 disabled:opacity-50"
            >
              {saving
                ? "Saving..."
                : form.markAsFinal
                  ? "Save & Mark Final"
                  : "Save Pricing"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}