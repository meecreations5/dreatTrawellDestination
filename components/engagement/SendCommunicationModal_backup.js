"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  updateDoc,
  where
} from "firebase/firestore";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  ListFilter,
  Mail,
  MapPin,
  MessageCircle,
  Package,
  Search,
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
import SmartSuggestionPanel from "@/components/engagement/SmartSuggestionPanel";

import { suggestCommunicationReply } from "@/lib/suggestCommunicationReply";

import {
  syncAgentCadenceAfterEngagement
} from "@/lib/engagementTaskService";

/* =========================
   TEMPLATE COMPILER
========================= */

function compileTemplate(template = "", vars = {}) {
  return String(template || "").replace(
    /{{\s*([a-zA-Z0-9_]+)\s*}}/g,
    (_, key) => vars[key] ?? ""
  );
}

/* =========================
   BASIC HELPERS
========================= */

function getFirstValue(...values) {
  return (
    values.find(
      value => typeof value === "string" && value.trim().length > 0
    )?.trim() || ""
  );
}

function normalize(value = "") {
  return String(value || "").trim().toLowerCase();
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
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasHtml(value = "") {
  return /<\/?[a-z][\s\S]*>/i.test(String(value || ""));
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

  return contact ? `${name} - ${contact}` : name;
}

function getSpocIndex(spocs = [], engagementSpoc = null) {
  if (!engagementSpoc || !spocs.length) return 0;

  const targetEmail = normalize(engagementSpoc.email);
  const targetMobile = normalize(engagementSpoc.mobile);
  const targetName = normalize(engagementSpoc.name);

  const index = spocs.findIndex(spoc => {
    const emailMatch =
      targetEmail && normalize(spoc.email) === targetEmail;

    const mobileMatch =
      targetMobile && normalize(spoc.mobile) === targetMobile;

    const nameMatch =
      targetName && normalize(spoc.name) === targetName;

    return emailMatch || mobileMatch || nameMatch;
  });

  return index >= 0 ? index : 0;
}

/* =========================
   ASSET HELPERS
========================= */

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
    rawAssetType: asset?.rawAssetType || asset?.documentType || "",

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

    sharedAs: asset?.sharedAs || "file_link",
    shareMode: asset?.shareMode || "link",

    isImage: Boolean(asset?.isImage),
    isPdf: Boolean(asset?.isPdf),
    isVideo: Boolean(asset?.isVideo),
    isYoutube: Boolean(asset?.isYoutube),
    youtubeEmbedUrl: asset?.youtubeEmbedUrl || ""
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

/* =========================
   TEMPLATE HELPERS
========================= */

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

function templateMatchesDestination(
  template,
  selectedDestinationIds = [],
  selectedDestinationNames = []
) {
  if (!template) return false;

  if (!selectedDestinationIds.length && !selectedDestinationNames.length) {
    return true;
  }

  const templateDestinationIds = Array.isArray(template.destinationIds)
    ? template.destinationIds
    : [];

  const templateDestinationNames = Array.isArray(template.destinationNames)
    ? template.destinationNames
    : template.primaryDestination
      ? [template.primaryDestination]
      : [];

  const isGeneral =
    templateDestinationIds.length === 0 &&
    templateDestinationNames.length === 0;

  if (isGeneral) return true;

  const selectedNameSet = new Set(
    selectedDestinationNames.map(name => normalize(name))
  );

  const idMatch = templateDestinationIds.some(id =>
    selectedDestinationIds.includes(id)
  );

  const nameMatch = templateDestinationNames.some(name =>
    selectedNameSet.has(normalize(name))
  );

  return idMatch || nameMatch;
}

function arrayIncludesValue(list = [], value = "") {
  if (!Array.isArray(list) || !value) return false;

  const normalizedValue = normalize(value);

  return list.some(item => normalize(item) === normalizedValue);
}

function templateHasIntent(template, intentCode = "") {
  return arrayIncludesValue(template?.intentCodes, intentCode);
}

function templateHasOutcome(template, outcomeCode = "") {
  return arrayIncludesValue(template?.outcomeCodes, outcomeCode);
}

function getTemplatePriorityScore({
  template,
  intentCode = "",
  outcomeCode = "",
  selectedDestinationIds = [],
  selectedDestinationNames = []
}) {
  let score = 0;

  if (templateHasIntent(template, intentCode)) {
    score += 100;
  }

  if (templateHasOutcome(template, outcomeCode)) {
    score += 60;
  }

  if (
    templateMatchesDestination(
      template,
      selectedDestinationIds,
      selectedDestinationNames
    )
  ) {
    score += 20;
  }

  const templateType = normalize(template?.templateType);

  if (templateType === "message") score += 8;
  if (templateType === "package") score += 6;
  if (templateType === "promotion") score += 5;
  if (template?.systemTemplate === true) score += 4;

  if (template?.usageCount) {
    score += Math.min(Number(template.usageCount || 0), 10);
  }

  return score;
}

function resolveRecommendedTemplate(recommendation, templates = []) {
  if (!recommendation) return null;

  if (recommendation.raw) return recommendation.raw;

  const templateId = getFirstValue(
    recommendation.templateId,
    recommendation.id,
    recommendation.slug
  );

  if (!templateId) return recommendation;

  return (
    templates.find(template => {
      return (
        template.id === templateId ||
        template.templateId === templateId ||
        template.slug === templateId
      );
    }) || recommendation
  );
}

function getTemplateTypeLabel(type = "") {
  const map = {
    message: "Message",
    promotion: "Promotion",
    package: "Package",
    itinerary: "Itinerary",
    document: "Document",
    vendor: "Vendor",
    internal: "Internal"
  };

  return map[normalize(type)] || "Template";
}

/* =========================
   SIGNATURE HELPERS
========================= */

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
    base.includes("{{ assetLinks }}") ||
    base.includes("{{assetLinksHtml}}") ||
    base.includes("{{ assetLinksHtml }}")
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

  if (base.includes("{{ signature }}")) {
    return base.replace(
      "{{ signature }}",
      `${assetPlaceholder}${channel === "email" ? "<br/>" : "\n\n"}{{ signature }}`
    );
  }

  return `${base}${channel === "email" ? "<br/><br/>" : "\n\n"}${assetPlaceholder}`;
}

