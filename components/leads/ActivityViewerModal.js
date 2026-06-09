// components/leads/ActivityViewerModal.jsx

"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";

import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { markQuotationFinal } from "@/lib/markQuotationFinal";

function toDate(value) {
  if (!value) return null;
  if (value?.toDate) return value.toDate();
  if (value instanceof Date) return value;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateTime(value) {
  const date = toDate(value);
  if (!date) return "—";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatMoney(value) {
  if (value === null || value === undefined || value === "") return "—";

  const amount = Number(value);

  if (!Number.isFinite(amount)) return "—";

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(amount);
}

function formatPercent(value) {
  if (value === null || value === undefined || value === "") return "—";

  const number = Number(value);

  if (!Number.isFinite(number)) return "—";

  return `${number.toFixed(1)}%`;
}

function getFirstValue(...values) {
  return values.find(
    value => value !== undefined && value !== null && value !== ""
  );
}

function getQuotationId(activity) {
  return getFirstValue(
    activity?.metadata?.quotationId,
    activity?.quotationId,
    activity?.id
  );
}

function getLeadId(activity) {
  return getFirstValue(
    activity?.leadId,
    activity?.metadata?.leadId
  );
}

function getSentVia(activity, quotation) {
  const metadata = activity?.metadata || {};

  const value = getFirstValue(
    metadata.sentVia,
    quotation?.sentVia,
    quotation?.sendVia,
    metadata.channel
  );

  if (Array.isArray(value)) return value.join(", ");
  return value || "—";
}

function getRevision(activity, quotation) {
  return getFirstValue(
    activity?.metadata?.revision,
    quotation?.revision,
    activity?.metadata?.rev,
    activity?.metadata?.version
  );
}

function getStatus(activity, quotation) {
  return getFirstValue(
    quotation?.status,
    activity?.metadata?.status,
    activity?.metadata?.isFinalQuotation ? "final" : "",
    activity?.metadata?.isDraft ? "draft" : ""
  );
}

function getCommercials(activity, quotation) {
  const metadata = activity?.metadata || {};

  const totalAmount = getFirstValue(
    metadata.totalAmount,
    metadata.customerQuotedAmount,
    metadata.totalPrice,
    quotation?.customerQuotedAmount,
    quotation?.totalPrice,
    quotation?.totalAmount
  );

  const vendorCost = getFirstValue(
    metadata.vendorCost,
    quotation?.vendorCost
  );

  const grossProfit = getFirstValue(
    metadata.grossProfit,
    quotation?.grossProfit,
    totalAmount !== undefined &&
      vendorCost !== undefined &&
      vendorCost !== null
      ? Number(totalAmount) - Number(vendorCost)
      : null
  );

  const marginPercent = getFirstValue(
    metadata.marginPercent,
    quotation?.marginPercent,
    totalAmount &&
      grossProfit !== undefined &&
      grossProfit !== null
      ? (Number(grossProfit) / Number(totalAmount)) * 100
      : null
  );

  return {
    totalAmount,
    vendorCost,
    grossProfit,
    marginPercent
  };
}

function DetailRow({ label, value }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-medium text-gray-900 break-all">
        {value || "—"}
      </p>
    </div>
  );
}

function CommercialCard({ commercials }) {
  return (
    <div className="bg-orange-50 border border-orange-100 rounded-lg p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <p className="text-sm font-semibold text-orange-800">
            🔒 Internal Commercials
          </p>
          <p className="text-xs text-orange-700">
            Internal only. Not visible to customer.
          </p>
        </div>

        <span className="text-[11px] bg-orange-100 text-orange-700 rounded-full px-2 py-1">
          Internal
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <DetailRow
          label="Quotation Amount"
          value={formatMoney(commercials.totalAmount)}
        />

        <DetailRow
          label="Vendor Cost"
          value={formatMoney(commercials.vendorCost)}
        />

        <DetailRow
          label="Gross Profit"
          value={formatMoney(commercials.grossProfit)}
        />

        <DetailRow
          label="Margin"
          value={formatPercent(commercials.marginPercent)}
        />
      </div>
    </div>
  );
}

function EmptyQuotationPreview() {
  return (
    <div className="border border-dashed border-gray-200 rounded-lg p-6 text-sm text-gray-500 text-center">
      Quotation content not found for this timeline record.
    </div>
  );
}

export default function ActivityViewerModal({
  activity,
  onClose,
  onEditDraft
}) {
  const { user } = useAuth();

  const [quotation, setQuotation] = useState(null);
  const [loadingQuotation, setLoadingQuotation] = useState(false);
  const [markingFinal, setMarkingFinal] = useState(false);
  const [activeTab, setActiveTab] = useState("details");

  const leadId = getLeadId(activity);
  const quotationId = getQuotationId(activity);
  const isQuotation = activity?.type === "quotation";

  useEffect(() => {
    let mounted = true;

    async function loadQuotation() {
      if (!isQuotation || !leadId || !quotationId) {
        setQuotation(null);
        return;
      }

      setLoadingQuotation(true);

      try {
        const snap = await getDoc(
          doc(db, "leads", leadId, "quotations", quotationId)
        );

        if (mounted) {
          setQuotation(
            snap.exists()
              ? {
                id: snap.id,
                ...snap.data()
              }
              : null
          );
        }
      } catch (error) {
        console.error("Failed to load quotation:", error);
        if (mounted) setQuotation(null);
      } finally {
        if (mounted) setLoadingQuotation(false);
      }
    }

    loadQuotation();

    return () => {
      mounted = false;
    };
  }, [isQuotation, leadId, quotationId]);

  const revision = useMemo(
    () => getRevision(activity, quotation),
    [activity, quotation]
  );

  const status = useMemo(
    () => getStatus(activity, quotation),
    [activity, quotation]
  );

  const sentVia = useMemo(
    () => getSentVia(activity, quotation),
    [activity, quotation]
  );

  const commercials = useMemo(
    () => getCommercials(activity, quotation),
    [activity, quotation]
  );

  const isFinal =
    status === "final" ||
    quotation?.isFinalQuotation === true ||
    activity?.metadata?.isFinalQuotation === true;

  const canMarkFinal =
    isQuotation &&
    leadId &&
    quotationId &&
    !isFinal &&
    !loadingQuotation;

  if (!activity) return null;

  const markAsFinal = async () => {
    if (!canMarkFinal || markingFinal) return;

    const ok = window.confirm(
      `Mark quotation Rev ${revision || ""} as final?`
    );

    if (!ok) return;

    setMarkingFinal(true);

    try {
      await markQuotationFinal({
        leadId,
        quotationId,
        user
      });

      const snap = await getDoc(
        doc(db, "leads", leadId, "quotations", quotationId)
      );

      if (snap.exists()) {
        setQuotation({
          id: snap.id,
          ...snap.data()
        });
      }

      alert("Quotation marked as final");
    } catch (error) {
      console.error("Mark final failed:", error);
      alert(error?.message || "Failed to mark quotation as final");
    } finally {
      setMarkingFinal(false);
    }
  };

  const itineraryHtml =
    quotation?.itineraryHtml ||
    activity?.metadata?.itineraryHtml ||
    "";

  const resolvedQuotationId = quotation?.id || quotationId;

  const isDraftQuotation =
    isQuotation &&
    (
      quotation?.isDraft === true ||
      quotation?.status === "draft" ||
      activity?.metadata?.isDraft === true ||
      activity?.metadata?.status === "draft"
    );

  const canEditDraft =
    isDraftQuotation &&
    leadId &&
    resolvedQuotationId;

  const draftPayload = quotation
    ? {
      ...quotation,
      id: quotation.id || resolvedQuotationId,
      quotationId: quotation.quotationId || resolvedQuotationId,
      leadId
    }
    : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-xl">
        {/* HEADER */}
        <div className="p-5 border-b flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {activity.title || "Activity Details"}
            </h2>

            <p className="text-xs text-gray-500 mt-1">
              {isQuotation ? "Quotation" : activity.type || "Activity"}
              {revision ? ` · Rev ${revision}` : ""}
              {status ? ` · ${status}` : ""}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* TABS */}
        {isQuotation && (
          <div className="px-5 pt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("details")}
              className={`px-3 py-1.5 rounded-full text-xs border ${activeTab === "details"
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-200"
                }`}
            >
              Details
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("quotation")}
              className={`px-3 py-1.5 rounded-full text-xs border ${activeTab === "quotation"
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-200"
                }`}
            >
              View Quotation
            </button>
          </div>
        )}

        {/* BODY */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          {isQuotation && loadingQuotation && (
            <div className="text-sm text-gray-500">
              Loading quotation details...
            </div>
          )}

          {(!isQuotation || activeTab === "details") && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <DetailRow
                  label="Total Amount"
                  value={formatMoney(commercials.totalAmount)}
                />

                <DetailRow
                  label="Sent Via"
                  value={sentVia}
                />

                <DetailRow
                  label="Date"
                  value={formatDateTime(activity.createdAt)}
                />

                <DetailRow
                  label="Revision"
                  value={revision ? `v${revision}` : "—"}
                />

                {status && (
                  <DetailRow
                    label="Status"
                    value={status}
                  />
                )}

                {quotationId && (
                  <DetailRow
                    label="Quotation ID"
                    value={quotationId}
                  />
                )}
              </div>

              {isQuotation && (
                <CommercialCard commercials={commercials} />
              )}

              {activity.description && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1">
                    Description
                  </p>
                  <p className="text-sm text-gray-800">
                    {activity.description}
                  </p>
                </div>
              )}

              {activity.metadata?.signatureUser?.name && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1">
                    Signature Used
                  </p>
                  <p className="text-sm text-gray-800">
                    {activity.metadata.signatureUser.name}
                    {activity.metadata.signatureUser.role
                      ? ` · ${activity.metadata.signatureUser.role}`
                      : ""}
                  </p>
                </div>
              )}
            </>
          )}

          {isQuotation && activeTab === "quotation" && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    Quotation Preview
                  </p>
                  <p className="text-xs text-gray-500">
                    Customer-facing quotation content.
                  </p>
                </div>

                {isFinal ? (
                  <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 px-3 py-1 rounded-full">
                    Final Quotation
                  </span>
                ) : (
                  <span className="text-xs bg-gray-50 text-gray-600 border border-gray-200 px-3 py-1 rounded-full">
                    Not Final
                  </span>
                )}
              </div>

              {itineraryHtml ? (
                <div className="border border-gray-200 rounded-lg bg-white p-4 overflow-x-auto">
                  <div
                    className="text-sm quotation-preview"
                    dangerouslySetInnerHTML={{
                      __html: itineraryHtml
                    }}
                  />
                </div>
              ) : (
                <EmptyQuotationPreview />
              )}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="p-5 border-t flex flex-col md:flex-row md:items-center gap-3">
          <p className="text-xs text-gray-500 flex-1">
            Created by{" "}
            <span className="font-medium">
              {activity.createdByName ||
                activity.createdByEmail ||
                "System"}
            </span>
          </p>

          <div className="flex gap-2">
            {isQuotation && (
              <button
                type="button"
                onClick={() => setActiveTab("quotation")}
                className="border border-gray-200 px-4 py-2 rounded-lg text-sm hover:bg-gray-50"
              >
                View Quotation
              </button>
            )}

            {canMarkFinal && (
              <button
                type="button"
                onClick={markAsFinal}
                disabled={markingFinal}
                className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-60"
              >
                {markingFinal ? "Marking..." : "Mark as Final"}
              </button>
            )}

            {canEditDraft && (
              <button
                type="button"
                onClick={() => onEditDraft?.(draftPayload)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm"
              >
                Edit / Send Draft
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="border border-gray-200 px-4 py-2 rounded-lg text-sm hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .quotation-preview table {
          border-collapse: collapse;
          width: 100%;
        }

        .quotation-preview td,
        .quotation-preview th {
          border: 1px solid #d1d5db;
          padding: 6px 8px;
          vertical-align: top;
        }

        .quotation-preview p {
          margin: 6px 0;
        }
      `}</style>
    </div>
  );
}