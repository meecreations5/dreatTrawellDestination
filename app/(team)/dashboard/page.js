"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";

import {
  LogOut,
  Shield,
  CalendarCheck
} from "lucide-react";

import TeamDashboardGraph from "@/components/team/TeamDashboardGraph";

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  /* =========================
     AUTH GUARD
  ========================== */
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return <p className="p-6">Loading…</p>;
  }

  const logout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-4 md:p-6">
      <div className="w-full max-w-7xl mx-auto">

        {/* ================= HEADER ================= */}
        <div className="mb-4 md:mb-6">
          <div className="w-full bg-white rounded-xl shadow-sm px-4 py-4 md:px-6 md:py-4">

            <div className="flex items-center justify-between">

              {/* LEFT */}
              <div className="flex items-center gap-3 md:gap-4">
                <div className="h-9 w-9 md:h-10 md:w-10 rounded-full
                                bg-blue-100 text-blue-600
                                flex items-center justify-center font-semibold">
                  T
                </div>

                <div>
                  <h1 className="text-base md:text-lg font-semibold text-gray-900">
                    Team Dashboard
                  </h1>
                  <p className="hidden md:block text-sm text-gray-500">
                    Execution & follow-up overview
                  </p>
                </div>
              </div>

              {/* RIGHT */}
              <div className="flex items-center gap-2 md:gap-3">

                {/* ================= ATTENDANCE ================= */}
                {/* Desktop */}
                <button
                  onClick={() => router.push("/attendance")}
                  className="hidden md:flex items-center gap-1.5 px-3 py-1.5
                             rounded-full text-xs font-medium
                             bg-blue-600 text-white
                             hover:bg-blue-700 transition"
                >
                  <CalendarCheck className="w-4 h-4" />
                  Mark Attendance
                </button>

                {/* Mobile */}
                <button
                  onClick={() => router.push("/attendance")}
                  className="flex md:hidden h-9 w-9 items-center justify-center
                             rounded-full bg-blue-600 text-white
                             hover:bg-blue-700 transition"
                  title="Mark Attendance"
                >
                  <CalendarCheck className="w-5 h-5" />
                </button>

                {/* ================= ADMIN ================= */}
                {user.isAdmin && (
                  <>
                    {/* Desktop */}
                    <button
                      onClick={() => router.push("/admin")}
                      className="hidden md:flex items-center gap-1 px-3 py-1.5
                                 rounded-full text-xs font-medium
                                 bg-red-50 text-red-600
                                 border border-red-100
                                 hover:bg-red-100 transition"
                    >
                      <Shield className="w-4 h-4" />
                      Admin
                    </button>

                    {/* Mobile */}
                    <button
                      onClick={() => router.push("/admin")}
                      className="flex md:hidden h-9 w-9 items-center justify-center
                                 rounded-full bg-red-50 text-red-600
                                 border border-red-100
                                 hover:bg-red-100 transition"
                      title="Admin Dashboard"
                    >
                      <Shield className="w-5 h-5" />
                    </button>
                  </>
                )}

                {/* ================= USER AVATAR ================= */}
                <div className="h-8 w-8 rounded-full bg-gray-200
                                flex items-center justify-center
                                text-xs font-semibold text-gray-700">
                  {user.displayName?.[0] || "U"}
                </div>

                {/* ================= LOGOUT ================= */}
                {/* Desktop */}
                <button
                  onClick={logout}
                  className="hidden md:flex items-center gap-1.5 px-3 py-1.5
                             rounded-full text-xs font-medium
                             text-gray-600 
                             hover:bg-red-50 hover:text-red-600 transition"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>

                {/* Mobile */}
                <button
                  onClick={logout}
                  className="flex md:hidden h-9 w-9 items-center justify-center
                             rounded-full text-gray-400
                             hover:text-red-600 hover:bg-red-50 transition"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>

              </div>
            </div>
          </div>
        </div>

        {/* ================= DASHBOARD ================= */}
        <TeamDashboardGraph />

      </div>
    </main>
  );
}
