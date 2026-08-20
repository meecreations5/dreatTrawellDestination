"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { buildTeamDirectory, buildTeamDirectoryLookup } from "@/lib/teamDirectory";

export function useUserDirectory({ includeInactive = false } = {}) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "users"),
      snap => {
        setUsers(snap.docs.map(item => ({ id: item.id, ...item.data() })));
        setLoading(false);
      },
      error => {
        console.warn("Users directory unavailable:", error);
        setUsers([]);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const directory = useMemo(
    () => buildTeamDirectory(users, { includeInactive }),
    [users, includeInactive]
  );
  const lookup = useMemo(() => buildTeamDirectoryLookup(directory), [directory]);

  return { users, directory, lookup, loading };
}
