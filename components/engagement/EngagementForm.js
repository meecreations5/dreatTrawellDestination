"use client";

import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  serverTimestamp,
  query,
  where,
  getDocs
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";

import EngagementChip from "@/components/engagement/EngagementChip";

export default function EngagementForm({ agent }) {
  const { user, loading } = useAuth();

  const [team, setTeam] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [form, setForm] = useState(null);

  /* =========================
     INIT FORM
  ========================== */
  useEffect(() => {
    if (!user) return;

    setForm({
      spocIndex: 0,
      channel: "call",
      subject: "",
      message: "",
      destinationRefId: "",
      destinationName: "",
      outcomeCode: "",
      customRemark: "",
      scheduledAt: "",
      assignedToUid: ""
    });
  }, [user]);

  /* LOAD TEAM */
  useEffect(() => {
    getDocs(
      query(
        collection(db, "users"),
        where("active", "==", true),
        where("role", "in", ["team", "admin"])
      )
    ).then(snap =>
      setTeam(
        snap.docs.map(d => ({
          uid: d.id,
          name: d.data().name
        }))
      )
    );
  }, []);

  /* LOAD DESTINATIONS */
  useEffect(() => {
    getDocs(
      query(
        collection(db, "destinations"),
        where("active", "==", true)
      )
    ).then(snap =>
      setDestinations(
        snap.docs.map(d => ({ id: d.id, ...d.data() }))
      )
    );
  }, []);

  if (loading || !user || !form || !agent?.spocs?.length) return null;

  /* =========================
     SAVE
  ========================== */
  const submit = async () => {
    if (!form.subject.trim() || !form.message.trim()) {
      alert("Subject and summary are required");
      return;
    }

    const spoc = agent.spocs[form.spocIndex];
    const assignee = team.find(t => t.uid === form.assignedToUid);

    await addDoc(collection(db, "engagements"), {
      entityType: "travelAgent",
      agentId: agent.id,
      agentName: agent.agencyName,
      spoc,
      channel: form.channel,
      subject: form.subject,
      message: form.message,
      destinationRefId: form.destinationRefId || null,
      destinationName: form.destinationName || null,
      outcomeCode: form.outcomeCode || null,
      customRemark: form.customRemark || "",
      scheduledAt: form.scheduledAt
        ? new Date(form.scheduledAt)
        : null,
      status: form.scheduledAt ? "scheduled" : "completed",
      assignedToUid: assignee?.uid || user.uid,
      assignedToName: assignee?.name || user.name,
      leadId: null,
      createdByUid: user.uid,
      createdByName: user.name,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    alert("Engagement saved");

    setForm({
      ...form,
      subject: "",
      message: "",
      outcomeCode: "",
      customRemark: "",
      scheduledAt: ""
    });
  };

  /* =========================
     UI
  ========================== */
  return (
    <div
      className="
        bg-white rounded-xl shadow-card
        lg:sticky lg:top-6
        flex flex-col
        max-h-[calc(100vh-3rem)]
      "
    >
      {/* ================= BODY (SCROLLABLE) ================= */}
      <div className="p-5 space-y-5 overflow-y-auto pb-28">
        <h2 className="text-sm font-semibold">
          New Engagement
        </h2>

        {/* SPOC */}
        <Field label="Select SPOC">
          <select
            className="mui-input"
            value={form.spocIndex}
            onChange={e =>
              setForm({ ...form, spocIndex: Number(e.target.value) })
            }
          >
            {agent.spocs.map((s, i) => (
              <option key={i} value={i}>
                {s.name} ({s.designation})
              </option>
            ))}
          </select>
        </Field>

        {/* CHANNEL */}
        <Field label="Select Channel">
          <div className="flex gap-3 flex-wrap">
            {[
              { key: "call", label: "Call", icon: "📞" },
              { key: "email", label: "Email", icon: "✉️" },
              { key: "whatsapp", label: "WhatsApp", icon: "💬" },
              { key: "meeting", label: "Meeting", icon: "🤝" }
            ].map(c => (
              <EngagementChip
                key={c.key}
                label={c.label}
                icon={c.icon}
                active={form.channel === c.key}
                onClick={() =>
                  setForm({ ...form, channel: c.key })
                }
              />
            ))}
          </div>
        </Field>

        {/* DESTINATION */}
        <Field label="Select Destination">
          <select
            className="mui-input"
            value={form.destinationRefId}
            onChange={e => {
              const d = destinations.find(
                x => x.id === e.target.value
              );
              setForm({
                ...form,
                destinationRefId: d?.id || "",
                destinationName: d?.name || ""
              });
            }}
          >
            <option value="">No Destination</option>
            {destinations.map(d => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Subject">
          <input
            className="mui-input"
            value={form.subject}
            onChange={e =>
              setForm({ ...form, subject: e.target.value })
            }
          />
        </Field>

        <Field label="Conversation Summary">
          <textarea
            className="mui-input min-h-[90px]"
            value={form.message}
            onChange={e =>
              setForm({ ...form, message: e.target.value })
            }
          />
        </Field>

        <Field label="Outcome">
          <select
            className="mui-input"
            value={form.outcomeCode}
            onChange={e =>
              setForm({ ...form, outcomeCode: e.target.value })
            }
          >
            <option value="">Select Outcome</option>
            <option value="call_not_picked">Call Not Picked</option>
            <option value="intro_done">Introduction Done</option>
            <option value="profile_shared">Company Profile Shared</option>
            <option value="followup_required">Follow-up Required</option>
            <option value="general_update">General Update</option>
          </select>
        </Field>

        <Field label="Internal Note">
          <textarea
            className="mui-input"
            value={form.customRemark}
            onChange={e =>
              setForm({ ...form, customRemark: e.target.value })
            }
          />
        </Field>

        <Field label="Schedule Follow-up">
          <input
            type="datetime-local"
            className="mui-input"
            value={form.scheduledAt}
            onChange={e =>
              setForm({ ...form, scheduledAt: e.target.value })
            }
          />
        </Field>

        <Field label="Assign To">
          <select
            className="mui-input"
            value={form.assignedToUid}
            onChange={e =>
              setForm({ ...form, assignedToUid: e.target.value })
            }
          >
            <option value="">Assign to self</option>
            {team.map(u => (
              <option key={u.uid} value={u.uid}>
                {u.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {/* ================= STICKY FOOTER ================= */}
      <div
        className="
          sticky bottom-0
          bg-white
          border-t
          p-4
          flex justify-end
        "
      >
        <button
          onClick={submit}
          className="
            bg-blue-600 text-white
            px-6 py-2.5
            rounded-md
            text-sm font-medium
            hover:bg-blue-700
          "
        >
          Save Engagement
        </button>
      </div>
    </div>
  );
}

/* ================= HELPER ================= */

function Field({ label, children }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-600">
        {label}
      </label>
      {children}
    </div>
  );
}
