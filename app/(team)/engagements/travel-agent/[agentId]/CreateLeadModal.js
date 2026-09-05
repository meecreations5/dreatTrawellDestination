"use client";

import { useEffect, useState } from "react";
import {
  getDocs,
  collection,
  query,
  where
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { createLeadFromEngagement } from "@/lib/createLeadFromEngagement";
import { canAccess, resolveUserRole } from "@/lib/rolePermissions";

import EngagementChip from "@/components/engagement/EngagementChip";

export default function CreateLeadModal({ engagement, onClose }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [team, setTeam] = useState([]);
  const [destinations, setDestinations] = useState([]);

  const [assignedUid, setAssignedUid] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [travelStartDate, setTravelStartDate] = useState("");
  const [travelEndDate, setTravelEndDate] = useState("");
  const [saving, setSaving] = useState(false);
  const isEngagementExecutive = resolveUserRole(user || {}) === "employee";

  /* =========================
     LOAD TEAM
  ========================== */
  useEffect(() => {
    const loadTeam = async () => {
      const snap = await getDocs(
        query(
          collection(db, "users"),
          where("active", "==", true),
          where("role", "in", ["team", "employee", "operation_executive", "operations_executive", "admin", "manager", "super_admin"])
        )
      );

      setTeam(
        snap.docs
          .map(d => ({ uid: d.id, ...d.data() }))
          .filter(member => ["operation_executive", "manager", "admin", "super_admin"].includes(resolveUserRole(member)))
          .map(member => ({
            uid: member.uid,
            name: member.name,
            email: member.email,
            role: member.role,
            accessRole: member.accessRole,
            roleProfile: member.roleProfile,
            active: member.active !== false
          }))
      );
    };

    loadTeam();
  }, []);

  /* =========================
     LOAD DESTINATIONS
  ========================== */
  useEffect(() => {
    const loadDestinations = async () => {
      const snap = await getDocs(
        query(
          collection(db, "destinations"),
          where("active", "==", true)
        )
      );

      setDestinations(
        snap.docs.map(d => ({ id: d.id, ...d.data() }))
      );
    };

    loadDestinations();
  }, []);

  if (loading || !user) return null;

  /* =========================
     CREATE LEAD
  ========================== */
  const createLead = async () => {
    if (!destinationId) {
      alert("Please select a destination");
      return;
    }

    if (travelStartDate && travelEndDate && travelEndDate < travelStartDate) {
      alert("Travel end date cannot be before the start date");
      return;
    }

    setSaving(true);

    const destination = destinations.find(
      d => d.id === destinationId
    );

    const isEngagementExecutive = resolveUserRole(user || {}) === "employee";
    const assignee = team.find(t => t.uid === assignedUid) || (isEngagementExecutive ? null : {
      uid: user.uid,
      email: user.email,
      name: user.name
    });

    if (!assignee?.uid) {
      alert("Please assign this Lead to a Lead & Operations Executive.");
      setSaving(false);
      return;
    }

    try {
      const leadId = await createLeadFromEngagement({
        engagement: {
          ...engagement,
          destinationRefId: destination.id,
          destinationId: destination.destinationId || null,
          destinationCode: destination.code || null,
          destinationName: destination.name
        },
        assignedUser: assignee,
        createdUser: {
          uid: user.uid,
          email: user.email || "",
          name: user.name || user.displayName || user.email || "",
          role: user.role || "",
          accessRole: user.accessRole || "",
          roleProfile: user.roleProfile || "",
          active: user.active !== false
        },
        travelStartDate,
        travelEndDate,
        travelMonth: travelStartDate ? travelStartDate.slice(0, 7) : ""
      });

      alert(
        canAccess(user, "leads.view")
          ? "Lead created successfully"
          : "Lead created successfully and handed over to Lead & Operations."
      );
      onClose();
      if (canAccess(user, "leads.view")) {
        router.push(`/leads/${leadId}`);
      }
    } catch (err) {
      alert(err.message || "Failed to create lead");
    } finally {
      setSaving(false);
    }
  };

  /* =========================
     UI
  ========================== */
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-card p-6 w-full max-w-lg space-y-5">
        <h2 className="text-lg font-semibold">
          Create Lead
        </h2>

        {/* DESTINATION – CHIPS */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-600">
            Select Destination
          </p>

          <div className="flex gap-3 flex-wrap">
            {destinations.map(d => (
              <EngagementChip
                key={d.id}
                label={d.name}
                icon="✈️"
                active={destinationId === d.id}
                onClick={() => setDestinationId(d.id)}
              />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-xs font-medium text-gray-600">
            <span>Travel Start Date</span>
            <input type="date" value={travelStartDate} onChange={e => setTravelStartDate(e.target.value)} className="h-10 w-full rounded-md border border-gray-200 px-3 text-sm" />
          </label>
          <label className="space-y-1 text-xs font-medium text-gray-600">
            <span>Travel End Date (optional)</span>
            <input type="date" min={travelStartDate || undefined} value={travelEndDate} onChange={e => setTravelEndDate(e.target.value)} className="h-10 w-full rounded-md border border-gray-200 px-3 text-sm" />
          </label>
        </div>

        {/* ASSIGN TO – CHIPS */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-600">
            Assign To
          </p>

          <div className="flex gap-3 flex-wrap">
            {!isEngagementExecutive ? (
              <EngagementChip
                label="Assign to self"
                icon="👤"
                active={!assignedUid}
                onClick={() => setAssignedUid("")}
              />
            ) : null}

            {team.map(u => (
              <EngagementChip
                key={u.uid}
                label={u.name}
                icon="🧑‍💼"
                active={assignedUid === u.uid}
                onClick={() => setAssignedUid(u.uid)}
              />
            ))}
          </div>
          {isEngagementExecutive && !assignedUid ? (
            <p className="text-xs font-medium text-amber-700">Select a Lead & Operations assignee for handover.</p>
          ) : null}
        </div>

        {/* ACTIONS */}
        <div className="flex gap-3 pt-4">
          <button
            onClick={onClose}
            className="
              w-1/2
              border rounded-md
              py-2
              text-sm
              hover:bg-gray-50
            "
          >
            Cancel
          </button>

          <button
            onClick={createLead}
            disabled={saving}
            className="
              w-1/2
              bg-blue-600 text-white
              rounded-md py-2
              text-sm font-medium
              hover:bg-blue-700
              disabled:opacity-60
            "
          >
            {saving ? "Creating..." : "Create Lead"}
          </button>
        </div>
      </div>
    </div>
  );
}
