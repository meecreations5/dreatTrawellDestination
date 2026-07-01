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
  Eye,
  FileText,
  Mail,
  MapPin,
  MessageCircle,
  Package,
  Send,
  Sparkles,
  Trash2,
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
import AssetPickerModal from "@/components/documents/AssetPickerModal";

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

function escapeHtml(value = "") {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function stripHtml(value = "") {
  return String(value || "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function getAssetTitle(asset) {
  return getFirstValue(
    asset?.title,
    asset?.name,
    asset?.fileName,
    asset?.currentFileName,
    "Asset"
  );
}

function getAssetUrl(asset) {
  return getFirstValue(
    asset?.url,
    asset?.currentUrl,
    asset?.externalUrl,
    asset?.downloadUrl,
    asset?.fileUrl
  );
}

function getAssetLabel(asset) {
  const title = getAssetTitle(asset);
  const category = getFirstValue(asset?.categoryName, asset?.assetType);

  return category ? `${title} (${category})` : title;
}

function normalizeAsset(asset) {
  return {
    assetId: asset?.assetId || asset?.id || asset?.documentId || "",
    title: getAssetTitle(asset),
    url: getAssetUrl(asset),

    categoryId: asset?.categoryId || "",
    categoryName: asset?.categoryName || "",
    categorySlug: asset?.categorySlug || "",

    assetType: asset?.assetType || asset?.documentType || "document",
    usageType: asset?.usageType || "",
    visibility: asset?.visibility || "team",

    currentVersion: asset?.currentVersion || asset?.version || 1,

    fileName: asset?.fileName || asset?.currentFileName || "",
    fileSize: asset?.fileSize || asset?.currentFileSize || null,
    fileType: asset?.fileType || asset?.currentFileType || "",
    fileExtension:
      asset?.fileExtension || asset?.currentFileExtension || "",

    destinationId: asset?.destinationId || "",
    destinationName: asset?.destinationName || "",

    sharedAs: asset?.sharedAs || "file_link"
  };
}

function normalizeAssets(assets = []) {
  if (!Array.isArray(assets)) return [];

  const map = new Map();

  assets.forEach(asset => {
    const normalized = normalizeAsset(asset);

    if (!normalized.assetId && !normalized.url) return;

    const key = normalized.assetId || normalized.url;
    map.set(key, normalized);
  });

  return Array.from(map.values());
}

function buildAssetLinksText(assets = []) {
  const usableAssets = normalizeAssets(assets).filter(asset =>
    getAssetUrl(asset)
  );

  if (!usableAssets.length) return "";

  return [
    "Shared Assets:",
    ...usableAssets.map((asset, index) => {
      return `${index + 1}. ${getAssetLabel(asset)}\n${getAssetUrl(asset)}`;
    })
  ].join("\n");
}

function buildAssetLinksHtml(assets = []) {
  const usableAssets = normalizeAssets(assets).filter(asset =>
    getAssetUrl(asset)
  );

  if (!usableAssets.length) return "";

  const items = usableAssets
    .map(asset => {
      const title = escapeHtml(getAssetTitle(asset));
      const category = escapeHtml(
        getFirstValue(asset?.categoryName, asset?.assetType, "Asset")
      );
      const url = escapeHtml(getAssetUrl(asset));

      return `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;">
            <div style="font-size:14px;font-weight:600;color:#111827;">
              ${title}
            </div>
            <div style="font-size:12px;color:#6b7280;margin-top:2px;">
              ${category}
            </div>
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;text-align:right;">
            <a href="${url}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-size:12px;font-weight:600;padding:8px 12px;border-radius:8px;">
              View Asset
            </a>
          </td>
        </tr>
      `;
    })
    .join("");

  return `
    <div style="margin:18px 0;padding:14px;border:1px solid #e5e7eb;border-radius:12px;background:#f9fafb;">
      <div style="font-size:15px;font-weight:700;color:#111827;margin-bottom:8px;">
        Shared Assets
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;">
        ${items}
      </table>
    </div>
  `;
}

function templateSupportsChannel(template, channel) {
  if (!template) return false;

  if (
    template.deleted === true ||
    template.isDeleted === true ||
    template.archived === true
  ) {
    return false;
  }

  if (channel === "email") {
    if (template.channels && template.channels.email === false) {
      return false;
    }

    return Boolean(template.emailHtml || template.emailSubject);
  }

  if (channel === "whatsapp") {
    if (template.channels && template.channels.whatsapp === false) {
      return false;
    }

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
      branding?.companyEmail,
      branding?.supportEmail
    ),

    mobile: getFirstValue(
      profile?.mobile,
      profile?.phone,
      user?.mobile,
      user?.phone,
      branding?.companyPhone,
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

function injectAssetsPlaceholderIfNeeded({ base, channel, hasAssets }) {
  if (!hasAssets) return base;

  if (
    base.includes("{{assetLinks}}") ||
    base.includes("{{assetLinksHtml}}")
  ) {
    return base;
  }

  const assetPlaceholder =
    channel === "email" ? "{{assetLinksHtml}}" : "{{assetLinks}}";

  if (base.includes("{{signature}}")) {
    return base.replace(
      "{{signature}}",
      `${assetPlaceholder}${channel === "email" ? "<br/>" : "\n\n"}{{signature}}`
    );
  }

  return `${base}${channel === "email" ? "<br/><br/>" : "\n\n"}${assetPlaceholder}`;
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
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);

  const [form, setForm] = useState({
    spocIndex: 0,
    channel: "email",
    templateId: "",
    body: "",
    destinationIds: [],
    sharedAssets: []
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
          tplSnap.docs
            .map(d => ({
              id: d.id,
              ...d.data()
            }))
            .filter(
              item =>
                item.deleted !== true &&
                item.isDeleted !== true &&
                item.archived !== true
            )
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

  const selectedAssets = useMemo(() => {
    return normalizeAssets(form.sharedAssets);
  }, [form.sharedAssets]);

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
        body: "",
        sharedAssets: []
      }));
    }
  }, [form.templateId, filteredTemplates]);

  const selectedDestinations = destinations.filter(d =>
    form.destinationIds.includes(d.id)
  );

  const destinationNames = selectedDestinations
    .map(d => d.name)
    .join(", ");

  const assetLinksText = useMemo(() => {
    return buildAssetLinksText(selectedAssets);
  }, [selectedAssets]);

  const assetLinksHtml = useMemo(() => {
    return buildAssetLinksHtml(selectedAssets);
  }, [selectedAssets]);

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

  const templateVars = useMemo(() => {
    return {
      spocName: getSpocName(spoc),
      agencyName: agent?.agencyName || agent?.name || "",
      agentCode: agent?.agentCode || agent?.code || "",
      destination: destinationNames,
      teamMemberName: getUserName(user, profile),

      companyName: branding?.companyName || "",
      companyEmail: branding?.companyEmail || branding?.supportEmail || "",
      companyPhone: branding?.companyPhone || branding?.supportMobile || "",
      companyLogoUrl: branding?.companyLogoUrl || "",

      body: form.body,
      assetLinks: assetLinksText,
      assetLinksHtml,
      signature
    };
  }, [
    spoc,
    agent,
    destinationNames,
    user,
    profile,
    branding,
    form.body,
    assetLinksText,
    assetLinksHtml,
    signature
  ]);

  const finalSubject = useMemo(() => {
    const baseSubject = selectedTemplate?.emailSubject || "Communication";
    return compileTemplate(baseSubject, templateVars);
  }, [selectedTemplate, templateVars]);

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
{{assetLinksHtml}}
{{signature}}
`
          : `
