"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc
} from "firebase/firestore";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  UserCheck,
  X
} from "lucide-react";

import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";

const ASSIGNMENT_ROLES = [
  "Account Manager",
  "Sales Executive",
  "Relationship Manager",
  "Team Lead",
  "Operations SPOC",
  "Accounts SPOC"
];

const ASSIGNMENT_PRIORITIES = ["Low", "Medium", "High", "Critical"];

function getUserName(user) {
  return (
    user?.name ||
    user?.fullName ||
    user?.displayName ||
    user?.email ||
    "Unknown User"
  );
}

function getUserEmail(user) {
  return user?.email || user?.workEmail || user?.officialEmail || "";
}

function getUserTeam(user) {
  return user?.team || user?.department || user?.teamName || "";
}

function getCurrentUserName(user) {
  return (
    user?.name ||
    user?.fullName ||
    user?.displayName ||
    user?.email ||
    "Admin"
  );
}

export default function AssignTravelAgentModal({
  open,
  agent,
  onClose,
  onAssigned
}) {
  const { user } = useAuth("admin");

  const [teamMembers, setTeamMembers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    assignedToUid: "",
    assignedRole: "Account Manager",
    assignedTeam: "",
    assignmentPriority: "Medium",
    assignmentReason: ""
  });

  const selectedUser = useMemo(() => {
    return teamMembers.find(member => member.id === form.assignedToUid);
  }, [teamMembers, form.assignedToUid]);

  const isAlreadyAssigned = !!(
    agent?.assignedToUid ||
    agent?.accountManagerUid ||
    agent?.assignedTo
  );

  /* =========================
     LOAD USERS
  ========================= */
  useEffect(() => {
    if (!open) return;

    let active = true;

    async function loadUsers() {
      try {
        setLoadingUsers(true);

        const snap = await getDocs(collection(db, "users"));

        if (!active) return;

        const rows = snap.docs
          .map(item => ({
            id: item.id,
            ...item.data()
          }))
          .filter(item => item.active !== false)
          .sort((a, b) => getUserName(a).localeCompare(getUserName(b)));

        setTeamMembers(rows);
      } catch (error) {
        console.error("Failed to load users:", error);
        alert("Unable to load team members.");
      } finally {
        if (active) setLoadingUsers(false);
      }
    }

    loadUsers();

    return () => {
      active = false;
    };
  }, [open]);

  /* =========================
     INIT FORM
  ========================= */
  useEffect(() => {
    if (!open || !agent) return;

    setForm({
      assignedToUid: agent.assignedToUid || agent.accountManagerUid || "",
      assignedRole: agent.assignedRole || "Account Manager",
      assignedTeam: agent.assignedTeam || agent.team || "",
      assignmentPriority: agent.assignmentPriority || "Medium",
      assignmentReason: ""
    });
  }, [open, agent]);

  /* =========================
     BODY SCROLL LOCK
  ========================= */
  useEffect(() => {
    if (!open) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open || !agent) return null;

  /* =========================
     ASSIGN
  ========================= */
  const handleAssign = async () => {
    if (!agent?.id) {
      alert("Travel agent not found.");
      return;
    }

    if (!form.assignedToUid) {
      alert("Please select a team member.");
      return;
    }

    const assignee = teamMembers.find(member => member.id === form.assignedToUid);

    if (!assignee) {
      alert("Selected team member not found.");
      return;
    }

    try {
      setSubmitting(true);

      const previousAssignedToUid =
        agent.assignedToUid || agent.accountManagerUid || "";
      const previousAssignedToName =
        agent.assignedToName || agent.assignedTo || "";

      const assignedToName = getUserName(assignee);
      const assignedToEmail = getUserEmail(assignee);
      const assignedTeam = form.assignedTeam || getUserTeam(assignee);

      const assignmentStatus = previousAssignedToUid
        ? "Reassigned"
        : "Assigned";

      const agentRef = doc(db, "travelAgents", agent.id);

      await updateDoc(agentRef, {
        assignedToUid: assignee.id,
        assignedToName,
        assignedToEmail,
        assignedTeam,
        assignedRole: form.assignedRole,
        assignmentPriority: form.assignmentPriority,
        assignmentStatus,

        assignedAt: serverTimestamp(),
        assignedByUid: user?.uid || "",
        assignedByName: getCurrentUserName(user),

        // Backward-compatible fields used in your existing form/module
        assignedTo: assignedToEmail || assignedToName,
        accountManagerUid: assignee.id,
        team: assignedTeam,

        updatedAt: serverTimestamp(),
        updatedByUid: user?.uid || ""
      });

      await addDoc(collection(db, "travelAgentAssignments"), {
        agentId: agent.id,
        agentName: agent.agencyName || agent.name || "",

        assignedToUid: assignee.id,
        assignedToName,
        assignedToEmail,
        assignedTeam,
        assignedRole: form.assignedRole,

        previousAssignedToUid,
        previousAssignedToName,

        assignmentStatus,
        assignmentPriority: form.assignmentPriority,
        assignmentReason: form.assignmentReason || "",

        assignedByUid: user?.uid || "",
        assignedByName: getCurrentUserName(user),

        createdAt: serverTimestamp()
      });

      onAssigned?.({
        agentId: agent.id,
        assignedToUid: assignee.id,
        assignedToName,
        assignedToEmail,
        assignedTeam,
        assignmentStatus
      });

      onClose?.();
    } catch (error) {
      console.error("Failed to assign travel agent:", error);
      alert("Unable to assign travel agent. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  /* =========================
     UNASSIGN
  ========================= */
  const handleUnassign = async () => {
    if (!agent?.id) return;

    const confirmUnassign = window.confirm(
      "Are you sure you want to mark this travel agent as unassigned?"
    );

    if (!confirmUnassign) return;

    try {
      setSubmitting(true);

      const previousAssignedToUid =
        agent.assignedToUid || agent.accountManagerUid || "";
      const previousAssignedToName =
        agent.assignedToName || agent.assignedTo || "";

      const agentRef = doc(db, "travelAgents", agent.id);

      await updateDoc(agentRef, {
        assignedToUid: "",
        assignedToName: "",
        assignedToEmail: "",
        assignedTeam: "",
        assignedRole: "",
        assignmentPriority: "Medium",
        assignmentStatus: "Unassigned",

        assignedAt: null,
        assignedByUid: "",
        assignedByName: "",

        // Backward-compatible clear
        assignedTo: "",
        accountManagerUid: "",

        updatedAt: serverTimestamp(),
        updatedByUid: user?.uid || ""
      });

      await addDoc(collection(db, "travelAgentAssignments"), {
        agentId: agent.id,
        agentName: agent.agencyName || agent.name || "",

        assignedToUid: "",
        assignedToName: "",
        assignedToEmail: "",
        assignedTeam: "",
        assignedRole: "",

        previousAssignedToUid,
        previousAssignedToName,

        assignmentStatus: "Unassigned",
        assignmentPriority: form.assignmentPriority,
        assignmentReason:
          form.assignmentReason || "Marked as unassigned from assignment modal.",

        assignedByUid: user?.uid || "",
        assignedByName: getCurrentUserName(user),

        createdAt: serverTimestamp()
      });

      onAssigned?.({
        agentId: agent.id,
        assignmentStatus: "Unassigned"
      });

      onClose?.();
    } catch (error) {
      console.error("Failed to unassign travel agent:", error);
      alert("Unable to unassign travel agent. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* HEADER */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
          <div className="flex gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <UserCheck size={22} />
            </div>

            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                Assign Travel Agent
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Assign ownership of this travel agent to a team member or account manager.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <X size={18} />
          </button>
        </div>

        {/* AGENT SUMMARY */}
        <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Travel Agent
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {agent.agencyName || agent.name || "Untitled Agent"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {agent.agentCategory || "B"} Category •{" "}
                {agent.partnerSegment || "New Partner"}
              </p>
            </div>

            <AssignmentBadge
              status={agent.assignmentStatus || (isAlreadyAssigned ? "Assigned" : "Unassigned")}
            />
          </div>
        </div>

        {/* BODY */}
        <div className="max-h-[70vh] overflow-y-auto p-5">
          {loadingUsers ? (
            <div className="flex min-h-[240px] items-center justify-center">
              <div className="text-center">
                <Loader2
                  size={26}
                  className="mx-auto animate-spin text-blue-600"
                />
                <p className="mt-3 text-sm font-medium text-slate-600">
                  Loading team members...
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* CURRENT ASSIGNMENT */}
              {isAlreadyAssigned && (
                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                  <p className="text-sm font-semibold text-blue-900">
                    Current Assignment
                  </p>
                  <p className="mt-1 text-sm text-blue-700">
                    {agent.assignedToName ||
                      agent.assignedTo ||
                      agent.accountManagerUid ||
                      "Assigned user not available"}
                  </p>
                </div>
              )}

              {/* ASSIGN TO */}
              <Field label="Assign To" required>
                <select
                  value={form.assignedToUid}
                  onChange={e => {
                    const uid = e.target.value;
                    const selected = teamMembers.find(member => member.id === uid);

                    setForm(prev => ({
                      ...prev,
                      assignedToUid: uid,
                      assignedTeam: selected
                        ? getUserTeam(selected) || prev.assignedTeam
                        : prev.assignedTeam
                    }));
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                >
                  <option value="">Select team member</option>
                  {teamMembers.map(member => (
                    <option key={member.id} value={member.id}>
                      {getUserName(member)}
                      {getUserEmail(member) ? ` (${getUserEmail(member)})` : ""}
                    </option>
                  ))}
                </select>
              </Field>

              {selectedUser && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {getUserName(selectedUser)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {getUserEmail(selectedUser) || "No email available"}
                      </p>
                    </div>

                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                      {selectedUser.role || "Team Member"}
                    </span>
                  </div>

                  {getUserTeam(selectedUser) && (
                    <p className="mt-3 text-xs font-medium text-slate-500">
                      Team: {getUserTeam(selectedUser)}
                    </p>
                  )}
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Assigned Role">
                  <select
                    value={form.assignedRole}
                    onChange={e =>
                      setForm(prev => ({
                        ...prev,
                        assignedRole: e.target.value
                      }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  >
                    {ASSIGNMENT_ROLES.map(role => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Priority">
                  <select
                    value={form.assignmentPriority}
                    onChange={e =>
                      setForm(prev => ({
                        ...prev,
                        assignmentPriority: e.target.value
                      }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  >
                    {ASSIGNMENT_PRIORITIES.map(priority => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Assigned Team" className="md:col-span-2">
                  <input
                    value={form.assignedTeam}
                    onChange={e =>
                      setForm(prev => ({
                        ...prev,
                        assignedTeam: e.target.value
                      }))
                    }
                    placeholder="Example: Sales, Corporate, Leisure, MICE"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  />
                </Field>

                <Field label="Reason / Note" className="md:col-span-2">
                  <textarea
                    value={form.assignmentReason}
                    onChange={e =>
                      setForm(prev => ({
                        ...prev,
                        assignmentReason: e.target.value
                      }))
                    }
                    rows={4}
                    placeholder="Example: Assigning due to category A partner, regional relationship, reassignment, workload balancing..."
                    className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  />
                </Field>
              </div>

              <div className="flex gap-3 rounded-2xl border border-amber-100 bg-amber-50 p-4">
                <AlertTriangle
                  size={18}
                  className="mt-0.5 shrink-0 text-amber-700"
                />
                <div>
                  <p className="text-sm font-semibold text-amber-900">
                    Assignment history will be saved
                  </p>
                  <p className="mt-1 text-xs leading-5 text-amber-700">
                    Every assignment, reassignment, or unassignment is logged in
                    travelAgentAssignments for future audit and dashboard reporting.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {isAlreadyAssigned && (
              <button
                type="button"
                onClick={handleUnassign}
                disabled={submitting}
                className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Mark Unassigned
              </button>
            )}
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleAssign}
              disabled={submitting || loadingUsers}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <CheckCircle2 size={16} />
              )}

              {submitting
                ? "Saving..."
                : isAlreadyAssigned
                ? "Reassign Agent"
                : "Assign Agent"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================
   SMALL UI
========================= */
function Field({ label, required, className = "", children }) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function AssignmentBadge({ status }) {
  const styles = {
    Assigned: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    Reassigned: "bg-blue-50 text-blue-700 ring-blue-100",
    Unassigned: "bg-amber-50 text-amber-700 ring-amber-100",
    "On Hold": "bg-slate-100 text-slate-700 ring-slate-200"
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
        styles[status] || styles.Unassigned
      }`}
    >
      {status || "Unassigned"}
    </span>
  );
}