function appendSignatureIfNeeded({ base, compiled, signature }) {
  if (!signature) return compiled;

  if (
    base.includes("{{signature}}") ||
    base.includes("{{ signature }}")
  ) {
    return compiled;
  }

  const compiledPlain = normalize(stripHtml(compiled));
  const signaturePlain = normalize(stripHtml(signature));

  if (
    signaturePlain &&
    compiledPlain.includes(signaturePlain.slice(0, 40))
  ) {
    return compiled;
  }

  return `${compiled}${signature}`;
}

/* =========================
   INITIAL HELPERS
========================= */

function getInitialChannel(engagement) {
  const channel = String(engagement?.channel || "").toLowerCase();

  if (channel === "email" || channel === "whatsapp") {
    return channel;
  }

  return "email";
}

function getInitialDestinationIds(engagement) {
  if (Array.isArray(engagement?.destinationIds)) {
    return engagement.destinationIds.filter(Boolean);
  }

  if (engagement?.destinationRefId) {
    return [engagement.destinationRefId];
  }

  return [];
}

function getSendButtonLabel(channel, sending) {
  if (sending) return "Sending...";
  if (channel === "email") return "Send Email";
  return "Open WhatsApp";
}

/* =========================
   COMPONENT
========================= */

export default function SendCommunicationModal({
  engagement = null,
  agent,
  onClose
}) {
  const { user, loading } = useAuth();

  const prefilledRef = useRef("");

  const [step, setStep] = useState(1);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [templates, setTemplates] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [documentAssets, setDocumentAssets] = useState([]);

  const [branding, setBranding] = useState(null);
  const [profile, setProfile] = useState(null);
  const [metaLoading, setMetaLoading] = useState(true);

  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState("");
  const [previewMode, setPreviewMode] = useState("message");
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);

  const [copiedMessage, setCopiedMessage] = useState(false);
  const [copiedAssets, setCopiedAssets] = useState(false);

  const [templateSearch, setTemplateSearch] = useState("");
  const [templateScope, setTemplateScope] = useState("all");

  const [form, setForm] = useState({
    spocIndex: 0,
    channel: "email",
    templateId: "",

    subject: "",
    body: "",
    bodyMode: "short",

    intentCode: "",
    suggestionUsed: false,
    suggestionId: "",
    suggestionTitle: "",

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
        const [tplSnap, destSnap, assetSnap, brandingData, userSnap] =
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
            getDocs(collection(db, "documents")),
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
          destSnap.docs
            .map(d => ({
              id: d.id,
              ...d.data()
            }))
            .sort((a, b) =>
              String(a.name || "").localeCompare(String(b.name || ""))
            )
        );

        setDocumentAssets(
          assetSnap.docs
            .map(d => ({
              id: d.id,
              ...d.data()
            }))
            .filter(asset => {
              if (asset.deleted === true || asset.isDeleted === true) return false;
              if (asset.archived === true) return false;
              if (asset.active === false) return false;
              if (asset.status && asset.status !== "active") return false;
              if (!getAssetUrl(asset)) return false;

              return true;
            })
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

  const selectedDestinations = useMemo(() => {
    return destinations.filter(d => form.destinationIds.includes(d.id));
  }, [destinations, form.destinationIds]);

  const selectedDestinationNames = useMemo(() => {
    return selectedDestinations
      .map(d => d.name)
      .filter(Boolean);
  }, [selectedDestinations]);

  const destinationNames = selectedDestinationNames.join(", ");

  const effectiveIntentCode = getFirstValue(
    form.intentCode,
    engagement?.intentCode,
    engagement?.suggestedIntentCode,
    engagement?.autoIntentCode
  );

  const effectiveOutcomeCode = getFirstValue(
    engagement?.outcomeCode,
    engagement?.outcome,
    engagement?.result
  );

  const filteredTemplates = useMemo(() => {
    return templates
      .filter(template => {
        return (
          templateSupportsChannel(template, form.channel) &&
          templateMatchesDestination(
            template,
            form.destinationIds,
            selectedDestinationNames
          )
        );
      })
      .map(template => {
        const smartScore = getTemplatePriorityScore({
          template,
          intentCode: effectiveIntentCode,
          outcomeCode: effectiveOutcomeCode,
          selectedDestinationIds: form.destinationIds,
          selectedDestinationNames
        });

        return {
          ...template,
          _smartScore: smartScore,
          _intentMatched: templateHasIntent(template, effectiveIntentCode),
          _outcomeMatched: templateHasOutcome(template, effectiveOutcomeCode)
        };
      })
      .sort((a, b) => {
        if (b._smartScore !== a._smartScore) {
          return b._smartScore - a._smartScore;
        }

        const aGeneral =
          !Array.isArray(a.destinationIds) ||
          a.destinationIds.length === 0;

        const bGeneral =
          !Array.isArray(b.destinationIds) ||
          b.destinationIds.length === 0;

        if (aGeneral !== bGeneral) return aGeneral ? 1 : -1;

        return String(a.name || "").localeCompare(String(b.name || ""));
      });
  }, [
    templates,
    form.channel,
    form.destinationIds,
    selectedDestinationNames,
    effectiveIntentCode,
    effectiveOutcomeCode
  ]);

  const manualTemplateChoices = useMemo(() => {
    const search = normalize(templateSearch);

    return filteredTemplates.filter(template => {
      const isIntentMatch = template._intentMatched === true;
      const isOutcomeMatch = template._outcomeMatched === true;
      const isDefault = template.systemTemplate === true;
      const isUsed = Number(template.usageCount || 0) > 0;

      if (templateScope === "matches" && !isIntentMatch && !isOutcomeMatch) {
        return false;
      }

      if (templateScope === "default" && !isDefault) {
        return false;
      }

      if (templateScope === "used" && !isUsed) {
        return false;
      }

      if (!search) return true;

      const haystack = normalize(
        [
          template.name,
          template.slug,
          template.templateType,
          template.categoryName,
          template.categoryCode,
          template.category,
          ...(Array.isArray(template.intentCodes) ? template.intentCodes : []),
          ...(Array.isArray(template.outcomeCodes) ? template.outcomeCodes : [])
        ].join(" ")
      );

      return haystack.includes(search);
    });
  }, [filteredTemplates, templateSearch, templateScope]);

  const selectedTemplate = filteredTemplates.find(
    t => t.id === form.templateId
  );

  const smartSuggestion = useMemo(() => {
    return suggestCommunicationReply({
      agent,
      spoc,
      engagement,
      engagements: [],

      lead: null,
      destination: selectedDestinations[0] || null,

      templates,
      assets: documentAssets,

      channel: form.channel,
      intentCode: effectiveIntentCode
    });
  }, [
    agent,
    spoc,
    engagement,
    selectedDestinations,
    templates,
    documentAssets,
    form.channel,
    effectiveIntentCode
  ]);

  const recommendedSuggestion = smartSuggestion?.suggestions?.[0] || null;

  const recommendedTemplate = useMemo(() => {
    const intentMatchedTemplate = filteredTemplates.find(template =>
      templateHasIntent(template, effectiveIntentCode)
    );

    if (intentMatchedTemplate) return intentMatchedTemplate;

    const outcomeMatchedTemplate = filteredTemplates.find(template =>
      templateHasOutcome(template, effectiveOutcomeCode)
    );

    if (outcomeMatchedTemplate) return outcomeMatchedTemplate;

    return resolveRecommendedTemplate(
      smartSuggestion?.recommendedTemplates?.[0],
      filteredTemplates
    );
  }, [
    filteredTemplates,
    smartSuggestion,
    effectiveIntentCode,
    effectiveOutcomeCode
  ]);

  const recommendedAssets = smartSuggestion?.recommendedAssets || [];

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

      companyName: branding?.companyName || "DreamTrawell Destination",
      companyEmail:
        branding?.companyEmail ||
        branding?.supportEmail ||
        "outbound@dreamtrawelldestination.com",
      companyPhone:
        branding?.companyPhone ||
        branding?.supportMobile ||
        "",
      body: form.body,
      assetLinks: assetLinksText,
      assetLinksHtml,
      companyLogoUrl:
        branding?.companyLogoUrl ||
        branding?.emailLogoUrl ||
        branding?.headerLogoUrl ||
        branding?.logoUrl ||
        "",
      websiteUrl:
        branding?.websiteUrl ||
        "https://dreamtrawelldestination.com/",
      tagline: branding?.tagline || "Realize the Experiance",
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
    const baseSubject =
      selectedTemplate?.emailSubject ||
      form.subject ||
      "Communication";

    return compileTemplate(baseSubject, templateVars);
  }, [selectedTemplate, form.subject, templateVars]);

  const finalMessage = useMemo(() => {
    if (!spoc || !user) return "";

    let base = "";

    if (selectedTemplate) {
      base =
        form.channel === "email"
          ? selectedTemplate.emailHtml || ""
          : selectedTemplate.whatsappText || "";
    } else {
      const bodyHasHtml = hasHtml(form.body);
      const isFullMessage = form.bodyMode === "full";

      if (isFullMessage) {
        base = form.body || "";
      } else {
        base =
          form.channel === "email"
            ? bodyHasHtml
              ? form.body
              : `
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
    form.body,
    form.bodyMode,
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

  const hasContent = Boolean(
    selectedTemplate || form.body.trim()
  );

  const canContinueStep1 =
    channelContactValid && selectedDestinations.length > 0;

  const canContinueStep2 =
    Boolean(selectedTemplate || form.body.trim());

  const canSend =
    !sending &&
    channelContactValid &&
    selectedDestinations.length > 0 &&
    hasContent;

  const whatsappHasAssets =
    form.channel === "whatsapp" && selectedAssets.length > 0;

  /* =========================
     PREFILL FROM ENGAGEMENT
  ========================== */

  useEffect(() => {
    if (!engagement || metaLoading) return;

    const key = engagement.id || engagement.templateId || "engagement";
    if (prefilledRef.current === key) return;

    const channel = getInitialChannel(engagement);
    const spocIndex = getSpocIndex(spocs, engagement.spoc);
    const destinationIds = getInitialDestinationIds(engagement);

    const isTemplateCommunication =
      Boolean(engagement.templateId) ||
      engagement.communicationSource === "template" ||
      engagement.isTemplateCommunication === true;

    setForm(prev => ({
      ...prev,
      spocIndex,
      channel,

      templateId: isTemplateCommunication
        ? engagement.templateId || ""
        : "",

      subject: engagement.emailSubject || engagement.subject || "",
      bodyMode: isTemplateCommunication ? "short" : "full",

      intentCode: engagement.intentCode || "",
      suggestionUsed: Boolean(engagement.suggestionUsed),
      suggestionId: engagement.suggestionId || "",
      suggestionTitle: engagement.suggestionTitle || "",

      body: isTemplateCommunication
        ? ""
        : stripHtml(
          engagement.messageText ||
          engagement.message ||
          engagement.messageHtml ||
          ""
        ),

      destinationIds,
      sharedAssets: normalizeAssets(engagement.sharedAssets || [])
    }));

    prefilledRef.current = key;
  }, [engagement, metaLoading, spocs]);

  /* =========================
     KEEP TEMPLATE VALID
  ========================== */

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
        bodyMode: "short",
        sharedAssets: []
      }));
    }
  }, [form.templateId, filteredTemplates]);

  /* =========================
     EARLY EXIT
  ========================== */

  if (loading || metaLoading || !user || !agent || !spocs.length) {
    return null;
  }

  /* =========================
     ACTIONS
  ========================== */

  const removeAsset = assetKey => {
    setForm(prev => ({
      ...prev,
      sharedAssets: (prev.sharedAssets || []).filter(item => {
        const key = item.assetId || item.url;
        return key !== assetKey;
      })
    }));
  };

  const selectTemplate = (template, extraPatch = {}) => {
    setForm(prev => ({
      ...prev,
      templateId: template.id,
      subject: "",
      body: "",
      bodyMode: "short",

      // Do not auto-select template assets.
      sharedAssets: normalizeAssets(prev.sharedAssets || []),

      ...extraPatch
    }));

    setStep(3);
    setPreviewMode("message");
  };

  const selectCustomMessage = () => {
    setForm(prev => ({
      ...prev,
      templateId: "",
      subject: "",
      body: "",
      bodyMode: "short",
      sharedAssets: []
    }));

    setStep(3);
    setPreviewMode("message");
  };

  const changeChannel = channel => {
    setForm(prev => ({
      ...prev,
      channel,
      templateId: "",
      subject: "",
      body: "",
      bodyMode: "short",
      sharedAssets: []
    }));

    setTemplateSearch("");
    setTemplateScope("all");
    setPreviewMode("message");
  };

  const toggleDestination = destinationId => {
    setForm(prev => ({
      ...prev,
      destinationIds: prev.destinationIds.includes(destinationId)
        ? prev.destinationIds.filter(id => id !== destinationId)
        : [...prev.destinationIds, destinationId]
    }));
  };

  const copyText = async (text, type) => {
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);

      if (type === "message") {
        setCopiedMessage(true);
        setTimeout(() => setCopiedMessage(false), 1600);
      }

      if (type === "assets") {
        setCopiedAssets(true);
        setTimeout(() => setCopiedAssets(false), 1600);
      }
    } catch (error) {
      console.error("Failed to copy:", error);
      alert("Unable to copy. Please copy manually.");
    }
  };

  const applyRecommendedSuggestion = () => {
    if (!recommendedSuggestion) {
      alert("No suggestion available");
      return;
    }

    const emailBody = String(
      recommendedSuggestion.emailHtml ||
      recommendedSuggestion.bodyText ||
      ""
    ).replaceAll("{{assetLinks}}", "{{assetLinksHtml}}");

    setForm(prev => ({
      ...prev,
      templateId: "",

      subject:
        recommendedSuggestion.emailSubject ||
        recommendedSuggestion.subject ||
        prev.subject ||
        "",

      body:
        prev.channel === "email"
          ? emailBody
          : recommendedSuggestion.whatsappText ||
          recommendedSuggestion.bodyText ||
          "",

      bodyMode: "full",

      intentCode:
        recommendedSuggestion.intentCode ||
        smartSuggestion?.intent?.code ||
        prev.intentCode,

      suggestionUsed: true,
      suggestionId: recommendedSuggestion.id || "",
      suggestionTitle: recommendedSuggestion.title || "",

      // Assets are only recommended. Team must attach manually.
      sharedAssets: normalizeAssets(prev.sharedAssets || [])
    }));

    setStep(3);
    setPreviewMode("message");
  };

  const saveUsageLog = async ({ engagementId }) => {
    if (!selectedTemplate?.id) return;

    try {
      await addDoc(collection(db, "templateUsageLogs"), {
        templateId: selectedTemplate.id,
        templateName: selectedTemplate.name || "",
        templateType: selectedTemplate.templateType || "",
        templateCategory:
          selectedTemplate.categoryName ||
          selectedTemplate.categoryCode ||
          selectedTemplate.category ||
          "",

        channel: form.channel,

        agentId: agent.id || "",
        agentName: agent.agencyName || agent.name || "",

        engagementId,

        destinationIds: selectedDestinations.map(d => d.id),
        destinationNames: selectedDestinations.map(d => d.name),

        usedByUid: uid,
        usedByName: getUserName(user, profile),
        usedByEmail: user?.email || "",
        usedAt: serverTimestamp()
      });

      await updateDoc(
        doc(db, "communicationTemplates", selectedTemplate.id),
        {
          usageCount: increment(1),
          lastUsedAt: serverTimestamp()
        }
      );
    } catch (error) {
      console.warn("Template usage log failed:", error);
    }
  };

  const saveSuggestionLog = async ({ engagementId }) => {
    if (!form.suggestionUsed && !form.intentCode) return;

    try {
      await addDoc(collection(db, "smartSuggestionLogs"), {
        agentId: agent.id || "",
        agentName: agent.agencyName || agent.name || "",

        engagementId,

        intentCode:
          effectiveIntentCode ||
          smartSuggestion?.intent?.code ||
          "",

        intentName:
          smartSuggestion?.intent?.name ||
          "",

        suggestionUsed: Boolean(form.suggestionUsed),
        suggestionId: form.suggestionId || "",
        suggestionTitle: form.suggestionTitle || "",
        suggestionSource: form.suggestionUsed ? "system" : "manual_intent",

        channel: form.channel,

        selectedTemplateId: selectedTemplate?.id || "",
        selectedTemplateName: selectedTemplate?.name || "",

        destinationIds: selectedDestinations.map(d => d.id),
        destinationNames: selectedDestinations.map(d => d.name),

        assetIds: selectedAssets
          .map(asset => asset.assetId)
          .filter(Boolean),

        createdByUid: uid,
        createdByName: getUserName(user, profile),
        createdByEmail: user?.email || "",
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.warn("Smart suggestion log failed:", error);
    }
  };

  const markSourceEngagementCommunicationSent = async ({ engagementId }) => {
    if (!engagement?.id) return;

    if (engagement?.engagementType === "communication_sent") return;

    try {
      await updateDoc(doc(db, "engagements", engagement.id), {
        communicationSent: true,
        communicationSentAt: serverTimestamp(),

        lastCommunicationEngagementId: engagementId,
        lastCommunicationChannel: form.channel,
        lastCommunicationStatus: "sent",

        lastCommunicationTemplateId: form.templateId || "",
        lastCommunicationTemplateName: selectedTemplate?.name || "",
        lastCommunicationTemplateType: selectedTemplate?.templateType || "",
        lastCommunicationTemplateCategory:
          selectedTemplate?.categoryName ||
          selectedTemplate?.categoryCode ||
          selectedTemplate?.category ||
          "",

        lastCommunicationSubject:
          form.channel === "email" ? finalSubject || "" : "",

        lastCommunicationAssetCount: selectedAssets.length,
        lastCommunicationSentByUid: uid,
        lastCommunicationSentByName: getUserName(user, profile),
        lastCommunicationSentByEmail: user?.email || "",

        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.warn("Source engagement communication mark failed:", error);
    }
  };

  const updateTravelAgentLastCommunication = async ({
    engagementId,
    outboundStatus
  }) => {
    if (!agent?.id) return;

    try {
      await updateDoc(doc(db, "travelAgents", agent.id), {
        lastCommunicationAt: serverTimestamp(),
        lastCommunicationEngagementId: engagementId,
        lastCommunicationChannel: form.channel,
        lastCommunicationStatus: outboundStatus || "sent",

        lastCommunicationTemplateId: form.templateId || "",
        lastCommunicationTemplateName: selectedTemplate?.name || "",
        lastCommunicationTemplateType: selectedTemplate?.templateType || "",
        lastCommunicationTemplateCategory:
          selectedTemplate?.categoryName ||
          selectedTemplate?.categoryCode ||
          selectedTemplate?.category ||
          "",

        lastCommunicationSubject:
          form.channel === "email" ? finalSubject || "" : "",

        lastCommunicationAssetCount: selectedAssets.length,

        lastCommunicationSentByUid: uid,
        lastCommunicationSentByName: getUserName(user, profile),
        lastCommunicationSentByEmail: user?.email || "",

        // Also keep normal engagement freshness updated
        lastEngagementAt: serverTimestamp(),
        lastEngagementType:
          form.channel === "email" ? "Email Communication" : "WhatsApp Communication",
        lastEngagementNote:
          selectedTemplate?.name
            ? `Template sent: ${selectedTemplate.name}`
            : "Custom communication sent",

        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.warn("Travel agent last communication update failed:", error);
    }
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
      let outboundStatus = "completed";
      let sendResult = null;

      if (form.channel === "email") {
        setSendStatus("Sending email...");

        await sendEmailViaBrevo({
          toEmail: spoc.email,
          toName: getSpocName(spoc),
          subject: finalSubject || "Communication",
          html: finalMessage
        });

        outboundStatus = "completed";
      }

      if (form.channel === "whatsapp") {
        setSendStatus("Opening WhatsApp...");

        sendResult = await sendWhatsAppWeb({
          mobile: spoc.mobile,
          message: finalMessage
        });

        outboundStatus = sendResult?.status || "whatsapp_opened";
      }

      setSendStatus("Saving engagement...");

      const primary = selectedDestinations[0];

      const engagementRef = await addDoc(collection(db, "engagements"), {
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

        emailSubject:
          form.channel === "email" ? finalSubject || "" : "",

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
        templateType: selectedTemplate?.templateType || "",
        templateCategory:
          selectedTemplate?.categoryName ||
          selectedTemplate?.categoryCode ||
          selectedTemplate?.category ||
          "",

        communicationSource: form.templateId ? "template" : "custom",
        isTemplateCommunication: Boolean(form.templateId),

        sourceEngagementId: engagement?.id || "",
        sourceEngagementType: engagement?.engagementType || "",
        sourceActivityType: engagement?.activityType || "",
        sourceIntentCode: engagement?.intentCode || "",
        sourceOutcomeCode: engagement?.outcomeCode || "",
        sourceChannel: engagement?.channel || "",
        sourceStatus: engagement?.status || "",
        sourceCreatedAt: engagement?.createdAt || null,

        intentCode:
          effectiveIntentCode ||
          smartSuggestion?.intent?.code ||
          "",

        intentName:
          smartSuggestion?.intent?.name ||
          "",

        intentReason:
          smartSuggestion?.intent?.reason ||
          "",

        suggestionSource: form.suggestionUsed ? "system" : "",
        suggestionUsed: Boolean(form.suggestionUsed),
        suggestionId: form.suggestionId || "",
        suggestionTitle: form.suggestionTitle || "",

        nextAction:
          smartSuggestion?.nextAction?.nextAction || "",

        nextActionLabel:
          smartSuggestion?.nextAction?.nextActionLabel || "",

        waitingOn:
          smartSuggestion?.nextAction?.waitingOn || "",

        communicationStatus:
          smartSuggestion?.nextAction?.communicationStatus || "",

        nextFollowUpAt:
          smartSuggestion?.nextAction?.nextFollowUpAt || null,

        autoSuggestedTemplateIds:
          smartSuggestion?.recommendedTemplates
            ?.map(item => item.templateId)
            .filter(Boolean) || [],

        autoSuggestedAssetIds:
          smartSuggestion?.recommendedAssets
            ?.map(item => item.assetId)
            .filter(Boolean) || [],

        destinationIds: selectedDestinations.map(d => d.id),
        destinationNames: selectedDestinations.map(d => d.name),

        destinationRefId: primary.id,
        destinationId: primary.destinationId || primary.id || null,
        destinationCode: primary.code || primary.destinationCode || null,
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
          department: signatureMember.department || "",
          signatureEnabled: signatureMember.signatureEnabled !== false
        },

        status: outboundStatus,
        sendStatus: outboundStatus,
        sendResult: sendResult || null,

        deleted: false,
        isDeleted: false,

        createdByUid: uid,
        createdByName: getUserName(user, profile),
        createdByEmail: user?.email || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      await Promise.all([
        saveUsageLog({
          engagementId: engagementRef.id
        }),
        saveSuggestionLog({
          engagementId: engagementRef.id
        }),
        markSourceEngagementCommunicationSent({
          engagementId: engagementRef.id
        }),
        updateTravelAgentLastCommunication({
          engagementId: engagementRef.id,
          outboundStatus
        })
      ]);

      setSendStatus("Done");
      alert("Communication sent");
      onClose?.();
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
      <div className="bg-white rounded-2xl shadow-card w-full max-w-7xl flex flex-col max-h-[92vh] overflow-hidden">
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
                  Guided flow: receiver, smart suggestion, template library and final review.
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

        {/* STEP INDICATOR */}
        <div className="border-b bg-gray-50 px-5 sm:px-6 py-3">
          <StepIndicator step={step} />
        </div>

        {/* BODY */}
        <div className="grid grid-cols-1 lg:grid-cols-2 min-h-0 flex-1">
          {/* LEFT */}
          <div className="p-5 sm:p-6 overflow-y-auto border-r border-gray-100">
            {step === 1 && (
              <div className="space-y-5">
                <StepHeading
                  icon={<UserRound size={18} />}
                  title="Step 1: Select Receiver"
                  description="Choose SPOC, channel and destination. The system will suggest the best reply after this."
                />

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
                        <option
                          key={`${s.email || s.mobile || s.name}-${i}`}
                          value={i}
                        >
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

                <section className="space-y-2">
                  <SectionTitle
                    icon={
                      form.channel === "email"
                        ? <Mail size={16} />
                        : <MessageCircle size={16} />
                    }
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

                <section className="space-y-2">
                  <SectionTitle
                    icon={<MapPin size={16} />}
                    title="Destination"
                    description="Select destination so suggestions, templates and assets are filtered properly."
                  />

                  <div className="flex gap-3 flex-wrap">
                    {destinations.map(d => (
                      <EngagementChip
                        key={d.id}
                        label={d.name}
                        icon="✈️"
                        active={form.destinationIds.includes(d.id)}
                        onClick={() => toggleDestination(d.id)}
                      />
                    ))}
                  </div>

                  {!selectedDestinations.length && (
                    <p className="text-xs text-orange-600">
                      Please select at least one destination.
                    </p>
                  )}
                </section>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <StepHeading
                  icon={<Sparkles size={18} />}
                  title="Step 2: Suggestion & Template"
                  description="Use the smart recommendation, choose a template manually, or write a custom message."
                />

                <section className="rounded-2xl border border-blue-100 bg-blue-50 p-4 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-blue-700">
                        Recommended Intent
                      </p>
                      <h3 className="text-base font-semibold text-gray-900 mt-0.5">
                        {smartSuggestion?.intent?.name || "Auto Suggestion"}
                      </h3>

                      {smartSuggestion?.intent?.reason && (
                        <p className="text-xs text-blue-700 mt-1">
                          Reason: {smartSuggestion.intent.reason}
                        </p>
                      )}
                    </div>

                    <span className="rounded-full border border-blue-100 bg-white px-2 py-0.5 text-[11px] font-semibold text-blue-700 capitalize">
                      {form.channel}
                    </span>
                  </div>

                  {recommendedSuggestion ? (
                    <div className="rounded-xl border border-gray-100 bg-white p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {recommendedSuggestion.title || "Suggested Reply"}
                          </p>
                          {recommendedSuggestion.subject && (
                            <p className="text-xs text-gray-500 mt-1">
                              Subject: {recommendedSuggestion.subject}
                            </p>
                          )}
                        </div>

                        {recommendedSuggestion.tone && (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                            {recommendedSuggestion.tone}
                          </span>
                        )}
                      </div>

                      <pre className="max-h-[220px] overflow-y-auto whitespace-pre-wrap font-sans text-sm leading-relaxed text-gray-700 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                        {recommendedSuggestion.bodyText ||
                          recommendedSuggestion.whatsappText ||
                          stripHtml(recommendedSuggestion.emailHtml)}
                      </pre>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <SummaryItem
                          label="Recommended Template"
                          value={recommendedTemplate?.name || "Not required"}
                        />

                        <SummaryItem
                          label="Recommended Assets"
                          value={
                            recommendedAssets.length
                              ? `${recommendedAssets.length} found`
                              : "No asset"
                          }
                        />
                      </div>

                      <p className="text-[11px] text-gray-500">
                        Assets are only recommended. They will not be attached unless selected manually.
                      </p>

                      <button
                        type="button"
                        onClick={applyRecommendedSuggestion}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                      >
                        <Sparkles size={16} />
                        Use Recommended Reply
                      </button>

                      {recommendedTemplate && (
                        <button
                          type="button"
                          onClick={() =>
                            selectTemplate(recommendedTemplate, {
                              suggestionUsed: true,
                              suggestionId: "",
                              suggestionTitle: `Recommended template: ${recommendedTemplate.name || ""}`
                            })
                          }
                          className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                        >
                          <Package size={16} />
                          Use Recommended Template
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-orange-100 bg-white p-4 text-sm text-orange-700">
                      No suggested reply found. You can create a custom message in Review step.
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={selectCustomMessage}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Write Custom Message
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowAdvanced(prev => !prev)}
                      className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                    >
                      {showAdvanced ? "Hide Advanced Options" : "Advanced Options"}
                    </button>
                  </div>
                </section>

                <ManualTemplateLibrary
                  templates={manualTemplateChoices}
                  allTemplates={filteredTemplates}
                  search={templateSearch}
                  scope={templateScope}
                  channel={form.channel}
                  selectedTemplateId={form.templateId}
                  onSearchChange={setTemplateSearch}
                  onScopeChange={setTemplateScope}
                  onSelectTemplate={template => selectTemplate(template)}
                />

                {showAdvanced && (
                  <SmartSuggestionPanel
                    suggestionData={smartSuggestion}
                    intentCode={form.intentCode}
                    onIntentChange={intentCode =>
                      setForm(prev => ({
                        ...prev,
                        intentCode
                      }))
                    }
                    channel={form.channel}
                    compact
                    onUseSuggestion={suggestion => {
                      const emailBody = String(
                        suggestion.emailHtml ||
                        suggestion.bodyText ||
                        ""
                      ).replaceAll("{{assetLinks}}", "{{assetLinksHtml}}");

                      setForm(prev => ({
                        ...prev,
                        templateId: "",
                        subject:
                          suggestion.emailSubject ||
                          suggestion.subject ||
                          prev.subject ||
                          "",
                        body:
                          prev.channel === "email"
                            ? emailBody
                            : suggestion.whatsappText ||
                            suggestion.bodyText ||
                            "",
                        bodyMode: "full",
                        intentCode: suggestion.intentCode || prev.intentCode,
                        suggestionUsed: true,
                        suggestionId: suggestion.id || "",
                        suggestionTitle: suggestion.title || "",
                        sharedAssets: normalizeAssets(prev.sharedAssets || [])
                      }));

                      setStep(3);
                      setPreviewMode("message");
                    }}
                    onUseTemplate={template => {
                      selectTemplate(template, {
                        suggestionUsed: true,
                        suggestionId: "",
                        suggestionTitle: `Recommended template: ${template.name || ""}`
                      });
                    }}
                    onAddAssets={assets => {
                      setForm(prev => ({
                        ...prev,
                        sharedAssets: normalizeAssets([
                          ...(prev.sharedAssets || []),
                          ...(assets || [])
                        ])
                      }));
                    }}
                  />
                )}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <StepHeading
                  icon={<Send size={18} />}
                  title="Step 3: Review & Send"
                  description="Edit message, confirm assets and send the communication."
                />

                {!selectedTemplate && (
                  <section className="space-y-2">
                    <SectionTitle
                      icon={<Sparkles size={16} />}
                      title="Message"
                      description="Edit the final message before sending."
                    />

                    {form.channel === "email" && (
                      <Field label="Email Subject">
                        <input
                          className="mui-input"
                          value={form.subject}
                          placeholder="Email subject"
                          onChange={e =>
                            setForm({
                              ...form,
                              subject: e.target.value
                            })
                          }
                        />
                      </Field>
                    )}

                    <Field label="Message">
                      <textarea
                        className="mui-input min-h-[180px]"
                        value={form.body}
                        placeholder="Write your message..."
                        onChange={e =>
                          setForm({
                            ...form,
                            body: e.target.value
                          })
                        }
                      />
                    </Field>
                  </section>
                )}

                {selectedTemplate && (
                  <section className="rounded-xl border border-purple-100 bg-purple-50 px-4 py-3">
                    <p className="text-xs font-semibold text-purple-800">
                      Selected Template
                    </p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">
                      {selectedTemplate.name}
                    </p>

                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-purple-700 border border-purple-100">
                        {getTemplateTypeLabel(selectedTemplate.templateType)}
                      </span>

                      {selectedTemplate.categoryName && (
                        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-purple-700 border border-purple-100">
                          {selectedTemplate.categoryName}
                        </span>
                      )}

                      {selectedTemplate._intentMatched && (
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700 border border-blue-100">
                          Intent Match
                        </span>
                      )}

                      {selectedTemplate._outcomeMatched && !selectedTemplate._intentMatched && (
                        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-700 border border-indigo-100">
                          Outcome Match
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setForm(prev => ({
                          ...prev,
                          templateId: "",
                          subject: finalSubject,
                          body: finalMessage,
                          bodyMode: "full"
                        }));
                      }}
                      className="mt-3 rounded-lg border border-purple-200 bg-white px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-50"
                    >
                      Convert to Editable Message
                    </button>
                  </section>
                )}

                <section className="space-y-2">
                  <SectionTitle
                    icon={<Package size={16} />}
                    title="Assets"
                    description="Assets are shared as links in Email / WhatsApp."
                  />

                  {whatsappHasAssets && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                      WhatsApp Web can open text only. Images, PDFs and videos will be shared as links.
                    </div>
                  )}

                  {selectedAssets.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-center">
                      <p className="text-sm font-medium text-gray-700">
                        No assets selected
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        You can still send message without assets.
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
                              onClick={() => removeAsset(asset.assetId || asset.url)}
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

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setAssetPickerOpen(true)}
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                    >
                      <Package className="h-4 w-4" />
                      Select Assets
                    </button>

                    {selectedAssets.length > 0 && (
                      <button
                        type="button"
                        onClick={() => copyText(assetLinksText, "assets")}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        {copiedAssets ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-green-600" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            Copy Asset Links
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </section>

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
                          ? "Included from My Profile and Branding Settings."
                          : "Not included - signature is disabled or missing."}
                      </p>
                    </div>
                  </div>
                </section>
              </div>
            )}
          </div>

          {/* RIGHT PREVIEW */}
          <div className="bg-gray-50 p-5 sm:p-6 overflow-y-auto">
            <div className="space-y-4">
              <section className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-gray-900 mb-3">
                  Communication Summary
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
                    value={agent?.agencyName || agent?.name || "-"}
                  />

                  <SummaryItem
                    label="Destination"
                    value={destinationNames || "Not selected"}
                  />

                  <SummaryItem
                    label="Suggestion"
                    value={smartSuggestion?.intent?.name || "Auto Detect"}
                  />

                  <SummaryItem
                    label="Template"
                    value={selectedTemplate?.name || "Not selected"}
                  />

                  <SummaryItem
                    label="Assets"
                    value={
                      selectedAssets.length
                        ? `${selectedAssets.length} selected`
                        : "No assets"
                    }
                  />
                </div>
              </section>

              <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
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
                  {form.channel === "whatsapp" && previewMode === "message" && (
                    <div className="mb-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() => copyText(finalMessage, "message")}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        {copiedMessage ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-green-600" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            Copy Message
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {previewMode === "message" ? (
                    form.channel === "email" ? (
                      <div>
                        <div className="mb-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
                          <p className="text-[11px] font-semibold text-blue-700">
                            Subject
                          </p>
                          <p className="text-sm font-semibold text-gray-900 break-words">
                            {finalSubject || "Communication"}
                          </p>
                        </div>

                        <div
                          className="border border-gray-200 rounded-lg p-4 bg-white text-sm overflow-x-auto min-h-[360px]"
                          dangerouslySetInnerHTML={{
                            __html:
                              finalMessage ||
                              "Message preview will appear here."
                          }}
                        />
                      </div>
                    ) : (
                      <div className="bg-[#e5ddd5] rounded-xl p-4 min-h-[360px]">
                        <div className="ml-auto max-w-[90%] bg-white rounded-lg px-4 py-3 text-sm">
                          <pre className="whitespace-pre-wrap font-sans text-gray-800">
                            {finalMessage ||
                              "Message preview will appear here."}
                          </pre>
                        </div>
                      </div>
                    )
                  ) : form.channel === "email" ? (
                    <div
                      className="border border-gray-200 rounded-lg p-4 bg-white text-sm overflow-x-auto min-h-[280px]"
                      dangerouslySetInnerHTML={{
                        __html: signature || "Signature not available."
                      }}
                    />
                  ) : (
                    <pre className="border border-gray-200 rounded-lg p-4 bg-gray-50 text-sm whitespace-pre-wrap font-sans min-h-[280px]">
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

          <div className="flex flex-wrap gap-3 justify-end">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep(prev => Math.max(1, prev - 1))}
                disabled={sending}
                className="border border-gray-200 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 inline-flex items-center gap-2"
              >
                <ArrowLeft size={16} />
                Back
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              disabled={sending}
              className="border border-gray-200 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              Cancel
            </button>

            {step === 1 && (
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!canContinueStep1}
                className="bg-blue-600 text-white rounded-lg px-6 py-2 text-sm font-medium disabled:opacity-60 hover:bg-blue-700 inline-flex items-center gap-2"
              >
                Continue to Suggestions
                <Sparkles size={16} />
              </button>
            )}

            {step === 2 && (
              <button
                type="button"
                onClick={() => setStep(3)}
                disabled={!canContinueStep2}
                className="bg-blue-600 text-white rounded-lg px-6 py-2 text-sm font-medium disabled:opacity-60 hover:bg-blue-700 inline-flex items-center gap-2"
              >
                Review & Send
                <Send size={16} />
              </button>
            )}

            {step === 3 && form.channel === "whatsapp" && (
              <button
                type="button"
                onClick={() => copyText(finalMessage, "message")}
                disabled={!finalMessage || sending}
                className="border border-gray-200 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 inline-flex items-center gap-2"
              >
                {copiedMessage ? (
                  <>
                    <Check size={16} className="text-green-600" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy size={16} />
                    Copy
                  </>
                )}
              </button>
            )}

            {step === 3 && (
              <button
                type="button"
                onClick={send}
                disabled={!canSend}
                className="bg-blue-600 text-white rounded-lg px-6 py-2 text-sm font-medium disabled:opacity-60 hover:bg-blue-700 inline-flex items-center gap-2"
              >
                <Send size={16} />
                {getSendButtonLabel(form.channel, sending)}
              </button>
            )}
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

function StepIndicator({ step }) {
  const steps = [
    { id: 1, label: "Receiver" },
    { id: 2, label: "Suggestion" },
    { id: 3, label: "Review & Send" }
  ];

  return (
    <div className="flex items-center gap-2 overflow-x-auto">
      {steps.map((item, index) => {
        const active = step === item.id;
        const done = step > item.id;

        return (
          <div key={item.id} className="flex items-center gap-2 shrink-0">
            <div
              className={`
                h-8 rounded-full px-3 flex items-center gap-2 border text-xs font-semibold
                ${active
                  ? "border-blue-500 bg-blue-600 text-white"
                  : done
                    ? "border-green-200 bg-green-50 text-green-700"
                    : "border-gray-200 bg-white text-gray-500"
                }
              `}
            >
              <span
                className={`
                  h-5 w-5 rounded-full flex items-center justify-center text-[11px]
                  ${active
                    ? "bg-white text-blue-600"
                    : done
                      ? "bg-green-600 text-white"
                      : "bg-gray-100 text-gray-500"
                  }
                `}
              >
                {done ? <Check size={12} /> : item.id}
              </span>
              {item.label}
            </div>

            {index < steps.length - 1 && (
              <div className="h-px w-6 bg-gray-200" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function StepHeading({ icon, title, description }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white px-4 py-3">
      <div className="flex items-start gap-2">
        <div className="h-8 w-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
          {icon}
        </div>

        <div>
          <h3 className="text-base font-semibold text-gray-900">
            {title}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

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
        {value || "-"}
      </p>
    </div>
  );
}

function ManualTemplateLibrary({
  templates = [],
  allTemplates = [],
  search = "",
  scope = "all",
  channel = "email",
  selectedTemplateId = "",
  onSearchChange,
  onScopeChange,
  onSelectTemplate
}) {
  const scopes = [
    {
      value: "all",
      label: "All",
      count: allTemplates.length
    },
    {
      value: "matches",
      label: "Smart Match",
      count: allTemplates.filter(
        template => template._intentMatched || template._outcomeMatched
      ).length
    },
    {
      value: "default",
      label: "Default",
      count: allTemplates.filter(template => template.systemTemplate).length
    },
    {
      value: "used",
      label: "Used",
      count: allTemplates.filter(template => Number(template.usageCount || 0) > 0)
        .length
    }
  ];

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
            <Package size={18} />
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-900">
              Choose Template Manually
            </p>
            <p className="mt-0.5 text-xs leading-5 text-gray-500">
              Pick any active template matching the selected channel and destination.
            </p>
          </div>
        </div>

        <span className="inline-flex w-fit items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-semibold text-gray-600">
          <ListFilter size={12} />
          {templates.length} available
        </span>
      </div>

      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

          <input
            value={search}
            onChange={event => onSearchChange?.(event.target.value)}
            placeholder="Search template by name, category, intent..."
            className="mui-input pl-9"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {scopes.map(item => (
            <button
              key={item.value}
              type="button"
              onClick={() => onScopeChange?.(item.value)}
              className={`
                shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition
                ${scope === item.value
                  ? "border-blue-200 bg-blue-50 text-blue-700"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                }
              `}
            >
              {item.label}
              <span className="ml-1 text-[10px] opacity-70">
                {item.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {templates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-5 text-center">
          <Package className="mx-auto h-8 w-8 text-gray-300" />

          <p className="mt-2 text-sm font-semibold text-gray-800">
            No template found
          </p>

          <p className="mt-1 text-xs text-gray-500">
            Try changing the search, destination, channel or filter.
          </p>
        </div>
      ) : (
        <div className="max-h-[380px] space-y-2 overflow-y-auto pr-1">
          {templates.map(template => (
            <ManualTemplateCard
              key={template.id}
              template={template}
              channel={channel}
              selected={selectedTemplateId === template.id}
              onSelect={() => onSelectTemplate?.(template)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ManualTemplateCard({
  template,
  channel = "email",
  selected = false,
  onSelect
}) {
  const previewText =
    channel === "email"
      ? stripHtml(template.emailHtml || template.emailSubject || "")
      : stripHtml(template.whatsappText || "");

  const smartMatched = template._intentMatched || template._outcomeMatched;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`
        w-full rounded-xl border p-3 text-left transition hover:shadow-sm
        ${selected
          ? "border-blue-300 bg-blue-50 ring-2 ring-blue-100"
          : smartMatched
            ? "border-blue-100 bg-blue-50/60 hover:bg-blue-50"
            : "border-gray-200 bg-white hover:bg-gray-50"
        }
      `}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-gray-900">
              {template.name || "Untitled Template"}
            </p>

            {selected && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                <Check size={11} />
                Selected
              </span>
            )}
          </div>

          <p className="mt-0.5 truncate text-xs text-gray-500">
            {template.categoryName ||
              template.categoryCode ||
              template.category ||
              "General"}
          </p>
        </div>

        <span className="shrink-0 rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-gray-600">
          {getTemplateTypeLabel(template.templateType)}
        </span>
      </div>

      {previewText && (
        <p className="mt-2 line-clamp-2 text-xs leading-5 text-gray-600">
          {previewText}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {template._intentMatched && (
          <span className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-white px-2 py-0.5 text-[11px] font-semibold text-blue-700">
            <Sparkles size={11} />
            Intent Match
          </span>
        )}

        {template._outcomeMatched && !template._intentMatched && (
          <span className="inline-flex items-center gap-1 rounded-full border border-indigo-100 bg-white px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
            <Sparkles size={11} />
            Outcome Match
          </span>
        )}

        {template.systemTemplate && (
          <span className="rounded-full border border-purple-100 bg-white px-2 py-0.5 text-[11px] font-semibold text-purple-700">
            Default
          </span>
        )}

        {Number(template.usageCount || 0) > 0 && (
          <span className="rounded-full border border-emerald-100 bg-white px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
            Used {Number(template.usageCount || 0)}
          </span>
        )}

        <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700">
          Use Template
          <Send size={11} />
        </span>
      </div>
    </button>
  );
}