Hi {{spocName}},

{{body}}

${destinationNames ? "📍 Destination: {{destination}}\n\n" : ""}
{{assetLinks}}

{{signature}}
`;
    }

    base = injectAssetsPlaceholderIfNeeded({
      base,
      channel: form.channel,
      hasAssets: selectedAssets.length > 0
    });

    const compiled = compileTemplate(base, templateVars);

    return appendSignatureIfNeeded({
      base,
      compiled,
      signature
    });
  }, [
    selectedTemplate,
    form.channel,
    destinationNames,
    spoc,
    user,
    selectedAssets.length,
    templateVars,
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
     ACTIONS
  ========================== */
  const removeAsset = assetId => {
    setForm(prev => ({
      ...prev,
      sharedAssets: (prev.sharedAssets || []).filter(
        item => item.assetId !== assetId
      )
    }));
  };

  const selectTemplate = template => {
    const templateAssets = normalizeAssets(template?.defaultAssets || []);

    setForm(prev => ({
      ...prev,
      templateId: template.id,
      body: "",
      sharedAssets: templateAssets
    }));
  };

  const selectCustomMessage = () => {
    setForm(prev => ({
      ...prev,
      templateId: "",
      body: "",
      sharedAssets: []
    }));
  };

  const changeChannel = channel => {
    setForm(prev => ({
      ...prev,
      channel,
      templateId: "",
      body: "",
      sharedAssets: []
    }));
  };

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
      let communicationStatus = "completed";
      let sendResult = null;

      if (form.channel === "email") {
        setSendStatus("Sending email...");

        await sendEmailViaBrevo({
          toEmail: spoc.email,
          toName: getSpocName(spoc),
          subject: finalSubject || "Communication",
          html: finalMessage
        });

        communicationStatus = "completed";
      }

      if (form.channel === "whatsapp") {
        setSendStatus("Opening WhatsApp...");

        sendResult = await sendWhatsAppWeb({
          mobile: spoc.mobile,
          message: finalMessage
        });

        communicationStatus = sendResult?.status || "whatsapp_opened";
      }

      setSendStatus("Saving engagement...");

      const primary = selectedDestinations[0];

      await addDoc(collection(db, "engagements"), {
        entityType: "travelAgent",
        engagementType: "communication_sent",

        agentId: agent.id,
        agentName: agent.agencyName || agent.name || "",
        travelAgentName: agent.agencyName || agent.name || "",
        agencyName: agent.agencyName || agent.name || "",

        spoc,

        channel: form.channel,
        direction: "outbound",

        subject:
          form.channel === "email"
            ? finalSubject || null
            : null,

        message:
          form.channel === "email"
            ? stripHtml(finalMessage)
            : finalMessage,

        messageHtml:
          form.channel === "email" ? finalMessage : null,

        messageText:
          form.channel === "whatsapp"
            ? finalMessage
            : stripHtml(finalMessage),

        templateId: form.templateId || null,
        templateName: selectedTemplate?.name || null,

        destinationIds: selectedDestinations.map(d => d.id),
        destinationNames: selectedDestinations.map(d => d.name),

        destinationRefId: primary.id,
        destinationName: primary.name,

        sharedAssets: selectedAssets,
        sharedAssetIds: selectedAssets
          .map(asset => asset.assetId)
          .filter(Boolean),
        sharedAssetTitles: selectedAssets
          .map(asset => asset.title)
          .filter(Boolean),
        assetShareCount: selectedAssets.length,
        hasSharedAssets: selectedAssets.length > 0,
        assetLinksText,
        assetLinksHtml:
          form.channel === "email" ? assetLinksHtml : "",

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

        status: communicationStatus,
        sendStatus: communicationStatus,
        sendResult: sendResult || null,

        deleted: false,
        isDeleted: false,

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
                  Compose, preview, attach assets and send with your profile
                  signature.
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
                  onClick={() => changeChannel("email")}
                />

                <ChannelCard
                  active={form.channel === "whatsapp"}
                  icon={<MessageCircle size={18} />}
                  title="WhatsApp"
                  description="Open WhatsApp Web"
                  onClick={() => changeChannel("whatsapp")}
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
                description={`Showing ${form.channel === "email" ? "Email" : "WhatsApp"
                  } templates only. Default assets will auto-load if configured.`}
              />

              <div className="flex gap-3 flex-wrap">
                <EngagementChip
                  label="Custom Message"
                  icon="✏️"
                  active={!form.templateId}
                  onClick={selectCustomMessage}
                />

                {filteredTemplates.map(t => (
                  <EngagementChip
                    key={t.id}
                    label={t.name}
                    icon={form.channel === "email" ? "✉️" : "💬"}
                    active={form.templateId === t.id}
                    onClick={() => selectTemplate(t)}
                  />
                ))}

                {filteredTemplates.length === 0 && (
                  <div className="w-full rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-700">
                    No {form.channel === "email" ? "email" : "WhatsApp"}{" "}
                    templates available. You can still use Custom Message.
                  </div>
                )}
              </div>

              {selectedTemplate?.hasDefaultAssets && (
                <p className="text-xs text-blue-600">
                  This template has default assets. They are loaded below.
                </p>
              )}
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

            {/* ASSETS */}
            <section className="space-y-2">
              <SectionTitle
                icon={<Package size={16} />}
                title="Assets"
                description="Select company profile, promotion packages, destination images or other approved assets."
              />

              {selectedAssets.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-center">
                  <p className="text-sm font-medium text-gray-700">
                    No assets selected
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Asset links will be added automatically to Email or
                    WhatsApp.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedAssets.map(asset => (
                    <div
                      key={asset.assetId || asset.url}
                      className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-800">
                          {getAssetTitle(asset)}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {asset.categoryName || asset.assetType || "Asset"} · v
                          {asset.currentVersion || 1}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {getAssetUrl(asset) && (
                          <a
                            href={getAssetUrl(asset)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={() => removeAsset(asset.assetId)}
                          className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => setAssetPickerOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
              >
                <Package className="h-4 w-4" />
                Select Assets from Library
              </button>
            </section>

            {/* MESSAGE */}
            {!selectedTemplate && (
              <section className="space-y-2">
                <SectionTitle
                  icon={<Sparkles size={16} />}
                  title="Message"
                  description="Write the main content. Signature and asset links are added automatically."
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
                    label="Assets"
                    value={
                      selectedAssets.length
                        ? `${selectedAssets.length} selected`
                        : "No assets"
                    }
                  />

                  <SummaryItem
                    label="Signature"
                    value={signature ? "Included" : "Not included"}
                  />
                </div>
              </section>

              {/* SELECTED ASSETS SUMMARY */}
              {selectedAssets.length > 0 && (
                <section className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                  <p className="text-sm font-semibold text-gray-900 mb-3">
                    Selected Assets
                  </p>

                  <div className="space-y-2">
                    {selectedAssets.map(asset => (
                      <div
                        key={asset.assetId || asset.url}
                        className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
                      >
                        <p className="text-xs font-semibold text-gray-900 truncate">
                          {getAssetTitle(asset)}
                        </p>
                        <p className="text-[11px] text-gray-500 truncate mt-0.5">
                          {getAssetUrl(asset)}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

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
                      className={`px-3 py-1.5 ${previewMode === "message"
                          ? "bg-blue-600 text-white"
                          : "bg-white text-gray-600 hover:bg-gray-50"
                        }`}
                    >
                      Message
                    </button>

                    <button
                      type="button"
                      onClick={() => setPreviewMode("signature")}
                      className={`px-3 py-1.5 ${previewMode === "signature"
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

        <AssetPickerModal
          open={assetPickerOpen}
          onClose={() => setAssetPickerOpen(false)}
          selectedAssets={selectedAssets}
          title="Select Assets for Communication"
          channel={form.channel}
          destinationId={selectedDestinations[0]?.id || ""}
          onConfirm={assets =>
            setForm(prev => ({
              ...prev,
              sharedAssets: normalizeAssets(assets)
            }))
          }
        />
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
        ${active
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
        ${valid
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