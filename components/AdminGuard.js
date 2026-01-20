"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { TableSkeleton } from "@/components/ui/TableSkeleton";

export default function AdminGuard({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // still resolving auth
    if (loading) return;

    // not logged in → redirect
    if (!user) {
      router.replace("/admin/login");
      return;
    }

    // logged in but not admin → deny
    if (!user.isAdmin) {
      setReady(true);
      return;
    }

    // admin user → allow
    setReady(true);
  }, [user, loading, router]);

  function SkeletonCard() {
    return (
      <div className="bg-white p-5 rounded-lg shadow-mui animate-pulse space-y-3">
        <div className="h-4 bg-gray-200 rounded w-1/3" />
        <div className="h-9 bg-gray-200 rounded" />
        <div className="h-9 bg-gray-200 rounded" />
      </div>
    );
  }

  /* =========================
     STATES
  ========================= */

  if (loading || !ready) {
    return <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </main>;
  }

  if (!user?.isAdmin) {
    return (
      <main className="p-6 text-center text-red-600">
        <h1 className="text-lg font-semibold">
          Access Denied
        </h1>
        <p className="text-sm mt-2">
          You do not have permission to view this page.
        </p>
      </main>
    );
  }

  return children;
}
