"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  getDocs,
  query,
  where
} from "firebase/firestore";
import {
  getDownloadURL,
  ref,
  uploadBytes
} from "firebase/storage";
import {
  ArrowLeft,
  AlertCircle,
  Bold,
  Building2,
  CheckCircle2,
  Eye,
  FileText,
  ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Mail,
  MapPin,
  Paperclip,
  Phone,
  Quote,
  Search,
  Send,
  Trash2,
  UploadCloud,
  UserRound,
  X
} from "lucide-react";

import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { createManualLead } from "@/lib/createManualLead";

const inputClass = `
  w-full
  border border-gray-200
  bg-white
  rounded-lg
  px-3 py-2
  text-sm
  focus:outline-none
  focus:ring-2 focus:ring-blue-100
  focus:border-blue-400
  disabled:bg-gray-50
  disabled:text-gray-400
  disabled:cursor-not-allowed
`;

const labelClass = "text-sm font-medium text-gray-700";

const referenceSources = [
  { value: "", label: "Select source" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "call", label: "Call Discussion" },
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

function getReferenceSourceLabel(value) {
  return (
    referenceSources.find(source => source.value === value)?.label ||
    "Not specified"
  );
}

function sortByName(rows, field) {
  return [...rows].sort((a, b) =>
    String(a?.[field] || "").localeCompare(String(b?.[field] || ""))
  );
}

function getAgentSpocs(agent) {
  if (!agent) return [];

  const arraySpocs =
    Array.isArray(agent.spocs) ? agent.spocs :
    Array.isArray(agent.contacts) ? agent.contacts :
    Array.isArray(agent.contactPersons) ? agent.contactPersons :
    [];

  if (arraySpocs.length > 0) {
    return arraySpocs.filter(Boolean);
  }

  const fallbackSpoc = {
    name:
      agent.spocName ||
      agent.contactPersonName ||
      agent.primaryContactName ||
      agent.contactName ||
      "",
    designation:
      agent.spocDesignation ||
      agent.contactDesignation ||
      agent.primaryContactDesignation ||
      agent.designation ||
      "",
    email:
      agent.spocEmail ||
      agent.contactEmail ||
      agent.primaryEmail ||
      agent.email ||
      "",
    phone:
      agent.spocPhone ||
      agent.contactPhone ||
      agent.primaryPhone ||
      agent.phone ||
      agent.mobile ||
      "",
    whatsapp:
      agent.spocWhatsapp ||
      agent.contactWhatsapp ||
      agent.whatsapp ||
      ""
  };

  const hasContact =
    fallbackSpoc.name ||
    fallbackSpoc.email ||
    fallbackSpoc.phone ||
    fallbackSpoc.whatsapp;

  return hasContact ? [fallbackSpoc] : [];
}

function formatAddress(address) {
  if (!address) return "";

  return [
    address.line1,
    address.line2,
    address.city,
    address.state,
    address.pincode,
    address.country
  ]
    .filter(Boolean)
    .join(", ");
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
  return String(html)
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

async function loadTeamUsers() {
  try {
    const snap = await getDocs(
      query(
        collection(db, "users"),
        where("active", "==", true),
        where("role", "in", ["employee", "admin", "manager"])
      )
    );

    return snap.docs.map(doc => ({
      ...doc.data(),
      uid: doc.id
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

    return snap.docs.map(doc => ({
      ...doc.data(),
      uid: doc.id
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

export default function ManualLeadCreatePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const agentSearchRef = useRef(null);
  const referenceEditorRef = useRef(null);

  const [destinations, setDestinations] = useState([]);
  const [agents, setAgents] = useState([]);
  const [team, setTeam] = useState([]);

  const [destinationId, setDestinationId] = useState("");
  const [agentId, setAgentId] = useState("");
  const [agentSearch, setAgentSearch] = useState("");
  const [showAgentSuggestions, setShowAgentSuggestions] = useState(false);

  const [spocIndex, setSpocIndex] = useState(0);
  const [assignedToUid, setAssignedToUid] = useState("");

  const [clientReferenceSource, setClientReferenceSource] = useState("");
  const [clientReferenceHtml, setClientReferenceHtml] = useState("");
  const [referenceFiles, setReferenceFiles] = useState([]);

  const [pageLoading, setPageLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [referenceUploading, setReferenceUploading] = useState(false);

  useEffect(() => {
    if (loading || !user) return;

    let mounted = true;

    async function loadData() {
      setPageLoading(true);
      setLoadError("");

      try {
        const [destinationSnap, agentSnap, teamRows] = await Promise.all([
          getDocs(
            query(
              collection(db, "destinations"),
              where("active", "==", true)
            )
          ),
          getDocs(
            query(
              collection(db, "travelAgents"),
              where("status", "==", "active")
            )
          ),
          loadTeamUsers()
        ]);

        if (!mounted) return;

        const destinationRows = destinationSnap.docs.map(doc => ({
          ...doc.data(),
          id: doc.id
        }));

        const agentRows = agentSnap.docs.map(doc => ({
          ...doc.data(),
          id: doc.id
        }));

        setDestinations(sortByName(destinationRows, "name"));
        setAgents(sortByName(agentRows, "agencyName"));
        setTeam(sortByName(teamRows, "name"));
      } catch (err) {
        console.error("Create lead data load failed:", err);

        if (mounted) {
          setLoadError(
            "Unable to load create lead data. Please refresh and try again."
          );
        }
      } finally {
        if (mounted) {
          setPageLoading(false);
        }
      }
    }

    loadData();

    return () => {
      mounted = false;
    };
  }, [loading, user]);

  useEffect(() => {
    function handleOutsideClick(event) {
      if (
        agentSearchRef.current &&
        !agentSearchRef.current.contains(event.target)
      ) {
        setShowAgentSuggestions(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  const destination = useMemo(
    () => destinations.find(d => d.id === destinationId),
    [destinationId, destinations]
  );

  const availableAgents = useMemo(() => {
    return agents;
  }, [agents]);

  const filteredAgentSuggestions = useMemo(() => {
    const keyword = agentSearch.trim().toLowerCase();

    if (!keyword) {
      return availableAgents.slice(0, 20);
    }

    return availableAgents
      .filter(agent => {
        const agencyName = String(agent.agencyName || "").toLowerCase();
        const agentCode = String(agent.agentCode || "").toLowerCase();
        const city = String(agent.address?.city || "").toLowerCase();
        const state = String(agent.address?.state || "").toLowerCase();
        const country = String(agent.address?.country || "").toLowerCase();
        const phone = String(agent.phone || agent.mobile || "").toLowerCase();
        const email = String(agent.email || "").toLowerCase();

        return (
          agencyName.includes(keyword) ||
          agentCode.includes(keyword) ||
          city.includes(keyword) ||
          state.includes(keyword) ||
          country.includes(keyword) ||
          phone.includes(keyword) ||
          email.includes(keyword)
        );
      })
      .slice(0, 20);
  }, [agentSearch, availableAgents]);

  const agent = useMemo(
    () => availableAgents.find(a => a.id === agentId),
    [agentId, availableAgents]
  );

  const spocs = useMemo(() => getAgentSpocs(agent), [agent]);

  const spoc = useMemo(
    () => spocs[spocIndex],
    [spocs, spocIndex]
  );

  const assignedUser = useMemo(() => {
    if (!assignedToUid) return user;
    return team.find(member => member.uid === assignedToUid) || user;
  }, [assignedToUid, team, user]);

  const agentAddress = useMemo(
    () => formatAddress(agent?.address),
    [agent]
  );

  const clientReferenceText = stripHtml(clientReferenceHtml);

  const hasClientReference =
    Boolean(clientReferenceSource) ||
    Boolean(clientReferenceText) ||
    referenceFiles.length > 0;

  const referenceSourceLabel = getReferenceSourceLabel(clientReferenceSource);

  const mailSubject =
    destination && agent
      ? `New Lead Created - ${destination.name || "Destination"} | ${
          agent.agencyName || "Travel Agent"
        }`
      : "New Lead Created - Lead Details Pending";

  const mailToName = getDisplayName(assignedUser);

  const mailPreviewDate = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });

  const canCreate =
    Boolean(destination) &&
    Boolean(agent) &&
    Boolean(spoc) &&
    !saving &&
    !referenceUploading &&
    !pageLoading;

  useEffect(() => {
    if (spocIndex >= spocs.length) {
      setSpocIndex(0);
    }
  }, [spocIndex, spocs.length]);

  const selectAgent = selectedAgent => {
    setAgentId(selectedAgent.id);
    setAgentSearch(
      `${selectedAgent.agencyName || "Unnamed Agency"}${
        selectedAgent.agentCode ? ` (${selectedAgent.agentCode})` : ""
      }`
    );
    setSpocIndex(0);
    setShowAgentSuggestions(false);
    setFormError("");
  };

  const clearSelectedAgent = () => {
    setAgentId("");
    setAgentSearch("");
    setSpocIndex(0);
    setShowAgentSuggestions(false);
    setFormError("");
  };

  const syncReferenceEditorHtml = () => {
    setClientReferenceHtml(referenceEditorRef.current?.innerHTML || "");
  };

  const runReferenceCommand = (command, value = null) => {
    referenceEditorRef.current?.focus();
    document.execCommand(command, false, value);
    syncReferenceEditorHtml();
  };

  const addReferenceLink = () => {
    const url = prompt("Paste link URL");

    if (!url?.trim()) return;

    runReferenceCommand("createLink", url.trim());
  };

  const handleReferencePaste = event => {
    event.preventDefault();

    const html = event.clipboardData.getData("text/html");
    const text = event.clipboardData.getData("text/plain");

    if (html) {
      document.execCommand("insertHTML", false, cleanRichHtml(html));
    } else {
      document.execCommand("insertText", false, text);
    }

    syncReferenceEditorHtml();
  };

  const addReferenceFiles = event => {
    const selectedFiles = Array.from(event.target.files || []);

    if (!selectedFiles.length) return;

    setFormError("");

    const existingCount = referenceFiles.length;

    if (existingCount + selectedFiles.length > maxReferenceFiles) {
      setFormError(
        `You can upload maximum ${maxReferenceFiles} reference files.`
      );
      event.target.value = "";
      return;
    }

    const validFiles = [];

    for (const file of selectedFiles) {
      const fileSizeMb = file.size / (1024 * 1024);

      if (!allowedReferenceTypes.includes(file.type)) {
        setFormError(
          "Only image, PDF, DOC and DOCX reference files are allowed."
        );
        event.target.value = "";
        return;
      }

      if (fileSizeMb > maxFileSizeMb) {
        setFormError(
          `Each reference file must be less than ${maxFileSizeMb} MB.`
        );
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

  const submit = async event => {
    event.preventDefault();
    setFormError("");

    if (!destination) {
      setFormError("Please select a destination.");
      return;
    }

    if (!agent) {
      setFormError("Please select a travel agent from the suggestions.");
      return;
    }

    if (!spoc) {
      setFormError(
        "Selected travel agent does not have a valid SPOC/contact person."
      );
      return;
    }

    const normalizedAssignedUser = {
      ...assignedUser,
      uid: assignedUser?.uid || assignedUser?.id || user?.uid,
      name: getDisplayName(assignedUser),
      email: assignedUser?.email || ""
    };

    const normalizedCreatedUser = {
      ...user,
      uid: user?.uid,
      name: getDisplayName(user),
      email: user?.email || ""
    };

    setSaving(true);

    try {
      let uploadedReferences = [];

      if (referenceFiles.length > 0) {
        setReferenceUploading(true);

        uploadedReferences = await uploadReferenceFiles({
          files: referenceFiles,
          user: normalizedCreatedUser
        });
      }

      const cleanReferenceHtml = cleanRichHtml(clientReferenceHtml);
      const cleanReferenceText = stripHtml(cleanReferenceHtml);

      const clientReference = {
        source: clientReferenceSource || "",
        notes: cleanReferenceText,
        notesHtml: cleanReferenceHtml,
        attachments: uploadedReferences
      };

      const leadId = await createManualLead({
        destination,
        agent,
        spoc,
        assignedUser: normalizedAssignedUser,
        createdUser: normalizedCreatedUser,
        clientReference
      });

      router.push(`/leads/${leadId}`);
    } catch (err) {
      console.error("Manual lead creation failed:", err);
      setFormError(
        "Lead could not be created. Please check the details and try again."
      );
    } finally {
      setSaving(false);
      setReferenceUploading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* HEADER */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-2"
            >
              <ArrowLeft size={16} />
              Back
            </button>

            <h1 className="text-lg font-semibold text-gray-900">
              Create Lead
            </h1>

            <p className="text-sm text-gray-500">
              Manually add a new travel lead, capture client reference and
              assign it to your team.
            </p>
          </div>
        </div>

        {loadError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm flex items-start gap-2">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <span>{loadError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* FORM */}
          <form
            onSubmit={submit}
            className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5"
          >
            {pageLoading ? (
              <div className="flex items-center justify-center py-16 text-sm text-gray-500">
                <Loader2 size={18} className="animate-spin mr-2" />
                Loading create lead data...
              </div>
            ) : (
              <>
                {/* DESTINATION */}
                <div className="space-y-1.5">
                  <label className={labelClass}>
                    Destination <span className="text-red-500">*</span>
                  </label>

                  <select
                    className={inputClass}
                    value={destinationId}
                    onChange={e => {
                      setDestinationId(e.target.value);
                      setFormError("");
                    }}
                  >
                    <option value="">Select Destination</option>

                    {destinations.map((destination, index) => (
                      <option
                        key={destination.id || `destination-${index}`}
                        value={destination.id || ""}
                      >
                        {destination.name || "Unnamed Destination"}
                      </option>
                    ))}
                  </select>

                  {destinations.length === 0 && (
                    <p className="text-xs text-amber-600">
                      No active destinations found.
                    </p>
                  )}
                </div>

                {/* TRAVEL AGENT AUTO SUGGEST */}
                <div ref={agentSearchRef} className="space-y-1.5 relative">
                  <label className={labelClass}>
                    Travel Agent <span className="text-red-500">*</span>
                  </label>

                  <div className="relative">
                    <Search
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />

                    <input
                      type="text"
                      className={`${inputClass} pl-9 pr-9`}
                      value={agentSearch}
                      placeholder="Search agent by agency name, code, city..."
                      onFocus={() => {
                        setShowAgentSuggestions(true);
                      }}
                      onChange={e => {
                        setAgentSearch(e.target.value);
                        setAgentId("");
                        setSpocIndex(0);
                        setShowAgentSuggestions(true);
                        setFormError("");
                      }}
                    />

                    {agentSearch && (
                      <button
                        type="button"
                        onClick={clearSelectedAgent}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                        aria-label="Clear selected agent"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>

                  {showAgentSuggestions && (
                    <div className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-y-auto">
                      {filteredAgentSuggestions.length > 0 ? (
                        filteredAgentSuggestions.map((agent, index) => (
                          <button
                            key={agent.id || `agent-suggestion-${index}`}
                            type="button"
                            onClick={() => selectAgent(agent)}
                            className="
                              w-full text-left px-3 py-2.5
                              hover:bg-blue-50
                              border-b border-gray-100 last:border-b-0
                              transition
                            "
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium text-gray-800">
                                  {agent.agencyName || "Unnamed Agency"}
                                </p>

                                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                  {agent.agentCode && (
                                    <span className="text-xs text-gray-500">
                                      {agent.agentCode}
                                    </span>
                                  )}

                                  {agent.address?.city && (
                                    <span className="text-xs text-gray-400">
                                      {agent.address.city}
                                      {agent.address?.state
                                        ? `, ${agent.address.state}`
                                        : ""}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {agent.status && (
                                <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 capitalize">
                                  {agent.status}
                                </span>
                              )}
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-4 text-sm text-gray-500 text-center">
                          No matching travel agent found.
                        </div>
                      )}
                    </div>
                  )}

                  {availableAgents.length === 0 && (
                    <p className="text-xs text-amber-600">
                      No active travel agents found.
                    </p>
                  )}

                  {agentSearch &&
                    !agentId &&
                    filteredAgentSuggestions.length > 0 && (
                      <p className="text-xs text-gray-500">
                        Select a travel agent from the suggestions.
                      </p>
                    )}
                </div>

                {/* SPOC */}
                <div className="space-y-1.5">
                  <label className={labelClass}>
                    SPOC / Contact Person{" "}
                    <span className="text-red-500">*</span>
                  </label>

                  <select
                    className={inputClass}
                    value={spocIndex}
                    disabled={!agent || spocs.length === 0}
                    onChange={e => {
                      setSpocIndex(Number(e.target.value));
                      setFormError("");
                    }}
                  >
                    {!agent && (
                      <option value={0}>Select agent first</option>
                    )}

                    {agent && spocs.length === 0 && (
                      <option value={0}>No SPOC available</option>
                    )}

                    {spocs.map((spoc, index) => (
                      <option
                        key={`${spoc.name || "spoc"}-${
                          spoc.email || spoc.phone || index
                        }`}
                        value={index}
                      >
                        {spoc.name || "Unnamed SPOC"}
                        {spoc.designation ? ` (${spoc.designation})` : ""}
                      </option>
                    ))}
                  </select>

                  {agent && spocs.length === 0 && (
                    <p className="text-xs text-red-600">
                      This agent does not have contact information. Please
                      update the travel agent profile first.
                    </p>
                  )}
                </div>

                {/* ASSIGN */}
                <div className="space-y-1.5">
                  <label className={labelClass}>
                    Assign Lead
                  </label>

                  <select
                    className={inputClass}
                    value={assignedToUid}
                    onChange={e => setAssignedToUid(e.target.value)}
                  >
                    <option value="">
                      Assign to self - {getDisplayName(user)}
                    </option>

                    {team.map((member, index) => (
                      <option
                        key={member.uid || `team-${index}`}
                        value={member.uid || ""}
                      >
                        {getDisplayName(member)}
                        {member.role ? ` - ${member.role}` : ""}
                      </option>
                    ))}
                  </select>
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
                        Add WhatsApp screenshots, requirement notes, email
                        brief, PDF or reference images shared by client.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className={labelClass}>
                        Reference Source
                      </label>

                      <select
                        className={inputClass}
                        value={clientReferenceSource}
                        onChange={e =>
                          setClientReferenceSource(e.target.value)
                        }
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
                      <label className={labelClass}>
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
                    <label className={labelClass}>
                      Reference Notes / Client Requirement
                    </label>

                    <div className="border border-gray-200 bg-white rounded-lg overflow-hidden">
                      {/* TOOLBAR */}
                      <div className="flex flex-wrap items-center gap-1 border-b border-gray-100 bg-gray-50 px-2 py-2">
                        <button
                          type="button"
                          onMouseDown={e => {
                            e.preventDefault();
                            runReferenceCommand("bold");
                          }}
                          className="p-1.5 rounded hover:bg-white text-gray-600"
                          title="Bold"
                        >
                          <Bold size={15} />
                        </button>

                        <button
                          type="button"
                          onMouseDown={e => {
                            e.preventDefault();
                            runReferenceCommand("italic");
                          }}
                          className="p-1.5 rounded hover:bg-white text-gray-600"
                          title="Italic"
                        >
                          <Italic size={15} />
                        </button>

                        <button
                          type="button"
                          onMouseDown={e => {
                            e.preventDefault();
                            runReferenceCommand("insertUnorderedList");
                          }}
                          className="p-1.5 rounded hover:bg-white text-gray-600"
                          title="Bullet List"
                        >
                          <List size={15} />
                        </button>

                        <button
                          type="button"
                          onMouseDown={e => {
                            e.preventDefault();
                            runReferenceCommand("insertOrderedList");
                          }}
                          className="p-1.5 rounded hover:bg-white text-gray-600"
                          title="Numbered List"
                        >
                          <ListOrdered size={15} />
                        </button>

                        <button
                          type="button"
                          onMouseDown={e => {
                            e.preventDefault();
                            runReferenceCommand("formatBlock", "blockquote");
                          }}
                          className="p-1.5 rounded hover:bg-white text-gray-600"
                          title="Quote"
                        >
                          <Quote size={15} />
                        </button>

                        <button
                          type="button"
                          onMouseDown={e => {
                            e.preventDefault();
                            addReferenceLink();
                          }}
                          className="p-1.5 rounded hover:bg-white text-gray-600"
                          title="Add Link"
                        >
                          <Link2 size={15} />
                        </button>

                        <div className="w-px h-5 bg-gray-200 mx-1" />

                        <button
                          type="button"
                          onMouseDown={e => {
                            e.preventDefault();
                            runReferenceCommand("removeFormat");
                          }}
                          className="px-2 py-1 rounded hover:bg-white text-xs text-gray-600"
                        >
                          Clear
                        </button>
                      </div>

                      {/* EDITOR */}
                      <div className="relative">
                        {!clientReferenceText && (
                          <p className="pointer-events-none absolute left-3 top-3 text-sm text-gray-400">
                            Example: Client shared WhatsApp screenshot for
                            Maldives honeymoon. Wants similar resort, private
                            pool, vegetarian meals, 4 nights...
                          </p>
                        )}

                        <div
                          ref={referenceEditorRef}
                          contentEditable
                          suppressContentEditableWarning
                          role="textbox"
                          aria-multiline="true"
                          onInput={syncReferenceEditorHtml}
                          onPaste={handleReferencePaste}
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

                    <p className="text-[11px] text-gray-500">
                      Use bullets for preferences, hotel names, dates, meal
                      plan, budget, special requests and copied client brief.
                    </p>
                  </div>

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
                                aria-label="Remove file"
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

                {formError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm flex items-start gap-2">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* ACTION */}
                <button
                  type="submit"
                  disabled={!canCreate}
                  className="
                    w-full py-2.5
                    bg-blue-600 hover:bg-blue-700
                    text-white font-medium
                    rounded-md
                    transition
                    disabled:opacity-60
                    disabled:cursor-not-allowed
                    inline-flex
                    items-center
                    justify-center
                    gap-2
                  "
                >
                  {(saving || referenceUploading) && (
                    <Loader2 size={16} className="animate-spin" />
                  )}

                  {referenceUploading
                    ? "Uploading References..."
                    : saving
                      ? "Creating Lead..."
                      : "Create Lead"}
                </button>
              </>
            )}
          </form>

          {/* SUMMARY */}
          <aside className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-5 h-fit lg:sticky lg:top-6">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                Lead Summary
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Preview of selected lead details and email notification.
              </p>
            </div>

            <div className="space-y-4">
              {/* DESTINATION PREVIEW */}
              <div className="rounded-lg border border-gray-100 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
                  <MapPin size={16} className="text-blue-600" />
                  Destination
                </div>

                <p className="text-sm text-gray-600 mt-2">
                  {destination?.name || "Not selected"}
                </p>

                {destination?.country && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {destination.country}
                  </p>
                )}
              </div>

              {/* AGENT PREVIEW */}
              <div className="rounded-lg border border-gray-100 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
                  <Building2 size={16} className="text-blue-600" />
                  Travel Agent
                </div>

                <p className="text-sm text-gray-600 mt-2">
                  {agent?.agencyName || "Not selected"}
                </p>

                {agent?.agentCode && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    Code: {agent.agentCode}
                  </p>
                )}

                {agentAddress && (
                  <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                    {agentAddress}
                  </p>
                )}
              </div>

              {/* SPOC PREVIEW */}
              <div className="rounded-lg border border-gray-100 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
                  <UserRound size={16} className="text-blue-600" />
                  SPOC
                </div>

                {spoc ? (
                  <div className="mt-2 space-y-2">
                    <div>
                      <p className="text-sm text-gray-700 font-medium">
                        {spoc.name || "Unnamed SPOC"}
                      </p>

                      {spoc.designation && (
                        <p className="text-xs text-gray-400">
                          {spoc.designation}
                        </p>
                      )}
                    </div>

                    {spoc.email && (
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <Mail size={14} />
                        <span className="truncate">{spoc.email}</span>
                      </div>
                    )}

                    {(spoc.phone || spoc.mobile || spoc.whatsapp) && (
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <Phone size={14} />
                        <span>
                          {spoc.phone || spoc.mobile || spoc.whatsapp}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 mt-2">
                    Not selected
                  </p>
                )}
              </div>

              {/* ASSIGNEE PREVIEW */}
              <div className="rounded-lg border border-gray-100 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
                  <CheckCircle2 size={16} className="text-blue-600" />
                  Assigned To
                </div>

                <p className="text-sm text-gray-600 mt-2">
                  {getDisplayName(assignedUser)}
                </p>

                {assignedUser?.email && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {assignedUser.email}
                  </p>
                )}
              </div>

              {/* CLIENT REFERENCE PREVIEW */}
              <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
                  <Paperclip size={16} className="text-blue-600" />
                  Client Reference
                </div>

                {hasClientReference ? (
                  <div className="mt-2 space-y-2">
                    {clientReferenceSource && (
                      <p className="text-xs text-gray-600 capitalize">
                        Source:{" "}
                        {clientReferenceSource.replaceAll("_", " ")}
                      </p>
                    )}

                    {clientReferenceText && (
                      <div
                        className="
                          text-xs text-gray-600 leading-relaxed
                          max-h-24 overflow-hidden
                          [&_ul]:list-disc [&_ul]:pl-4
                          [&_ol]:list-decimal [&_ol]:pl-4
                          [&_a]:text-blue-600 [&_a]:underline
                        "
                        dangerouslySetInnerHTML={{
                          __html: cleanRichHtml(clientReferenceHtml)
                        }}
                      />
                    )}

                    {referenceFiles.length > 0 && (
                      <p className="text-xs text-blue-700">
                        {referenceFiles.length} file
                        {referenceFiles.length === 1 ? "" : "s"} selected
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 mt-2">
                    No reference added
                  </p>
                )}
              </div>

              {/* MAIL PREVIEW */}
              <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div className="bg-[#1d4e89] px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Eye size={16} className="text-white" />
                      <p className="text-sm font-semibold text-white">
                        Mail Preview
                      </p>
                    </div>

                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/15 text-white">
                      Live
                    </span>
                  </div>
                </div>

                <div className="p-4 space-y-3 bg-gray-50">
                  {/* EMAIL META */}
                  <div className="bg-white rounded-lg border border-gray-100 p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <Mail
                        size={14}
                        className="text-[#1d4e89] mt-0.5 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-[11px] uppercase tracking-wide text-gray-400">
                          Subject
                        </p>
                        <p className="text-xs font-medium text-gray-800 leading-relaxed">
                          {mailSubject}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <Send
                        size={14}
                        className="text-[#9b0112] mt-0.5 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-[11px] uppercase tracking-wide text-gray-400">
                          To
                        </p>
                        <p className="text-xs text-gray-700 truncate">
                          {mailToName}
                          {assignedUser?.email
                            ? ` <${assignedUser.email}>`
                            : ""}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* EMAIL BODY PREVIEW */}
                  <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-xs text-gray-500">
                        Hello {mailToName},
                      </p>

                      <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                        A new lead has been created and assigned for your
                        follow-up. Please review the details below.
                      </p>
                    </div>

                    <div className="p-4 space-y-3">
                      <div className="grid grid-cols-1 gap-2">
                        <div className="rounded-lg bg-[#1d4e89]/5 border border-[#1d4e89]/10 p-3">
                          <p className="text-[11px] text-gray-500">
                            Destination
                          </p>
                          <p className="text-sm font-semibold text-gray-900">
                            {destination?.name || "Not selected"}
                          </p>
                          {destination?.country && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              {destination.country}
                            </p>
                          )}
                        </div>

                        <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
                          <p className="text-[11px] text-gray-500">
                            Travel Agent
                          </p>
                          <p className="text-sm font-semibold text-gray-900">
                            {agent?.agencyName || "Not selected"}
                          </p>
                          {agent?.agentCode && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              Code: {agent.agentCode}
                            </p>
                          )}
                        </div>

                        <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
                          <p className="text-[11px] text-gray-500">
                            SPOC / Contact Person
                          </p>

                          {spoc ? (
                            <>
                              <p className="text-sm font-semibold text-gray-900">
                                {spoc.name || "Unnamed SPOC"}
                              </p>

                              {spoc.email && (
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {spoc.email}
                                </p>
                              )}

                              {(spoc.phone || spoc.mobile || spoc.whatsapp) && (
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {spoc.phone || spoc.mobile || spoc.whatsapp}
                                </p>
                              )}
                            </>
                          ) : (
                            <p className="text-sm text-gray-500">
                              Not selected
                            </p>
                          )}
                        </div>

                        <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
                          <p className="text-[11px] text-gray-500">
                            Client Reference Source
                          </p>
                          <p className="text-sm font-semibold text-gray-900">
                            {referenceSourceLabel}
                          </p>
                        </div>
                      </div>

                      {clientReferenceText && (
                        <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3">
                          <p className="text-[11px] font-medium text-gray-500 mb-2">
                            Client Requirement
                          </p>

                          <div
                            className="
                              text-xs text-gray-700 leading-relaxed
                              max-h-32 overflow-y-auto
                              [&_ul]:list-disc [&_ul]:pl-4
                              [&_ol]:list-decimal [&_ol]:pl-4
                              [&_blockquote]:border-l-4
                              [&_blockquote]:border-blue-200
                              [&_blockquote]:pl-3
                              [&_a]:text-blue-600
                              [&_a]:underline
                            "
                            dangerouslySetInnerHTML={{
                              __html: cleanRichHtml(clientReferenceHtml)
                            }}
                          />
                        </div>
                      )}

                      {referenceFiles.length > 0 && (
                        <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                          <p className="text-[11px] font-medium text-gray-500 mb-2">
                            Attachments
                          </p>

                          <div className="space-y-1.5">
                            {referenceFiles.map(item => (
                              <div
                                key={`mail-preview-${item.id}`}
                                className="flex items-center justify-between gap-2 text-xs text-gray-600"
                              >
                                <span className="truncate">
                                  {item.file.name}
                                </span>
                                <span className="text-gray-400 shrink-0">
                                  {formatFileSize(item.file.size)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="pt-2 border-t border-gray-100">
                        <p className="text-[11px] text-gray-400">
                          Created on {mailPreviewDate} by{" "}
                          {getDisplayName(user)}
                        </p>
                      </div>
                    </div>

                    <div className="bg-[#9b0112]/5 border-t border-[#9b0112]/10 px-4 py-3">
                      <p className="text-[11px] text-gray-600 leading-relaxed">
                        Dream Trawell · Realize the Experiance
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}