"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  getDocs,
  query,
  where
} from "firebase/firestore";
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
`;

export default function ManualLeadCreatePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  /* =========================
     STATE
  ========================== */
  const [destinations, setDestinations] = useState([]);
  const [agents, setAgents] = useState([]);
  const [team, setTeam] = useState([]);

  const [destinationId, setDestinationId] = useState("");
  const [agentId, setAgentId] = useState("");
  const [spocIndex, setSpocIndex] = useState(0);
  const [assignedToUid, setAssignedToUid] = useState("");

  const [saving, setSaving] = useState(false);

  /* =========================
     LOAD DATA
  ========================== */
  useEffect(() => {
    Promise.all([
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
      getDocs(
        query(
          collection(db, "users"),
          where("active", "==", true),
          where("role", "in", ["employee", "admin"])
        )
      )
    ]).then(([dSnap, aSnap, tSnap]) => {
      setDestinations(dSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setAgents(aSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setTeam(tSnap.docs.map(d => ({ uid: d.id, ...d.data() })));
    });
  }, []);

  /* =========================
     DERIVED
  ========================== */
  const agent = useMemo(
    () => agents.find(a => a.id === agentId),
    [agentId, agents]
  );

  const spocs = agent?.spocs || [];
  const spoc = spocs[spocIndex];

  const destination = useMemo(
    () => destinations.find(d => d.id === destinationId),
    [destinationId, destinations]
  );

  if (loading || !user) return null;

  /* =========================
     SUBMIT
  ========================== */
  const submit = async () => {
    if (!destination || !agent || !spoc) {
      alert("Destination, Agent and SPOC are required");
      return;
    }

    const assignee =
      team.find(u => u.uid === assignedToUid) || user;

    setSaving(true);
    try {
      const leadId = await createManualLead({
        destination,
        agent,
        spoc,
        assignedUser: assignee,
        createdUser: user
      });

      router.push(`/leads/${leadId}`);
    } finally {
      setSaving(false);
    }
  };

  /* =========================
     UI (STYLE-ALIGNED)
  ========================== */
  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* HEADER */}
        <div>
          <h1 className="text-lg font-semibold">
            Create Lead
          </h1>
          <p className="text-sm text-gray-500">
            Manually add a new travel lead
          </p>
        </div>

        {/* FORM */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-5">
          {/* DESTINATION */}
          <div className="space-y-1">
            <label className="text-sm font-medium">
              Destination
            </label>
            <select
              className={inputClass}
              value={destinationId}
              onChange={e =>
                setDestinationId(e.target.value)
              }
            >
              <option value="">Select Destination</option>
              {destinations.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* AGENT */}
          <div className="space-y-1">
            <label className="text-sm font-medium">
              Travel Agent
            </label>
            <select
              className={inputClass}
              value={agentId}
              onChange={e => {
                setAgentId(e.target.value);
                setSpocIndex(0);
              }}
            >
              <option value="">Select Agent</option>
              {agents.map(a => (
                <option key={a.id} value={a.id}>
                  {a.agencyName}
                </option>
              ))}
            </select>
          </div>

          {/* SPOC */}
          {spocs.length > 0 && (
            <div className="space-y-1">
              <label className="text-sm font-medium">
                SPOC
              </label>
              <select
                className={inputClass}
                value={spocIndex}
                onChange={e =>
                  setSpocIndex(Number(e.target.value))
                }
              >
                {spocs.map((s, i) => (
                  <option key={i} value={i}>
                    {s.name} ({s.designation})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* ASSIGN */}
          <div className="space-y-1">
            <label className="text-sm font-medium">
              Assign Lead
            </label>
            <select
              className={inputClass}
              value={assignedToUid}
              onChange={e =>
                setAssignedToUid(e.target.value)
              }
            >
              <option value="">Assign to self</option>
              {team.map(u => (
                <option key={u.uid} value={u.uid}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          {/* ACTION */}
          <button
            onClick={submit}
            disabled={saving}
            className="
              w-full py-2.5
              bg-blue-600 hover:bg-blue-700
              text-white font-medium
              rounded-md
              transition
              disabled:opacity-60
            "
          >
            {saving ? "Creating Lead..." : "Create Lead"}
          </button>
        </div>
      </div>
    </main>
  );
}
