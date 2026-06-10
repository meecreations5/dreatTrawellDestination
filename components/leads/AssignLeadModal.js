"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where
} from "firebase/firestore";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Paperclip,
  Search,
  UserCheck,
  X
} from "lucide-react";

import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import {
  logLeadAction,
  LEAD_TIMELINE_TYPES
} from "@/lib/logLeadAction";

function getFirstValue(...values) {
  return (
    values.find(
      value => typeof value === "string" && value.trim().length > 0
    )?.trim() || ""
  );
}

function getUserId(user) {
  return getFirstValue(
    user?.uid,
    user?.id,
    user?.email
  );
}

function getUserName(user) {
  return (
    getFirstValue(
      user?.name,
      user?.displayName,
      user?.fullName,
      user?.employeeName,
      user?.profile?.name,
      user?.email
    ) || "Unnamed User"
  );
}

function getUserEmail(user) {
  return getFirstValue(
    user?.email,
    user?.workEmail,
    user?.officialEmail,
    user?.profile?.email
  );
}

function getUserRole(user) {
  return getFirstValue(
    user?.role,
    user?.designation,
    user?.jobTitle,
    user?.employeeRole,
    user?.profile?.designation
  );
}

function formatSource(source = "") {
  if (!source) return "Not specified";

  return String(source)
    .replaceAll("_", " ")
    .replace(/\b\w/g, char => char.toUpperCase());
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

function buildClientReferenceSnapshot(lead) {
  const reference = lead?.clientReference || {};

  const attachments = Array.isArray(reference.attachments)
    ? reference.attachments
    : [];

  const source =
    reference.source ||
    lead?.clientReferenceSource ||
    "";

  const notesHtml =
    reference.notesHtml ||
    lead?.clientReferenceNotesHtml ||
    "";

  const notes =
    reference.notes ||
    lead?.clientReferenceNotes ||
    stripHtml(notesHtml);

  const attachmentCount =
    attachments.length ||
    lead?.clientReferenceAttachmentCount ||
    0;

  const hasReference =
    Boolean(source) ||
    Boolean(notes) ||
    Boolean(notesHtml) ||
    attachmentCount > 0;

  if (!hasReference) return null;

  return {
    source,
    notes,
    notesHtml,
    attachmentCount,
    attachments
  };
}

async function loadAssignableUsers() {
  try {
    const snap = await getDocs(
      query(
        collection(db, "users"),
        where("active", "==", true),
        where("role", "in", ["employee", "admin", "manager", "team"])
      )
    );

    return snap.docs.map(docSnap => ({
      id: docSnap.id,
      uid: docSnap.id,
      ...docSnap.data()
    }));
  } catch (error) {
    console.warn(
      "Role based user query failed. Falling back to active users.",
      error
    );

    const snap = await getDocs(
      query(
        collection(db, "users"),
        where("active", "==", true)
      )
    );

    return snap.docs.map(docSnap => ({
      id: docSnap.id,
      uid: docSnap.id,
      ...docSnap.data()
    }));
  }
}

export default function AssignLeadModal({ leadId, lead, onClose }) {
  const { user, loading: authLoading } = useAuth();

  const [team, setTeam] = useState([]);
  const [selectedUid, setSelectedUid] = useState("");
  const [remark, setRemark] = useState("");
  const [search, setSearch] = useState("");

  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const clientReferenceSnapshot = useMemo(
    () => buildClientReferenceSnapshot(lead),
    [lead]
  );

  const hasClientReference = Boolean(clientReferenceSnapshot);

  useEffect(() => {
    let mounted = true;

    async function loadUsers() {
      setPageLoading(true);
      setError("");

      try {
        const rows = await loadAssignableUsers();

        const normalizedRows = rows
          .map(member => ({
            ...member,
            safeId: getUserId(member)
          }))
          .filter(member => member.safeId)
          .sort((a, b) => getUserName(a).localeCompare(getUserName(b)));

        if (mounted) {
          setTeam(normalizedRows);
        }
      } catch (err) {
        console.error("Assignable users load failed:", err);

        if (mounted) {
          setError("Unable to load team members.");
        }
      } finally {
        if (mounted) {
          setPageLoading(false);
        }
      }
    }

    loadUsers();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const existingAssignedUid = getFirstValue(
      lead?.assignedToUid,
      lead?.assignedUserUid,
      lead?.ownerUid,
      lead?.teamLeadUid
    );

    if (existingAssignedUid) {
      setSelectedUid(existingAssignedUid);
    }
  }, [lead]);

  const filteredTeam = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) return team;

    return team.filter(member => {
      const name = getUserName(member).toLowerCase();
      const email = getUserEmail(member).toLowerCase();
      const role = getUserRole(member).toLowerCase();

      return (
        name.includes(keyword) ||
        email.includes(keyword) ||
        role.includes(keyword)
      );
    });
  }, [search, team]);

  const selectedUser = useMemo(() => {
    return team.find(member => {
      const safeId = member.safeId || getUserId(member);
      return safeId === selectedUid;
    });
  }, [selectedUid, team]);

  const assignLead = async () => {
    setError("");
    setSuccess("");

    if (!leadId) {
      setError("Lead ID is missing.");
      return;
    }

    if (!selectedUser) {
      setError("Please select a team member.");
      return;
    }

    if (!user) {
      setError("User session not found.");
      return;
    }

    const cleanRemark = remark.trim();

    const selectedUserUid =
      selectedUser.uid ||
      selectedUser.id ||
      selectedUser.safeId;

    const selectedUserName = getUserName(selectedUser);
    const selectedUserEmail = getUserEmail(selectedUser);
    const selectedUserRole = getUserRole(selectedUser);

    const assignedByName = getUserName(user);
    const assignedByEmail = getUserEmail(user);

    const updatePayload = {
      assignedToUid: selectedUserUid,
      assignedTo: selectedUserEmail || selectedUserUid,
      assignedToName: selectedUserName,
      assignedToEmail: selectedUserEmail,
      assignedToRole: selectedUserRole,

      assignmentRemark: cleanRemark,
      lastAssignmentRemark: cleanRemark,

      assignedAt: serverTimestamp(),
      assignedByUid: user.uid || "",
      assignedByName,
      assignedByEmail,

      updatedAt: serverTimestamp()
    };

    if (!lead?.stage || lead?.stage === "new") {
      updatePayload.stage = "assigned";
      updatePayload.stageLabel = "Assigned";
      updatePayload.status = "open";
    }

    setSaving(true);

    try {
      await updateDoc(doc(db, "leads", leadId), updatePayload);

      await logLeadAction({
        leadId,
        type: LEAD_TIMELINE_TYPES.ASSIGNED || "assigned",
        title: "Lead Assigned",
        description: cleanRemark
          ? `Lead assigned to ${selectedUserName}. Remark: ${cleanRemark}`
          : `Lead assigned to ${selectedUserName}`,
        metadata: {
          action: "lead_assigned",

          assignedToUid: selectedUserUid,
          assignedToName: selectedUserName,
          assignedToEmail: selectedUserEmail,
          assignedToRole: selectedUserRole,

          assignedByUid: user.uid || "",
          assignedByName,
          assignedByEmail,

          remark: cleanRemark,
          assignmentRemark: cleanRemark,

          clientReferenceCaptured: Boolean(clientReferenceSnapshot),
          clientReference: clientReferenceSnapshot
        },
        user
      });

      setSuccess("Lead assigned successfully.");

      setTimeout(() => {
        onClose?.(true);
      }, 500);
    } catch (err) {
      console.error("Lead assignment failed:", err);
      setError(err?.message || "Failed to assign lead.");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || !user) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden">
        {/* HEADER */}
        <div className="p-5 border-b border-gray-100 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-orange-50 text-orange-700 flex items-center justify-center">
              <UserCheck size={20} />
            </div>

            <div>
              <h2 className="text-base font-semibold text-gray-900">
                Assign Lead
              </h2>

              <p className="text-sm text-gray-500 mt-1">
                Assign this lead to a team member and share client reference context.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onClose?.()}
            disabled={saving}
            className="text-gray-400 hover:text-gray-700 disabled:opacity-60"
          >
            <X size={18} />
          </button>
        </div>

        {/* BODY */}
        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="bg-red-50 border border-red-100 text-red-700 rounded-lg px-3 py-2 text-sm flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-100 text-green-700 rounded-lg px-3 py-2 text-sm flex items-start gap-2">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* CLIENT REFERENCE PREVIEW */}
          {hasClientReference && (
            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 space-y-3">
              <div className="flex items-start gap-2">
                <Paperclip size={17} className="text-blue-600 mt-0.5" />

                <div>
                  <p className="text-sm font-semibold text-blue-900">
                    Client Reference Captured
                  </p>

                  <p className="text-xs text-blue-700 mt-0.5">
                    This context will be shared in the assignment activity.
                  </p>
                </div>
              </div>

              {clientReferenceSnapshot.source && (
                <p className="text-xs text-gray-600">
                  Source:{" "}
                  <span className="font-medium">
                    {formatSource(clientReferenceSnapshot.source)}
                  </span>
                </p>
              )}

              {clientReferenceSnapshot.notes && (
                <p className="text-sm text-gray-700 line-clamp-4 whitespace-pre-wrap">
                  {clientReferenceSnapshot.notes}
                </p>
              )}

              {clientReferenceSnapshot.attachmentCount > 0 && (
                <p className="text-xs text-blue-700">
                  {clientReferenceSnapshot.attachmentCount} reference file
                  {clientReferenceSnapshot.attachmentCount === 1 ? "" : "s"} attached
                </p>
              )}
            </div>
          )}

          {/* SEARCH */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500">
              Search Team Member
            </label>

            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                value={search}
                disabled={saving}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search by name, email or role"
                className="
                  w-full border border-gray-200 rounded-lg
                  pl-9 pr-3 py-2 text-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-100
                  disabled:bg-gray-50 disabled:text-gray-400
                "
              />
            </div>
          </div>

          {/* TEAM LIST */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-500">
              Select Assignee <span className="text-red-500">*</span>
            </p>

            {pageLoading ? (
              <div className="py-8 flex items-center justify-center text-sm text-gray-500">
                <Loader2 size={17} className="animate-spin mr-2" />
                Loading team members...
              </div>
            ) : filteredTeam.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {filteredTeam.map((member, index) => {
                  const safeId =
                    member.safeId ||
                    getUserId(member) ||
                    `member-${index}`;

                  const active = selectedUid === safeId;

                  return (
                    <button
                      key={`${safeId}-${index}`}
                      type="button"
                      disabled={saving}
                      onClick={() => {
                        setSelectedUid(safeId);
                        setError("");
                      }}
                      className={`
                        text-left border rounded-xl p-3 transition
                        disabled:opacity-60
                        ${
                          active
                            ? "border-orange-300 bg-orange-50"
                            : "border-gray-100 bg-white hover:bg-gray-50"
                        }
                      `}
                    >
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {getUserName(member)}
                      </p>

                      {getUserEmail(member) && (
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {getUserEmail(member)}
                        </p>
                      )}

                      {getUserRole(member) && (
                        <p className="text-[11px] text-orange-700 mt-1 capitalize">
                          {getUserRole(member)}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="border border-dashed border-gray-200 rounded-xl py-8 text-center">
                <p className="text-sm text-gray-500">
                  No team member found.
                </p>
              </div>
            )}
          </div>

          {/* ASSIGNMENT REMARK */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500">
              Assignment Remark
            </label>

            <textarea
              rows={3}
              value={remark}
              disabled={saving}
              onChange={event => setRemark(event.target.value)}
              placeholder="Example: Assigning this lead for vendor pricing follow-up or quotation preparation."
              className="
                w-full border border-gray-200 rounded-lg
                px-3 py-2 text-sm resize-none
                focus:outline-none focus:ring-2 focus:ring-blue-100
                disabled:bg-gray-50 disabled:text-gray-400
              "
            />
          </div>
        </div>

        {/* FOOTER */}
        <div className="p-5 border-t border-gray-100 flex gap-3">
          <button
            type="button"
            onClick={() => onClose?.()}
            disabled={saving}
            className="
              flex-1 border border-gray-200 rounded-lg
              py-2 text-sm hover:bg-gray-50
              disabled:opacity-60
            "
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={assignLead}
            disabled={saving || pageLoading || !selectedUser}
            className="
              flex-1 bg-orange-600 text-white rounded-lg
              py-2 text-sm font-medium hover:bg-orange-700
              disabled:opacity-60
              inline-flex items-center justify-center gap-2
            "
          >
            {saving && <Loader2 size={15} className="animate-spin" />}
            {saving ? "Assigning..." : "Assign Lead"}
          </button>
        </div>
      </div>
    </div>
  );
}