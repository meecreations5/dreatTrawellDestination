"use client";

import { X, FileText, Building2 } from "lucide-react";
import VendorQuotesList from "@/components/vendors/VendorQuotesList";

export default function VendorQuotesSidePanel({
  open,
  lead,
  leadId,
  vendorRequest,
  onClose,
  onSelected
}) {
  if (!open || !vendorRequest) return null;

  return (
    <div className="fixed inset-0 z-[80]">
      {/* OVERLAY */}
      <button
        type="button"
        aria-label="Close vendor quotes panel"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />

      {/* PANEL */}
      <aside
        className="
          absolute right-0 top-0 h-full w-full
          sm:w-[720px] lg:w-[820px]
          bg-white shadow-2xl
          flex flex-col
          animate-in slide-in-from-right duration-200
        "
      >
        {/* HEADER */}
        <div className="shrink-0 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-blue-50 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-2xl bg-white border border-purple-100 text-purple-700 flex items-center justify-center">
                  <FileText size={18} />
                </div>

                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-purple-700">
                    Vendor Quotes
                  </p>

                  <h2 className="text-lg font-semibold text-gray-900 truncate">
                    {vendorRequest.vendorName || "Vendor Pricing"}
                  </h2>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1">
                  <Building2 size={13} />
                  {vendorRequest.vendorCode || "Vendor"}
                </span>

                <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1">
                  Quotes: {Number(vendorRequest.latestRevision || vendorRequest.quoteCount || 0)}
                </span>

                {vendorRequest.selectedQuoteId && (
                  <span className="rounded-full border border-green-200 bg-green-50 px-2.5 py-1 font-semibold text-green-700">
                    Final Selected
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="h-9 w-9 rounded-xl border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:text-gray-900"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto bg-gray-50 p-4">
          <VendorQuotesList
            leadId={leadId}
            lead={lead}
            vendorRequest={vendorRequest}
            onCancel={onClose}
            onSelected={onSelected}
          />
        </div>
      </aside>
    </div>
  );
}