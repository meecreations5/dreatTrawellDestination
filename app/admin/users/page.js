"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  updateDoc,
  doc
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { LayoutGrid, List, Download, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import AdminGuard from "@/components/AdminGuard";
import PageSkeleton from "@/components/ui/PageSkeleton";
import { getFunctions, httpsCallable } from "firebase/functions";
/* =========================
   UI ATOMS
========================= */

const RoleChip = ({ label }) => (
  <span className="px-2 py-[2px] rounded-md text-[11px] bg-gray-100 text-gray-700">
    {label}
  </span>
);

const UserStatusToggle = ({ user }) => (
  <button
    onClick={async () => {
      await updateDoc(doc(db, "users", user.id), {
        active: !user.active
      });
    }}
    className={`text-xs px-2 py-1 rounded-md border
      ${user.active
        ? "bg-green-50 text-green-700 border-green-200"
        : "bg-gray-100 text-gray-600 border-gray-200"
      }`}
  >
    {user.active ? "Active" : "Inactive"}
  </button>
);


const deleteUserFn = httpsCallable(
  getFunctions(),
  "deleteUser"
);

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
    "Active"
  ];

  const rows = users.map(u => [
    u.name || "",
    u.email || "",
    u.employeeId || "",
    u.role || "",
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
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [view, setView] = useState("table");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [selected, setSelected] = useState([]);

  const router = useRouter(); // ✅ ADD THIS


  const functions = getFunctions();
  const deleteUserFn = httpsCallable(functions, "deleteUser");

  /* =========================
     LOAD USERS
  ========================= */
  useEffect(() => {
    getDocs(collection(db, "users")).then(snap => {
      setUsers(
        snap.docs.map(d => ({
          id: d.id,
          ...d.data()
        }))
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
        !u.employeeId?.toLowerCase().includes(s)
      ) {
        return false;
      }

      if (role !== "all" && u.role !== role) {
        return false;
      }

      return true;
    });
  }, [users, search, role]);

  /* =========================
     BULK ACTIONS
  ========================= */
  const bulkUpdateStatus = async active => {
    for (const id of selected) {
      await updateDoc(doc(db, "users", id), { active });
    }

    setUsers(u =>
      u.map(user =>
        selected.includes(user.id)
          ? { ...user, active }
          : user
      )
    );

    setSelected([]);
  };

  /* =========================
     STATES
  ========================= */
  if (loading) return <PageSkeleton lines={6} />;

  return (
    <AdminGuard>
      <main className="p-6 w-full mx-auto space-y-4">

        <h1 className="text-xl font-semibold">
          Team Management
        </h1>

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
                placeholder="Search name, email, employee ID"
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
            </div>

            {/* RIGHT ACTIONS */}
            <div className="flex items-center gap-2">

              {selected.length > 0 && (
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

                    <td className="px-4 py-3">
                      <UserStatusToggle user={u} />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={async () => {
                          if (
                            !confirm(
                              `PERMANENTLY delete ${u.name}? This cannot be undone.`
                            )
                          )
                            return;

                          await deleteUserFn({ uid: u.id });

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

                <div className="mt-3 flex justify-between items-center">
                  <RoleChip label={u.role} />
                  <UserStatusToggle user={u} />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </AdminGuard>
  );
}
