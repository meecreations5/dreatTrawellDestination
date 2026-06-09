// components/leads/AssignLeadModal.jsx

"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc
} from "firebase/firestore";

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
  return getFirstValue(
    user?.displayName,
    user?.name,
    user?.fullName,
    user?.employeeName,
    user?.email
  );
}

function getUserEmail(user) {
  return getFirstValue(
    user?.email,
    user?.workEmail,
    user?.officialEmail
  );
}

function getUserRole(user) {
  return getFirstValue(
    user?.designation,
    user?.jobTitle,
    user?.role
  );
}

function isInternalUser(user) {
  const role = String(user?.role || "").toLowerCase();

  const inactive =
    user?.disabled ||
    user?.isDisabled ||
    user?.deleted ||
    user?.isDeleted ||
    user?.status === "inactive" ||
    user?.active === false;

  const excludedRoles = [
    "customer",
    "client",
    "vendor",
    "travel_agent",
    "travel-agent"
  ];

  return !inactive && !excludedRoles.includes(role);
}

export default function AssignLeadModal({ leadId, onClose }) {
  const { user } = useAuth();

  const [members, setMembers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [remark, setRemark] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadUsers() {
      setLoading(true);

      try {
        const snap = await getDocs(collection(db, "users"));

        const rows = snap.docs
          .map(docSnap => {
            const data = docSnap.data();

            return {
              id: docSnap.id,
              uid: data?.uid || docSnap.id,
              ...data
            };
          })
          .filter(isInternalUser)
          .map(member => {
            const safeId = getUserId(member);

            return {
              ...member,
              safeId
            };
          })
          .filter(member => member.safeId)
          .sort((a, b) =>
            getUserName(a).localeCompare(getUserName(b))
          );

        if (mounted) {
          setMembers(rows);
        }
      } catch (error) {
        console.error("Failed to load users:", error);
        if (mounted) setMembers([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadUsers();

    return () => {
      mounted = false;
    };
  }, []);

  const selectedMember = useMemo(() => {
    return members.find(member => member.safeId === selectedUserId) || null;
  }, [members, selectedUserId]);

  const assignLead = async () => {
    if (saving) return;

    if (!selectedMember) {
      alert("Please select team member");
      return;
    }

    const assigneeId = getUserId(selectedMember);
    const assigneeName = getUserName(selectedMember);
    const assigneeEmail = getUserEmail(selectedMember);
    const assigneeRole = getUserRole(selectedMember);

    if (!assigneeId) {
      alert("Selected team member does not have valid UID or email");
      return;
    }

    setSaving(true);

    try {
      await updateDoc(doc(db, "leads", leadId), {
        assignedTo: assigneeId,
        assignedToUid: assigneeId,
        assignedToName: assigneeName,
        assignedToEmail: assigneeEmail,
        assignedToRole: assigneeRole,

        stage: "assigned",

        assignedAt: serverTimestamp(),
        assignedByUid: user?.uid || "",
        assignedByName:
          user?.displayName || user?.name || user?.email || "",

        updatedAt: serverTimestamp()
      });

      await logLeadAction({
        leadId,
        type: LEAD_TIMELINE_TYPES.ASSIGNED || "assigned",
        title: "Lead assigned",
        description: `Lead assigned to ${assigneeName || assigneeEmail || assigneeId}`,
        metadata: {
          action: "lead_assigned",
          assignedTo: assigneeId,
          assignedToUid: assigneeId,
          assignedToName: assigneeName,
          assignedToEmail: assigneeEmail,
          assignedToRole: assigneeRole,
          remark: remark || ""
        },
        user
      });

      onClose();
    } catch (error) {
      console.error("Assign lead failed:", error);
      alert(error?.message || "Failed to assign lead");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full shadow-xl">
        <div className="p-5 border-b">
          <h2 className="text-base font-semibold text-gray-900">
            Assign Lead
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Assign or change the team member responsible for this lead.
          </p>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500">
              Team Member
            </label>

            <select
              value={selectedUserId}
              onChange={e => setSelectedUserId(e.target.value)}
              disabled={loading || saving}
              className="
                mt-1 w-full border border-gray-200 rounded-lg
                px-3 py-2 text-sm bg-white
                focus:outline-none focus:ring-2 focus:ring-blue-100
                disabled:bg-gray-100 disabled:text-gray-500
              "
            >
              <option value="">
                {loading ? "Loading team members..." : "Select team member"}
              </option>

              {members.map((member, index) => {
                const safeId = member.safeId;
                const name = getUserName(member);
                const email = getUserEmail(member);
                const role = getUserRole(member);

                return (
                  <option
                    key={`${safeId}-${index}`}
                    value={safeId}
                  >
                    {name || email || safeId}
                    {role ? ` — ${role}` : ""}
                    {email && name !== email ? ` (${email})` : ""}
                  </option>
                );
              })}
            </select>
          </div>

          {selectedMember && (
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-xs text-gray-700">
              <p className="font-semibold text-gray-900">
                {getUserName(selectedMember)}
              </p>

              {getUserRole(selectedMember) && (
                <p className="mt-1">{getUserRole(selectedMember)}</p>
              )}

              {getUserEmail(selectedMember) && (
                <p className="mt-1">{getUserEmail(selectedMember)}</p>
              )}
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-gray-500">
              Internal Remark
            </label>

            <textarea
              rows={3}
              value={remark}
              onChange={e => setRemark(e.target.value)}
              placeholder="Optional assignment note"
              className="
                mt-1 w-full border border-gray-200 rounded-lg
                px-3 py-2 text-sm bg-white
                focus:outline-none focus:ring-2 focus:ring-blue-100
              "
            />
          </div>
        </div>

        <div className="p-5 border-t flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 border border-gray-200 rounded-lg py-2 text-sm disabled:opacity-60"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={assignLead}
            disabled={saving || loading || !selectedUserId}
            className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm disabled:opacity-60"
          >
            {saving ? "Assigning..." : "Assign Lead"}
          </button>
        </div>
      </div>
    </div>
  );
}