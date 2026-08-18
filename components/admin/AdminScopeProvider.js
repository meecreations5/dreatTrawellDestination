"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  buildTeamDirectory,
  buildTeamDirectoryLookup,
  getMembersForTeam,
  getTeamOptions
} from "@/lib/teamDirectory";
import { DEFAULT_ADMIN_SCOPE } from "@/lib/adminScope";

const STORAGE_KEY = "dreamtrawell.adminScope.v1";
const AdminScopeContext = createContext(null);

function readStoredScope() {
  if (typeof window === "undefined") return DEFAULT_ADMIN_SCOPE;
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      dateRange: stored.dateRange || DEFAULT_ADMIN_SCOPE.dateRange,
      dateFrom: stored.dateFrom || DEFAULT_ADMIN_SCOPE.dateFrom,
      dateTo: stored.dateTo || DEFAULT_ADMIN_SCOPE.dateTo,
      team: stored.team || DEFAULT_ADMIN_SCOPE.team
    };
  } catch {
    return DEFAULT_ADMIN_SCOPE;
  }
}

export default function AdminScopeProvider({ children }) {
  const [scope, setScopeState] = useState(DEFAULT_ADMIN_SCOPE);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);

  useEffect(() => {
    setScopeState(readStoredScope());
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "users"),
      snap => {
        setUsers(snap.docs.map(item => ({ id: item.id, ...item.data() })));
        setUsersLoading(false);
      },
      error => {
        console.warn("Global Users directory unavailable:", error);
        setUsers([]);
        setUsersLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // Operational dropdowns show active Users only. A second all-users directory
  // is kept for legacy identity resolution, so historical records belonging to
  // an inactive employee can still be attributed correctly without putting
  // that person back into normal working filters.
  const allUserDirectory = useMemo(
    () => buildTeamDirectory(users, { includeInactive: true }),
    [users]
  );
  const teamDirectory = useMemo(
    () => buildTeamDirectory(users, { includeInactive: false }),
    [users]
  );
  const userLookup = useMemo(() => buildTeamDirectoryLookup(allUserDirectory), [allUserDirectory]);
  const teamOptions = useMemo(() => getTeamOptions(teamDirectory), [teamDirectory]);
  const scopedMembers = useMemo(
    () => getMembersForTeam(teamDirectory, scope.team),
    [teamDirectory, scope.team]
  );

  // If a persisted team was removed/renamed, do not leave every page empty.
  useEffect(() => {
    if (scope.team === "all" || usersLoading) return;
    if (!teamOptions.includes(scope.team)) {
      setScopeState(current => ({ ...current, team: "all" }));
    }
  }, [scope.team, teamOptions, usersLoading]);

  const setScope = useCallback(update => {
    setScopeState(current => {
      const next = typeof update === "function" ? update(current) : { ...current, ...update };
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      }
      return next;
    });
  }, []);

  const resetScope = useCallback(() => setScope(DEFAULT_ADMIN_SCOPE), [setScope]);

  const value = useMemo(() => ({
    scope,
    setScope,
    resetScope,
    users,
    usersLoading,
    teamDirectory,
    allUserDirectory,
    userLookup,
    teamOptions,
    scopedMembers
  }), [scope, setScope, resetScope, users, usersLoading, teamDirectory, allUserDirectory, userLookup, teamOptions, scopedMembers]);

  return <AdminScopeContext.Provider value={value}>{children}</AdminScopeContext.Provider>;
}

export function useAdminScope() {
  const context = useContext(AdminScopeContext);
  if (!context) throw new Error("useAdminScope must be used inside AdminScopeProvider");
  return context;
}
