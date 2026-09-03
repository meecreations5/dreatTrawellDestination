"use client";

import { Crown, LogOut, Menu, Shield } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { getAuth, signOut } from "firebase/auth";
import { getRoleLabel } from "@/lib/rolePermissions";

export default function AdminTopBar({ collapsed, onMenuClick }) {
  const { user } = useAuth();
  const router = useRouter();
  const auth = getAuth();

  if (!user) return null;

  const isSuperAdmin =
    user?.role === "super_admin" || user?.isSuperAdmin === true;

  const isAdmin =
    isSuperAdmin || user?.role === "admin" || user?.isAdmin === true;

  const roleLabel = isSuperAdmin
    ? "Super Admin"
    : isAdmin
    ? "Admin"
    : getRoleLabel(user?.role);

  const roleBadgeClass = isSuperAdmin
    ? "bg-purple-100 text-purple-700"
    : "bg-blue-100 text-blue-700";

  const RoleIcon = isSuperAdmin ? Crown : Shield;

  const handleLogout = async () => {
    await signOut(auth);
    router.replace("/login");
  };

  return (
    <header
      className={`
        fixed left-3 right-3 top-3 z-30 flex h-16 items-center justify-between
        rounded-2xl border border-white/70 bg-white/90 px-3 shadow-[0_10px_30px_rgba(15,23,42,0.08)]
        backdrop-blur-xl transition-all duration-300 sm:px-4 lg:right-4 lg:top-4 lg:h-14 lg:px-6
        ${collapsed ? "lg:left-[96px]" : "lg:left-[320px]"}
      `}
    >
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open admin navigation"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 lg:hidden"
        >
          <Menu size={20} />
        </button>

        <div
          className={`
            hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white sm:flex
            ${isSuperAdmin ? "bg-purple-600" : "bg-blue-600"}
          `}
        >
          <RoleIcon size={18} />
        </div>

        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-semibold text-gray-900">
            Admin Console
          </p>
          <p className="hidden truncate text-xs text-gray-500 sm:block">
            {isSuperAdmin ? "Full System Control" : "Module Based Access"}
          </p>
        </div>
      </div>

      <div className="flex min-w-0 items-center gap-2 sm:gap-3 lg:gap-5">
        <div
          className={`hidden items-center gap-2 rounded-full px-3 py-1 text-xs font-medium md:flex ${roleBadgeClass}`}
        >
          <RoleIcon size={14} />
          {roleLabel}
        </div>

        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <div className="relative shrink-0">
            <div
              className={`
                flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold uppercase text-white
                ${isSuperAdmin ? "bg-purple-600" : "bg-blue-600"}
              `}
            >
              {getInitials(user?.name || user?.email || "AD")}
            </div>

            <span
              className={`
                absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white
                ${user?.active === false ? "bg-red-500" : "bg-emerald-500"}
              `}
            />
          </div>

          <div className="hidden min-w-0 leading-tight xl:block">
            <p className="max-w-[160px] truncate text-sm font-medium text-gray-800">
              {user?.name || "Admin"}
            </p>
            <p className="max-w-[200px] truncate text-xs text-gray-500">
              {user?.email}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          aria-label="Logout"
          className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-500 transition hover:bg-red-50 hover:text-red-600 lg:h-auto lg:w-auto lg:gap-2 lg:px-2 lg:py-2 lg:text-sm"
        >
          <LogOut size={17} />
          <span className="hidden lg:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}

function getInitials(value = "") {
  const cleaned = String(value || "").trim();

  if (!cleaned) return "AD";

  if (cleaned.includes("@")) {
    return cleaned.slice(0, 2).toUpperCase();
  }

  return cleaned
    .split(" ")
    .filter(Boolean)
    .map(v => v[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatRole(role = "") {
  if (!role) return "User";

  return role
    .replaceAll("_", " ")
    .replace(/\b\w/g, char => char.toUpperCase());
}
