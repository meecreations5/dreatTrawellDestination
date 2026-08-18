"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X
} from "lucide-react";
import { useMemo, useState } from "react";

import { useAuth } from "@/hooks/useAuth";
import { adminSidebar } from "@/config/adminSidebar";
import { canAccess } from "@/lib/rolePermissions";

export default function AdminSidebar({
  collapsed,
  setCollapsed,
  mobileOpen = false,
  setMobileOpen
}) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [open, setOpen] = useState({});

  const toggleGroup = label => {
    setOpen(prev => ({
      ...prev,
      [label]: !prev[label]
    }));
  };

  const visibleSidebar = useMemo(() => {
    if (loading || !user) return [];

    return adminSidebar
      .map(item => {
        const hasChildren =
          Array.isArray(item.children) && item.children.length > 0;

        if (hasChildren) {
          const visibleChildren = item.children.filter(child => {
            if (!child.permission) return true;
            return canAccess(user, child.permission);
          });

          if (visibleChildren.length === 0) return null;

          return {
            ...item,
            children: visibleChildren
          };
        }

        if (!item.permission) return item;

        return canAccess(user, item.permission) ? item : null;
      })
      .filter(Boolean);
  }, [user, loading]);

  const closeMobile = () => setMobileOpen?.(false);

  return (
    <aside
      className={`
        fixed bottom-0 left-0 top-0 z-40
        flex w-[280px] flex-col justify-between
        bg-white shadow-2xl
        transition-all duration-300
        ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:bottom-4 lg:left-4 lg:top-4 lg:translate-x-0 lg:rounded-2xl lg:shadow-[0_10px_30px_rgba(0,0,0,0.06)]
        ${collapsed ? "lg:w-[72px]" : "lg:w-[280px]"}
      `}
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-4">
        <div className="relative flex justify-center border-b border-slate-100 pb-4 lg:border-b-0">
          <Image
            src="/logo.png"
            alt="DreamTrawell"
            priority
            width={80}
            height={80}
            className={collapsed ? "lg:h-12 lg:w-12" : ""}
          />

          <button
            type="button"
            aria-label="Close navigation"
            onClick={closeMobile}
            className="absolute right-0 top-0 flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 lg:hidden"
          >
            <X size={18} />
          </button>
        </div>

        {!collapsed ? (
          <div className="mt-4 hidden px-2 lg:block">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Admin Workspace
            </p>
          </div>
        ) : null}

        <nav className="mt-3 space-y-2 pb-6">
          {visibleSidebar.map(item => {
            const Icon = item.icon;
            const hasChildren =
              Array.isArray(item.children) && item.children.length > 0;

            const isActive = item.href && pathname.startsWith(item.href);

            const isChildActive =
              hasChildren &&
              item.children.some(child => pathname.startsWith(child.href));

            const active = isActive || isChildActive;

            return (
              <div key={item.label}>
                {item.href ? (
                  <Link
                    href={item.href}
                    onClick={closeMobile}
                    className={rootItemClass(active)}
                  >
                    <IconBlock
                      icon={<Icon size={20} strokeWidth={1.75} />}
                      active={active}
                    />

                    <span className="ml-3 text-sm font-medium lg:hidden">
                      {item.label}
                    </span>

                    {!collapsed && (
                      <span className="ml-3 hidden text-sm font-medium lg:inline">
                        {item.label}
                      </span>
                    )}

                    {collapsed && <Tooltip label={item.label} />}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (!collapsed || !window.matchMedia("(min-width: 1024px)").matches) {
                        toggleGroup(item.label);
                      }
                    }}
                    className={rootItemClass(active)}
                  >
                    <IconBlock
                      icon={<Icon size={20} strokeWidth={1.75} />}
                      active={active}
                    />

                    <span className="ml-3 flex-1 text-left text-sm font-medium lg:hidden">
                      {item.label}
                    </span>

                    {!collapsed && (
                      <>
                        <span className="ml-3 hidden flex-1 text-left text-sm font-medium lg:block">
                          {item.label}
                        </span>

                        <ChevronDown
                          size={16}
                          className={`hidden transition lg:block ${
                            open[item.label] || active ? "rotate-180" : ""
                          }`}
                        />
                      </>
                    )}

                    <ChevronDown
                      size={16}
                      className={`transition lg:hidden ${
                        open[item.label] || active ? "rotate-180" : ""
                      }`}
                    />

                    {collapsed && <Tooltip label={item.label} />}
                  </button>
                )}

                {hasChildren &&
                  (open[item.label] || active) && (
                    <div
                      className={`mt-1 space-y-1 ${
                        collapsed ? "ml-11 lg:hidden" : "ml-11"
                      }`}
                    >
                      {item.children.map(child => {
                        const ChildIcon = child.icon;
                        const childActive = pathname.startsWith(child.href);

                        return (
                          <Link
                            key={child.label}
                            href={child.href}
                            onClick={closeMobile}
                            className={`
                              flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition
                              ${
                                childActive
                                  ? "bg-blue-100 text-blue-700"
                                  : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                              }
                            `}
                          >
                            <ChildIcon size={16} />
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
              </div>
            );
          })}

          {!loading && visibleSidebar.length === 0 && !collapsed && (
            <div className="rounded-xl bg-gray-50 px-3 py-4 text-center text-xs text-gray-500">
              No menu access assigned.
            </div>
          )}
        </nav>
      </div>

      <div className="hidden space-y-3 border-t border-slate-100 px-3 py-4 lg:block">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="mx-auto flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-gray-100 hover:text-slate-800"
        >
          {collapsed ? (
            <ChevronRight size={18} />
          ) : (
            <ChevronLeft size={18} />
          )}
        </button>
      </div>
    </aside>
  );
}

function rootItemClass(active) {
  return `
    group relative flex min-h-11 w-full items-center rounded-xl px-3
    transition-all duration-200
    ${
      active
        ? "bg-blue-100 text-blue-700"
        : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
    }
  `;
}

function IconBlock({ icon, active }) {
  return (
    <div
      className={`
        flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition
        ${
          active
            ? "text-blue-600"
            : "text-gray-400 group-hover:text-gray-600"
        }
      `}
    >
      {icon}
    </div>
  );
}

function Tooltip({ label }) {
  return (
    <span
      className="
        pointer-events-none absolute left-full z-50 ml-3 hidden
        whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-xs text-white
        opacity-0 shadow-lg transition group-hover:opacity-100 lg:block
      "
    >
      {label}
    </span>
  );
}
