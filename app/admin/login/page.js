"use client";

import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AdminLoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user?.isAdmin) {
      router.replace("/admin");
    }
  }, [user, loading, router]);

  if (loading) return <p className="p-6">Loading…</p>;

  return <div>Admin Login UI</div>;
}
