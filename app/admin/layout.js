export const dynamic = "force-dynamic";
"use client";

import { useState } from "react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminTopBar from "@/components/admin/AdminTopBar";
import AdminBreadcrumb from "@/components/admin/AdminBreadcrumb";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AdminLayout({ children }) {
  const { user, loading } = useAuth(true);
  const router = useRouter();

  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    if (user && !user.isAdmin) router.replace("/dashboard");
  }, [user, loading, router]);

  if (loading || !user || !user.isAdmin) return null;

  return (
    <section>
      <AdminSidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
      />

      <AdminTopBar collapsed={collapsed} />

      <main
        className={`
          transition-all duration-300
          pt-[96px]
          ${collapsed ? "ml-[96px]" : "ml-[320px]"}
        `}
      >
        <AdminBreadcrumb />
        {children}
      </main>
    </section>
  );
}
