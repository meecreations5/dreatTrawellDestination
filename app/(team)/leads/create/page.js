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
  ArrowLeft,
  AlertCircle,
  Building2,
  CheckCircle2,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Search,
  UserRound,
  X
} from "lucide-react";

import { db } from "@/lib/firebase";
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

function getDisplayName(user) {
  return (
    user?.name ||
    user?.fullName ||
    user?.displayName ||
    user?.email ||
    "Unnamed User"
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
    console.warn("Role based team query failed. Falling back to active users.", err);

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

export default function ManualLeadCreatePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const agentSearchRef = useRef(null);

  const [destinations, setDestinations] = useState([]);
  const [agents, setAgents] = useState([]);
  const [team, setTeam] = useState([]);

  const [destinationId, setDestinationId] = useState("");
  const [agentId, setAgentId] = useState("");
  const [agentSearch, setAgentSearch] = useState("");
  const [showAgentSuggestions, setShowAgentSuggestions] = useState(false);

  const [spocIndex, setSpocIndex] = useState(0);
  const [assignedToUid, setAssignedToUid] = useState("");

  const [pageLoading, setPageLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

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
          setLoadError("Unable to load create lead data. Please refresh and try again.");
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

  const canCreate =
    Boolean(destination) &&
    Boolean(agent) &&
    Boolean(spoc) &&
    !saving &&
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
      setFormError("Selected travel agent does not have a valid SPOC/contact person.");
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
      const leadId = await createManualLead({
        destination,
        agent,
        spoc,
        assignedUser: normalizedAssignedUser,
        createdUser: normalizedCreatedUser
      });

      router.push(`/leads/${leadId}`);
    } catch (err) {
      console.error("Manual lead creation failed:", err);
      setFormError("Lead could not be created. Please check the details and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
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
              Manually add a new travel lead and assign it to your team.
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
                                      {agent.address?.state ? `, ${agent.address.state}` : ""}
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

                  {agentSearch && !agentId && filteredAgentSuggestions.length > 0 && (
                    <p className="text-xs text-gray-500">
                      Select a travel agent from the suggestions.
                    </p>
                  )}
                </div>

                {/* SPOC */}
                <div className="space-y-1.5">
                  <label className={labelClass}>
                    SPOC / Contact Person <span className="text-red-500">*</span>
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
                        key={`${spoc.name || "spoc"}-${spoc.email || spoc.phone || index}`}
                        value={index}
                      >
                        {spoc.name || "Unnamed SPOC"}
                        {spoc.designation ? ` (${spoc.designation})` : ""}
                      </option>
                    ))}
                  </select>

                  {agent && spocs.length === 0 && (
                    <p className="text-xs text-red-600">
                      This agent does not have contact information. Please update the travel agent profile first.
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
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  {saving ? "Creating Lead..." : "Create Lead"}
                </button>
              </>
            )}
          </form>

          {/* SUMMARY */}
          <aside className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-5 h-fit">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                Lead Summary
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Preview of selected lead details.
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
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}