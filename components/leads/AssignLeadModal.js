// componenets/leads/AssignLeadModal

"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { assignLead } from "@/lib/assignLead";
import { useAuth } from "@/hooks/useAuth";

/* =========================
   UI STYLES (LOCAL)
========================= */
const inputClass = `
  w-full
  border border-gray-200
  rounded-lg
  px-3 py-2
  text-sm
  bg-white
  focus:outline-none
  focus:ring-2
  focus:ring-blue-100
  focus:border-blue-400
`;

export default function AssignLeadModal({ leadId, onClose }) {
  const { user } = useAuth();
  const [team, setTeam] = useState([]);
  const [selectedUid, setSelectedUid] = useState("");

  useEffect(() => {
    // ⛔ Wait until user is available
    if (!user?.uid) return;

    getDocs(collection(db, "users")).then(snap => {
      const users = snap.docs.map(d => ({
        uid: d.id,
        ...d.data()
      }));

      setTeam(
        users.filter(u => {
          // ✅ Only admin or team can be assigned
          if (!(u.role === "admin" || u.role === "employee"))
            return false;

          // ❌ Logged-in user should not see themselves
          if (u.uid === user.uid)
            return false;

          return true;
        })
      );
    });
  }, [user]);
  const assign = async () => {
    const newUser = team.find(u => u.uid === selectedUid);
    if (!newUser) return;

    await assignLead({
      leadId,
      newUser,
      assignedBy: user
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-sm rounded-xl shadow-sm p-6 space-y-4">
        <h2 className="text-sm font-semibold">Assign Lead</h2>

        <select
          className={inputClass}
          value={selectedUid}
          onChange={e => setSelectedUid(e.target.value)}
        >
          <option value="">Select Team Member</option>
          {team.map(u => (
            <option key={u.uid} value={u.uid}>
              {u.name}
            </option>
          ))}
        </select>

        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            className="flex-1 border rounded-md py-2"
          >
            Cancel
          </button>

          <button
            onClick={assign}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md py-2"
          >
            Assign Lead
          </button>
        </div>
      </div>
    </div>
  );
}
