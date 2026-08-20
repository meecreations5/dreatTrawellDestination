"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { LayoutGrid, List, Download, Trash2, AlertTriangle, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import AdminGuard from "@/components/AdminGuard";
import PageSkeleton from "@/components/ui/PageSkeleton";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getDirectoryUserEmail, getDirectoryUserName } from "@/lib/teamDirectory";
import { useAuth } from "@/hooks/useAuth";
import { canAccess, isSuperAdmin, resolveUserRole } from "@/lib/rolePermissions";
import { updateUserAccess } from "@/lib/updateUserAccess";
/* =========================
   UI ATOMS
========================= */

const RoleChip = ({ label }) => (
  <span className="px-2 py-[2px] rounded-md text-[11px] bg-gray-100 text-gray-700">
    {label}
  </span>
);

const isSameUser = (currentUser, targetUser) => Boolean(
  currentUser && targetUser && (
    currentUser.id === targetUser.id ||
    (currentUser.uid && targetUser.uid && currentUser.uid === targetUser.uid)
  )
);

const UserStatusToggle = ({ user, currentUser, onUpdated }) => {
  const canEdit = canAccess(currentUser, "users.edit");
  const locked = !canEdit || isSameUser(currentUser, user) || isSuperAdmin(user);

  return (
    <button
      type="button"
      disabled={locked}
      onClick={async () => {
        const nextActive = !user.active;
        await updateUserAccess({
          userId: user.id,
          active: nextActive,
          changeReason: "Status changed from Team Management"
        });
        onUpdated?.(user.id, nextActive);
      }}
      className={`text-xs px-2 py-1 rounded-md border disabled:cursor-not-allowed disabled:opacity-50
        ${user.active
          ? "bg-green-50 text-green-700 border-green-200"
          : "bg-gray-100 text-gray-600 border-gray-200"
        }`}
      title={locked ? "Status cannot be changed for this user" : "Change user status"}
    >
      {user.active ? "Active" : "Inactive"}
    </button>
  );
};


const getUserTeamName = user => String(
  user?.teamName ||
  user?.teamLabel ||
  (typeof user?.team === "string" ? user.team : user?.team?.name || user?.team?.label) ||
  user?.departmentName ||
  (typeof user?.department === "string" ? user.department : user?.department?.name || user?.department?.label) ||
  ""
).trim();

/* =========================
   CSV EXPORT
========================= */
function exportUsersCsv(users) {
  if (!users.length) return;

  const headers = [
    "Name",
    "Email",
    "Employee ID",
    "Role",
    "Team / Department",
    "Active"
  ];

  const rows = users.map(u => [
    u.name || "",
    u.email || "",
    u.employeeId || "",
    u.role || "",
    getUserTeamName(u),
    u.active ? "Active" : "Inactive"
  ]);

  const csv =
    [headers, ...rows]
      .map(r => r.map(v => `"${v}"`).join(","))
      .join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "users.csv";
  a.click();

  URL.revokeObjectURL(url);
}

