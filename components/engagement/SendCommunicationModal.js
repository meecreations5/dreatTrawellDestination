"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { sendEmailViaBrevo } from "@/lib/sendEmailViaBrevo";
import { sendWhatsAppWeb } from "@/lib/whatsapp";

import EngagementChip from "@/components/engagement/EngagementChip";

/* =========================
   TEMPLATE COMPILER
========================= */
function compileTemplate(template, vars) {
  let out = template || "";
  Object.entries(vars).forEach(([k, v]) => {
    out = out.replaceAll(`{{${k}}}`, v || "");
  });
  return out;
}

export default function SendCommunicationModal({ agent, onClose }) {
  const { user, loading } = useAuth();

  /* =========================
     STATE (ALL HOOKS FIRST)
  ========================== */
  const [templates, setTemplates] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [sending, setSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const [form, setForm] = useState({
    spocIndex: 0,
    channel: "email",
    templateId: "",
    body: "",
    destinationIds: []
  });

  /* =========================
     LOAD DATA
  ========================== */
  useEffect(() => {
    const load = async () => {
      const [tplSnap, destSnap] = await Promise.all([
        getDocs(
          query(
            collection(db, "communicationTemplates"),
            where("active", "==", true)
          )
        ),
        getDocs(
          query(
            collection(db, "destinations"),
            where("active", "==", true)
          )
        )
      ]);

      setTemplates(tplSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setDestinations(destSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    };

    load();
  }, []);

  /* =========================
     DERIVED (SAFE)
  ========================== */
  const spocs = agent?.spocs || [];
  const spoc = spocs[form.spocIndex] || null;

  const selectedTemplate = templates.find(
    t => t.id === form.templateId
  );

  const selectedDestinations = destinations.filter(d =>
    form.destinationIds.includes(d.id)
  );

  const destinationNames = selectedDestinations
    .map(d => d.name)
    .join(", ");

  /* =========================
     FINAL MESSAGE
  ========================== */
  const finalMessage = useMemo(() => {
    if (!spoc || !user) return "";

    let base = "";

    // TEMPLATE MODE
    if (selectedTemplate) {
      base =
        form.channel === "email"
          ? selectedTemplate.emailHtml || ""
          : selectedTemplate.whatsappText || "";
    }
    // CUSTOM MODE
    else {
      base =
        form.channel === "email"
          ? `
Hi {{spocName}},<br/><br/>
{{body}}<br/><br/>
${destinationNames ? "📍 Destination: {{destination}}<br/><br/>" : ""}
Thank you,<br/>
{{teamMemberName}}
`
          : `
Hi {{spocName}},

{{body}}

${destinationNames ? "📍 Destination: {{destination}}\n\n" : ""}
Thank you,
{{teamMemberName}}
`;
    }

    return compileTemplate(base, {
      spocName: spoc.name,
      destination: destinationNames,
      teamMemberName: user.name,
      body: form.body
    });
  }, [
    selectedTemplate,
    form.channel,
    form.body,
    destinationNames,
    spoc,
    user
  ]);

  /* =========================
     EARLY EXIT (AFTER HOOKS)
  ========================== */
  if (loading || !user || !agent || !spocs.length) return null;

  /* =========================
     SEND
  ========================== */
  const send = async () => {
    if (!selectedTemplate && !form.body.trim()) {
      alert("Message required");
      return;
    }

    if (form.channel === "email" && !spoc?.email) {
      alert("Selected SPOC has no email");
      return;
    }

    if (form.channel === "whatsapp" && !spoc?.mobile) {
      alert("Selected SPOC has no mobile");
      return;
    }

    if (!selectedDestinations.length) {
      alert("Please select at least one destination");
      return;
    }

    setSending(true);

    try {
      if (form.channel === "email") {
        await sendEmailViaBrevo({
          toEmail: spoc.email,
          toName: spoc.name,
          subject:
            selectedTemplate?.emailSubject || "Communication",
          html: finalMessage
        });
      }

      if (form.channel === "whatsapp") {
        await sendWhatsAppWeb({
          mobile: spoc.mobile,
          message: finalMessage
        });
      }

      const primary = selectedDestinations[0];

      await addDoc(collection(db, "engagements"), {
        entityType: "travelAgent",
        agentId: agent.id,
        agentName: agent.agencyName,
        spoc,

        channel: form.channel,
        subject:
          form.channel === "email"
            ? selectedTemplate?.emailSubject || null
            : null,
        messageHtml:
          form.channel === "email" ? finalMessage : null,
        messageText:
          form.channel === "whatsapp" ? finalMessage : null,

        templateId: form.templateId || null,

        destinationIds: selectedDestinations.map(d => d.id),
        destinationNames: selectedDestinations.map(d => d.name),

        destinationRefId: primary.id,
        destinationName: primary.name,

        status: "completed",

        createdByUid: user.uid,
        createdByName: user.name,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      alert("Communication sent");
      onClose();
    } catch (e) {
      console.error(e);
      alert("Failed to send communication");
    } finally {
      setSending(false);
    }
  };

  /* =========================
     UI
  ========================== */
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-card w-full max-w-xl flex flex-col max-h-[90vh]">

        {/* HEADER */}
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">
            Send Communication
          </h2>
        </div>

        {/* BODY */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* SPOC */}
          <Field label="Select SPOC">
            <select
              className="mui-input"
              value={form.spocIndex}
              onChange={e =>
                setForm({ ...form, spocIndex: Number(e.target.value) })
              }
            >
              {spocs.map((s, i) => (
                <option key={i} value={i}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>

          {/* CHANNEL */}
          <Field label="Select Channel">
            <div className="flex gap-3 flex-wrap">
              {[
                { key: "email", label: "Email", icon: "✉️" },
                { key: "whatsapp", label: "WhatsApp", icon: "💬" }
              ].map(c => (
                <EngagementChip
                  key={c.key}
                  label={c.label}
                  icon={c.icon}
                  active={form.channel === c.key}
                  onClick={() =>
                    setForm({
                      ...form,
                      channel: c.key,
                      templateId: "",
                      body: ""
                    })
                  }
                />
              ))}
            </div>
          </Field>

          {/* TEMPLATE */}
          <Field label="Select Template">
            <div className="flex gap-3 flex-wrap">
              <EngagementChip
                label="Custom Message"
                icon="✏️"
                active={!form.templateId}
                onClick={() =>
                  setForm({ ...form, templateId: "", body: "" })
                }
              />

              {templates.map(t => (
                <EngagementChip
                  key={t.id}
                  label={t.name}
                  icon="📄"
                  active={form.templateId === t.id}
                  onClick={() =>
                    setForm({ ...form, templateId: t.id, body: "" })
                  }
                />
              ))}
            </div>
          </Field>

          {/* DESTINATIONS */}
          <Field label="Select Destination">
            <div className="flex gap-3 flex-wrap">
              {destinations.map(d => (
                <EngagementChip
                  key={d.id}
                  label={d.name}
                  icon="✈️"
                  active={form.destinationIds.includes(d.id)}
                  onClick={() =>
                    setForm({
                      ...form,
                      destinationIds: form.destinationIds.includes(d.id)
                        ? form.destinationIds.filter(x => x !== d.id)
                        : [...form.destinationIds, d.id]
                    })
                  }
                />
              ))}
            </div>
          </Field>

          {/* MESSAGE */}
          {!selectedTemplate && (
            <Field label="Message">
              <textarea
                className="mui-input min-h-[100px]"
                value={form.body}
                onChange={e =>
                  setForm({ ...form, body: e.target.value })
                }
              />
            </Field>
          )}

          {/* PREVIEW */}
          <div className="space-y-2">
            <button
              onClick={() => setShowPreview(v => !v)}
              className="text-sm text-blue-600 hover:underline"
            >
              {showPreview ? "Hide Preview" : "Preview Message"}
            </button>

            {showPreview && (
              <div className="border rounded-md bg-gray-50 p-3 text-sm">
                {form.channel === "email" ? (
                  <div
                    dangerouslySetInnerHTML={{ __html: finalMessage }}
                  />
                ) : (
                  <pre className="whitespace-pre-wrap font-sans">
                    {finalMessage}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <div className="border-t px-6 py-4 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="border rounded-md px-4 py-2"
          >
            Cancel
          </button>
          <button
            onClick={send}
            disabled={sending}
            className="bg-blue-600 text-white rounded-md px-6 py-2 disabled:opacity-60"
          >
            {sending ? "Sending..." : "Send"}
          </button>
        </div>
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
