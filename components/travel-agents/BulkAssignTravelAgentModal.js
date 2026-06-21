"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  writeBatch
} from "firebase/firestore";
import {
  AlertTriangle,
  Loader2,
  UserCheck,
  X
} from "lucide-react";

import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";

const ASSIGNMENT_ROLES = [
  "Account Manager",
  "Relationship Manager",
  "Sales Executive",
  "Team Lead",
  "Operations Owner"
];

const ASSIGNMENT_PRIORITIES = [
  "Critical",
  "High",
  "Medium",
  "Low"
];

const normalizeText = value =>
  String(value || "").trim();

const getUserName = user =>
  normalizeText(
    user.name ||
      user.fullName ||
      user.displayName ||
      user.email ||
      user.workEmail
  );

const getUserEmail = user =>
  normalizeText(user.email || user.workEmail || user.officialEmail);

const getUserTeam = user =>
  normalizeText(user.team || user.department || user.branch || "");

const getAgentName = agent =>
  normalizeText(agent.agencyName || agent.agentName || agent.name || "Unnamed Travel Agent");

const getAssignedUid = agent =>
  agent.assignedToUid || agent.accountManagerUid || "";

const getAssignedName = agent =>
  agent.assignedToName ||
  agent.assignedToEmail ||
  agent.assignedTo ||
  agent.accountManagerUid ||
  "";

const getAssignmentStatus = agent => {
  if (agent.assignmentStatus) return agent.assignmentStatus;

  return getAssignedUid(agent) || getAssignedName(agent)
    ? "Assigned"
    : "Unassigned";
};

const chunkArray = (items, size) => {
  const chunks = [];

  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }

  return chunks;
};

