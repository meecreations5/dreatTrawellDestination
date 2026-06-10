"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { ArrowLeft, Lock, ShieldAlert } from "lucide-react";

export default function AdminGuard({ children, permission }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  const isSuperAdmin =
    user?.role === "super_admin" || user?.isSuperAdmin === true;

  const isAdmin =
    isSuperAdmin ||
    user?.role === "admin" ||
    user?.isAdmin === true;

  const hasPermission =
    isSuperAdmin ||
    !permission ||
    user?.permissions?.[permission] === true;

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/admin/login");
      return;
    }

    if (user.active === false) {
      router.replace("/admin/login");
      return;
    }

    setReady(true);
  }, [user, loading, router]);

  function SkeletonCard() {
    return (
      <div className="animate-pulse rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 h-4 w-1/3 rounded bg-gray-200" />
        <div className="space-y-3">
          <div className="h-10 rounded-xl bg-gray-100" />
          <div className="h-10 rounded-xl bg-gray-100" />
          <div className="h-10 rounded-xl bg-gray-100" />
        </div>
      </div>
    );
  }

  if (loading || !ready) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-6xl space-y-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-md rounded-3xl border border-red-100 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <ShieldAlert className="h-7 w-7" />
          </div>

          <h1 className="text-xl font-semibold text-gray-900">
            Access Denied
          </h1>

          <p className="mt-2 text-sm leading-6 text-gray-500">
            You do not have admin access to view this page.
          </p>

          <button
            type="button"
            onClick={() => router.replace("/dashboard")}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Go to Dashboard
          </button>
        </div>
      </main>
    );
  }

  if (!hasPermission) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-md rounded-3xl border border-amber-100 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <Lock className="h-7 w-7" />
          </div>

          <h1 className="text-xl font-semibold text-gray-900">
            Permission Required
          </h1>

          <p className="mt-2 text-sm leading-6 text-gray-500">
            Your role does not have permission to access this module.
          </p>

          <button
            type="button"
            onClick={() => router.replace("/admin")}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Admin Area
          </button>
        </div>
      </main>
    );
  }

  return children;
}