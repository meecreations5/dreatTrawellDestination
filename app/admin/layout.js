"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminTopBar from "@/components/admin/AdminTopBar";
import AdminBreadcrumb from "@/components/admin/AdminBreadcrumb";
import AdminScopeProvider from "@/components/admin/AdminScopeProvider";
import AdminGlobalScopeBar from "@/components/admin/AdminGlobalScopeBar";
import { useAuth } from "@/hooks/useAuth";
import {
  canAccess,
  canEnterAdminArea,
  getRequiredPermissionForPath
} from "@/lib/rolePermissions";

export default function AdminLayout({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const requiredPermission = getRequiredPermissionForPath(pathname || "", { admin: true });
  const hasAdminAccess = canEnterAdminArea(user);
  const hasRouteAccess = !requiredPermission || canAccess(user, requiredPermission);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (user.active === false) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const showGlobalScope =
    pathname === "/admin/dashboard" ||
    pathname === "/admin/action-center" ||
    pathname === "/admin/engagements" ||
    pathname === "/admin/meetings" ||
    pathname === "/admin/leads" ||
    pathname === "/admin/leads/dashboard" ||
    pathname === "/admin/travel-agents" ||
    pathname === "/admin/travel-agents/dashboard" ||
    pathname === "/admin/travel-agents/assigned";

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-medium text-slate-500 shadow-sm">
          Redirecting...
        </div>
      </main>
    );
  }

  if (!hasAdminAccess || !hasRouteAccess) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md rounded-3xl border border-amber-100 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">Permission Required</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Your effective Role & Access settings do not allow this admin route.
          </p>
          <button
            type="button"
            onClick={() => router.replace("/dashboard")}
            className="mt-6 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
          >
            Return to Team Dashboard
          </button>
        </div>
      </main>
    );
  }

  return (
    <AdminScopeProvider>
      <section className="min-h-screen bg-slate-50">
        <AdminSidebar
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          mobileOpen={mobileOpen}
          setMobileOpen={setMobileOpen}
        />

        {mobileOpen ? (
          <button
            type="button"
            aria-label="Close admin navigation"
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 z-30 bg-slate-950/35 backdrop-blur-[1px] lg:hidden"
          />
        ) : null}

        <AdminTopBar collapsed={collapsed} onMenuClick={() => setMobileOpen(true)} />

        <main
          className={`
            min-h-screen bg-slate-50
            pt-[84px] transition-[margin] duration-300 lg:pt-[96px]
            ${collapsed ? "lg:ml-[96px]" : "lg:ml-[320px]"}
          `}
        >
          <div className="px-4 pt-1 sm:px-6 lg:px-6">
            <AdminBreadcrumb />
          </div>
          {showGlobalScope ? <AdminGlobalScopeBar /> : null}
          {children}
        </main>
      </section>
    </AdminScopeProvider>
  );
}
