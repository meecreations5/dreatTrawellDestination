"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp
} from "firebase/firestore";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Mail,
  MapPin,
  MessageCircle,
  Send,
  Sparkles,
  UserRound,
  X
} from "lucide-react";

import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { sendEmailViaBrevo } from "@/lib/sendEmailViaBrevo";
import { sendWhatsAppWeb } from "@/lib/whatsapp";

import { getBrandingSettings } from "@/lib/brandingSettings";
import {
  buildEmailSignatureHtml,
  buildWhatsAppSignatureText
} from "@/lib/signatureUtils";

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

/* =========================
   HELPERS
========================= */
function getFirstValue(...values) {
  return (
    values.find(
      value => typeof value === "string" && value.trim().length > 0
    )?.trim() || ""
  );
}

function getUserUid(user) {
  return getFirstValue(user?.uid, user?.id);
}

function getUserName(user, profile) {
  return getFirstValue(
    profile?.name,
    profile?.displayName,
    user?.name,
    user?.displayName,
    user?.email,
    "Team Member"
  );
}

function getSpocName(spoc) {
  return getFirstValue(
    spoc?.name,
    spoc?.email,
    spoc?.mobile,
    "Partner"
  );
}

function getSpocLabel(spoc) {
  if (!spoc) return "SPOC";

  const name = getFirstValue(spoc.name, "Unnamed SPOC");
  const contact = getFirstValue(spoc.email, spoc.mobile);

  return contact ? `${name} — ${contact}` : name;
}

function templateSupportsChannel(template, channel) {
  if (!template) return false;

  if (channel === "email") {
    return Boolean(template.emailHtml || template.emailSubject);
  }

  if (channel === "whatsapp") {
    return Boolean(template.whatsappText);
  }

  return false;
}

function buildSignatureMember({ user, profile, branding }) {
  return {
    uid: getUserUid(user),

    name: getFirstValue(
      profile?.name,
      profile?.displayName,
      user?.name,
      user?.displayName,
      user?.email
    ),

    displayName: getFirstValue(
      profile?.displayName,
      profile?.name,
      user?.displayName,
      user?.name
    ),

    email: getFirstValue(
      profile?.email,
      user?.email,
      branding?.supportEmail
    ),

    mobile: getFirstValue(
      profile?.mobile,
      profile?.phone,
      user?.mobile,
      user?.phone,
      branding?.supportMobile
    ),

    designation: getFirstValue(
      profile?.designation,
      profile?.roleTitle,
      profile?.role,
      user?.designation,
      user?.roleTitle,
      user?.role
    ),

    department: getFirstValue(
      profile?.department,
      profile?.teamName,
      user?.department,
      user?.teamName
    ),

    ...(branding || {}),

    signatureEnabled: profile?.signatureEnabled !== false,

    signatureHtml: getFirstValue(
      profile?.signatureHtml,
      profile?.emailSignatureHtml
    ),

    emailSignatureHtml: getFirstValue(
      profile?.emailSignatureHtml,
      profile?.signatureHtml
    ),

    whatsappSignature: getFirstValue(
      profile?.whatsappSignature,
      profile?.signatureText
    ),

    signatureText: getFirstValue(
      profile?.signatureText,
      profile?.whatsappSignature
    )
  };
}

function appendSignatureIfNeeded({ base, compiled, signature }) {
  if (!signature) return compiled;

  if (base.includes("{{signature}}")) {
    return compiled;
  }

  return `${compiled}${signature}`;
}

function getChannelIcon(channel) {
  if (channel === "email") {
    return <Mail size={16} />;
  }

  return <MessageCircle size={16} />;
}

function getSendButtonLabel(channel, sending) {
  if (sending) return "Sending...";
  if (channel === "email") return "Send Email";
  return "Open WhatsApp";
}

