// componenets/leads/NextActionModal

"use client";

import { useState } from "react";
import { updateNextAction } from "@/lib/updateNextAction";
import { useAuth } from "@/hooks/useAuth";

export default function NextActionModal({ lead, onClose }) {
  const { user } = useAuth();

  const [type, setType] = useState(
    lead.nextActionType || ""
  );
  const [date, setDate] = useState(
    lead.nextActionDueAt?.toDate
      ? lead.nextActionDueAt.toDate().toISOString().slice(0, 16)
      : ""
  );

  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await updateNextAction({
        leadId: lead.id,
        nextActionType: type || null,
        nextActionDueAt: type ? new Date(date) : null,
        user
      });

      alert("Next action updated");
      onClose(true);
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-xl w-full max-w-md space-y-4">
        <h2 className="font-semibold text-lg">
          Update Next Action
        </h2>

        <select
          className="border p-2 w-full"
          value={type}
          onChange={e => setType(e.target.value)}
        >
          <option value="">No next action</option>
          <option value="follow_up">Follow-up</option>
          <option value="quotation">Quotation</option>
        </select>

        {type && (
          <input
            type="datetime-local"
            className="border p-2 w-full"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        )}

        <div className="flex gap-2">
          <button
            onClick={() => onClose()}
            className="w-1/2 border py-2 rounded"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="w-1/2 bg-green-600 text-white py-2 rounded"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
