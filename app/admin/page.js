// admin/page.js

"use client";

import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { logout } from "@/lib/logout";
import AdminDashboardGraph from "./dashboard/page";

export default function AdminDashboard() {
  const { user, loading } = useAuth(true);
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/admin/login");
    }
  }, [loading, user, router]);

  if (loading) return <p className="p-6">Loading…</p>;
  if (!user) return null;

  return (
    // <main className="p-6">
      <AdminDashboardGraph />
    // </main>
  );
}