export default function SendCommunicationModal({ agent, onClose }) {
  const { user, loading } = useAuth();

  /* =========================
     STATE
  ========================== */
  const [templates, setTemplates] = useState([]);
  const [destinations, setDestinations] = useState([]);

  const [branding, setBranding] = useState(null);
  const [profile, setProfile] = useState(null);
  const [metaLoading, setMetaLoading] = useState(true);

  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState("");
  const [previewMode, setPreviewMode] = useState("message");

  const [form, setForm] = useState({
    spocIndex: 0,
    channel: "email",
    templateId: "",
    body: "",
    destinationIds: []
  });

  const uid = getUserUid(user);

  /* =========================
     LOAD DATA
  ========================== */
  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!user) return;

      setMetaLoading(true);

      try {
        const [tplSnap, destSnap, brandingData, userSnap] =
          await Promise.all([
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
            ),
            getBrandingSettings(),
            uid ? getDoc(doc(db, "users", uid)) : null
          ]);

        if (!mounted) return;

        setTemplates(
          tplSnap.docs.map(d => ({
            id: d.id,
            ...d.data()
          }))
        );

        setDestinations(
          destSnap.docs.map(d => ({
            id: d.id,
            ...d.data()
          }))
        );

        setBranding(brandingData || null);

        setProfile(
          userSnap?.exists()
            ? {
                id: userSnap.id,
                ...userSnap.data()
              }
            : null
        );
      } catch (error) {
        console.error("Failed to load communication data:", error);
        alert("Failed to load communication data");
      } finally {
        if (mounted) {
          setMetaLoading(false);
        }
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [user, uid]);

  /* =========================
     DERIVED
  ========================== */
  const spocs = agent?.spocs || [];
  const spoc = spocs[form.spocIndex] || null;

  const filteredTemplates = useMemo(() => {
    return templates.filter(template =>
      templateSupportsChannel(template, form.channel)
    );
  }, [templates, form.channel]);

  const selectedTemplate = filteredTemplates.find(
    t => t.id === form.templateId
  );

  useEffect(() => {
    if (!form.templateId) return;

    const templateStillValid = filteredTemplates.some(
      template => template.id === form.templateId
    );

    if (!templateStillValid) {
      setForm(prev => ({
        ...prev,
        templateId: "",
        body: ""
      }));
    }
  }, [form.templateId, filteredTemplates]);

  const selectedDestinations = destinations.filter(d =>
    form.destinationIds.includes(d.id)
  );

  const destinationNames = selectedDestinations
    .map(d => d.name)
    .join(", ");

  const signatureMember = useMemo(() => {
    return buildSignatureMember({
      user,
      profile,
      branding
    });
  }, [user, profile, branding]);

  const signature = useMemo(() => {
    if (!signatureMember?.signatureEnabled) return "";

    if (form.channel === "email") {
      return buildEmailSignatureHtml(signatureMember);
    }

    return `\n\n${buildWhatsAppSignatureText(signatureMember)}`;
  }, [form.channel, signatureMember]);

  const finalMessage = useMemo(() => {
    if (!spoc || !user) return "";

    let base = "";

    if (selectedTemplate) {
      base =
        form.channel === "email"
          ? selectedTemplate.emailHtml || ""
          : selectedTemplate.whatsappText || "";
    } else {
      base =
        form.channel === "email"
          ? `
Hi {{spocName}},<br/><br/>
{{body}}<br/><br/>
${destinationNames ? "📍 Destination: {{destination}}<br/>" : ""}
{{signature}}
`
          : `
Hi {{spocName}},

{{body}}

${destinationNames ? "📍 Destination: {{destination}}\n" : ""}
{{signature}}
`;
    }

    const compiled = compileTemplate(base, {
      spocName: getSpocName(spoc),
      destination: destinationNames,
      teamMemberName: getUserName(user, profile),
      body: form.body,
      signature
    });

    return appendSignatureIfNeeded({
      base,
      compiled,
      signature
    });
  }, [
    selectedTemplate,
    form.channel,
    form.body,
    destinationNames,
    spoc,
    user,
    profile,
    signature
  ]);

  const hasValidEmail = Boolean(spoc?.email);
  const hasValidMobile = Boolean(spoc?.mobile);

  const channelContactValid =
    form.channel === "email" ? hasValidEmail : hasValidMobile;

  const canSend =
    !sending &&
    channelContactValid &&
    selectedDestinations.length > 0 &&
    (selectedTemplate || form.body.trim());

  /* =========================
     EARLY EXIT
  ========================== */
  if (loading || metaLoading || !user || !agent || !spocs.length) {
    return null;
  }

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
        setSendStatus("Sending email...");

        await sendEmailViaBrevo({
          toEmail: spoc.email,
          toName: getSpocName(spoc),
          subject: selectedTemplate?.emailSubject || "Communication",
          html: finalMessage
        });
      }

      if (form.channel === "whatsapp") {
        setSendStatus("Opening WhatsApp...");

        await sendWhatsAppWeb({
          mobile: spoc.mobile,
          message: finalMessage
        });
      }

      setSendStatus("Saving engagement...");

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

        signatureIncluded: Boolean(signature),
        signatureSource: Boolean(signature)
          ? "branding_and_user_profile"
          : "disabled_or_missing",

        brandingSnapshot: branding || null,

        senderProfileSnapshot: {
          uid,
          name: signatureMember.name || "",
          email: signatureMember.email || "",
          mobile: signatureMember.mobile || "",
          designation: signatureMember.designation || "",
          signatureEnabled: signatureMember.signatureEnabled !== false
        },

        status: "completed",

        createdByUid: uid,
        createdByName: getUserName(user, profile),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      setSendStatus("Done");
      alert("Communication sent");
      onClose();
    } catch (error) {
      console.error("Failed to send communication:", error);
      alert("Failed to send communication");
    } finally {
      setSending(false);
      setSendStatus("");
    }
  };

  /* =========================
     UI
  ========================== */
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-3">
      <div className="bg-white rounded-2xl shadow-card w-full max-w-6xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* HEADER */}
        <div className="px-5 sm:px-6 py-4 border-b bg-white flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                <Send size={18} />
              </div>

              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Send Communication
                </h2>

                <p className="text-xs text-gray-500 mt-0.5">
                  Compose, preview and send with your profile signature.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="h-9 w-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-60"
          >
            <X size={18} />
          </button>
        </div>

        {/* BODY */}
        <div className="grid grid-cols-1 lg:grid-cols-2 min-h-0 flex-1">
          {/* LEFT: COMPOSE */}
          <div className="p-5 sm:p-6 space-y-5 overflow-y-auto border-r border-gray-100">
            {/* RECIPIENT SUMMARY */}
            <section className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <UserRound size={16} className="text-gray-500" />
                <p className="text-sm font-semibold text-gray-900">
                  Recipient
                </p>
              </div>

              <Field label="Select SPOC">
                <select
                  className="mui-input"
                  value={form.spocIndex}
                  onChange={e =>
                    setForm({
                      ...form,
                      spocIndex: Number(e.target.value)
                    })
                  }
                >
                  {spocs.map((s, i) => (
                    <option key={i} value={i}>
                      {getSpocLabel(s)}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <ContactStatus
                  label="Email"
                  value={spoc?.email}
                  valid={hasValidEmail}
                />

                <ContactStatus
                  label="Mobile"
                  value={spoc?.mobile}
                  valid={hasValidMobile}
                />
              </div>
            </section>

            {/* CHANNEL */}
            <section className="space-y-2">
              <SectionTitle
                icon={getChannelIcon(form.channel)}
                title="Channel"
                description="Choose how you want to send this communication."
              />

              <div className="grid grid-cols-2 gap-3">
                <ChannelCard
                  active={form.channel === "email"}
                  icon={<Mail size={18} />}
                  title="Email"
                  description="Send via Brevo"
                  onClick={() =>
                    setForm({
                      ...form,
                      channel: "email",
                      templateId: "",
                      body: ""
                    })
                  }
                />

                <ChannelCard
                  active={form.channel === "whatsapp"}
                  icon={<MessageCircle size={18} />}
                  title="WhatsApp"
                  description="Open WhatsApp Web"
                  onClick={() =>
                    setForm({
                      ...form,
                      channel: "whatsapp",
                      templateId: "",
                      body: ""
                    })
                  }
                />
              </div>

              {!channelContactValid && (
                <div className="flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-700">
                  <AlertCircle size={15} className="mt-0.5 shrink-0" />
                  <span>
                    {form.channel === "email"
                      ? "Selected SPOC does not have an email address."
                      : "Selected SPOC does not have a mobile number."}
                  </span>
                </div>
              )}
            </section>

            {/* TEMPLATE */}
            <section className="space-y-2">
              <SectionTitle
                icon={<FileText size={16} />}
                title="Template"
                description={`Showing ${
                  form.channel === "email" ? "Email" : "WhatsApp"
                } templates only.`}
              />

              <div className="flex gap-3 flex-wrap">
                <EngagementChip
                  label="Custom Message"
                  icon="✏️"
                  active={!form.templateId}
                  onClick={() =>
                    setForm({
                      ...form,
                      templateId: "",
                      body: ""
                    })
                  }
                />

                {filteredTemplates.map(t => (
                  <EngagementChip
                    key={t.id}
                    label={t.name}
                    icon={form.channel === "email" ? "✉️" : "💬"}
                    active={form.templateId === t.id}
                    onClick={() =>
                      setForm({
                        ...form,
                        templateId: t.id,
                        body: ""
                      })
                    }
                  />
                ))}

                {filteredTemplates.length === 0 && (
                  <div className="w-full rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-700">
                    No {form.channel === "email" ? "email" : "WhatsApp"} templates available.
                    You can still use Custom Message.
                  </div>
                )}
              </div>
            </section>

            {/* DESTINATIONS */}
            <section className="space-y-2">
              <SectionTitle
                icon={<MapPin size={16} />}
                title="Destination"
                description="Select one or more destinations for this communication."
              />

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

              {!selectedDestinations.length && (
                <p className="text-xs text-orange-600">
                  Please select at least one destination.
                </p>
              )}
            </section>

            {/* MESSAGE */}
            {!selectedTemplate && (
              <section className="space-y-2">
                <SectionTitle
                  icon={<Sparkles size={16} />}
                  title="Message"
                  description="Write the main content. Signature is added automatically."
                />

                <textarea
                  className="mui-input min-h-[130px]"
                  value={form.body}
                  placeholder="Write your message..."
                  onChange={e =>
                    setForm({
                      ...form,
                      body: e.target.value
                    })
                  }
                />
              </section>
            )}

            {/* SIGNATURE STATUS */}
            <section className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-start gap-2">
                {signature ? (
                  <CheckCircle2
                    size={17}
                    className="text-green-600 mt-0.5"
                  />
                ) : (
                  <AlertCircle
                    size={17}
                    className="text-orange-600 mt-0.5"
                  />
                )}

                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    Signature
                  </p>

                  <p className="text-xs text-gray-500 mt-1">
                    {signature
                      ? "Active — using My Profile signature with Branding Settings."
                      : "Not included — signature is disabled or missing in My Profile."}
                  </p>
                </div>
              </div>
            </section>
          </div>

          {/* RIGHT: PREVIEW */}
          <div className="bg-gray-50 p-5 sm:p-6 overflow-y-auto">
            <div className="space-y-4">
              {/* SUMMARY */}
              <section className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <p className="text-sm font-semibold text-gray-900 mb-3">
                  Ready Summary
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <SummaryItem
                    label="Channel"
                    value={form.channel === "email" ? "Email" : "WhatsApp"}
                  />

                  <SummaryItem
                    label="To"
                    value={
                      form.channel === "email"
                        ? spoc?.email || "Missing email"
                        : spoc?.mobile || "Missing mobile"
                    }
                  />

                  <SummaryItem
                    label="Agent"
                    value={agent?.agencyName || agent?.name || "—"}
                  />

                  <SummaryItem
                    label="Destination"
                    value={destinationNames || "Not selected"}
                  />

                  <SummaryItem
                    label="Template"
                    value={selectedTemplate?.name || "Custom Message"}
                  />

                  <SummaryItem
                    label="Signature"
                    value={signature ? "Included" : "Not included"}
                  />
                </div>
              </section>

              {/* PREVIEW MODE */}
              <section className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <div className="border-b border-gray-100 px-4 py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      Live Preview
                    </p>
                    <p className="text-xs text-gray-500">
                      Final content that will be sent and saved.
                    </p>
                  </div>

                  <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                    <button
                      type="button"
                      onClick={() => setPreviewMode("message")}
                      className={`px-3 py-1.5 ${
                        previewMode === "message"
                          ? "bg-blue-600 text-white"
                          : "bg-white text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      Message
                    </button>

                    <button
                      type="button"
                      onClick={() => setPreviewMode("signature")}
                      className={`px-3 py-1.5 ${
                        previewMode === "signature"
                          ? "bg-blue-600 text-white"
                          : "bg-white text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      Signature
                    </button>
                  </div>
                </div>

                <div className="p-4">
                  {previewMode === "message" ? (
                    form.channel === "email" ? (
                      <div
                        className="border border-gray-200 rounded-lg p-4 bg-white text-sm overflow-x-auto min-h-[280px]"
                        dangerouslySetInnerHTML={{
                          __html:
                            finalMessage ||
                            "Message preview will appear here."
                        }}
                      />
                    ) : (
                      <div className="bg-[#e5ddd5] rounded-xl p-4 min-h-[280px]">
                        <div className="ml-auto max-w-[90%] bg-white rounded-lg px-4 py-3 shadow-sm text-sm">
                          <pre className="whitespace-pre-wrap font-sans text-gray-800">
                            {finalMessage ||
                              "Message preview will appear here."}
                          </pre>
                        </div>
                      </div>
                    )
                  ) : form.channel === "email" ? (
                    <div
                      className="border border-gray-200 rounded-lg p-4 bg-white text-sm overflow-x-auto min-h-[220px]"
                      dangerouslySetInnerHTML={{
                        __html: signature || "Signature not available."
                      }}
                    />
                  ) : (
                    <pre className="border border-gray-200 rounded-lg p-4 bg-gray-50 text-sm whitespace-pre-wrap font-sans min-h-[220px]">
                      {signature?.trim() || "Signature not available."}
                    </pre>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="border-t bg-white px-5 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-xs text-gray-500 min-h-4">
            {sendStatus || "Communication will be saved in engagement timeline."}
          </div>

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={sending}
              className="border border-gray-200 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={send}
              disabled={!canSend}
              className="bg-blue-600 text-white rounded-lg px-6 py-2 text-sm font-medium disabled:opacity-60 hover:bg-blue-700 inline-flex items-center gap-2"
            >
              <Send size={16} />
              {getSendButtonLabel(form.channel, sending)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================
   UI HELPERS
========================= */

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

function SectionTitle({ icon, title, description }) {
  return (
    <div className="flex items-start gap-2">
      <div className="text-gray-500 mt-0.5">
        {icon}
      </div>

      <div>
        <p className="text-sm font-semibold text-gray-900">
          {title}
        </p>

        {description && (
          <p className="text-xs text-gray-500 mt-0.5">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

function ChannelCard({ active, icon, title, description, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        text-left rounded-xl border p-4 transition
        ${
          active
            ? "border-blue-500 bg-blue-50 text-blue-700"
            : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
        }
      `}
    >
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-sm font-semibold">{title}</p>
      </div>

      <p className="text-xs mt-1 opacity-80">
        {description}
      </p>
    </button>
  );
}

function ContactStatus({ label, value, valid }) {
  return (
    <div
      className={`
        rounded-lg border px-3 py-2
        ${
          valid
            ? "border-green-200 bg-green-50"
            : "border-orange-200 bg-orange-50"
        }
      `}
    >
      <div className="flex items-center gap-1.5">
        {valid ? (
          <CheckCircle2 size={14} className="text-green-600" />
        ) : (
          <AlertCircle size={14} className="text-orange-600" />
        )}

        <p
          className={`
            text-xs font-medium
            ${valid ? "text-green-700" : "text-orange-700"}
          `}
        >
          {label}
        </p>
      </div>

      <p className="text-xs text-gray-600 mt-1 truncate">
        {value || "Not available"}
      </p>
    </div>
  );
}

function SummaryItem({ label, value }) {
  return (
    <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
      <p className="text-[11px] text-gray-500">
        {label}
      </p>

      <p className="text-xs font-semibold text-gray-900 mt-0.5 break-words">
        {value || "—"}
      </p>
    </div>
  );
}