"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import AdminGuard from "@/components/AdminGuard";
import { useAuth } from "@/hooks/useAuth";

export default function AdminIndexPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading || !user) return;

    const isSuperAdmin =
      user.role === "super_admin" ||
      user.isSuperAdmin === true;

    if (isSuperAdmin) {
      router.replace("/admin/dashboard");
    } else {
      router.replace("/admin/travel-agents");
    }
  }, [user, loading, router]);

  return (
    <AdminGuard>
      <main className="min-h-screen bg-gray-50 p-6 text-sm text-gray-500">
        Redirecting...
      </main>
    </AdminGuard>
  );
}