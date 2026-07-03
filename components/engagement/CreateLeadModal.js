"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  getDocs,
  collection,
  query,
  where
} from "firebase/firestore";
import {
  getDownloadURL,
  ref,
  uploadBytes
} from "firebase/storage";
import {
  AlertCircle,
  Bold,
  ExternalLink,
  FileText,
  ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Paperclip,
  Quote,
  Sparkles,
  Trash2,
  UploadCloud,
  X
} from "lucide-react";

import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { createLeadFromEngagement } from "@/lib/createLeadFromEngagement";

import EngagementChip from "@/components/engagement/EngagementChip";

const inputClass = `
  w-full border border-gray-200 bg-white rounded-lg
  px-3 py-2 text-sm
  focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400
  disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed
`;

const referenceSources = [
  { value: "", label: "Select source" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "call", label: "Call Discussion" },
  { value: "meeting", label: "Meeting Discussion" },
  { value: "instagram", label: "Instagram / Social Media" },
  { value: "website", label: "Website / Online" },
  { value: "walk_in", label: "Walk-in / Offline" },
  { value: "other", label: "Other" }
];

const allowedReferenceTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/jpg",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
];

const maxReferenceFiles = 5;
const maxFileSizeMb = 10;

/* =========================
   BASIC HELPERS
========================= */

function getDisplayName(user) {
  return (
    user?.name ||
    user?.fullName ||
    user?.displayName ||
    user?.email ||
    "Unnamed User"
  );
}

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

function safeFileName(name = "") {
  const cleanName = String(name)
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "");

  return cleanName || `reference-${Date.now()}`;
}

function formatFileSize(size = 0) {
  if (!size) return "0 KB";

  const kb = size / 1024;
  const mb = kb / 1024;

  if (mb >= 1) return `${mb.toFixed(1)} MB`;

  return `${kb.toFixed(0)} KB`;
}

