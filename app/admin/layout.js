"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminTopBar from "@/components/admin/AdminTopBar";
import AdminBreadcrumb from "@/components/admin/AdminBreadcrumb";
import { useAuth } from "@/hooks/useAuth";

export const dynamic = "force-dynamic";

export default function AdminLayout({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const isLoginPage = pathname === "/admin/login";

  useEffect(() => {
    // 🔥 DO NOT GUARD LOGIN PAGE
    if (isLoginPage) return;

    if (loading) return;

    if (!user) {
      router.replace("/admin/login");
      return;
    }

    if (!user.isAdmin) {
      router.replace("/admin/dashboard");
    }
  }, [user, loading, isLoginPage, router]);

  // ✅ Allow login page to render freely
  if (isLoginPage) {
    return <>{children}</>;
  }

  // ⛔ Guard all other admin routes
  if (loading || !user || !user.isAdmin) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500">Redirecting…</p>
      </main>
    );
  }

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
