// components/leads/FollowUpForm.js

"use client";

import { useState } from "react";
import { logFollowUp } from "@/lib/logFollowUp";
import { useAuth } from "@/hooks/useAuth";

export default function FollowUpForm({ leadId }) {
  const { user } = useAuth();

  const [form, setForm] = useState({
    type: "call",
    outcome: "connected",
    summary: "",
    nextFollowUpAt: ""
  });

  const submit = async () => {
    await logFollowUp({
      leadId,
      channel: form.type,
      outcome: form.outcome,
      summary: form.summary,
      nextFollowUpAt: form.nextFollowUpAt
        ? new Date(form.nextFollowUpAt)
        : null,
      user
    });

    setForm({
      type: "call",
      outcome: "connected",
      summary: "",
      nextFollowUpAt: ""
    });

    alert("Follow-up logged");
  };

  return (
    <div className="bg-white p-4 rounded shadow space-y-2">
      <h3 className="font-semibold">Log Follow-Up</h3>

      <select
        className="border p-2 w-full"
        value={form.type}
        onChange={e =>
          setForm({ ...form, type: e.target.value })
        }
      >
        <option value="call">Call</option>
        <option value="whatsapp">WhatsApp</option>
        <option value="meeting">Meeting</option>
      </select>

      <select
        className="border p-2 w-full"
        value={form.outcome}
        onChange={e =>
          setForm({ ...form, outcome: e.target.value })
        }
      >
        <option value="connected">Connected</option>
        <option value="not_picked">Not Picked</option>
        <option value="interested">Interested</option>
        <option value="quote_requested">Quote Requested</option>
        <option value="not_interested">Not Interested</option>
        <option value="lost">Lead Lost</option>
      </select>

      <textarea
        className="border p-2 w-full"
        placeholder="Summary"
        value={form.summary}
        onChange={e =>
          setForm({ ...form, summary: e.target.value })
        }
      />

      <input
        type="datetime-local"
        className="border p-2 w-full"
        value={form.nextFollowUpAt}
        onChange={e =>
          setForm({ ...form, nextFollowUpAt: e.target.value })
        }
      />

      <button
        onClick={submit}
        className="bg-blue-600 text-white w-full py-2 rounded"
      >
        Save Follow-Up
      </button>
    </div>
  );
}
