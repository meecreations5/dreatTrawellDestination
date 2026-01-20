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

import EngagementChip from "@/components/engagement/EngagementChip";

export default function CreateLeadModal({ engagement, onClose }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [team, setTeam] = useState([]);
  const [destinations, setDestinations] = useState([]);

  const [assignedUid, setAssignedUid] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [saving, setSaving] = useState(false);

  /* =========================
     LOAD TEAM
  ========================== */
  useEffect(() => {
    const loadTeam = async () => {
      const snap = await getDocs(
        query(
          collection(db, "users"),
          where("active", "==", true),
          where("role", "in", ["team", "admin"])
        )
      );

      setTeam(
        snap.docs.map(d => ({
          uid: d.id,
          name: d.data().name,
          email: d.data().email
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

    setSaving(true);

    const destination = destinations.find(
      d => d.id === destinationId
    );

    const assignee =
      team.find(t => t.uid === assignedUid) || {
        uid: user.uid,
        email: user.email,
        name: user.name
      };

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
          email: user.email,
          name: user.name
        }
      });

      alert("Lead created successfully");
      onClose();
      router.push(`/leads/${leadId}`);
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

        {/* ASSIGN TO – CHIPS */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-600">
            Assign To
          </p>

          <div className="flex gap-3 flex-wrap">
            <EngagementChip
              label="Assign to self"
              icon="👤"
              active={!assignedUid}
              onClick={() => setAssignedUid("")}
            />

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
