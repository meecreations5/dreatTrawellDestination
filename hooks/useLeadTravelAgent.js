"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  getLeadTravelAgentId,
  resolveLeadTravelAgent,
  usesLiveTravelAgentMaster
} from "@/lib/leadOwnership";

export function useLeadTravelAgent(lead) {
  const travelAgentId = useMemo(
    () => getLeadTravelAgentId(lead || {}),
    [lead]
  );

  const liveLinked = useMemo(
    () => usesLiveTravelAgentMaster(lead || {}),
    [lead]
  );

  const [liveAgent, setLiveAgent] = useState(null);

  useEffect(() => {
    if (!liveLinked || !travelAgentId) {
      setLiveAgent(null);
      return undefined;
    }

    return onSnapshot(
      doc(db, "travelAgents", travelAgentId),
      snap => {
        setLiveAgent(
          snap.exists()
            ? { id: snap.id, ...snap.data() }
            : null
        );
      },
      error => {
        console.warn("Unable to load linked travel agent master:", error);
        setLiveAgent(null);
      }
    );
  }, [liveLinked, travelAgentId]);

  const agentMap = useMemo(() => {
    const map = new Map();
    if (liveAgent?.id) map.set(liveAgent.id, liveAgent);
    return map;
  }, [liveAgent]);

  return useMemo(
    () => resolveLeadTravelAgent(lead || {}, agentMap),
    [lead, agentMap]
  );
}
