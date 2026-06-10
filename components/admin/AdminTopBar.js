"use client";

import { LogOut, Shield, Crown, UserCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { getAuth, signOut } from "firebase/auth";

export default function AdminTopBar({ collapsed }) {
  const { user } = useAuth();
  const router = useRouter();
  const auth = getAuth();

  if (!user) return null;

  const isSuperAdmin =
    user?.role === "super_admin" || user?.isSuperAdmin === true;

  const isAdmin =
    isSuperAdmin ||
    user?.role === "admin" ||
    user?.isAdmin === true;

  const roleLabel = isSuperAdmin
    ? "Super Admin"
    : isAdmin
    ? "Admin"
    : formatRole(user?.role);

  const roleBadgeClass = isSuperAdmin
    ? "bg-purple-100 text-purple-700"
    : "bg-blue-100 text-blue-700";

  const RoleIcon = isSuperAdmin ? Crown : Shield;

  const handleLogout = async () => {
    await signOut(auth);
    router.replace("/admin/login");
  };

  return (
    <header
      className={`
        fixed top-4 right-4 z-20
        h-14
        flex items-center justify-between
        rounded-2xl bg-[#f9fafb]
        px-6
        shadow-[0_10px_30px_rgba(0,0,0,0.06)]
        transition-all duration-300
        ${collapsed ? "left-[96px]" : "left-[320px]"}
      `}
    >
      {/* LEFT */}
      <div className="flex items-center gap-3">
        <div
          className={`
            flex h-9 w-9 items-center justify-center
            rounded-xl text-white
            ${isSuperAdmin ? "bg-purple-600" : "bg-blue-600"}
          `}
        >
          {isSuperAdmin ? (
            <Crown size={18} />
          ) : (
            <Shield size={18} />
          )}
        </div>

        <div className="leading-tight">
          <p className="text-sm font-medium text-gray-800">
            Admin Console
          </p>
          <p className="text-xs text-gray-500">
            {isSuperAdmin
              ? "Full System Control"
              : "Module Based Access"}
          </p>
        </div>
      </div>

      {/* RIGHT */}
      <div className="flex items-center gap-6">
        {/* ROLE BADGE */}
        <div
          className={`
            flex items-center gap-2 rounded-full
            px-3 py-1 text-xs font-medium
            ${roleBadgeClass}
          `}
        >
          <RoleIcon size={14} />
          {roleLabel}
        </div>

        {/* USER */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div
              className={`
                flex h-9 w-9 items-center justify-center
                rounded-full text-xs font-semibold uppercase text-white
                ${isSuperAdmin ? "bg-purple-600" : "bg-blue-600"}
              `}
            >
              {getInitials(user?.name || user?.email || "AD")}
            </div>

            <span
              className={`
                absolute -bottom-0.5 -right-0.5
                h-2.5 w-2.5 rounded-full
                border-2 border-white
                ${user?.active === false ? "bg-red-500" : "bg-emerald-500"}
              `}
            />
          </div>

          <div className="leading-tight">
            <p className="text-sm font-medium text-gray-800">
              {user?.name || "Admin"}
            </p>
            <p className="max-w-[220px] truncate text-xs text-gray-500">
              {user?.email}
            </p>
          </div>
        </div>

        {/* LOGOUT */}
        <button
          type="button"
          onClick={handleLogout}
          className="
            flex items-center gap-2
            text-sm text-gray-500
            transition hover:text-red-600
          "
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </header>
  );
}

/* =========================
   HELPERS
========================= */

function getInitials(value = "") {
  return value
    .split(" ")
    .filter(Boolean)
    .map((v) => v[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatRole(role = "") {
  if (!role) return "User";

  return role
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}