"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDocs, limit, onSnapshot, query, where } from "firebase/firestore";
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

    let cancelled = false;
    let fallbackUnsubscribe = null;

    const subscribeToDocument = documentId => {
      if (!documentId || cancelled) return;

      if (fallbackUnsubscribe) {
        fallbackUnsubscribe();
        fallbackUnsubscribe = null;
      }

      fallbackUnsubscribe = onSnapshot(
        doc(db, "travelAgents", documentId),
        snap => {
          if (cancelled) return;
          setLiveAgent(snap.exists() ? { id: snap.id, ...snap.data() } : null);
        },
        error => {
          if (!cancelled) {
            console.warn("Unable to subscribe to linked travel agent master:", error);
          }
        }
      );
    };

    const resolveLegacyDocumentId = async () => {
      const fields = ["travelAgentId", "agentId"];

      for (const field of fields) {
        try {
          const snap = await getDocs(
            query(
              collection(db, "travelAgents"),
              where(field, "==", travelAgentId),
              limit(1)
            )
          );

          if (cancelled) return;

          if (!snap.empty) {
            subscribeToDocument(snap.docs[0].id);
            return;
          }
        } catch (error) {
          console.warn(`Unable to resolve Travel Agent by ${field}:`, error);
        }
      }

      if (!cancelled) setLiveAgent(null);
    };

    // Modern leads store the Firestore document ID. Older leads sometimes
    // stored a business Travel Agent ID instead, so fall back to field lookup
    // if the direct document does not exist.
    const directUnsubscribe = onSnapshot(
      doc(db, "travelAgents", travelAgentId),
      snap => {
        if (cancelled) return;

        if (snap.exists()) {
          setLiveAgent({ id: snap.id, ...snap.data() });
          return;
        }

        resolveLegacyDocumentId();
      },
      error => {
        console.warn("Unable to load linked travel agent master:", error);
        resolveLegacyDocumentId();
      }
    );

    return () => {
      cancelled = true;
      directUnsubscribe?.();
      fallbackUnsubscribe?.();
    };
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
