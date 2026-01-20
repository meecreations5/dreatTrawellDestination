// componenets/leads/addFollowUpModal

"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { logFollowUp } from "@/lib/logFollowUp";

export default function AddFollowUpModal({ leadId, onClose }) {
  const { user } = useAuth();

  const [channel, setChannel] = useState("call");
  const [summary, setSummary] = useState("");
  const [nextFollowUpAt, setNextFollowUpAt] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!summary.trim()) {
      alert("Summary is required");
      return;
    }

    setSaving(true);

    try {
      await logFollowUp({
        leadId,
        channel,
        outcome: "connected",
        summary,
        nextFollowUpAt: nextFollowUpAt
          ? new Date(nextFollowUpAt)
          : null,
        user
      });

      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white p-6 rounded-xl w-full max-w-md space-y-3">
        <h2 className="font-semibold text-sm">Log Follow-Up</h2>

        <select
          value={channel}
          onChange={e => setChannel(e.target.value)}
          className="border rounded-md px-3 py-2 w-full"
        >
          <option value="call">📞 Call</option>
          <option value="whatsapp">💬 WhatsApp</option>
          <option value="meeting">🤝 Meeting</option>
        </select>

        <textarea
          rows={3}
          className="border rounded-md px-3 py-2 w-full"
          placeholder="Conversation summary"
          value={summary}
          onChange={e => setSummary(e.target.value)}
        />

        {/* 🔑 THIS CONTROLS NEXT ACTION */}
        <input
          type="datetime-local"
          className="border rounded-md px-3 py-2 w-full"
          value={nextFollowUpAt}
          onChange={e => setNextFollowUpAt(e.target.value)}
        />

        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            className="w-1/2 border py-2 rounded-md"
          >
            Cancel
          </button>

          <button
            onClick={save}
            disabled={saving}
            className="w-1/2 bg-blue-600 text-white py-2 rounded-md"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
