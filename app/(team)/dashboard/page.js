"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";

import {
  LogOut,
  Shield,
  CalendarCheck,
  Sparkles,
  UserRound,
  LayoutDashboard
} from "lucide-react";

import TeamDashboardGraph from "@/components/team/TeamDashboardGraph";

/* =========================
   HELPERS
========================= */
function getInitials(user) {
  const name = user?.displayName || user?.name || user?.email || "User";

  if (name.includes("@")) {
    return name[0]?.toUpperCase() || "U";
  }

  const parts = name.trim().split(" ").filter(Boolean);

  if (parts.length === 1) {
    return parts[0]?.slice(0, 2).toUpperCase() || "U";
  }

  return `${parts[0]?.[0] || ""}${parts[1]?.[0] || ""}`.toUpperCase();
}

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function HeaderAction({
  icon: Icon,
  label,
  onClick,
  variant = "default",
  title
}) {
  const desktopClasses =
    variant === "primary"
      ? "bg-white text-blue-700 hover:bg-blue-50 shadow-sm"
      : variant === "admin"
      ? "bg-red-50 text-red-700 border border-red-100 hover:bg-red-100"
      : "bg-white/10 text-white border border-white/20 hover:bg-white/20";

  const mobileClasses =
    variant === "primary"
      ? "bg-white text-blue-700"
      : variant === "admin"
      ? "bg-red-50 text-red-700 border border-red-100"
      : "bg-white/10 text-white border border-white/20";

  return (
    <>
      <button
        onClick={onClick}
        className={`hidden md:flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-semibold transition ${desktopClasses}`}
      >
        <Icon className="w-4 h-4" />
        {label}
      </button>

      <button
        onClick={onClick}
        title={title || label}
        className={`flex md:hidden h-10 w-10 items-center justify-center rounded-full transition ${mobileClasses}`}
      >
        <Icon className="w-5 h-5" />
      </button>
    </>
  );
}

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const displayName =
    user?.displayName || user?.name || user?.email || "Team Member";

  const initials = useMemo(() => getInitials(user), [user]);

  const isAdmin = useMemo(() => {
    return (
      user?.isAdmin === true ||
      user?.role === "admin" ||
      user?.role === "ADMIN" ||
      user?.role === "super_admin"
    );
  }, [user]);

  const roleLabel = useMemo(() => {
    if (user?.role) {
      return String(user.role)
        .replaceAll("_", " ")
        .replace(/\b\w/g, char => char.toUpperCase());
    }

    return isAdmin ? "Admin" : "Team Member";
  }, [user?.role, isAdmin]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  const logout = useCallback(async () => {
    await signOut(auth);
    router.replace("/login");
  }, [router]);

  if (loading || !user) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-4 md:p-6">
        <div className="w-full max-w-7xl mx-auto space-y-5">
          <div className="h-40 rounded-3xl bg-white border border-slate-200 shadow-sm animate-pulse" />

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="h-28 rounded-2xl bg-white border border-slate-200 animate-pulse" />
            <div className="h-28 rounded-2xl bg-white border border-slate-200 animate-pulse" />
            <div className="h-28 rounded-2xl bg-white border border-slate-200 animate-pulse" />
            <div className="h-28 rounded-2xl bg-white border border-slate-200 animate-pulse" />
          </div>

          <div className="h-80 rounded-3xl bg-white border border-slate-200 animate-pulse" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#eff6ff_0%,#f8fafc_36%,#f8fafc_100%)] px-3 py-3 md:px-6 md:py-6">
      <div className="w-full max-w-7xl mx-auto space-y-5">

        {/* ================= HEADER ================= */}
        <section className="overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-sm">

          <div className="relative bg-gradient-to-r from-blue-700 via-indigo-700 to-sky-600 px-4 py-5 md:px-6 md:py-6">
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,_white,_transparent_35%)]" />

            <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">

              {/* LEFT */}
              <div className="flex items-start gap-3 md:gap-4">
                <div className="h-12 w-12 md:h-14 md:w-14 rounded-2xl bg-white/15 border border-white/20 text-white flex items-center justify-center shadow-sm">
                  <LayoutDashboard className="w-6 h-6 md:w-7 md:h-7" />
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/15 border border-white/20 px-2.5 py-1 text-[11px] font-medium text-blue-50">
                      <Sparkles className="w-3.5 h-3.5" />
                      Team Workspace
                    </span>

                    <span className="inline-flex items-center rounded-full bg-emerald-400/20 border border-emerald-200/30 px-2.5 py-1 text-[11px] font-medium text-emerald-50">
                      Active
                    </span>
                  </div>

                  <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
                    Team Dashboard
                  </h1>

                  <p className="mt-1 text-sm text-blue-50/90">
                    {getGreeting()}, {displayName}
                  </p>

                  <p className="hidden md:block mt-1 text-sm text-blue-100">
                    Your daily command center for follow-ups, attendance, meetings and lead activity.
                  </p>
                </div>
              </div>

              {/* RIGHT */}
              <div className="flex items-center justify-between md:justify-end gap-2">
                <div className="flex items-center gap-2">
                  <HeaderAction
                    icon={CalendarCheck}
                    label="Mark Attendance"
                    variant="primary"
                    onClick={() => router.push("/attendance")}
                  />

                  {isAdmin && (
                    <HeaderAction
                      icon={Shield}
                      label="Admin"
                      variant="admin"
                      title="Admin Dashboard"
                      onClick={() => router.push("/admin")}
                    />
                  )}

                  <HeaderAction
                    icon={LogOut}
                    label="Logout"
                    onClick={logout}
                  />
                </div>

                <div className="hidden sm:flex items-center gap-3 rounded-2xl bg-white/10 border border-white/20 px-3 py-2">
                  <div className="h-9 w-9 rounded-full bg-white text-blue-700 flex items-center justify-center text-xs font-bold shadow-sm">
                    {initials}
                  </div>

                  <div className="min-w-0">
                    <p className="max-w-40 truncate text-xs font-semibold text-white">
                      {displayName}
                    </p>
                    <p className="text-[11px] text-blue-100">
                      {roleLabel}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* MOBILE USER STRIP */}
          <div className="sm:hidden px-4 py-3 border-t border-blue-50 bg-white">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                {initials}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {displayName}
                </p>
                <p className="text-xs text-slate-500">
                  {roleLabel}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ================= DASHBOARD ================= */}
        <TeamDashboardGraph />

      </div>
    </main>
  );
}