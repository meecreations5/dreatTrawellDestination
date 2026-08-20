"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import AdminGuard from "@/components/AdminGuard";
import { useAuth } from "@/hooks/useAuth";
import { getAdminLandingPathForRole } from "@/lib/rolePermissions";

export default function AdminIndexPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading || !user) return;

    router.replace(getAdminLandingPathForRole(user.role));
  }, [user, loading, router]);

  return (
    <AdminGuard>
      <main className="min-h-screen bg-gray-50 p-6 text-sm text-gray-500">
        Redirecting...
      </main>
    </AdminGuard>
  );
}