"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Loader2,
  Trophy,
  X
} from "lucide-react";

import {
  LOST_REASON_OPTIONS,
  getLeadStageMeta,
  isConvertedStage,
  isLostStage
} from "@/lib/leadStages";

export default function LeadStageCloseModal({
  open,
  newStage,
  saving = false,
  error = "",
  onClose,
  onConfirm
}) {
  const [remark, setRemark] = useState("");
  const [lostReason, setLostReason] = useState("");
  const [localError, setLocalError] = useState("");

  const stageMeta = getLeadStageMeta(newStage);
  const isConverted = isConvertedStage(newStage);
  const isLost = isLostStage(newStage);

  useEffect(() => {
    if (!open) return;

    setRemark("");
    setLostReason("");
    setLocalError("");
  }, [open, newStage]);

  const quickRemarks = useMemo(() => {
    if (isConverted) {
      return [
        "Travel agent confirmed booking and payment is pending.",
        "Final quotation accepted and booking moved to conversion.",
        "Agent confirmed package after follow-up."
      ];
    }

    return [
      "Agent dropped due to budget mismatch.",
      "No response after multiple follow-ups.",
      "Agent chose another travel partner.",
      "Travel date is not fixed yet."
    ];
  }, [isConverted]);

  if (!open) return null;

  const handleConfirm = () => {
    setLocalError("");

    if (isLost && !lostReason) {
      setLocalError("Lost reason is required.");
      return;
    }

    if (!remark.trim()) {
      setLocalError(
        isLost
          ? "Lost remark is required."
          : "Conversion remark is required."
      );
      return;
    }

    onConfirm?.({
      remark: remark.trim(),
      lostReason: isLost ? lostReason : ""
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
        {/* HEADER */}
        <div className="p-5 border-b border-gray-100 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={`
                h-10 w-10 rounded-xl flex items-center justify-center
                ${
                  isConverted
                    ? "bg-green-50 text-green-700"
                    : "bg-rose-50 text-rose-700"
                }
              `}
            >
              {isConverted ? (
                <Trophy size={20} />
              ) : (
                <AlertTriangle size={20} />
              )}
            </div>

            <div>
              <h2 className="text-base font-semibold text-gray-900">
                Confirm Stage Change
              </h2>

              <p className="text-sm text-gray-500 mt-1">
                Moving this lead to{" "}
                <span className="font-semibold text-gray-800">
                  {stageMeta.label}
                </span>
                .
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="text-gray-400 hover:text-gray-700 disabled:opacity-60"
          >
            <X size={18} />
          </button>
        </div>

        {/* BODY */}
        <div className="p-5 space-y-4">
          <div
            className={`
              rounded-xl p-3 border text-sm
              ${
                isConverted
                  ? "bg-green-50 border-green-100 text-green-700"
                  : "bg-rose-50 border-rose-100 text-rose-700"
              }
            `}
          >
            {isConverted
              ? "Mark this lead as converted after final confirmation."
              : "Mark this lead as lost with a clear reason."}
          </div>

          {isLost && (
            <div>
              <label className="text-xs font-medium text-gray-500">
                Lost Reason <span className="text-red-500">*</span>
              </label>

              <select
                value={lostReason}
                disabled={saving}
                onChange={e => {
                  setLostReason(e.target.value);
                  setLocalError("");
                }}
                className="
                  mt-1 w-full border border-gray-200 rounded-lg
                  px-3 py-2 text-sm bg-white
                  focus:outline-none focus:ring-2 focus:ring-blue-100
                  disabled:bg-gray-50 disabled:text-gray-400
                "
              >
                <option value="">Select lost reason</option>

                {LOST_REASON_OPTIONS.map(item => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-gray-500">
              {isLost ? "Lost Remark" : "Conversion Remark"}{" "}
              <span className="text-red-500">*</span>
            </label>

            <textarea
              rows={4}
              value={remark}
              disabled={saving}
              onChange={e => {
                setRemark(e.target.value);
                setLocalError("");
              }}
              placeholder={
                isLost
                  ? "Example: Agent selected another vendor due to price difference."
                  : "Example: Agent confirmed final quotation and payment is expected."
              }
              className="
                mt-1 w-full border border-gray-200 rounded-lg
                px-3 py-2 text-sm resize-none
                focus:outline-none focus:ring-2 focus:ring-blue-100
                disabled:bg-gray-50 disabled:text-gray-400
              "
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {quickRemarks.map(item => (
              <button
                key={item}
                type="button"
                disabled={saving}
                onClick={() => {
                  setRemark(item);
                  setLocalError("");
                }}
                className={`
                  text-xs px-3 py-1.5 rounded-full border disabled:opacity-60
                  ${
                    isConverted
                      ? "bg-green-50 text-green-700 border-green-100"
                      : "bg-rose-50 text-rose-700 border-rose-100"
                  }
                `}
              >
                {item}
              </button>
            ))}
          </div>

          {(localError || error) && (
            <p className="text-xs text-red-600">
              {localError || error}
            </p>
          )}
        </div>

        {/* FOOTER */}
        <div className="p-5 border-t border-gray-100 flex gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="
              flex-1 border border-gray-200 rounded-lg
              py-2 text-sm hover:bg-gray-50
              disabled:opacity-60
            "
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={handleConfirm}
            className={`
              flex-1 rounded-lg py-2 text-sm text-white
              disabled:opacity-60
              inline-flex items-center justify-center gap-2
              ${
                isConverted
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-rose-600 hover:bg-rose-700"
              }
            `}
          >
            {saving && <Loader2 size={15} className="animate-spin" />}
            {saving ? "Updating..." : `Confirm ${stageMeta.label}`}
          </button>
        </div>
      </div>
    </div>
  );
}