export default function BulkAssignTravelAgentModal({
  open,
  agents = [],
  onClose,
  onAssigned
}) {
  const { user } = useAuth();

  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    assigneeUid: "",
    assignedRole: "Account Manager",
    assignedTeam: "",
    assignmentPriority: "Medium",
    assignmentReason: ""
  });

  useEffect(() => {
    if (!open) return;

    async function loadUsers() {
      try {
        setLoadingUsers(true);

        const snap = await getDocs(collection(db, "users"));

        const rows = snap.docs
          .map(item => ({
            id: item.id,
            ...item.data()
          }))
          .filter(item => item.active !== false)
          .sort((a, b) => getUserName(a).localeCompare(getUserName(b)));

        setUsers(rows);
      } catch (error) {
        console.error(error);
        alert(error?.message || "Unable to load users.");
      } finally {
        setLoadingUsers(false);
      }
    }

    loadUsers();
  }, [open]);

  const selectedAssignee = useMemo(() => {
    return users.find(item => item.id === form.assigneeUid) || null;
  }, [users, form.assigneeUid]);

  useEffect(() => {
    if (!selectedAssignee) return;

    setForm(prev => ({
      ...prev,
      assignedTeam: prev.assignedTeam || getUserTeam(selectedAssignee)
    }));
  }, [selectedAssignee]);

  if (!open) return null;

  const updateForm = (key, value) => {
    setForm(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleBulkAssign = async () => {
    if (!agents.length) {
      alert("Please select at least one travel agent.");
      return;
    }

    if (!selectedAssignee) {
      alert("Please select assignee.");
      return;
    }

    try {
      setSaving(true);

      const assigneeName = getUserName(selectedAssignee);
      const assigneeEmail = getUserEmail(selectedAssignee);
      const assigneeTeam = normalizeText(form.assignedTeam);
      const assignedByName =
        user?.displayName || user?.name || user?.email || "System";

      /*
        Firestore batch limit is 500 writes.
        Each agent = 2 writes:
        1 travelAgents update + 1 assignment history log.
        Chunking 200 agents keeps it safely under limit.
      */
      const chunks = chunkArray(agents, 200);

      for (const chunk of chunks) {
        const batch = writeBatch(db);

        chunk.forEach(agent => {
          const previousAssignedUid = getAssignedUid(agent);
          const previousAssignedName = getAssignedName(agent);
          const previousStatus = getAssignmentStatus(agent);

          const assignmentStatus =
            previousAssignedUid || previousAssignedName
              ? "Reassigned"
              : "Assigned";

          const agentRef = doc(db, "travelAgents", agent.id);
          const historyRef = doc(collection(db, "travelAgentAssignments"));

          batch.update(agentRef, {
            assignedToUid: selectedAssignee.id,
            assignedToName: assigneeName,
            assignedToEmail: assigneeEmail,
            assignedTeam: assigneeTeam,
            assignedRole: form.assignedRole,
            assignmentStatus,
            assignmentPriority: form.assignmentPriority,
            assignmentReason: normalizeText(form.assignmentReason),

            // Backward-compatible fields
            assignedTo: assigneeEmail || assigneeName,
            accountManagerUid: selectedAssignee.id,
            team: assigneeTeam,

            assignedAt: serverTimestamp(),
            assignedByUid: user?.uid || "",
            assignedByName,

            updatedAt: serverTimestamp(),
            updatedByUid: user?.uid || "",
            updatedByName: assignedByName
          });

          batch.set(historyRef, {
            agentId: agent.id,
            agentName: getAgentName(agent),
            agentCode: agent.agentCode || "",

            previousAssignedToUid: previousAssignedUid || "",
            previousAssignedToName: previousAssignedName || "",
            previousAssignmentStatus: previousStatus || "Unassigned",

            assignedToUid: selectedAssignee.id,
            assignedToName: assigneeName,
            assignedToEmail: assigneeEmail,
            assignedTeam: assigneeTeam,
            assignedRole: form.assignedRole,

            assignmentStatus,
            assignmentPriority: form.assignmentPriority,
            assignmentReason: normalizeText(form.assignmentReason),

            assignedByUid: user?.uid || "",
            assignedByName,

            source: "bulk_assign",
            createdAt: serverTimestamp()
          });
        });

        await batch.commit();
      }

      await onAssigned?.();

      setForm({
        assigneeUid: "",
        assignedRole: "Account Manager",
        assignedTeam: "",
        assignmentPriority: "Medium",
        assignmentReason: ""
      });
    } catch (error) {
      console.error(error);
      alert(error?.message || "Unable to bulk assign travel agents.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <UserCheck className="h-5 w-5 text-indigo-600" />
              Bulk Assign Travel Agents
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Assign {agents.length} selected travel agent{agents.length === 1 ? "" : "s"} to one team member.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-60"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-5">
          {agents.length === 0 && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm text-amber-700">
              <AlertTriangle className="mt-0.5 h-4 w-4" />
              Select travel agents first.
            </div>
          )}

          <div className="mb-5 rounded-xl border border-slate-100 bg-slate-50 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Selected Agents
            </p>

            <div className="flex max-h-28 flex-wrap gap-2 overflow-y-auto">
              {agents.slice(0, 20).map(agent => (
                <span
                  key={agent.id}
                  className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200"
                >
                  {getAgentName(agent)}
                </span>
              ))}

              {agents.length > 20 && (
                <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-700">
                  +{agents.length - 20} more
                </span>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Assign To
              </label>

              <select
                value={form.assigneeUid}
                onChange={e => updateForm("assigneeUid", e.target.value)}
                disabled={loadingUsers || saving}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 disabled:bg-slate-50"
              >
                <option value="">
                  {loadingUsers ? "Loading users..." : "Select user"}
                </option>

                {users.map(item => (
                  <option key={item.id} value={item.id}>
                    {getUserName(item)}
                    {getUserTeam(item) ? ` • ${getUserTeam(item)}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Assignment Role
              </label>

              <select
                value={form.assignedRole}
                onChange={e => updateForm("assignedRole", e.target.value)}
                disabled={saving}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
              >
                {ASSIGNMENT_ROLES.map(role => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Priority
              </label>

              <select
                value={form.assignmentPriority}
                onChange={e =>
                  updateForm("assignmentPriority", e.target.value)
                }
                disabled={saving}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
              >
                {ASSIGNMENT_PRIORITIES.map(priority => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Assigned Team
              </label>

              <input
                value={form.assignedTeam}
                onChange={e => updateForm("assignedTeam", e.target.value)}
                disabled={saving}
                placeholder="Example: Sales Team"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Assignment Reason
              </label>

              <textarea
                value={form.assignmentReason}
                onChange={e =>
                  updateForm("assignmentReason", e.target.value)
                }
                disabled={saving}
                rows={3}
                placeholder="Example: City-wise reassignment / campaign ownership / manager allocation"
                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 p-5">
          <p className="text-xs text-slate-500">
            This will update assignment fields and create assignment history logs.
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleBulkAssign}
              disabled={saving || !agents.length || !form.assigneeUid}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Assign {agents.length}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}