function stripHtml(html = "") {
  return String(html || "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanRichHtml(html = "") {
  return String(html || "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .trim();
}

function getAttachmentType(file) {
  if (file?.type?.startsWith("image/")) return "image";
  if (file?.type === "application/pdf") return "pdf";
  return "document";
}

/* =========================
   ASSET HELPERS
========================= */

function getAssetTitle(asset = {}) {
  return getFirstValue(
    asset.title,
    asset.name,
    asset.fileName,
    asset.currentFileName,
    "Shared Asset"
  );
}

function getAssetUrl(asset = {}) {
  return getFirstValue(
    asset.url,
    asset.currentUrl,
    asset.externalUrl,
    asset.downloadUrl,
    asset.fileUrl
  );
}

function getAssetType(asset = {}) {
  const type = normalize(
    asset.assetType ||
      asset.documentType ||
      asset.fileType ||
      asset.fileExtension ||
      "document"
  );

  const fileType = normalize(asset.fileType || asset.currentFileType);
  const extension = normalize(
    asset.fileExtension || asset.currentFileExtension
  );

  if (
    type.includes("image") ||
    fileType.startsWith("image/") ||
    ["jpg", "jpeg", "png", "webp"].includes(extension)
  ) {
    return "image";
  }

  if (
    type.includes("pdf") ||
    fileType === "application/pdf" ||
    extension === "pdf"
  ) {
    return "pdf";
  }

  if (
    type.includes("video") ||
    type.includes("youtube") ||
    fileType.startsWith("video/")
  ) {
    return "video";
  }

  if (type.includes("link")) return "link";

  return "document";
}

function getSharedAssets(engagement) {
  const assets = Array.isArray(engagement?.sharedAssets)
    ? engagement.sharedAssets
    : [];

  const map = new Map();

  assets.forEach(asset => {
    const assetId =
      asset.assetId ||
      asset.id ||
      asset.documentId ||
      getAssetUrl(asset);

    if (!assetId) return;

    map.set(assetId, {
      assetId,
      title: getAssetTitle(asset),
      url: getAssetUrl(asset),

      categoryId: asset.categoryId || "",
      categoryName: asset.categoryName || "",
      categorySlug: asset.categorySlug || "",

      assetType: asset.assetType || asset.documentType || "document",
      usageType: asset.usageType || "",

      currentVersion: asset.currentVersion || asset.version || 1,

      fileName: asset.fileName || asset.currentFileName || "",
      fileSize: asset.fileSize || asset.currentFileSize || 0,
      fileType: asset.fileType || asset.currentFileType || "",
      fileExtension:
        asset.fileExtension || asset.currentFileExtension || "",

      source: "engagement_shared_asset"
    });
  });

  return Array.from(map.values());
}

function normalizeSharedAssetAsReference(asset = {}) {
  return {
    name: getAssetTitle(asset),
    url: getAssetUrl(asset),

    type: getAssetType(asset),
    mimeType: asset.fileType || asset.currentFileType || "",
    size: asset.fileSize || asset.currentFileSize || 0,

    source: "engagement_shared_asset",

    assetId: asset.assetId || asset.id || asset.documentId || "",
    categoryName: asset.categoryName || "",
    usageType: asset.usageType || "",
    currentVersion: asset.currentVersion || asset.version || 1,

    fileName: asset.fileName || asset.currentFileName || "",
    fileExtension:
      asset.fileExtension || asset.currentFileExtension || ""
  };
}

/* =========================
   ENGAGEMENT REFERENCE
========================= */

function getEngagementReferenceHtml(engagement) {
  const parts = [];

  if (engagement?.templateName) {
    parts.push(
      `<p><strong>Template Used:</strong> ${escapeHtml(
        engagement.templateName
      )}</p>`
    );
  }

  if (engagement?.templateType) {
    parts.push(
      `<p><strong>Template Type:</strong> ${escapeHtml(
        engagement.templateType
      )}</p>`
    );
  }

  if (engagement?.templateCategory) {
    parts.push(
      `<p><strong>Template Category:</strong> ${escapeHtml(
        engagement.templateCategory
      )}</p>`
    );
  }

  if (engagement?.communicationSource) {
    parts.push(
      `<p><strong>Communication Source:</strong> ${escapeHtml(
        engagement.communicationSource
      )}</p>`
    );
  }

  if (engagement?.channel) {
    parts.push(
      `<p><strong>Channel:</strong> ${escapeHtml(engagement.channel)}</p>`
    );
  }

  if (engagement?.destinationName) {
    parts.push(
      `<p><strong>Destination:</strong> ${escapeHtml(
        engagement.destinationName
      )}</p>`
    );
  }

  if (engagement?.emailSubject) {
    parts.push(
      `<p><strong>Email Subject:</strong> ${escapeHtml(
        engagement.emailSubject
      )}</p>`
    );
  } else if (engagement?.subject) {
    parts.push(
      `<p><strong>Subject:</strong> ${escapeHtml(engagement.subject)}</p>`
    );
  }

  if (engagement?.messageHtml) {
    parts.push(`<div>${cleanRichHtml(engagement.messageHtml)}</div>`);
  } else if (engagement?.message || engagement?.messageText) {
    const text = escapeHtml(
      engagement.message || engagement.messageText || ""
    ).replace(/\n/g, "<br />");

    parts.push(`<p>${text}</p>`);
  }

  if (engagement?.notes) {
    parts.push(
      `<p>${escapeHtml(String(engagement.notes)).replace(
        /\n/g,
        "<br />"
      )}</p>`
    );
  }

  if (engagement?.outcomeLabel || engagement?.outcomeCode) {
    parts.push(
      `<p><strong>Outcome:</strong> ${escapeHtml(
        engagement.outcomeLabel || engagement.outcomeCode
      )}</p>`
    );
  }

  const sharedAssets = getSharedAssets(engagement);

  if (sharedAssets.length > 0) {
    const rows = sharedAssets
      .map(asset => {
        const title = escapeHtml(getAssetTitle(asset));
        const url = getAssetUrl(asset);
        const category = escapeHtml(asset.categoryName || asset.assetType || "Asset");

        if (url) {
          return `• <a href="${escapeHtml(
            url
          )}" target="_blank" rel="noopener noreferrer">${title}</a> (${category})`;
        }

        return `• ${title} (${category})`;
      })
      .join("<br />");

    parts.push(`<p><strong>Shared Assets:</strong><br />${rows}</p>`);
  }

  return parts.join("");
}

/* =========================
   DATA LOADERS
========================= */

async function loadTeamUsers() {
  try {
    const snap = await getDocs(
      query(
        collection(db, "users"),
        where("active", "==", true),
        where("role", "in", ["team", "admin", "manager", "employee"])
      )
    );

    return snap.docs.map(d => ({
      uid: d.id,
      id: d.id,
      ...d.data()
    }));
  } catch (err) {
    console.warn(
      "Role based team query failed. Falling back to active users.",
      err
    );

    const snap = await getDocs(
      query(
        collection(db, "users"),
        where("active", "==", true)
      )
    );

    return snap.docs.map(d => ({
      uid: d.id,
      id: d.id,
      ...d.data()
    }));
  }
}

async function uploadReferenceFiles({ files, user }) {
  if (!files.length) return [];

  const userId = user?.uid || "unknown-user";
  const uploadedAt = new Date();

  const uploads = await Promise.all(
    files.map(async (item, index) => {
      const file = item.file;
      const cleanName = safeFileName(file.name);
      const path = `uploads/lead-references/${userId}/${Date.now()}-${index}-${cleanName}`;

      const storageRef = ref(storage, path);

      await uploadBytes(storageRef, file, {
        contentType: file.type || "application/octet-stream"
      });

      const url = await getDownloadURL(storageRef);

      return {
        name: file.name,
        url,
        path,
        type: getAttachmentType(file),
        mimeType: file.type || "",
        size: file.size || 0,
        source: "manual_upload",
        uploadedAt,
        uploadedByUid: user?.uid || "",
        uploadedByName: getDisplayName(user),
        uploadedByEmail: user?.email || ""
      };
    })
  );

  return uploads;
}

function resolveDestinationIdFromEngagement(engagement, destinations = []) {
  if (!engagement || !destinations.length) return "";

  const destinationRefId = getFirstValue(engagement.destinationRefId);
  const destinationId = getFirstValue(engagement.destinationId);
  const destinationName = normalize(engagement.destinationName);

  const matched = destinations.find(destination => {
    const idMatch =
      destinationRefId &&
      String(destination.id) === String(destinationRefId);

    const destinationIdMatch =
      destinationId &&
      String(destination.destinationId || destination.id) ===
        String(destinationId);

    const nameMatch =
      destinationName &&
      normalize(destination.name) === destinationName;

    return idMatch || destinationIdMatch || nameMatch;
  });

  return matched?.id || "";
}

/* =========================
   COMPONENT
========================= */

export default function CreateLeadModal({ engagement, onClose }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  const editorRef = useRef(null);

  const [team, setTeam] = useState([]);
  const [destinations, setDestinations] = useState([]);

  const [assignedUid, setAssignedUid] = useState("");
  const [destinationId, setDestinationId] = useState("");

  const [clientReferenceSource, setClientReferenceSource] = useState("");
  const [clientReferenceHtml, setClientReferenceHtml] = useState("");
  const [referenceFiles, setReferenceFiles] = useState([]);

  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingReferences, setUploadingReferences] = useState(false);
  const [formError, setFormError] = useState("");

  const sharedAssets = useMemo(() => {
    return getSharedAssets(engagement);
  }, [engagement]);

  const hasTemplate = Boolean(
    engagement?.templateId ||
      engagement?.templateName ||
      engagement?.isTemplateCommunication ||
      engagement?.communicationSource === "template"
  );

  /* =========================
     LOAD TEAM + DESTINATIONS
  ========================== */

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      setPageLoading(true);
      setFormError("");

      try {
        const [teamRows, destinationSnap] = await Promise.all([
          loadTeamUsers(),
          getDocs(
            query(
              collection(db, "destinations"),
              where("active", "==", true)
            )
          )
        ]);

        if (!mounted) return;

        setTeam(
          teamRows
            .filter(Boolean)
            .sort((a, b) =>
              getDisplayName(a).localeCompare(getDisplayName(b))
            )
        );

        setDestinations(
          destinationSnap.docs
            .map(d => ({
              id: d.id,
              ...d.data()
            }))
            .sort((a, b) =>
              String(a?.name || "").localeCompare(String(b?.name || ""))
            )
        );
      } catch (err) {
        console.error("Create lead modal load failed:", err);
        setFormError("Unable to load destinations or team members.");
      } finally {
        if (mounted) setPageLoading(false);
      }
    }

    loadData();

    return () => {
      mounted = false;
    };
  }, []);

  /* =========================
     PREFILL REFERENCE FROM ENGAGEMENT
  ========================== */

  useEffect(() => {
    const initialHtml = getEngagementReferenceHtml(engagement);
    const initialSource = engagement?.channel || "";

    setClientReferenceSource(initialSource);
    setClientReferenceHtml(initialHtml || "");
    setReferenceFiles([]);
    setDestinationId("");
    setFormError("");

    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = initialHtml || "";
      }
    }, 0);
  }, [engagement]);

  /* =========================
     AUTO SELECT DESTINATION
  ========================== */

  useEffect(() => {
    if (!engagement || !destinations.length) return;

    const resolvedDestinationId = resolveDestinationIdFromEngagement(
      engagement,
      destinations
    );

    if (resolvedDestinationId) {
      setDestinationId(resolvedDestinationId);
    }
  }, [engagement, destinations]);

  const destination = useMemo(() => {
    return destinations.find(d => d.id === destinationId) || null;
  }, [destinations, destinationId]);

  const assignee = useMemo(() => {
    if (!assignedUid) {
      return {
        uid: user?.uid || "",
        email: user?.email || "",
        name: getDisplayName(user)
      };
    }

    return (
      team.find(t => t.uid === assignedUid || t.id === assignedUid) || {
        uid: user?.uid || "",
        email: user?.email || "",
        name: getDisplayName(user)
      }
    );
  }, [assignedUid, team, user]);

  const clientReferenceText = stripHtml(clientReferenceHtml);

  const canCreate =
    Boolean(destinationId) &&
    !saving &&
    !uploadingReferences &&
    !pageLoading;

  /* =========================
     EDITOR ACTIONS
  ========================== */

  const syncEditorHtml = () => {
    setClientReferenceHtml(editorRef.current?.innerHTML || "");
  };

  const runCommand = (command, value = null) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    syncEditorHtml();
  };

  const addLink = () => {
    const url = prompt("Paste link URL");

    if (!url?.trim()) return;

    runCommand("createLink", url.trim());
  };

  const handlePaste = event => {
    event.preventDefault();

    const html = event.clipboardData.getData("text/html");
    const text = event.clipboardData.getData("text/plain");

    if (html) {
      document.execCommand("insertHTML", false, cleanRichHtml(html));
    } else {
      document.execCommand("insertText", false, text);
    }

    syncEditorHtml();
  };

  /* =========================
     FILE HANDLING
  ========================== */

  const addReferenceFiles = event => {
    const files = Array.from(event.target.files || []);

    if (!files.length) return;

    setFormError("");

    if (referenceFiles.length + files.length > maxReferenceFiles) {
      setFormError(`You can upload maximum ${maxReferenceFiles} reference files.`);
      event.target.value = "";
      return;
    }

    const validFiles = [];

    for (const file of files) {
      const fileSizeMb = file.size / (1024 * 1024);

      if (!allowedReferenceTypes.includes(file.type)) {
        setFormError("Only image, PDF, DOC and DOCX files are allowed.");
        event.target.value = "";
        return;
      }

      if (fileSizeMb > maxFileSizeMb) {
        setFormError(`Each file must be less than ${maxFileSizeMb} MB.`);
        event.target.value = "";
        return;
      }

      validFiles.push({
        id: `${file.name}-${file.lastModified}-${Math.random()}`,
        file
      });
    }

    setReferenceFiles(prev => [...prev, ...validFiles]);
    event.target.value = "";
  };

  const removeReferenceFile = fileId => {
    setReferenceFiles(prev => prev.filter(item => item.id !== fileId));
  };

  if (loading || !user) return null;

  /* =========================
     CREATE LEAD
  ========================== */

  const createLead = async () => {
    setFormError("");

    if (!destinationId || !destination) {
      setFormError("Please select a destination.");
      return;
    }

    setSaving(true);

    try {
      let uploadedReferences = [];

      if (referenceFiles.length > 0) {
        setUploadingReferences(true);

        uploadedReferences = await uploadReferenceFiles({
          files: referenceFiles,
          user
        });
      }

      const cleanReferenceHtml = cleanRichHtml(clientReferenceHtml);
      const cleanReferenceText = stripHtml(cleanReferenceHtml);

      const sharedAssetReferences = sharedAssets
        .map(normalizeSharedAssetAsReference)
        .filter(asset => asset.url || asset.assetId);

      const clientReference = {
        source: clientReferenceSource || engagement?.channel || "",
        notes: cleanReferenceText,
        notesHtml: cleanReferenceHtml,

        attachments: [
          ...sharedAssetReferences,
          ...uploadedReferences
        ],

        templateId: engagement?.templateId || "",
        templateName: engagement?.templateName || "",
        templateType: engagement?.templateType || "",
        templateCategory: engagement?.templateCategory || "",
        communicationSource: engagement?.communicationSource || "",

        emailSubject: engagement?.emailSubject || "",
        subject: engagement?.subject || "",

        assetLinksText: engagement?.assetLinksText || "",
        sharedAssetIds: engagement?.sharedAssetIds || [],
        sharedAssetTitles: engagement?.sharedAssetTitles || [],

        sourceEngagementId: engagement?.id || "",
        sourceEngagementType: engagement?.engagementType || "",
        sourceChannel: engagement?.channel || ""
      };

      const leadId = await createLeadFromEngagement({
        engagement: {
          ...engagement,
          destinationRefId: destination.id,
          destinationId: destination.destinationId || destination.id || null,
          destinationCode:
            destination.code || destination.destinationCode || null,
          destinationName: destination.name
        },
        assignedUser: {
          ...assignee,
          uid: assignee?.uid || assignee?.id || user.uid,
          email: assignee?.email || "",
          name: getDisplayName(assignee)
        },
        createdUser: {
          uid: user.uid,
          email: user.email || "",
          name: getDisplayName(user)
        },
        clientReference
      });

      onClose?.();
      router.push(`/leads/${leadId}`);
    } catch (err) {
      console.error("Create lead from engagement failed:", err);
      setFormError(err?.message || "Failed to create lead.");
    } finally {
      setSaving(false);
      setUploadingReferences(false);
    }
  };

  /* =========================
     UI
  ========================== */

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[92vh] overflow-hidden">
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Create Lead
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Convert this engagement into a lead with destination, assignee and client reference.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="text-gray-400 hover:text-gray-700 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* BODY */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[calc(92vh-140px)]">
          {pageLoading ? (
            <div className="py-16 flex items-center justify-center text-sm text-gray-500">
              <Loader2 size={18} className="animate-spin mr-2" />
              Loading lead options...
            </div>
          ) : (
            <>
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm flex items-start gap-2">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* TEMPLATE CONTEXT */}
              {hasTemplate && (
                <div className="rounded-xl border border-purple-100 bg-purple-50 px-4 py-3">
                  <div className="flex items-start gap-2">
                    <Sparkles size={17} className="text-purple-700 mt-0.5" />

                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-purple-700">
                        Template Communication
                      </p>

                      <p className="text-sm font-semibold text-gray-900 mt-1 truncate">
                        {engagement?.templateName || "Communication Template"}
                      </p>

                      <div className="flex flex-wrap gap-2 mt-2 text-[11px]">
                        {engagement?.templateType && (
                          <span className="rounded-full bg-white border border-purple-100 px-2 py-0.5 text-purple-700">
                            {engagement.templateType}
                          </span>
                        )}

                        {engagement?.channel && (
                          <span className="rounded-full bg-white border border-purple-100 px-2 py-0.5 text-purple-700">
                            {engagement.channel}
                          </span>
                        )}

                        {engagement?.destinationName && (
                          <span className="rounded-full bg-white border border-purple-100 px-2 py-0.5 text-purple-700">
                            {engagement.destinationName}
                          </span>
                        )}

                        {engagement?.emailSubject && (
                          <span className="rounded-full bg-white border border-purple-100 px-2 py-0.5 text-purple-700">
                            Email subject available
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* DESTINATION */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-600">
                  Select Destination <span className="text-red-500">*</span>
                </p>

                <div className="flex gap-2 flex-wrap">
                  {destinations.map((d, index) => (
                    <EngagementChip
                      key={d.id || `destination-${index}`}
                      label={d.name || "Unnamed Destination"}
                      icon="✈️"
                      active={destinationId === d.id}
                      onClick={() => {
                        setDestinationId(d.id);
                        setFormError("");
                      }}
                    />
                  ))}
                </div>

                {destinations.length === 0 && (
                  <p className="text-xs text-amber-600">
                    No active destinations found.
                  </p>
                )}
              </div>

              {/* ASSIGN TO */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-600">
                  Assign To
                </p>

                <div className="flex gap-2 flex-wrap">
                  <EngagementChip
                    label={`Self - ${getDisplayName(user)}`}
                    icon="👤"
                    active={!assignedUid}
                    onClick={() => setAssignedUid("")}
                  />

                  {team.map((u, index) => {
                    const safeUid =
                      u.uid ||
                      u.id ||
                      u.email ||
                      `team-${index}`;

                    return (
                      <EngagementChip
                        key={`${safeUid}-${index}`}
                        label={getDisplayName(u)}
                        icon="🧑‍💼"
                        active={assignedUid === safeUid}
                        onClick={() => setAssignedUid(safeUid)}
                      />
                    );
                  })}
                </div>
              </div>

              {/* CLIENT REFERENCE */}
              <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 space-y-4">
                <div className="flex items-start gap-2">
                  <Paperclip size={18} className="text-blue-600 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">
                      Client Reference
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Add client requirement, copied chat/email content or reference files.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">
                      Reference Source
                    </label>

                    <select
                      className={inputClass}
                      value={clientReferenceSource}
                      onChange={e => setClientReferenceSource(e.target.value)}
                    >
                      {referenceSources.map(source => (
                        <option
                          key={source.value || "empty"}
                          value={source.value}
                        >
                          {source.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">
                      Upload Reference
                    </label>

                    <label
                      className="
                        flex items-center justify-center gap-2
                        border border-dashed border-blue-200
                        bg-white rounded-lg px-3 py-2
                        text-sm text-blue-700
                        cursor-pointer hover:bg-blue-50
                        transition
                      "
                    >
                      <UploadCloud size={16} />
                      Add image / PDF / document

                      <input
                        type="file"
                        multiple
                        accept="image/*,.pdf,.doc,.docx"
                        onChange={addReferenceFiles}
                        className="hidden"
                      />
                    </label>

                    <p className="text-[11px] text-gray-500">
                      Max {maxReferenceFiles} files, {maxFileSizeMb} MB each.
                    </p>
                  </div>
                </div>

                {/* ASSETS ALREADY SHARED */}
                {sharedAssets.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-600">
                      Assets Already Shared in Engagement
                    </p>

                    <div className="space-y-2">
                      {sharedAssets.map((asset, index) => (
                        <div
                          key={asset.assetId || asset.url || index}
                          className="flex items-center justify-between gap-3 bg-white border border-blue-100 rounded-lg px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-gray-800 truncate">
                              {getAssetTitle(asset)}
                            </p>
                            <p className="text-[11px] text-gray-400 truncate">
                              {asset.categoryName || asset.assetType || "Asset"}
                            </p>
                          </div>

                          {asset.url && (
                            <a
                              href={asset.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline shrink-0"
                            >
                              View
                              <ExternalLink size={12} />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* RICH TEXT EDITOR */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">
                    Reference Notes / Client Requirement
                  </label>

                  <div className="border border-gray-200 bg-white rounded-lg overflow-hidden">
                    <div className="flex flex-wrap items-center gap-1 border-b border-gray-100 bg-gray-50 px-2 py-2">
                      <button
                        type="button"
                        onMouseDown={e => {
                          e.preventDefault();
                          runCommand("bold");
                        }}
                        className="p-1.5 rounded hover:bg-white text-gray-600"
                      >
                        <Bold size={15} />
                      </button>

                      <button
                        type="button"
                        onMouseDown={e => {
                          e.preventDefault();
                          runCommand("italic");
                        }}
                        className="p-1.5 rounded hover:bg-white text-gray-600"
                      >
                        <Italic size={15} />
                      </button>

                      <button
                        type="button"
                        onMouseDown={e => {
                          e.preventDefault();
                          runCommand("insertUnorderedList");
                        }}
                        className="p-1.5 rounded hover:bg-white text-gray-600"
                      >
                        <List size={15} />
                      </button>

                      <button
                        type="button"
                        onMouseDown={e => {
                          e.preventDefault();
                          runCommand("insertOrderedList");
                        }}
                        className="p-1.5 rounded hover:bg-white text-gray-600"
                      >
                        <ListOrdered size={15} />
                      </button>

                      <button
                        type="button"
                        onMouseDown={e => {
                          e.preventDefault();
                          runCommand("formatBlock", "blockquote");
                        }}
                        className="p-1.5 rounded hover:bg-white text-gray-600"
                      >
                        <Quote size={15} />
                      </button>

                      <button
                        type="button"
                        onMouseDown={e => {
                          e.preventDefault();
                          addLink();
                        }}
                        className="p-1.5 rounded hover:bg-white text-gray-600"
                      >
                        <Link2 size={15} />
                      </button>

                      <div className="w-px h-5 bg-gray-200 mx-1" />

                      <button
                        type="button"
                        onMouseDown={e => {
                          e.preventDefault();
                          runCommand("removeFormat");
                        }}
                        className="px-2 py-1 rounded hover:bg-white text-xs text-gray-600"
                      >
                        Clear
                      </button>
                    </div>

                    <div className="relative">
                      {!clientReferenceText && (
                        <p className="pointer-events-none absolute left-3 top-3 text-sm text-gray-400">
                          Add client requirement, preferences, budget, hotel references, meal plan, dates...
                        </p>
                      )}

                      <div
                        ref={editorRef}
                        contentEditable
                        suppressContentEditableWarning
                        role="textbox"
                        aria-multiline="true"
                        onInput={syncEditorHtml}
                        onPaste={handlePaste}
                        className="
                          min-h-[150px]
                          px-3 py-3
                          text-sm text-gray-800
                          outline-none
                          leading-relaxed

                          [&_ul]:list-disc
                          [&_ul]:pl-5
                          [&_ol]:list-decimal
                          [&_ol]:pl-5
                          [&_blockquote]:border-l-4
                          [&_blockquote]:border-blue-200
                          [&_blockquote]:pl-3
                          [&_blockquote]:text-gray-600
                          [&_a]:text-blue-600
                          [&_a]:underline
                        "
                      />
                    </div>
                  </div>
                </div>

                {/* FILE LIST */}
                {referenceFiles.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-600">
                      Selected Reference Files
                    </p>

                    <div className="space-y-2">
                      {referenceFiles.map(item => {
                        const file = item.file;
                        const isImage = file.type?.startsWith("image/");

                        return (
                          <div
                            key={item.id}
                            className="flex items-center justify-between gap-3 bg-white border border-gray-100 rounded-lg px-3 py-2"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {isImage ? (
                                <ImageIcon
                                  size={16}
                                  className="text-blue-600 shrink-0"
                                />
                              ) : (
                                <FileText
                                  size={16}
                                  className="text-orange-600 shrink-0"
                                />
                              )}

                              <div className="min-w-0">
                                <p className="text-xs font-medium text-gray-800 truncate">
                                  {file.name}
                                </p>
                                <p className="text-[11px] text-gray-400">
                                  {formatFileSize(file.size)}
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => removeReferenceFile(item.id)}
                              className="text-gray-400 hover:text-red-600"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* FOOTER */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="
              w-1/2 border border-gray-200 rounded-md py-2
              text-sm hover:bg-gray-50 disabled:opacity-60
            "
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={createLead}
            disabled={!canCreate}
            className="
              w-1/2 bg-blue-600 text-white rounded-md py-2
              text-sm font-medium hover:bg-blue-700
              disabled:opacity-60
              inline-flex items-center justify-center gap-2
            "
          >
            {(saving || uploadingReferences) && (
              <Loader2 size={15} className="animate-spin" />
            )}

            {uploadingReferences
              ? "Uploading..."
              : saving
                ? "Creating..."
                : "Create Lead"}
          </button>
        </div>
      </div>
    </div>
  );
}