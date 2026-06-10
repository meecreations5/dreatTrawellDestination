"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Trophy, XCircle, X } from "lucide-react";

const STAGE_LABELS = {
  closed_won: "Closed Won",
  closed_lost: "Closed Lost"
};

export default function LeadStageCloseModal({
  open,
  newStage,
  saving = false,
  error = "",
  onClose,
  onConfirm
}) {
  const [remark, setRemark] = useState("");
  const [localError, setLocalError] = useState("");

  const isWon = newStage === "closed_won";

  useEffect(() => {
    if (!open) return;

    setRemark("");
    setLocalError("");
  }, [open, newStage]);

  const quickRemarks = useMemo(() => {
    if (isWon) {
      return [
        "Client confirmed booking and accepted quotation.",
        "Client approved final package and payment is expected.",
        "Booking converted after follow-up and package discussion."
      ];
    }

    return [
      "Client dropped due to budget mismatch.",
      "Client stopped responding after follow-ups.",
      "Client chose another travel partner.",
      "Client postponed the travel plan."
    ];
  }, [isWon]);

  if (!open) return null;

  const handleConfirm = () => {
    setLocalError("");

    if (!remark.trim()) {
      setLocalError("Closing remark is required.");
      return;
    }

    onConfirm?.(remark.trim());
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
                  isWon
                    ? "bg-green-50 text-green-700"
                    : "bg-red-50 text-red-700"
                }
              `}
            >
              {isWon ? <Trophy size={20} /> : <XCircle size={20} />}
            </div>

            <div>
              <h2 className="text-base font-semibold text-gray-900">
                Confirm Lead Closure
              </h2>

              <p className="text-sm text-gray-500 mt-1">
                Moving this lead to{" "}
                <span className="font-semibold text-gray-800">
                  {STAGE_LABELS[newStage] || "Closed"}
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
                isWon
                  ? "bg-green-50 border-green-100 text-green-700"
                  : "bg-red-50 border-red-100 text-red-700"
              }
            `}
          >
            {isWon
              ? "Mark this lead as successfully converted."
              : "Mark this lead as lost with a clear reason."}
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500">
              Closing Remark <span className="text-red-500">*</span>
            </label>

            <textarea
              rows={4}
              value={remark}
              onChange={e => {
                setRemark(e.target.value);
                setLocalError("");
              }}
              placeholder={
                isWon
                  ? "Example: Client confirmed booking and quotation accepted."
                  : "Example: Client dropped due to budget, no response, or chose another vendor."
              }
              className="
                mt-1 w-full border border-gray-200 rounded-lg
                px-3 py-2 text-sm resize-none
                focus:outline-none focus:ring-2 focus:ring-blue-100
              "
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {quickRemarks.map(item => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setRemark(item);
                  setLocalError("");
                }}
                className={`
                  text-xs px-3 py-1.5 rounded-full border
                  ${
                    isWon
                      ? "bg-green-50 text-green-700 border-green-100"
                      : "bg-red-50 text-red-700 border-red-100"
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
                isWon
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-red-600 hover:bg-red-700"
              }
            `}
          >
            {saving && <Loader2 size={15} className="animate-spin" />}
            {saving
              ? "Updating..."
              : `Confirm ${STAGE_LABELS[newStage] || "Close"}`}
          </button>
        </div>
      </div>
    </div>
  );
}