/* =========================
   PAGE
========================= */

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [view, setView] = useState("table");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [team, setTeam] = useState("all");
  const [selected, setSelected] = useState([]);

  const router = useRouter();
  const canEditUsers = canAccess(currentUser, "users.edit");
  const canCreateUsers = canAccess(currentUser, "users.create");

  const functions = getFunctions();
  const deleteUserFn = httpsCallable(functions, "deleteUser");

  /* =========================
     LOAD USERS
  ========================= */
  useEffect(() => {
    getDocs(collection(db, "users")).then(snap => {
      setUsers(
        snap.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            storedRole: data.role || "",
            role: resolveUserRole(data)
          };
        })
      );
      setLoading(false);
    });
  }, []);

  /* =========================
     ROLES (AUTO)
  ========================= */
  const roles = useMemo(() => {
    return Array.from(
      new Set(users.map(u => u.role).filter(Boolean))
    );
  }, [users]);

  const teams = useMemo(() => {
    return Array.from(new Set(users.map(getUserTeamName).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b));
  }, [users]);

  const dataHealth = useMemo(() => {
    const emailCounts = new Map();
    const nameCounts = new Map();

    users.forEach(item => {
      const email = getDirectoryUserEmail(item);
      const name = getDirectoryUserName(item).toLowerCase();
      if (email) emailCounts.set(email, (emailCounts.get(email) || 0) + 1);
      if (name) nameCounts.set(name, (nameCounts.get(name) || 0) + 1);
    });

    const duplicateEmails = Array.from(emailCounts.values()).filter(count => count > 1).length;
    const duplicateNames = Array.from(nameCounts.values()).filter(count => count > 1).length;
    const missingUid = users.filter(item => !String(item.uid || item.userUid || item.authUid || item.firebaseUid || "").trim()).length;
    const missingName = users.filter(item => item.active !== false && !getDirectoryUserName(item)).length;
    const missingTeam = users.filter(item => item.active !== false && !getUserTeamName(item)).length;

    return { duplicateEmails, duplicateNames, missingUid, missingName, missingTeam };
  }, [users]);

  /* =========================
     FILTERED USERS
  ========================= */
  const filteredUsers = useMemo(() => {
    const s = search.toLowerCase();

    return users.filter(u => {
      if (
        s &&
        !u.name?.toLowerCase().includes(s) &&
        !u.email?.toLowerCase().includes(s) &&
        !u.employeeId?.toLowerCase().includes(s) &&
        !getUserTeamName(u).toLowerCase().includes(s)
      ) {
        return false;
      }

      if (role !== "all" && u.role !== role) {
        return false;
      }

      if (team !== "all" && getUserTeamName(u) !== team) {
        return false;
      }

      return true;
    });
  }, [users, search, role, team]);

  /* =========================
     BULK ACTIONS
  ========================= */
  const bulkUpdateStatus = async active => {
    if (!canEditUsers) return;

    const eligibleIds = selected.filter(id => {
      const target = users.find(item => item.id === id);
      return target && !isSameUser(currentUser, target) && !isSuperAdmin(target);
    });

    for (const id of eligibleIds) {
      await updateUserAccess({
        userId: id,
        active,
        changeReason: "Bulk status change from Team Management"
      });
    }

    setUsers(rows =>
      rows.map(item =>
        eligibleIds.includes(item.id) ? { ...item, active } : item
      )
    );

    setSelected([]);
  };

  /* =========================
     STATES
  ========================= */
  if (loading) return <PageSkeleton lines={6} />;

  return (
    <AdminGuard permission="users.view">
      <main className="p-6 w-full mx-auto space-y-4">

        <h1 className="text-xl font-semibold">
          Team Management
        </h1>

        {(dataHealth.duplicateEmails || dataHealth.duplicateNames || dataHealth.missingUid || dataHealth.missingName || dataHealth.missingTeam) ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">User Master Data Health</p>
                <p className="mt-1">
                  {dataHealth.duplicateEmails} duplicate email group(s) · {dataHealth.duplicateNames} duplicate display-name group(s) · {dataHealth.missingUid} user(s) without Auth UID · {dataHealth.missingName} active user(s) without a display name · {dataHealth.missingTeam} active user(s) without Team / Department.
                  Staff filters use this Users master only. Duplicate-name groups are review warnings only; the CRM never auto-merges two people when their identities conflict.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {/* FILTER + ACTION BAR */}
        <div
          className="
            sticky top-0 z-20
            bg-white/90 backdrop-blur
            border border-gray-100
            rounded-xl
            p-3
          "
        >
          <div className="flex flex-wrap gap-3 items-center justify-between">

            {/* LEFT FILTERS */}
            <div className="flex flex-wrap gap-2">
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name, email, employee ID, team"
                className="text-xs px-3 py-2 border border-gray-100 rounded-lg bg-white w-64"
              />

              <select
                value={role}
                onChange={e => setRole(e.target.value)}
                className="text-xs px-3 py-2 border border-gray-100 rounded-lg bg-white"
              >
                <option value="all">All Roles</option>
                {roles.map(r => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>

              <select
                value={team}
                onChange={e => setTeam(e.target.value)}
                className="text-xs px-3 py-2 border border-gray-100 rounded-lg bg-white"
              >
                <option value="all">All Teams</option>
                {teams.map(item => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>

            {/* RIGHT ACTIONS */}
            <div className="flex items-center gap-2">

              {selected.length > 0 && canEditUsers && (
                <>
                  <button
                    onClick={() => bulkUpdateStatus(true)}
                    className="text-green-600 text-xs font-medium"
                  >
                    Activate ({selected.length})
                  </button>
                  <button
                    onClick={() => bulkUpdateStatus(false)}
                    className="text-red-600 text-xs font-medium"
                  >
                    Deactivate ({selected.length})
                  </button>
                </>
              )}

              {canCreateUsers && (
                <button
                  type="button"
                  onClick={() => router.push("/admin/users/new")}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  <Plus size={14} />
                  Add User
                </button>
              )}

              <button
                onClick={() => exportUsersCsv(filteredUsers)}
                className="
                  inline-flex items-center gap-1.5
                  border border-gray-100
                  rounded-lg
                  px-3 py-2
                  text-xs text-gray-600
                  hover:bg-gray-50
                "
              >
                <Download size={14} />
                Export
              </button>

              <div className="flex border border-gray-100 rounded-lg overflow-hidden">
                <button
                  onClick={() => setView("card")}
                  className={`p-2 ${view === "card"
                    ? "bg-blue-600 text-white"
                    : "text-gray-500 hover:bg-gray-50"
                    }`}
                >
                  <LayoutGrid size={14} />
                </button>
                <button
                  onClick={() => setView("table")}
                  className={`p-2 ${view === "table"
                    ? "bg-blue-600 text-white"
                    : "text-gray-500 hover:bg-gray-50"
                    }`}
                >
                  <List size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* TABLE VIEW */}
        {view === "table" && (
          <div className="border border-gray-100 rounded-xl bg-white overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50/60 text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-3">
                    <input
                      type="checkbox"
                      disabled={!canEditUsers}
                      checked={
                        selected.length === filteredUsers.length &&
                        filteredUsers.length > 0
                      }
                      onChange={e =>
                        setSelected(
                          e.target.checked
                            ? filteredUsers.map(u => u.id)
                            : []
                        )
                      }
                    />
                  </th>
                  <th className="px-4 py-3 text-left">User</th>
                  <th className="px-4 py-3 text-left">Role</th>
                  <th className="px-4 py-3 text-left">Team / Department</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredUsers.map(u => (
                  <tr
                    key={u.id}
                    className="border-b border-gray-100 hover:bg-gray-50/60"
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        disabled={!canEditUsers || isSameUser(currentUser, u) || isSuperAdmin(u)}
                        checked={selected.includes(u.id)}
                        onChange={e =>
                          setSelected(s =>
                            e.target.checked
                              ? [...s, u.id]
                              : s.filter(id => id !== u.id)
                          )
                        }
                      />
                    </td>

                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => router.push(`/admin/users/${u.id}`)}
                        className="font-medium text-blue-600 hover:underline text-left"
                      >
                        {u.name}
                      </button>
                      <div className="text-xs text-gray-500">{u.email}</div>
                    </td>

                    <td className="px-4 py-3">
                      <RoleChip label={u.role} />
                    </td>

                    <td className="px-4 py-3 text-xs text-gray-600">
                      {getUserTeamName(u) || <span className="text-amber-600">Not assigned</span>}
                    </td>

                    <td className="px-4 py-3">
                      <UserStatusToggle
                        user={u}
                        currentUser={currentUser}
                        onUpdated={(id, active) => setUsers(rows => rows.map(item => item.id === id ? { ...item, active } : item))}
                      />
                    </td>
                    <td className="px-4 py-3">
                      {canEditUsers && !isSameUser(currentUser, u) && !isSuperAdmin(u) && (
                      <button
                        onClick={async () => {
                          if (
                            !confirm(
                              `PERMANENTLY delete ${u.name}? This cannot be undone.`
                            )
                          )
                            return;

                          await deleteUserFn({ id: u.id });

                          // Remove immediately from UI
                          setUsers(users =>
                            users.filter(x => x.id !== u.id)
                          );
                        }}
                        className="text-red-600 hover:text-red-700"
                        title="Delete user"
                      >
                        <Trash2 size={16} />
                      </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* CARD VIEW */}
        {view === "card" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {filteredUsers.map(u => (
              <div
                key={u.id}
                className="border border-gray-100 rounded-xl bg-white p-4 hover:bg-gray-50/50"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{u.name}</p>
                    <p className="text-xs text-gray-500">{u.email}</p>
                  </div>

                  <input
                    type="checkbox"
                    disabled={!canEditUsers || isSameUser(currentUser, u) || isSuperAdmin(u)}
                    checked={selected.includes(u.id)}
                    onChange={e =>
                      setSelected(s =>
                        e.target.checked
                          ? [...s, u.id]
                          : s.filter(id => id !== u.id)
                      )
                    }
                  />
                </div>

                <p className="mt-3 text-xs text-gray-500">
                  Team: <span className="font-medium text-gray-700">{getUserTeamName(u) || "Not assigned"}</span>
                </p>

                <div className="mt-3 flex justify-between items-center">
                  <RoleChip label={u.role} />
                  <UserStatusToggle
                    user={u}
                    currentUser={currentUser}
                    onUpdated={(id, active) => setUsers(rows => rows.map(item => item.id === id ? { ...item, active } : item))}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </AdminGuard>
  );
}
