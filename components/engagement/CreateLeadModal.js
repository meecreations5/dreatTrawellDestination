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
  FileText,
  ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Paperclip,
  Quote,
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

function getDisplayName(user) {
  return (
    user?.name ||
    user?.fullName ||
    user?.displayName ||
    user?.email ||
    "Unnamed User"
  );
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

function getEngagementReferenceHtml(engagement) {
  const parts = [];

  if (engagement?.subject) {
    parts.push(`<p><strong>Subject:</strong> ${engagement.subject}</p>`);
  }

  if (engagement?.message) {
    parts.push(`<p>${String(engagement.message).replace(/\n/g, "<br />")}</p>`);
  }

  if (engagement?.notes) {
    parts.push(`<p>${String(engagement.notes).replace(/\n/g, "<br />")}</p>`);
  }

  if (engagement?.outcomeLabel || engagement?.outcomeCode) {
    parts.push(
      `<p><strong>Outcome:</strong> ${
        engagement.outcomeLabel || engagement.outcomeCode
      }</p>`
    );
  }

  return parts.join("");
}

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
        uploadedAt,
        uploadedByUid: user?.uid || "",
        uploadedByName: getDisplayName(user),
        uploadedByEmail: user?.email || ""
      };
    })
  );

  return uploads;
}

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
    setFormError("");

    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = initialHtml || "";
      }
    }, 0);
  }, [engagement]);

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

      const clientReference = {
        source: clientReferenceSource || engagement?.channel || "",
        notes: cleanReferenceText,
        notesHtml: cleanReferenceHtml,
        attachments: uploadedReferences
      };

      const leadId = await createLeadFromEngagement({
        engagement: {
          ...engagement,
          destinationRefId: destination.id,
          destinationId: destination.destinationId || destination.id || null,
          destinationCode: destination.code || null,
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